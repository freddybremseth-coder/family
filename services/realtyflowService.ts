import { supabasePublic, isRealtyflowSupabaseConfigured, SUPABASE_REFS, SUPABASE_STATUS } from '../supabase';
import { getEurToNokRate } from './fxService';
import { APP_VERSION } from '../config/appVersion';

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

export interface RealtyflowCommissionEvent {
  id: string;
  customerName: string;
  brandKey: CommissionBrandKey;
  brand: string;
  salePriceEur: number;
  commissionEur: number;
  commissionNok: number;
  payoutDate: string;
  status?: string;
  sourceTable: string;
}

export interface RealtyflowSummary {
  brands: BrandCommission[];
  totalEur: number;
  totalNok: number;
  fxRate: number;
  source: 'supabase' | 'fallback';
  diagnostics: string[];
  events?: RealtyflowCommissionEvent[];
}

const FALLBACK_FX = 11.55;
const READ_TIMEOUT_MS = 8000;

const DEFAULT_TABLE_CANDIDATES = [
  'contacts',
  'business_financial_events',
  'family_economy_realtyflow',
  'family_economy_monthly',
  'realtyflow_payouts',
  'realtyflow_deals',
  'real_estate_deals',
  'transactions',
  'properties',
];

function cleanEnv(value: unknown): string {
  return String(value || '').trim().replace(/^[`'"]|[`'"]$/g, '').trim();
}

function env() {
  return typeof import.meta !== 'undefined' ? import.meta.env : {};
}

function configuredTables(): string[] {
  const raw = cleanEnv(env().VITE_REALTYFLOW_COMMISSION_TABLES || env().VITE_REALTYFLOW_TABLES || '');
  const explicit = raw.split(',').map((table) => table.trim()).filter(Boolean);
  if (explicit.length > 0) return Array.from(new Set(explicit));
  return DEFAULT_TABLE_CANDIDATES;
}

function normalize(value: unknown): string {
  return String(value || '').trim().toLowerCase().replace(/https?:\/\//g, '').replace(/www\./g, '').replace(/\.com|\.no|\.es/g, '').replace(/[^a-z0-9]+/g, '');
}

function getFirst(row: any, keys: string[]): any {
  for (const key of keys) if (row?.[key] !== undefined && row?.[key] !== null) return row[key];
  return undefined;
}

function nestedCandidates(row: any) {
  return [row?.metadata, row?.meta, row?.data, row?.details, row?.payload, row?.project, row?.developer, row?.brand, row?.company, row?.customer].filter(Boolean);
}

function getAny(row: any, keys: string[]): any {
  const direct = getFirst(row, keys);
  if (direct !== undefined && direct !== null) return direct;
  for (const nested of nestedCandidates(row)) {
    const value = getFirst(nested, keys);
    if (value !== undefined && value !== null) return value;
  }
  return undefined;
}

function brandKey(row: any): CommissionBrandKey {
  const candidates = [
    getAny(row, ['brand_id', 'brand', 'business_unit', 'businessUnit', 'source_type', 'company', 'project_brand', 'developer_name', 'developer', 'builder', 'project_name', 'project', 'source', 'tenant', 'tenant_id']),
    JSON.stringify(row || {}),
  ].flatMap((value) => Array.isArray(value) ? value : [value]).map(normalize).filter(Boolean);
  const joined = candidates.join(' ');
  if (joined.includes('soleada')) return 'soleada';
  if (joined.includes('zenecohomes') || joined.includes('zeneco') || joined.includes('zeneohomes') || joined.includes('zenhomes') || joined.includes('zenecohome')) return 'zenecohomes';
  return 'other';
}

function brandLabel(key: CommissionBrandKey) {
  return key === 'soleada' ? 'Soleada' : key === 'zenecohomes' ? 'ZenEcoHomes' : 'Andre / ukjent';
}

function emptyBrand(key: CommissionBrandKey): BrandCommission {
  return { key, brand: brandLabel(key), totalEur: 0, totalNok: 0, count: 0, rawBrandIds: [], monthly: [] };
}

function amountValue(row: any): number {
  const value = getAny(row, [
    'amount_eur', 'net_eur', 'total_eur', 'realtyflow_net_eur', 'value_eur',
    'amount', 'commission_amount', 'our_commission', 'ourGrossCommission', 'our_gross_commission',
    'gross_commission', 'net_commission', 'ourNetCommission', 'our_net_commission', 'expected_amount',
    'payout_amount', 'commission', 'total_commission', 'sales_commission', 'sale_commission', 'value', 'price_commission',
    'realtyflow_net_nok', 'amount_nok', 'net_nok', 'total_nok',
  ]);
  return Number(value || 0);
}

function salePriceValue(row: any): number {
  return Number(getAny(row, ['sale_price', 'salePrice', 'pipeline_value', 'property_price', 'price', 'budget', 'value']) || 0);
}

function customerName(row: any): string {
  return String(getAny(row, ['customer_name', 'client_name', 'name', 'buyer_name', 'contact_name', 'title']) || 'RealtyFlow-kunde');
}

function currencyValue(row: any): string { return String(getAny(row, ['currency', 'commission_currency', 'amount_currency']) || 'EUR').toUpperCase(); }
function amountIsNok(row: any) {
  if (getAny(row, ['realtyflow_net_nok', 'amount_nok', 'net_nok', 'total_nok']) !== undefined) return true;
  return currencyValue(row) === 'NOK';
}
function dateValue(row: any): string { return String(getAny(row, ['month', 'event_date', 'date', 'sale_date', 'created_at', 'expected_date', 'payment_date', 'payout_date', 'commission_paid_date', 'paid_date', 'sold_at', 'closed_at', 'updated_at']) || new Date().toISOString()).slice(0, 10); }
function payoutDateValue(row: any): string { return String(getAny(row, ['commission_paid_date', 'payout_date', 'payment_date', 'expected_payout_date', 'paid_date', 'expected_date', 'date', 'event_date']) || '').slice(0, 10); }

function isWonCustomer(row: any): boolean {
  const status = String(getAny(row, ['pipeline_status', 'status', 'deal_status', 'stage']) || '').toLowerCase();
  return ['won', 'customer', 'vip', 'completed', 'closed', 'sold'].some((value) => status.includes(value));
}

function isCommissionRow(row: any, table: string): boolean {
  if (['contacts', 'business_financial_events', 'family_economy_realtyflow', 'realtyflow_payouts'].includes(table)) return true;
  const text = [table, JSON.stringify(row || {})].map((x) => String(x || '').toLowerCase()).join(' ');
  return text.includes('commission') || text.includes('kommisjon') || text.includes('provisjon') || text.includes('provision') || text.includes('realtyflow') || amountValue(row) > 0;
}

function isIncomeRow(row: any): boolean {
  const direction = String(getAny(row, ['direction', 'type', 'kind', 'status', 'event_type', 'pipeline_status']) || '').toLowerCase();
  if (!direction) return true;
  return ['income', 'in', 'credit', 'paid', 'expected', 'recognized', 'closed', 'won', 'customer', 'vip', 'sold', 'commission', 'revenue', 'sale'].some((x) => direction.includes(x));
}

async function withTimeout<T>(promise: Promise<T>, label: string, timeoutMs = READ_TIMEOUT_MS): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error(`${label}: timeout etter ${timeoutMs / 1000}s`)), timeoutMs); });
  try { return await Promise.race([promise, timeout]); }
  finally { clearTimeout(timer!); }
}

