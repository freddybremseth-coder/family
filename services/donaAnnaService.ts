import { supabaseDonaAnna, isDonaAnnaSupabaseConfigured, SUPABASE_REFS, SUPABASE_STATUS } from '../supabase';
import { getEurToNokRate } from './fxService';

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

const OLIVIA_TABLES = [
  'farm_expenses',
  'subsidy_income',
  'commerce_orders',
  'commerce_order_items',
  'commerce_products',
  'commerce_invoices',
  'harvest_records',
  'batches',
  'parcels',
  'tasks',
];

function getFirst(row: any, keys: string[]): any {
  for (const key of keys) {
    if (row?.[key] !== undefined && row?.[key] !== null && row?.[key] !== '') return row[key];
  }
  return undefined;
}

function amountValue(row: any): number {
  return Number(getFirst(row, [
    'amount', 'total', 'total_amount', 'subtotal', 'grand_total', 'price', 'unit_price',
    'value', 'cost', 'expense', 'net_amount', 'sales_amount', 'income_amount',
    'expense_amount', 'paid_amount', 'payment_amount', 'total_cost', 'total_income',
    'order_total', 'invoice_total', 'line_total', 'sum', 'revenue'
  ]) || 0);
}

function currencyValue(row: any): 'EUR' | 'NOK' {
  return String(getFirst(row, ['currency','currency_code']) || 'EUR').toUpperCase() === 'NOK' ? 'NOK' : 'EUR';
}

function dateValue(row: any): string {
  return String(getFirst(row, [
    'event_date','date','created_at','updated_at','harvest_date','sale_date','order_date',
    'invoice_date','recorded_at','completed_at','paid_at','due_date'
  ]) || new Date().toISOString()).slice(0, 10);
}

function descriptionValue(row: any, table: string): string {
  return String(getFirst(row, [
    'description','title','name','note','notes','product_name','item_name','category',
    'variety','field_name','plot_name','sku','task_title','customer_name'
  ]) || `${table} aktivitet`);
}

function categoryValue(row: any, table: string): string {
  return String(getFirst(row, ['stream','category','type','operation_type','activity_type','status','harvest_type','expense_type']) || table);
}

function toEur(amount: number, currency: string, eurNok: number) {
  return currency === 'NOK' ? Number(amount || 0) / eurNok : Number(amount || 0);
}

function columnsFor(rows: any[]): string[] {
  const set = new Set<string>();
  rows.slice(0, 3).forEach((row) => Object.keys(row || {}).forEach((key) => set.add(key)));
  return Array.from(set).sort();
}

async function readRows(client: any, table: string) {
  const { data, error } = await client.from(table).select('*').limit(1000);
  if (error) return { rows: [], error: `${table}: ${error.message}` };
  return { rows: data || [], error: undefined };
}

function expenseOps(rows: any[], table: string): DonaAnnaOperation[] {
  return rows.map((row, index) => ({
    id: String(row.id || `${table}-${index}`),
    date: dateValue(row),
    description: descriptionValue(row, table),
    category: categoryValue(row, table),
    type: 'Expense' as const,
    amount: Math.abs(amountValue(row)),
    currency: currencyValue(row),
  })).filter((op) => op.amount > 0);
}

function incomeOps(rows: any[], table: string): DonaAnnaOperation[] {
  return rows.map((row, index) => ({
    id: String(row.id || `${table}-${index}`),
    date: dateValue(row),
    description: descriptionValue(row, table),
    category: categoryValue(row, table),
    type: 'Income' as const,
    amount: Math.abs(amountValue(row)),
    currency: currencyValue(row),
  })).filter((op) => op.amount > 0);
}

function harvestOps(rows: any[], table: string): DonaAnnaOperation[] {
  return rows.map((row, index) => {
    const liters = Number(getFirst(row, ['liters','litres','oil_liters','oil_litres','yield_liters','total_liters','quantity_liters','produced_liters','production_liters']) || 0);
    const kg = Number(getFirst(row, ['kg','kilos','kilograms','olive_kg','olives_kg','harvest_kg','total_kg','weight_kg','net_weight_kg']) || 0);
    const bottles = Number(getFirst(row, ['bottles','bottle_count','units','quantity','total_units']) || 0);
    const metricText = [liters ? `${liters} liter olje` : '', kg ? `${kg} kg oliven` : '', bottles ? `${bottles} flasker` : ''].filter(Boolean).join(' · ');
    const amount = amountValue(row);
    return {
      id: String(row.id || `${table}-harvest-${index}`),
      date: dateValue(row),
      description: metricText ? `${descriptionValue(row, table)} · ${metricText}` : descriptionValue(row, table),
      category: categoryValue(row, table),
      type: amount < 0 ? 'Expense' as const : 'Income' as const,
      amount: Math.abs(amount),
      currency: currencyValue(row),
    };
  });
}

