// Henter konsolidert månedlig økonomi-oversikt fra delt Supabase
// (olivia + realtyflow-pro + mondeo). Bruker view 'family_economy_monthly'.

import { supabase, isSupabaseConfigured } from '../supabase';

export interface MonthlyEconomyRow {
  month: string; // ISO 'YYYY-MM-DD' (første dag i mnd)
  oliviaRevenueNok: number;
  oliviaCostNok: number;
  realtyflowNetNok: number;
  mondeoInterestNok: number;
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

export async function fetchFamilyEconomy(userId: string): Promise<EconomySummary> {
  const empty: EconomySummary = {
    rows: [],
    ytd: { oliviaNet: 0, realtyflowNet: 0, mondeoInterest: 0, totalNet: 0 },
    lastMonth: null,
  };

  if (!isSupabaseConfigured() || !userId) return empty;

  const { data, error } = await supabase
    .from('family_economy_monthly')
    .select('*')
    .eq('user_id', userId)
    .order('month', { ascending: true });

  if (error || !data) {
    if (error && error.code !== 'PGRST116') {
      console.warn('[familyEconomyService] error', error);
    }
    return empty;
  }

  const rows: MonthlyEconomyRow[] = data.map((r: any) => {
    const oliviaNet = Number(r.olivia_revenue_nok || 0) - Number(r.olivia_cost_nok || 0);
    const total = oliviaNet + Number(r.realtyflow_net_nok || 0) + Number(r.mondeo_interest_nok || 0);
    return {
      month: r.month,
      oliviaRevenueNok: Number(r.olivia_revenue_nok || 0),
      oliviaCostNok: Number(r.olivia_cost_nok || 0),
      realtyflowNetNok: Number(r.realtyflow_net_nok || 0),
      mondeoInterestNok: Number(r.mondeo_interest_nok || 0),
      totalNetNok: total,
    };
  });

  const currentYear = new Date().getFullYear();
  const ytdRows = rows.filter((r) => new Date(r.month).getFullYear() === currentYear);
  const ytd = ytdRows.reduce(
    (acc, r) => ({
      oliviaNet: acc.oliviaNet + (r.oliviaRevenueNok - r.oliviaCostNok),
      realtyflowNet: acc.realtyflowNet + r.realtyflowNetNok,
      mondeoInterest: acc.mondeoInterest + r.mondeoInterestNok,
      totalNet: acc.totalNet + r.totalNetNok,
    }),
    { oliviaNet: 0, realtyflowNet: 0, mondeoInterest: 0, totalNet: 0 },
  );

  return {
    rows,
    ytd,
    lastMonth: rows[rows.length - 1] ?? null,
  };
}