function isMissingTableError(errorText = '') {
  const lower = errorText.toLowerCase();
  return lower.includes('404') || lower.includes('not found') || lower.includes('does not exist') || lower.includes('could not find the table') || lower.includes('schema cache');
}

async function readRows(table: string): Promise<{ rows: any[]; error?: string; missing?: boolean }> {
  try {
    const result: any = await withTimeout(supabasePublic.from(table).select('*').limit(2000), table);
    if (result.error) {
      const error = `${table}: ${result.error.message}`;
      return { rows: [], error, missing: isMissingTableError(error) };
    }
    return { rows: result.data || [] };
  } catch (err: any) {
    const error = `${table}: ${err?.message || 'ukjent feil'}`;
    return { rows: [], error, missing: isMissingTableError(error) };
  }
}

function rawBrandValue(row: any) {
  return String(getAny(row, ['brand_id', 'brand', 'business_unit', 'businessUnit', 'company', 'source_type', 'developer_name', 'developer', 'project_name', 'source', 'tenant', 'tenant_id']) || '');
}

function shouldIncludeOtherAsRealtyflow(table: string, row: any) {
  const text = `${table} ${JSON.stringify(row || {})}`.toLowerCase();
  return table === 'family_economy_realtyflow' || text.includes('realtyflow') || table === 'contacts';
}

