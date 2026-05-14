// Konsolidert økonomi for Oversikt.
// Leser family economy-viewene fra Business/RealtyFlow-klienten, ikke FamilyHub-user schema.
// Hvis viewene ikke finnes i aktuell deploy, faller tjenesten stille tilbake til live summer.

import { supabase, supabasePublic, isRealtyflowSupabaseConfigured } from '../supabase';
import { fetchRealtyflowCommissions } from './realtyflowService';
import { fetchDonaAnnaSummary } from './donaAnnaService';
import { canAccessBusiness } from '../config/productMode';
import { getEurToNokRate } from './fxService';

export interface MonthlyEconomyRow {
  month: string;
  oliviaNetNok: number;
  realtyflowNetNok: number;
  mondeoInterestNok: number;
  mondeoPaidNok: number;
  totalNetNok: number;
}

export interface EconomySummary {
  rows: MonthlyEconomyRow[];
  ytd: {
    oliviaNet: number;
    realtyflowNet: number;
    mondeoInterest: number;
    totalNet: number;
  };
  lastMonth: MonthlyEconomyRow | null;
}

const emptySummary = (): EconomySummary => ({ rows: [], ytd: { oliviaNet: 0, realtyflowNet: 0, mondeoInterest: 0, totalNet: 0 }, lastMonth: null });

function numberValue(value: any): number {
  if (value === undefined || value === null || value === '') return 0;
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  return Number(String(value).replace(/\s/g, '').replace(',', '.')) || 0;
}

function first(row: any, keys: string[]): any {
  for (const key of keys) if (row?.[key] !== undefined && row?.[key] !== null && row?.[key] !== '') return row[key];
  return undefined;
}

function monthValue(row: any): string {
  return String(first(row, ['month', 'period', 'date', 'event_date', 'created_at']) || new Date().toISOString()).slice(0, 7) + '-01';
}

function rowAmountNok(row: any, keys: string[], eurNok: number): number {
  const nok = first(row, keys.filter((key) => key.toLowerCase().includes('nok')));
  if (nok !== undefined) return numberValue(nok);
  const eur = first(row, keys.filter((key) => key.toLowerCase().includes('eur')));
  if (eur !== undefined) return numberValue(eur) * eurNok;
  const amount = first(row, keys);
  const currency = String(first(row, ['currency', 'currency_code']) || 'NOK').toUpperCase();
  return currency === 'EUR' ? numberValue(amount) * eurNok : numberValue(amount);
}

async function resolveCurrentEmail(userEmail?: string | null): Promise<string | null> {
  if (userEmail) return userEmail;
  try { const { data } = await supabase.auth.getUser(); return data.user?.email || null; } catch { return null; }
}

function summarizeRows(rows: MonthlyEconomyRow[]): EconomySummary {
  const sorted = rows.sort((a, b) => (a.month < b.month ? -1 : 1));
  const currentYear = new Date().getFullYear();
  const ytd = sorted.filter((r) => new Date(r.month).getFullYear() === currentYear).reduce((acc, r) => ({ oliviaNet: acc.oliviaNet + r.oliviaNetNok, realtyflowNet: acc.realtyflowNet + r.realtyflowNetNok, mondeoInterest: acc.mondeoInterest + r.mondeoInterestNok, totalNet: acc.totalNet + r.totalNetNok }), { oliviaNet: 0, realtyflowNet: 0, mondeoInterest: 0, totalNet: 0 });
  return { rows: sorted, ytd, lastMonth: sorted[sorted.length - 1] ?? null };
}

function mergeMonth(map: Map<string, MonthlyEconomyRow>, month: string, patch: Partial<MonthlyEconomyRow>) {
  const current = map.get(month) || { month, oliviaNetNok: 0, realtyflowNetNok: 0, mondeoInterestNok: 0, mondeoPaidNok: 0, totalNetNok: 0 };
  const next = { ...current, ...patch };
  next.totalNetNok = next.oliviaNetNok + next.realtyflowNetNok + next.mondeoInterestNok;
  map.set(month, next);
}

function isMissingRelation(error: any) {
  const text = `${error?.code || ''} ${error?.message || ''} ${error?.details || ''}`.toLowerCase();
  return text.includes('404') || text.includes('pgrst205') || text.includes('could not find') || text.includes('does not exist') || text.includes('schema cache');
}

async function readBusinessTable(table: string) {
  if (!isRealtyflowSupabaseConfigured()) return [];
  const { data, error } = await supabasePublic.from(table).select('*').limit(2000);
  if (error) {
    if (!isMissingRelation(error)) console.warn(`[familyEconomyService] ${table} error`, error.message || error);
    return [];
  }
  return data || [];
}

