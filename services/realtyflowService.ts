// Leser eiendomsprovisjoner direkte fra RealtyFlow Pro sin sentrale
// ledger `public.business_financial_events`. Filterer på stream='commission'
// og grupperer per brand_id (Soleada, ZenEcoHomes, …).

import { supabasePublic, isSupabaseConfigured } from '../supabase';

export interface BrandCommission {
  brand: string;
  totalEur: number;
  totalNok: number;
  count: number;
  monthly: { month: string; amountEur: number }[];
}

export interface RealtyflowSummary {
  brands: BrandCommission[];
  totalEur: number;
  totalNok: number;
  fxRate: number;
}

const FALLBACK_FX = 11.55;

function brandLabel(brandId: string): string {
  const map: Record<string, string> = {
    soleada: 'Soleada',
    zenecohomes: 'ZenEcoHomes',
    'zen-eco-homes': 'ZenEcoHomes',
    zen_eco_homes: 'ZenEcoHomes',
  };
  return map[brandId.toLowerCase()] ?? brandId;
}

export async function fetchRealtyflowCommissions(): Promise<RealtyflowSummary> {
  const empty: RealtyflowSummary = { brands: [], totalEur: 0, totalNok: 0, fxRate: FALLBACK_FX };
  if (!isSupabaseConfigured()) return empty;

  // Hent FX-kurs (best effort)
  let fxRate = FALLBACK_FX;
  const { data: fxRow } = await supabasePublic
    .from('fx_rates')
    .select('rate')
    .eq('pair', 'EUR_NOK')
    .maybeSingle();
  if (fxRow?.rate) fxRate = Number(fxRow.rate);

  const { data, error } = await supabasePublic
    .from('business_financial_events')
    .select('brand_id, amount, currency, event_date, status, direction, stream')
    .eq('stream', 'commission')
    .in('status', ['recognized', 'paid']);

  if (error || !data) {
    if (error) console.warn('[realtyflowService]', error);
    return { ...empty, fxRate };
  }

  const byBrand = new Map<string, BrandCommission>();
  for (const row of data) {
    const id = row.brand_id || 'ukjent';
    const amountEur =
      row.currency === 'EUR' ? Number(row.amount) : Number(row.amount) / fxRate;

    if (!byBrand.has(id)) {
      byBrand.set(id, {
        brand: brandLabel(id),
        totalEur: 0,
        totalNok: 0,
        count: 0,
        monthly: [],
      });
    }
    const b = byBrand.get(id)!;
    b.totalEur += amountEur;
    b.count += 1;

    const m = (row.event_date || '').slice(0, 7) + '-01';
    const existing = b.monthly.find((x) => x.month === m);
    if (existing) existing.amountEur += amountEur;
    else b.monthly.push({ month: m, amountEur });
  }

  const brands = Array.from(byBrand.values()).map((b) => ({
    ...b,
    totalNok: b.totalEur * fxRate,
    monthly: b.monthly.sort((a, b) => (a.month < b.month ? -1 : 1)),
  }));

  brands.sort((a, b) => b.totalEur - a.totalEur);

  const totalEur = brands.reduce((s, b) => s + b.totalEur, 0);
  return { brands, totalEur, totalNok: totalEur * fxRate, fxRate };
}