function makeEvent(row: any, table: string, fxRate: number, amountEur: number): RealtyflowCommissionEvent | null {
  const payoutDate = payoutDateValue(row);
  if (!payoutDate) return null;
  const brand = brandKey(row);
  return {
    id: `${table}-${String(getAny(row, ['id', 'contact_id', 'deal_id']) || `${customerName(row)}-${payoutDate}-${amountEur}`).replace(/\s+/g, '-')}`,
    customerName: customerName(row),
    brandKey: brand,
    brand: brandLabel(brand),
    salePriceEur: salePriceValue(row),
    commissionEur: amountEur,
    commissionNok: amountEur * fxRate,
    payoutDate,
    status: String(getAny(row, ['pipeline_status', 'status', 'deal_status']) || ''),
    sourceTable: table,
  };
}

export async function fetchRealtyflowCommissions(): Promise<RealtyflowSummary> {
  const fx = await getEurToNokRate();
  const fxRate = fx.rate || FALLBACK_FX;
  const baseDiagnostics = [`App-versjon: ${APP_VERSION}`, ...fx.diagnostics];
  const empty: RealtyflowSummary = { brands: [emptyBrand('soleada'), emptyBrand('zenecohomes')], totalEur: 0, totalNok: 0, fxRate, source: 'fallback', diagnostics: baseDiagnostics, events: [] };
  const tables = configuredTables();
  const usingExplicitTables = !!cleanEnv(env().VITE_REALTYFLOW_COMMISSION_TABLES || env().VITE_REALTYFLOW_TABLES || '');

  if (!isRealtyflowSupabaseConfigured()) {
    return { ...empty, diagnostics: [...baseDiagnostics, 'RealtyFlow Supabase er ikke konfigurert. Sett VITE_REALTYFLOW_SUPABASE_URL og VITE_REALTYFLOW_SUPABASE_ANON_KEY.', `RealtyFlow URL: ${SUPABASE_REFS.realtyflow || 'mangler'}`, `RealtyFlow key-navn: ${SUPABASE_STATUS.realtyflowResolvedKeyName || 'mangler'}`, `RealtyFlow key-lengde: ${SUPABASE_STATUS.realtyflowKeyLength || 0}`] };
  }

  const diagnostics: string[] = [
    ...baseDiagnostics,
    `EUR/NOK-kilde: ${fx.source}`,
    `RealtyFlow URL: ${SUPABASE_REFS.realtyflow}`,
    `RealtyFlow key konfigurert: ${SUPABASE_STATUS.realtyflowKeyConfigured ? 'ja' : 'nei'}`,
    `RealtyFlow key-navn: ${SUPABASE_STATUS.realtyflowResolvedKeyName || 'mangler'}`,
    `RealtyFlow key-lengde: ${SUPABASE_STATUS.realtyflowKeyLength || 0}`,
    usingExplicitTables ? `RealtyFlow-tabeller fra env: ${tables.join(', ')}` : `RealtyFlow-tabeller autodetekteres: ${tables.join(', ')}`,
  ];
  const byBrand = new Map<CommissionBrandKey, BrandCommission>();
  byBrand.set('soleada', emptyBrand('soleada'));
  byBrand.set('zenecohomes', emptyBrand('zenecohomes'));
  const events: RealtyflowCommissionEvent[] = [];

  let totalRows = 0;
  let matchedRows = 0;
  let missingTables = 0;
  let existingTables = 0;
  const rawBrands = new Set<string>();
  let invalidKeySeen = false;

  for (const table of tables) {
    const result = await readRows(table);
    if (result.error) {
      if (result.missing && !usingExplicitTables) { missingTables += 1; continue; }
      diagnostics.push(result.error);
      if (result.error.toLowerCase().includes('invalid api key')) { invalidKeySeen = true; break; }
      continue;
    }
    existingTables += 1;
    diagnostics.push(`${table}: ${result.rows.length} rader lest`);
    totalRows += result.rows.length;
    for (const row of result.rows) {
      const rawBrand = rawBrandValue(row);
      if (rawBrand) rawBrands.add(rawBrand);
      const brand = brandKey(row);
      if (brand === 'other' && !shouldIncludeOtherAsRealtyflow(table, row)) continue;
      if (!isCommissionRow(row, table) || !isIncomeRow(row)) continue;
      if (table === 'contacts' && !isWonCustomer(row)) continue;
      const rawAmount = amountValue(row);
      if (!rawAmount) continue;
      matchedRows += 1;
      const amountEur = amountIsNok(row) ? rawAmount / fxRate : rawAmount;
      const item = byBrand.get(brand) || emptyBrand(brand);
      item.totalEur += amountEur;
      item.count += 1;
      if (rawBrand && !item.rawBrandIds.includes(rawBrand)) item.rawBrandIds.push(rawBrand);
      const month = dateValue(row).slice(0, 7) + '-01';
      const existing = item.monthly.find((x) => x.month === month);
      if (existing) existing.amountEur += amountEur;
      else item.monthly.push({ month, amountEur });
      byBrand.set(brand, item);
      const event = makeEvent(row, table, fxRate, amountEur);
      if (event) events.push(event);
    }
  }

  if (invalidKeySeen) diagnostics.push('RealtyFlow-nøkkelen er ugyldig i denne builden/cachet nettleser. Hvis desktop fungerer men mobil feiler, slett mobilens nettstedsdata eller åpne etter ny Vercel-deploy.');
  if (!usingExplicitTables && missingTables > 0) diagnostics.push(`${missingTables} standardtabeller finnes ikke i RealtyFlow og ble hoppet over uten å blokkere siden.`);
  if (existingTables === 0) diagnostics.push('Fant ingen lesbare RealtyFlow-tabeller. Sett VITE_REALTYFLOW_COMMISSION_TABLES til faktiske tabellnavn for salg/kommisjoner.');

  const brands = Array.from(byBrand.values()).map((b) => ({ ...b, totalNok: b.totalEur * fxRate, monthly: b.monthly.sort((a, b) => (a.month < b.month ? -1 : 1)) }));
  const totalEur = brands.reduce((sum, b) => sum + b.totalEur, 0);
  diagnostics.push(`Totalt leste rader: ${totalRows}`);
  diagnostics.push(`Matchede kommisjons-/RealtyFlow-rader: ${matchedRows}`);
  diagnostics.push(`RealtyFlow utbetalingshendelser med dato: ${events.length}`);
  if (rawBrands.size > 0) diagnostics.push(`Brand/business values funnet: ${Array.from(rawBrands).slice(0, 30).join(', ')}`);

  return { brands, totalEur, totalNok: totalEur * fxRate, fxRate, source: invalidKeySeen || existingTables === 0 ? 'fallback' : 'supabase', diagnostics, events: events.sort((a, b) => a.payoutDate.localeCompare(b.payoutDate)) };
}

export async function fetchRealtyflowCommissionEvents(): Promise<RealtyflowCommissionEvent[]> {
  const summary = await fetchRealtyflowCommissions();
  return summary.events || [];
}
