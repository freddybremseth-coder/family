import { supabasePublic, isRealtyflowSupabaseConfigured, SUPABASE_REFS } from '../supabase';

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
  diagnostics: string[];
}

const FALLBACK: DonaAnnaSummary = {
  operations: [],
  incomeEur: 0,
  expensesEur: 0,
  netEur: 0,
  harvestLiters: 0,
  trees: 0,
  source: 'fallback',
  diagnostics: [],
};

const FX = 11.55;
const toEur = (amount: number, currency?: string) => currency === 'NOK' ? Number(amount || 0) / FX : Number(amount || 0);

export async function fetchDonaAnnaSummary(): Promise<DonaAnnaSummary> {
  if (!isRealtyflowSupabaseConfigured()) {
    return {
      ...FALLBACK,
      diagnostics: [
        'RealtyFlow Supabase er ikke konfigurert. Sett VITE_REALTYFLOW_SUPABASE_URL og VITE_REALTYFLOW_SUPABASE_ANON_KEY.',
        `RealtyFlow URL i appen: ${SUPABASE_REFS.realtyflow || 'mangler'}`,
      ],
    };
  }

  let operations: DonaAnnaOperation[] = [];
  const diagnostics: string[] = [];

  const { data: eventRows, error: eventError } = await supabasePublic
    .from('business_financial_events')
    .select('id, event_date, description, stream, direction, amount, currency, brand_id, brand, business_unit, status, metadata')
    .in('status', ['recognized', 'paid', 'expected', 'pending']);

  if (eventError) {
    diagnostics.push(`business_financial_events: ${eventError.message}`);
  }

  if (!eventError && eventRows) {
    const donaRows = eventRows.filter((row: any) => {
      const raw = [row.brand_id, row.brand, row.business_unit, row.metadata?.brand, row.metadata?.source, row.metadata?.company]
        .map((x) => String(x || '').toLowerCase().replace(/[^a-z0-9]+/g, ''))
        .join(' ');
      return raw.includes('donaanna') || raw.includes('dona') || raw.includes('olivia');
    });

    operations = donaRows.map((row: any) => ({
      id: String(row.id),
      date: row.event_date,
      description: row.description || row.stream || 'Dona Anna aktivitet',
      category: row.stream || 'Drift',
      type: String(row.direction || '').toLowerCase() === 'income' ? 'Income' : 'Expense',
      amount: Number(row.amount || 0),
      currency: row.currency === 'NOK' ? 'NOK' : 'EUR',
    }));
  }

  if (operations.length === 0) {
    const { data: farmRows, error: farmError } = await supabasePublic
      .from('farm_operations')
      .select('id, date, description, category, type, amount, currency')
      .order('date', { ascending: false });

    if (farmError) diagnostics.push(`farm_operations: ${farmError.message}`);

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

  let harvestLiters = 0;
  const { data: harvestRows, error: harvestError } = await supabasePublic
    .from('harvest_records')
    .select('liters, year, harvest_date')
    .order('harvest_date', { ascending: false })
    .limit(1);
  if (harvestError) diagnostics.push(`harvest_records: ${harvestError.message}`);
  if (harvestRows?.[0]?.liters) harvestLiters = Number(harvestRows[0].liters);

  const incomeEur = operations.filter(op => op.type === 'Income').reduce((sum, op) => sum + toEur(op.amount, op.currency), 0);
  const expensesEur = operations.filter(op => op.type === 'Expense').reduce((sum, op) => sum + toEur(op.amount, op.currency), 0);
  if (operations.length === 0) diagnostics.push('Fant ingen Dona Anna/Olivia-operasjoner i RealtyFlow Supabase.');

  return {
    operations: operations.sort((a, b) => (a.date < b.date ? 1 : -1)),
    incomeEur,
    expensesEur,
    netEur: incomeEur - expensesEur,
    harvestLiters,
    trees: 0,
    source: 'supabase',
    diagnostics,
  };
}
