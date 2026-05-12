import { supabaseDonaAnna, supabasePublic, isDonaAnnaSupabaseConfigured, isRealtyflowSupabaseConfigured, SUPABASE_REFS, SUPABASE_STATUS } from '../supabase';

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

const FALLBACK: DonaAnnaSummary = { operations: [], incomeEur: 0, expensesEur: 0, netEur: 0, harvestLiters: 0, trees: 0, source: 'fallback', diagnostics: [] };
const FX = 11.55;
const DONA_TABLES = ['business_financial_events','financial_events','farm_operations','operations','transactions','expenses','income','sales','orders','harvest_records','harvests','batches'];

function getFirst(row: any, keys: string[]): any { for (const key of keys) if (row?.[key] !== undefined && row?.[key] !== null) return row[key]; return undefined; }
function normalize(value: unknown): string { return String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, ''); }
function amountValue(row: any): number { return Number(getFirst(row, ['amount','total','total_amount','price','value','cost','revenue','income','expense','net_amount']) || 0); }
function currencyValue(row: any): 'EUR' | 'NOK' { return String(getFirst(row, ['currency','currency_code']) || 'EUR').toUpperCase() === 'NOK' ? 'NOK' : 'EUR'; }
function dateValue(row: any): string { return String(getFirst(row, ['event_date','date','created_at','updated_at','harvest_date','sale_date','order_date']) || new Date().toISOString()).slice(0, 10); }
function descriptionValue(row: any, table: string): string { return String(getFirst(row, ['description','title','name','note','notes','product_name','item_name','category']) || `${table} aktivitet`); }
function categoryValue(row: any, table: string): string { return String(getFirst(row, ['stream','category','type','operation_type','activity_type','status']) || table); }
function isIncome(row: any, table: string): boolean { const text = [table, getFirst(row, ['direction','type','kind','category','stream','status'])].map((x) => String(x || '').toLowerCase()).join(' '); if (text.includes('expense') || text.includes('cost') || text.includes('utgift') || text.includes('kostnad')) return false; if (text.includes('sale') || text.includes('sales') || text.includes('order') || text.includes('income') || text.includes('revenue') || text.includes('inntekt')) return true; return amountValue(row) >= 0; }
function toEur(amount: number, currency?: string) { return currency === 'NOK' ? Number(amount || 0) / FX : Number(amount || 0); }
function rowLooksDona(row: any, table: string): boolean { if (!row) return false; return true; }

async function readRows(client: any, table: string) { const { data, error } = await client.from(table).select('*').limit(1000); if (error) return { rows: [], error: `${table}: ${error.message}` }; return { rows: data || [], error: undefined }; }

function operationsFromRows(rows: any[], table: string): DonaAnnaOperation[] {
  return rows.filter((row) => rowLooksDona(row, table)).map((row, index) => {
    const amount = amountValue(row);
    const currency = currencyValue(row);
    const income = isIncome(row, table);
    return { id: String(row.id || `${table}-${index}-${dateValue(row)}`), date: dateValue(row), description: descriptionValue(row, table), category: categoryValue(row, table), type: income ? 'Income' : 'Expense', amount: Math.abs(amount), currency };
  }).filter((op) => Number(op.amount || 0) > 0);
}

function harvestLitersFromRows(rows: any[]): number { return rows.map((row) => Number(getFirst(row, ['liters','litres','oil_liters','oil_litres','yield_liters','total_liters','quantity_liters']) || 0)).reduce((max, value) => Math.max(max, value), 0); }
function treeCountFromRows(rows: any[]): number { return rows.map((row) => Number(getFirst(row, ['trees','tree_count','olive_trees','active_trees']) || 0)).reduce((max, value) => Math.max(max, value), 0); }

function envDiagnostics() {
  return [
    `Dona Anna URL konfigurert: ${SUPABASE_STATUS.donaAnnaUrlConfigured ? 'ja' : 'nei'}`,
    `Dona Anna key konfigurert: ${SUPABASE_STATUS.donaAnnaKeyConfigured ? 'ja' : 'nei'}`,
    `Dona Anna URL i build: ${SUPABASE_REFS.donaAnna || 'mangler'}`,
    `Aksepterte key-navn: ${SUPABASE_STATUS.donaAnnaAcceptedKeyNames.join(', ')}`,
  ];
}

async function collectFromClient(client: any, sourceName: string) {
  const diagnostics: string[] = [`${sourceName} URL: ${sourceName === 'Dona Anna/Olivia' ? SUPABASE_REFS.donaAnna : SUPABASE_REFS.realtyflow}`];
  let operations: DonaAnnaOperation[] = [];
  let harvestLiters = 0;
  let trees = 0;
  for (const table of DONA_TABLES) {
    const result = await readRows(client, table);
    if (result.error) { diagnostics.push(result.error); continue; }
    diagnostics.push(`${table}: ${result.rows.length} rader lest`);
    if (['harvest_records','harvests','batches'].includes(table)) { harvestLiters = Math.max(harvestLiters, harvestLitersFromRows(result.rows)); trees = Math.max(trees, treeCountFromRows(result.rows)); }
    operations = operations.concat(operationsFromRows(result.rows, table));
  }
  return { operations, harvestLiters, trees, diagnostics };
}

export async function fetchDonaAnnaSummary(): Promise<DonaAnnaSummary> {
  let diagnostics: string[] = envDiagnostics();
  let operations: DonaAnnaOperation[] = [];
  let harvestLiters = 0;
  let trees = 0;

  if (isDonaAnnaSupabaseConfigured()) {
    const direct = await collectFromClient(supabaseDonaAnna, 'Dona Anna/Olivia');
    diagnostics = diagnostics.concat(direct.diagnostics);
    operations = direct.operations;
    harvestLiters = direct.harvestLiters;
    trees = direct.trees;
  } else {
    diagnostics.push('Dona Anna/Olivia Supabase er ikke konfigurert i denne Vite-builden. Keyen mangler vanligvis i Vercel Production/Preview eller deployen er ikke rebuildet etter miljøvariabelen ble lagt inn.');
  }

  if (operations.length === 0 && isRealtyflowSupabaseConfigured()) {
    const fallback = await collectFromClient(supabasePublic, 'RealtyFlow fallback');
    diagnostics = diagnostics.concat(fallback.diagnostics);
    operations = fallback.operations.filter((op) => {
      const raw = `${op.description} ${op.category}`.toLowerCase();
      return raw.includes('dona') || raw.includes('olivia') || raw.includes('farm') || raw.includes('harvest') || raw.includes('olive');
    });
    harvestLiters = Math.max(harvestLiters, fallback.harvestLiters);
    trees = Math.max(trees, fallback.trees);
  }

  const incomeEur = operations.filter(op => op.type === 'Income').reduce((sum, op) => sum + toEur(op.amount, op.currency), 0);
  const expensesEur = operations.filter(op => op.type === 'Expense').reduce((sum, op) => sum + toEur(op.amount, op.currency), 0);
  diagnostics.push(`Dona Anna/Olivia operasjoner funnet: ${operations.length}`);
  if (operations.length === 0) diagnostics.push('Fant ingen økonomirader. Sjekk anon key/RLS og faktiske tabellnavn i Dona Anna-prosjektet.');

  return { operations: operations.sort((a, b) => (a.date < b.date ? 1 : -1)), incomeEur, expensesEur, netEur: incomeEur - expensesEur, harvestLiters, trees, source: operations.length > 0 ? 'supabase' : 'fallback', diagnostics };
}
