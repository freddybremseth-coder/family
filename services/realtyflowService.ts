import { supabasePublic, isRealtyflowSupabaseConfigured, SUPABASE_REFS } from '../supabase';

export type CommissionBrandKey = 'soleada' | 'zenecohomes' | 'other';

export interface BrandCommission {
  key: CommissionBrandKey;
  brand: string;
  totalEur: number;
  totalNok: number;
  count: number;
  rawBrandIds: string[];
  monthly: { month: string; amountEur: number }[];
}

export interface RealtyflowSummary {
  brands: BrandCommission[];
  totalEur: number;
  totalNok: number;
  fxRate: number;
  source: 'supabase' | 'fallback';
  diagnostics: string[];
}

const FALLBACK_FX = 11.55;
const TABLES = ['business_financial_events', 'real_estate_deals', 'commission_payouts', 'commissions', 'deals'];

function normalize(value: unknown): string {
  return String(value || '').trim().toLowerCase().replace(/https?:\/\//g, '').replace(/www\./g, '').replace(/\.com|\.no|\.es/g, '').replace(/[^a-z0-9]+/g, '');
}

function getFirst(row: any, keys: string[]): any {
  for (const key of keys) {
    if (row?.[key] !== undefined && row?.[key] !== null) return row[key];
  }
  return undefined;
}

function brandKey(row: any): CommissionBrandKey {
  const meta = row?.metadata || row?.meta || row?.data || {};
  const candidates = [
    getFirst(row, ['brand_id', 'brand', 'business_unit', 'businessUnit', 'source_type', 'company', 'project_brand']),
    meta.brand,
    meta.brand_id,
    meta.businessUnit,
    meta.business_unit,
    meta.company,
    meta.source,
    meta.project,
  ].map(normalize).filter(Boolean);

  const joined = candidates.join(' ');
  if (joined.includes('soleada')) return 'soleada';
  if (joined.includes('zenecohomes') || joined.includes('zeneco') || joined.includes('zeneohomes') || joined.includes('zenhomes') || joined.includes('zenecohome')) return 'zenecohomes';
  return 'other';
}

function emptyBrand(key: CommissionBrandKey): BrandCommission {
  return {
    key,
    brand: key === 'soleada' ? 'Soleada' : key === 'zenecohomes' ? 'ZenEcoHomes' : 'Andre / ukjent',
    totalEur: 0,
    totalNok: 0,
    count: 0,
    rawBrandIds: [],
    monthly: [],
  };
}

function amountValue(row: any): number {
  return Number(getFirst(row, ['amount', 'commission_amount', 'our_commission', 'ourGrossCommission', 'our_gross_commission', 'gross_commission', 'net_commission', 'ourNetCommission', 'expected_amount', 'payout_amount']) || 0);
}

function currencyValue(row: any): string {
  return String(getFirst(row, ['currency', 'commission_currency']) || 'EUR').toUpperCase();
}

function dateValue(row: any): string {
  return String(getFirst(row, ['event_date', 'date', 'sale_date', 'created_at', 'expected_date', 'payment_date']) || new Date().toISOString()).slice(0, 10);
}

function isCommissionRow(row: any, table: string): boolean {
  if (['commission_payouts', 'commissions'].includes(table)) return true;
  const meta = row?.metadata || row?.meta || row?.data || {};
  const text = [row?.stream, row?.type, row?.category, row?.description, row?.event_type, meta.stream, meta.type, meta.category, meta.description]
    .map((x) => String(x || '').toLowerCase()).join(' ');
  return text.includes('commission') || text.includes('provisjon') || text.includes('provision') || amountValue(row) > 0;
}

function isIncomeRow(row: any): boolean {
  const direction = String(getFirst(row, ['direction', 'type', 'kind']) || '').toLowerCase();
  if (!direction) return true;
  return ['income', 'in', 'credit', 'paid', 'expected', 'recognized'].some((x) => direction.includes(x));
}

async function readRows(table: string): Promise<{ rows: any[]; error?: string }> {
  const { data, error } = await supabasePublic.from(table).select('*').limit(1000);
  if (error) return { rows: [], error: `${table}: ${error.message}` };
  return { rows: data || [] };
}

export async function fetchRealtyflowCommissions(): Promise<RealtyflowSummary> {
  const empty: RealtyflowSummary = {
    brands: [emptyBrand('soleada'), emptyBrand('zenecohomes')],
    totalEur: 0,
    totalNok: 0,
    fxRate: FALLBACK_FX,
    source: 'fallback',
    diagnostics: [],
  };

  if (!isRealtyflowSupabaseConfigured()) {
    return {
      ...empty,
      diagnostics: [
        'RealtyFlow Supabase er ikke konfigurert. Sett VITE_REALTYFLOW_SUPABASE_URL og VITE_REALTYFLOW_SUPABASE_ANON_KEY.',
        `RealtyFlow URL: ${SUPABASE_REFS.realtyflow || 'mangler'}`,
      ],
    };
  }

  let fxRate = FALLBACK_FX;
  try {
    const { data: fxRow } = await supabasePublic.from('fx_rates').select('*').limit(1).maybeSingle();
    if (fxRow?.rate) fxRate = Number(fxRow.rate);
  } catch {}

  const diagnostics: string[] = [`RealtyFlow URL: ${SUPABASE_REFS.realtyflow}`];
  const byBrand = new Map<CommissionBrandKey, BrandCommission>();
  byBrand.set('soleada', emptyBrand('soleada'));
  byBrand.set('zenecohomes', emptyBrand('zenecohomes'));

  let totalRows = 0;
  let matchedRows = 0;
  const rawBrands = new Set<string>();

  for (const table of TABLES) {
    const result = await readRows(table);
    if (result.error) {
      diagnostics.push(result.error);
      continue;
    }
    diagnostics.push(`${table}: ${result.rows.length} rader lest`);
    totalRows += result.rows.length;

    for (const row of result.rows) {
      const brand = brandKey(row);
      const rawBrand = String(getFirst(row, ['brand_id', 'brand', 'business_unit', 'businessUnit', 'company', 'source_type']) || '');
      if (rawBrand) rawBrands.add(rawBrand);
      if (brand === 'other') continue;
      if (!isCommissionRow(row, table)) continue;
      if (!isIncomeRow(row)) continue;

      const rawAmount = amountValue(row);
      if (!rawAmount) continue;

      matchedRows += 1;
      const amountEur = currencyValue(row) === 'EUR' ? rawAmount : rawAmount / fxRate;
      const item = byBrand.get(brand) || emptyBrand(brand);
      item.totalEur += amountEur;
      item.count += 1;
      if (rawBrand && !item.rawBrandIds.includes(rawBrand)) item.rawBrandIds.push(rawBrand);

      const month = dateValue(row).slice(0, 7) + '-01';
      const existing = item.monthly.find((x) => x.month === month);
      if (existing) existing.amountEur += amountEur;
      else item.monthly.push({ month, amountEur });
    }
  }

  const brands = Array.from(byBrand.values()).map((b) => ({
    ...b,
    totalNok: b.totalEur * fxRate,
    monthly: b.monthly.sort((a, b) => (a.month < b.month ? -1 : 1)),
  }));
  const totalEur = brands.reduce((sum, b) => sum + b.totalEur, 0);

  diagnostics.push(`Totalt leste rader: ${totalRows}`);
  diagnostics.push(`Matchede kommisjonsrader for Soleada/ZenEcoHomes: ${matchedRows}`);
  if (rawBrands.size > 0) diagnostics.push(`Brand/business values funnet: ${Array.from(rawBrands).slice(0, 30).join(', ')}`);
  if ((byBrand.get('soleada')?.count || 0) === 0) diagnostics.push('Soleada ga 0 treff. Sjekk faktisk brand/business value i listen over.');
  if ((byBrand.get('zenecohomes')?.count || 0) === 0) diagnostics.push('ZenEcoHomes ga 0 treff. Sjekk faktisk brand/business value i listen over.');

  return { brands, totalEur, totalNok: totalEur * fxRate, fxRate, source: 'supabase', diagnostics };
}
