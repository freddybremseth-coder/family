// Leser eiendomsprovisjoner fra RealtyFlow Pro sin sentrale hub.
// FamilyHub skal ikke være master for salg/provisjoner; den viser data fra
// RealtyFlow Pro / Supabase public-schema.

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
const COMMISSION_STREAMS = new Set(['commission','commissions','real_estate_commission','property_commission','sales_commission','sale_commission']);

function normalize(value: unknown): string {
  return String(value || '').trim().toLowerCase().replace(/https?:\/\//g, '').replace(/www\./g, '').replace(/\.com|\.no|\.es/g, '').replace(/[^a-z0-9]+/g, '');
}

function brandKey(row: any): CommissionBrandKey {
  const candidates = [row.brand_id,row.brand,row.business_unit,row.source_type,row.metadata?.brand,row.metadata?.brand_id,row.metadata?.businessUnit,row.metadata?.business_unit,row.metadata?.company,row.metadata?.source]
    .map(normalize).filter(Boolean);
  const joined = candidates.join(' ');
  if (joined.includes('soleada')) return 'soleada';
  if (joined.includes('zenecohomes') || joined.includes('zeneco') || joined.includes('zeneohomes') || joined.includes('zenhomes') || joined.includes('zenecohome')) return 'zenecohomes';
  return 'other';
}

function brandLabel(key: CommissionBrandKey): string {
  if (key === 'soleada') return 'Soleada';
  if (key === 'zenecohomes') return 'ZenEcoHomes';
  return 'Andre / ukjent';
}

function emptyBrand(key: CommissionBrandKey): BrandCommission {
  return { key, brand: brandLabel(key), totalEur: 0, totalNok: 0, count: 0, rawBrandIds: [], monthly: [] };
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
        `RealtyFlow URL i appen: ${SUPABASE_REFS.realtyflow || 'mangler'}`,
      ],
    };
  }

  let fxRate = FALLBACK_FX;
  try {
    const { data: fxRow } = await supabasePublic.from('fx_rates').select('rate').eq('pair', 'EUR_NOK').maybeSingle();
    if (fxRow?.rate) fxRate = Number(fxRow.rate);
  } catch {
    // Bruk fallback-kurs.
  }

  const { data, error } = await supabasePublic
    .from('business_financial_events')
    .select('brand_id, brand, business_unit, source_type, amount, currency, event_date, status, direction, stream, metadata, description')
    .in('status', ['recognized', 'paid', 'expected', 'pending']);

  if (error || !data) {
    const message = error?.message || 'Fant ingen data fra business_financial_events.';
    return { ...empty, fxRate, diagnostics: [message, `RealtyFlow URL: ${SUPABASE_REFS.realtyflow}`] };
  }

  const byBrand = new Map<CommissionBrandKey, BrandCommission>();
  byBrand.set('soleada', emptyBrand('soleada'));
  byBrand.set('zenecohomes', emptyBrand('zenecohomes'));

  const diagnostics: string[] = [];
  const rawBrandIds = new Set<string>();
  const rawStreams = new Set<string>();
  let commissionRows = 0;

  for (const row of data) {
    if (row.brand_id) rawBrandIds.add(String(row.brand_id));
    if (row.stream) rawStreams.add(String(row.stream));

    const stream = String(row.stream || '').toLowerCase();
    const description = String(row.description || row.metadata?.description || '').toLowerCase();
    const isCommission = COMMISSION_STREAMS.has(stream) || stream.includes('commission') || description.includes('commission') || description.includes('provisjon');
    if (!isCommission) continue;
    if (row.direction && !['income', 'in', 'credit'].includes(String(row.direction).toLowerCase())) continue;

    commissionRows += 1;
    const key = brandKey(row);
    if (key === 'other') continue;

    const amountEur = row.currency === 'EUR' ? Number(row.amount || 0) : Number(row.amount || 0) / fxRate;
    const item = byBrand.get(key) || emptyBrand(key);
    item.totalEur += amountEur;
    item.count += 1;
    const rawId = String(row.brand_id || row.brand || row.business_unit || key);
    if (rawId && !item.rawBrandIds.includes(rawId)) item.rawBrandIds.push(rawId);

    const month = (row.event_date || '').slice(0, 7) + '-01';
    const existing = item.monthly.find((x) => x.month === month);
    if (existing) existing.amountEur += amountEur;
    else item.monthly.push({ month, amountEur });
    byBrand.set(key, item);
  }

  const brands = Array.from(byBrand.values()).map((b) => ({ ...b, totalNok: b.totalEur * fxRate, monthly: b.monthly.sort((a, b) => (a.month < b.month ? -1 : 1)) }));
  const totalEur = brands.reduce((sum, b) => sum + b.totalEur, 0);

  if (commissionRows === 0) diagnostics.push(`Fant ingen kommisjonsrader. Streams funnet: ${Array.from(rawStreams).join(', ') || 'ingen'}`);
  if ((byBrand.get('zenecohomes')?.count || 0) === 0) diagnostics.push('Fant ingen ZenEcoHomes-kommisjoner. Sjekk brand_id/business_unit/metadata i RealtyFlow Pro.');
  if ((byBrand.get('soleada')?.count || 0) === 0) diagnostics.push('Fant ingen Soleada-kommisjoner. Sjekk brand_id/business_unit/metadata i RealtyFlow Pro.');
  if (rawBrandIds.size > 0) diagnostics.push(`Brand IDs funnet i hub: ${Array.from(rawBrandIds).join(', ')}`);

  return { brands, totalEur, totalNok: totalEur * fxRate, fxRate, source: 'supabase', diagnostics };
}
