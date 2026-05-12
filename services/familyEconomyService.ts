// Konsolidert månedlig økonomi-oversikt.
// Leser fra view `family.economy_monthly` som joiner RealtyFlows
// sentrale ledger (public.business_financial_events) med Mondeo-
// betalinger i family-schemaet. Alle beløp returneres i NOK.

import { supabase, isSupabaseConfigured } from '../supabase';

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

export async function fetchFamilyEconomy(userId: string): Promise<EconomySummary> {
  const empty: EconomySummary = {
    rows: [],
    ytd: { oliviaNet: 0, realtyflowNet: 0, mondeoInterest: 0, totalNet: 0 },
    lastMonth: null,
  };

  if (!isSupabaseConfigured() || !userId) return empty;

  // economy_monthly er allerede filtrert via RLS for mondeo-radene,
  // men olivia/realtyflow-summene er aggregerte på tvers av tenants.
  const { data, error } = await supabase
    .from('economy_monthly')
    .select('*')
    .order('month', { ascending: true });

  if (error || !data) {
    if (error && (error as any).code !== 'PGRST116') {
      console.warn('[familyEconomyService] error', error);
    }
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
