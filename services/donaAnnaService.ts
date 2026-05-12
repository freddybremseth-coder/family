import { supabasePublic, isSupabaseConfigured } from '../supabase';

export interface DonaAnnaOperation {
  id: string;
  date: string;
  description: string;
  category: string;
  type: 'Income' | 'Expense';
  amount: number;
  currency: 'EUR' | 'NOK';
}

export interface DonaAnnaSummary {
  operations: DonaAnnaOperation[];
  incomeEur: number;
  expensesEur: number;
  netEur: number;
  harvestLiters: number;
  trees: number;
  source: 'supabase' | 'fallback';
}

const FALLBACK: DonaAnnaSummary = {
  operations: [],
  incomeEur: 0,
  expensesEur: 0,
  netEur: 0,
  harvestLiters: 1370,
  trees: 1500,
  source: 'fallback',
};

const FX = 11.55;
const toEur = (amount: number, currency?: string) => currency === 'NOK' ? Number(amount || 0) / FX : Number(amount || 0);

export async function fetchDonaAnnaSummary(): Promise<DonaAnnaSummary> {
  if (!isSupabaseConfigured()) return FALLBACK;

  let operations: DonaAnnaOperation[] = [];

  // Primær kilde: Olivia / Dona Anna data speilet til RealtyFlow Pro public-schema.
  // Bruker best-effort queries slik at FamilyHub ikke brekker dersom enkelte tabeller
  // ikke er opprettet eller eksponert ennå.
  const { data: eventRows, error: eventError } = await supabasePublic
    .from('business_financial_events')
    .select('id, event_date, description, stream, direction, amount, currency, brand_id, status')
    .in('brand_id', ['donaanna', 'dona_anna', 'olivia'])
    .in('status', ['recognized', 'paid']);

  if (!eventError && eventRows) {
    operations = eventRows.map((row: any) => ({
      id: String(row.id),
      date: row.event_date,
      description: row.description || row.stream || 'Dona Anna aktivitet',
      category: row.stream || 'Drift',
      type: row.direction === 'income' ? 'Income' : 'Expense',
      amount: Number(row.amount || 0),
      currency: row.currency === 'NOK' ? 'NOK' : 'EUR',
    }));
  }

  // Sekundær kilde dersom Olivia bruker egen farm_operations-tabell i public.
  if (operations.length === 0) {
    const { data: farmRows } = await supabasePublic
      .from('farm_operations')
      .select('id, date, description, category, type, amount, currency')
      .order('date', { ascending: false });

    if (farmRows) {
      operations = farmRows.map((row: any) => ({
        id: String(row.id),
        date: row.date,
        description: row.description || 'Gårdsoperasjon',
        category: row.category || 'Drift',
        type: row.type === 'Income' || row.type === 'income' ? 'Income' : 'Expense',
        amount: Number(row.amount || 0),
        currency: row.currency === 'NOK' ? 'NOK' : 'EUR',
      }));
    }
  }

  let harvestLiters = FALLBACK.harvestLiters;
  const { data: harvestRows } = await supabasePublic
    .from('harvest_records')
    .select('liters, year, harvest_date')
    .order('harvest_date', { ascending: false })
    .limit(1);
  if (harvestRows?.[0]?.liters) harvestLiters = Number(harvestRows[0].liters);

  const incomeEur = operations.filter(op => op.type === 'Income').reduce((sum, op) => sum + toEur(op.amount, op.currency), 0);
  const expensesEur = operations.filter(op => op.type === 'Expense').reduce((sum, op) => sum + toEur(op.amount, op.currency), 0);

  return {
    operations: operations.sort((a, b) => (a.date < b.date ? 1 : -1)),
    incomeEur,
    expensesEur,
    netEur: incomeEur - expensesEur,
    harvestLiters,
    trees: FALLBACK.trees,
    source: 'supabase',
  };
}