async function fetchEconomyViews(eurNok: number): Promise<EconomySummary> {
  const monthMap = new Map<string, MonthlyEconomyRow>();

  const monthly = await readBusinessTable('family_economy_monthly');
  monthly.forEach((r: any) => {
    const month = monthValue(r);
    mergeMonth(monthMap, month, {
      oliviaNetNok: rowAmountNok(r, ['olivia_net_nok', 'olivia_net_eur', 'oliviaNetNok', 'oliviaNetEur'], eurNok),
      realtyflowNetNok: rowAmountNok(r, ['realtyflow_net_nok', 'realtyflow_net_eur', 'realtyflowNetNok', 'realtyflowNetEur'], eurNok),
      mondeoInterestNok: rowAmountNok(r, ['mondeo_interest_nok', 'mondeo_interest_eur', 'mondeoInterestNok', 'mondeoInterestEur'], eurNok),
      mondeoPaidNok: rowAmountNok(r, ['mondeo_paid_nok', 'mondeo_paid_eur', 'mondeoPaidNok', 'mondeoPaidEur'], eurNok),
    });
  });

  const oliviaRows = await readBusinessTable('family_economy_olivia');
  oliviaRows.forEach((r: any) => mergeMonth(monthMap, monthValue(r), { oliviaNetNok: rowAmountNok(r, ['olivia_net_nok', 'net_nok', 'total_nok', 'amount_nok', 'olivia_net_eur', 'net_eur', 'total_eur', 'amount_eur', 'value'], eurNok) }));

  const realtyRows = await readBusinessTable('family_economy_realtyflow');
  realtyRows.forEach((r: any) => mergeMonth(monthMap, monthValue(r), { realtyflowNetNok: rowAmountNok(r, ['realtyflow_net_nok', 'net_nok', 'total_nok', 'amount_nok', 'realtyflow_net_eur', 'net_eur', 'total_eur', 'amount_eur', 'value'], eurNok) }));

  const mondeoRows = await readBusinessTable('family_economy_mondeo');
  mondeoRows.forEach((r: any) => mergeMonth(monthMap, monthValue(r), {
    mondeoInterestNok: rowAmountNok(r, ['mondeo_interest_nok', 'interest_nok', 'rente_nok', 'net_nok', 'amount_nok', 'mondeo_interest_eur', 'interest_eur', 'rente_eur', 'net_eur', 'amount_eur', 'value'], eurNok),
    mondeoPaidNok: rowAmountNok(r, ['mondeo_paid_nok', 'paid_nok', 'payment_nok', 'principal_paid_nok', 'mondeo_paid_eur', 'paid_eur', 'payment_eur', 'principal_paid_eur'], eurNok),
  }));

  const rows = Array.from(monthMap.values()).filter((r) => Math.abs(r.totalNetNok) > 0 || Math.abs(r.mondeoPaidNok) > 0);
  return rows.length === 0 ? emptySummary() : summarizeRows(rows);
}

function buildSingleMonthSummary(oliviaNetNok: number, realtyflowNetNok: number, mondeoInterestNok = 0): EconomySummary {
  const month = new Date().toISOString().slice(0, 7) + '-01';
  return summarizeRows([{ month, oliviaNetNok, realtyflowNetNok, mondeoInterestNok, mondeoPaidNok: 0, totalNetNok: oliviaNetNok + realtyflowNetNok + mondeoInterestNok }]);
}

export async function fetchFamilyEconomy(userId: string, userEmail?: string | null): Promise<EconomySummary> {
  if (!userId) return emptySummary();
  const resolvedEmail = await resolveCurrentEmail(userEmail);
  if (!canAccessBusiness(resolvedEmail)) return emptySummary();

  const fx = await getEurToNokRate();
  const rate = fx.rate || 11.55;
  const view = await fetchEconomyViews(rate);
  const viewHasAnyBusiness = Math.abs(view.ytd.oliviaNet) > 0 || Math.abs(view.ytd.realtyflowNet) > 0 || Math.abs(view.ytd.mondeoInterest) > 0;
  if (view.rows.length > 0 && viewHasAnyBusiness) return view;

  const [realtyflow, olivia] = await Promise.allSettled([fetchRealtyflowCommissions(), fetchDonaAnnaSummary()]);
  const realtyflowNetNok = realtyflow.status === 'fulfilled' ? Number(realtyflow.value.totalNok || 0) : 0;
  const oliviaNetNok = olivia.status === 'fulfilled' ? Number(olivia.value.netEur || 0) * rate : 0;
  return buildSingleMonthSummary(oliviaNetNok, realtyflowNetNok, view.ytd.mondeoInterest || 0);
}
