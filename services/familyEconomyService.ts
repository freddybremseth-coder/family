// Konsolidert økonomi for Oversikt.
// Prøver først family.economy_monthly hvis viewet finnes.
// Hvis viewet mangler eller bare har delvise tall, hentes live summer fra RealtyFlow og Olivia-service.

import { supabase, isSupabaseConfigured } from '../supabase';
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

const emptySummary = (): EconomySummary => ({
  rows: [],
  ytd: { oliviaNet: 0, realtyflowNet: 0, mondeoInterest: 0, totalNet: 0 },
  lastMonth: null,
});

function buildSingleMonthSummary(oliviaNetNok: number, realtyflowNetNok: number, mondeoInterestNok = 0): EconomySummary {
  const month = new Date().toISOString().slice(0, 7) + '-01';
  const row: MonthlyEconomyRow = {
    month,
    oliviaNetNok,
    realtyflowNetNok,
    mondeoInterestNok,
    mondeoPaidNok: 0,
    totalNetNok: oliviaNetNok + realtyflowNetNok + mondeoInterestNok,
  };
  return {
    rows: [row],
    ytd: {
      oliviaNet: oliviaNetNok,
      realtyflowNet: realtyflowNetNok,
      mondeoInterest: mondeoInterestNok,
      totalNet: row.totalNetNok,
    },
    lastMonth: row,
  };
}

async function fetchEconomyView(): Promise<EconomySummary> {
  const empty = emptySummary();
  if (!isSupabaseConfigured()) return empty;

  const { data, error } = await supabase
    .from('economy_monthly')
    .select('*')
    .order('month', { ascending: true });

  if (error || !data) {
    if (error && (error as any).code !== 'PGRST116') console.warn('[familyEconomyService] economy_monthly error', error);
    return empty;
  }

  const rows: MonthlyEconomyRow[] = data.map((r: any) => {
    const olivia = Number(r.olivia_net_nok || 0);
    const realtyflow = Number(r.realtyflow_net_nok || 0);
    const mondeo = Number(r.mondeo_interest_nok || 0);
    return {
      month: r.month,
      oliviaNetNok: olivia,
      realtyflowNetNok: realtyflow,
      mondeoInterestNok: mondeo,
      mondeoPaidNok: Number(r.mondeo_paid_nok || 0),
      totalNetNok: olivia + realtyflow + mondeo,
    };
  });

  const currentYear = new Date().getFullYear();
  const ytd = rows
    .filter((r) => new Date(r.month).getFullYear() === currentYear)
    .reduce(
      (acc, r) => ({
        oliviaNet: acc.oliviaNet + r.oliviaNetNok,
        realtyflowNet: acc.realtyflowNet + r.realtyflowNetNok,
        mondeoInterest: acc.mondeoInterest + r.mondeoInterestNok,
        totalNet: acc.totalNet + r.totalNetNok,
      }),
      { oliviaNet: 0, realtyflowNet: 0, mondeoInterest: 0, totalNet: 0 },
    );

  return { rows, ytd, lastMonth: rows[rows.length - 1] ?? null };
}

export async function fetchFamilyEconomy(userId: string, userEmail?: string | null): Promise<EconomySummary> {
  if (!userId) return emptySummary();
  if (!canAccessBusiness(userEmail)) return emptySummary();

  const [viewSummary, fx, realtyflow, olivia] = await Promise.allSettled([
    fetchEconomyView(),
    getEurToNokRate(),
    fetchRealtyflowCommissions(),
    fetchDonaAnnaSummary(),
  ]);

  const view = viewSummary.status === 'fulfilled' ? viewSummary.value : emptySummary();
  const rate = fx.status === 'fulfilled' ? fx.value.rate : 11.55;
  const realtyflowNetNok = realtyflow.status === 'fulfilled' ? Number(realtyflow.value.totalNok || 0) : 0;
  const oliviaNetNok = olivia.status === 'fulfilled' ? Number(olivia.value.netEur || 0) * rate : 0;

  const viewHasBusiness = Math.abs(view.ytd.oliviaNet) > 0 || Math.abs(view.ytd.realtyflowNet) > 0;
  if (view.rows.length > 0 && viewHasBusiness) return view;

  return buildSingleMonthSummary(oliviaNetNok, realtyflowNetNok, view.ytd.mondeoInterest || 0);
}
