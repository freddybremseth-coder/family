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

export interface RealtyflowSummary {
  brands: BrandCommission[];
  totalEur: number;
  totalNok: number;
  fxRate: number;
  source: 'supabase' | 'fallback';
  diagnostics: string[];
}

const FALLBACK_FX = 11.55;
const READ_TIMEOUT_MS = 8000;

// Trygge standardtabeller. 404 på enkelt-tabeller håndteres stille og blokkerer ikke dashboard.
const DEFAULT_TABLE_CANDIDATES = [
  'real_estate_deals',
  'property_deals',
  'deals',
  'sales',
  'house_sales',
  'commissions',
  'commission_payouts',
  'after_sales',
  'transactions',
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
  return [row?.metadata, row?.meta, row?.data, row?.project, row?.developer, row?.brand, row?.company, row?.customer].filter(Boolean);
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
  const meta = row?.metadata || row?.meta || row?.data || {};
  const candidates = [
    getAny(row, ['brand_id', 'brand', 'business_unit', 'businessUnit', 'source_type', 'company', 'project_brand', 'developer_name', 'developer', 'builder', 'project_name', 'project']),
    meta.brand, meta.brand_id, meta.businessUnit, meta.business_unit, meta.company, meta.source, meta.project, meta.developer,
  ].flatMap((value) => Array.isArray(value) ? value : [value]).map(normalize).filter(Boolean);
  const joined = candidates.join(' ');
  if (joined.includes('soleada')) return 'soleada';
  if (joined.includes('zenecohomes') || joined.includes('zeneco') || joined.includes('zeneohomes') || joined.includes('zenhomes') || joined.includes('zenecohome')) return 'zenecohomes';
  return 'other';
}

function emptyBrand(key: CommissionBrandKey): BrandCommission {
  return { key, brand: key === 'soleada' ? 'Soleada' : key === 'zenecohomes' ? 'ZenEcoHomes' : 'Andre / ukjent', totalEur: 0, totalNok: 0, count: 0, rawBrandIds: [], monthly: [] };
}

function amountValue(row: any): number {
  const value = getAny(row, [
    'amount', 'commission_amount', 'our_commission', 'ourGrossCommission', 'our_gross_commission',
    'gross_commission', 'net_commission', 'ourNetCommission', 'our_net_commission', 'expected_amount',
    'payout_amount', 'commission', 'total_commission', 'sales_commission', 'sale_commission', 'value', 'price_commission',
  ]);
  return Number(value || 0);
}

function currencyValue(row: any): string { return String(getAny(row, ['currency', 'commission_currency', 'amount_currency']) || 'EUR').toUpperCase(); }
function dateValue(row: any): string { return String(getAny(row, ['event_date', 'date', 'sale_date', 'created_at', 'expected_date', 'payment_date', 'sold_at', 'closed_at', 'updated_at']) || new Date().toISOString()).slice(0, 10); }

function isCommissionRow(row: any, table: string): boolean {
  if (['commission_payouts', 'commissions'].includes(table)) return true;
  const meta = row?.metadata || row?.meta || row?.data || {};
  const text = [
    table, row?.stream, row?.type, row?.category, row?.description, row?.event_type, row?.status,
    meta.stream, meta.type, meta.category, meta.description, meta.status,
  ].map((x) => String(x || '').toLowerCase()).join(' ');
  return text.includes('commission') || text.includes('kommisjon') || text.includes('provisjon') || text.includes('provision') || amountValue(row) > 0;
}

function isIncomeRow(row: any): boolean {
  const direction = String(getAny(row, ['direction', 'type', 'kind', 'status']) || '').toLowerCase();
  if (!direction) return true;
  return ['income', 'in', 'credit', 'paid', 'expected', 'recognized', 'closed', 'won', 'sold', 'commission'].some((x) => direction.includes(x));
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
    const result: any = await withTimeout(supabasePublic.from(table).select('*').limit(1000), table);
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

export async function fetchRealtyflowCommissions(): Promise<RealtyflowSummary> {
  const fx = await getEurToNokRate();
  const fxRate = fx.rate || FALLBACK_FX;
  const baseDiagnostics = [`App-versjon: ${APP_VERSION}`, ...fx.diagnostics];
  const empty: RealtyflowSummary = { brands: [emptyBrand('soleada'), emptyBrand('zenecohomes')], totalEur: 0, totalNok: 0, fxRate, source: 'fallback', diagnostics: baseDiagnostics };
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
    usingExplicitTables ? `RealtyFlow-tabeller fra env: ${tables.join(', ')}` : `RealtyFlow-tabeller autodetekteres trygt: ${tables.join(', ')}`,
  ];
  const byBrand = new Map<CommissionBrandKey, BrandCommission>();
  byBrand.set('soleada', emptyBrand('soleada'));
  byBrand.set('zenecohomes', emptyBrand('zenecohomes'));

  let totalRows = 0;
  let matchedRows = 0;
  let missingTables = 0;
  let existingTables = 0;
  const rawBrands = new Set<string>();
  let invalidKeySeen = false;

  for (const table of tables) {
    const result = await readRows(table);
    if (result.error) {
      if (result.missing && !usingExplicitTables) {
        missingTables += 1;
        continue;
      }
      diagnostics.push(result.error);
      if (result.error.toLowerCase().includes('invalid api key')) { invalidKeySeen = true; break; }
      continue;
    }
    existingTables += 1;
    diagnostics.push(`${table}: ${result.rows.length} rader lest`);
    totalRows += result.rows.length;
    for (const row of result.rows) {
      const brand = brandKey(row);
      const rawBrand = String(getAny(row, ['brand_id', 'brand', 'business_unit', 'businessUnit', 'company', 'source_type', 'developer_name', 'developer', 'project_name']) || '');
      if (rawBrand) rawBrands.add(rawBrand);
      if (brand === 'other' || !isCommissionRow(row, table) || !isIncomeRow(row)) continue;
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

  if (invalidKeySeen) diagnostics.push('RealtyFlow-nøkkelen er ugyldig i denne builden/cachet nettleser. Hvis desktop fungerer men mobil feiler, slett mobilens nettstedsdata eller åpne etter ny Vercel-deploy.');
  if (!usingExplicitTables && missingTables > 0) diagnostics.push(`${missingTables} standardtabeller finnes ikke i RealtyFlow og ble hoppet over uten å blokkere siden.`);
  if (existingTables === 0) diagnostics.push('Fant ingen lesbare RealtyFlow-tabeller. Sett VITE_REALTYFLOW_COMMISSION_TABLES til faktiske tabellnavn for salg/kommisjoner.');

  const brands = Array.from(byBrand.values()).map((b) => ({ ...b, totalNok: b.totalEur * fxRate, monthly: b.monthly.sort((a, b) => (a.month < b.month ? -1 : 1)) }));
  const totalEur = brands.reduce((sum, b) => sum + b.totalEur, 0);
  diagnostics.push(`Totalt leste rader: ${totalRows}`);
  diagnostics.push(`Matchede kommisjonsrader for Soleada/ZenEcoHomes: ${matchedRows}`);
  if (rawBrands.size > 0) diagnostics.push(`Brand/business values funnet: ${Array.from(rawBrands).slice(0, 30).join(', ')}`);

  return { brands, totalEur, totalNok: totalEur * fxRate, fxRate, source: invalidKeySeen || existingTables === 0 ? 'fallback' : 'supabase', diagnostics };
}