function harvestLitersFromRows(rows: any[]): number {
  return rows.reduce((sum, row) => sum + Number(getFirst(row, ['liters','litres','oil_liters','oil_litres','yield_liters','total_liters','quantity_liters','produced_liters','production_liters']) || 0), 0);
}

function treeCountFromParcels(rows: any[]): number {
  return rows.reduce((sum, row) => sum + Number(getFirst(row, ['trees','tree_count','olive_trees','active_trees','number_of_trees']) || 0), 0);
}

function envDiagnostics() {
  return [
    `Olivia URL konfigurert: ${SUPABASE_STATUS.donaAnnaUrlConfigured ? 'ja' : 'nei'}`,
    `Olivia key konfigurert: ${SUPABASE_STATUS.donaAnnaKeyConfigured ? 'ja' : 'nei'}`,
    `Olivia URL i build: ${SUPABASE_REFS.donaAnna || 'mangler'}`,
    `Olivia key-navn: ${SUPABASE_STATUS.donaAnnaResolvedKeyName || 'mangler'}`,
    `Olivia-tabeller appen leser: ${OLIVIA_TABLES.join(', ')}`,
  ];
}

async function collectFromOlivia(client: any) {
  const diagnostics: string[] = [`Olivia URL: ${SUPABASE_REFS.donaAnna}`];
  let operations: DonaAnnaOperation[] = [];
  let harvestLiters = 0;
  let trees = 0;
  let rowsFound = false;

  for (const table of OLIVIA_TABLES) {
    const result = await readRows(client, table);
    if (result.error) { diagnostics.push(result.error); continue; }
    diagnostics.push(`${table}: ${result.rows.length} rader lest`);
    if (result.rows.length > 0) {
      rowsFound = true;
      diagnostics.push(`${table} kolonner: ${columnsFor(result.rows).join(', ')}`);
    }

    if (table === 'farm_expenses') operations = operations.concat(expenseOps(result.rows, table));
    else if (['subsidy_income', 'commerce_orders', 'commerce_order_items', 'commerce_invoices'].includes(table)) operations = operations.concat(incomeOps(result.rows, table));
    else if (['harvest_records', 'batches'].includes(table)) {
      harvestLiters += harvestLitersFromRows(result.rows);
      operations = operations.concat(harvestOps(result.rows, table));
    } else if (table === 'parcels') {
      trees += treeCountFromParcels(result.rows);
    }
  }

  return { operations, harvestLiters, trees, diagnostics, rowsFound };
}

export async function fetchDonaAnnaSummary(): Promise<DonaAnnaSummary> {
  const fx = await getEurToNokRate();
  let diagnostics: string[] = envDiagnostics().concat(fx.diagnostics);
  let operations: DonaAnnaOperation[] = [];
  let harvestLiters = 0;
  let trees = 0;
  let rowsFound = false;

  if (isDonaAnnaSupabaseConfigured()) {
    const direct = await collectFromOlivia(supabaseDonaAnna);
    diagnostics = diagnostics.concat(direct.diagnostics);
    operations = direct.operations;
    harvestLiters = direct.harvestLiters;
    trees = direct.trees;
    rowsFound = direct.rowsFound;
  } else {
    diagnostics.push('Olivia Supabase er ikke konfigurert i denne Vite-builden. Sett VITE_OLIVIA_SUPABASE_URL og VITE_OLIVIA_SUPABASE_ANON_KEY.');
  }

  const deduped = new Map<string, DonaAnnaOperation>();
  operations.forEach((op) => deduped.set(op.id, op));
  operations = Array.from(deduped.values());

  const moneyOps = operations.filter(op => Number(op.amount || 0) > 0);
  const incomeEur = moneyOps.filter(op => op.type === 'Income').reduce((sum, op) => sum + toEur(op.amount, op.currency, fx.rate), 0);
  const expensesEur = moneyOps.filter(op => op.type === 'Expense').reduce((sum, op) => sum + toEur(op.amount, op.currency, fx.rate), 0);

  diagnostics.push(`Olivia operasjoner funnet: ${operations.length}`);
  diagnostics.push(`Olivia økonomirader med beløp: ${moneyOps.length}`);
  if (rowsFound && moneyOps.length === 0) diagnostics.push('Olivia svarer, men radene har ikke økonomibeløp i kjente felt. Kolonnelisten over viser hvilke felter vi må mappe videre.');
  if (!rowsFound) diagnostics.push('Fant ingen lesbare Olivia-rader. Sjekk RLS eller faktisk schema/tabellnavn.');

  return { operations: operations.sort((a, b) => (a.date < b.date ? 1 : -1)), incomeEur, expensesEur, netEur: incomeEur - expensesEur, harvestLiters, trees, source: rowsFound ? 'supabase' : 'fallback', diagnostics };
}
