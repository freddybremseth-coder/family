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

type SaleCandidate = {
  identity: string;
  table: string;
  row: any;
  brandKey: CommissionBrandKey;
  rawBrand: string;
  customerName: string;
  salePriceEur: number;
  commissionEur: number;
  payoutDate: string;
  status: string;
  confidence: number;
};

const FALLBACK_FX = 11.55;
const READ_TIMEOUT_MS = 8000;
const DEFAULT_COMMISSION_PERCENT = 5;

const DEFAULT_TABLE_CANDIDATES = [
  'contacts',
  'business_financial_events',
  'realtyflow_payouts',
  'family_economy_realtyflow',
  'family_economy_monthly',
  'realtyflow_deals',
  'real_estate_deals',
  'transactions',
  'properties',
];

function cleanEnv(value: unknown): string { return String(value || '').trim().replace(/^[`'"]|[`'"]$/g, '').trim(); }
function env() { return typeof import.meta !== 'undefined' ? import.meta.env : {}; }
function configuredTables(): string[] {
  const raw = cleanEnv(env().VITE_REALTYFLOW_COMMISSION_TABLES || env().VITE_REALTYFLOW_TABLES || '');
  const explicit = raw.split(',').map((table) => table.trim()).filter(Boolean);
  return explicit.length > 0 ? Array.from(new Set(explicit)) : DEFAULT_TABLE_CANDIDATES;
}
function normalize(value: unknown): string {
  return String(value || '').trim().toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .replace(/æ/g, 'ae').replace(/ø/g, 'o').replace(/å/g, 'a')
    .replace(/https?:\/\//g, '').replace(/www\./g, '').replace(/\.com|\.no|\.es/g, '')
    .replace(/[^a-z0-9]+/g, '');
}
function getFirst(row: any, keys: string[]): any { for (const key of keys) if (row?.[key] !== undefined && row?.[key] !== null && row?.[key] !== '') return row[key]; return undefined; }
function nestedCandidates(row: any) { return [row?.metadata, row?.meta, row?.data, row?.details, row?.payload, row?.project, row?.developer, row?.brand, row?.company, row?.customer, row?.contact, row?.deal].filter(Boolean); }
function getAny(row: any, keys: string[]): any {
  const direct = getFirst(row, keys); if (direct !== undefined && direct !== null && direct !== '') return direct;
  for (const nested of nestedCandidates(row)) { const value = getFirst(nested, keys); if (value !== undefined && value !== null && value !== '') return value; }
  return undefined;
}
function toNumber(value: any): number {
  if (value === undefined || value === null || value === '') return 0;
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  const raw = String(value).trim();
  const normalized = raw.includes(',') && raw.lastIndexOf(',') > raw.lastIndexOf('.') ? raw.replace(/\./g, '').replace(',', '.') : raw.replace(/,/g, '');
  const cleaned = normalized.replace(/[^0-9.-]/g, '');
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}
function brandKey(row: any): CommissionBrandKey {
  const candidates = [getAny(row, ['brand_id', 'brand', 'business_unit', 'businessUnit', 'source_type', 'company', 'project_brand', 'developer_name', 'developer', 'builder', 'project_name', 'project', 'source', 'tenant', 'tenant_id']), JSON.stringify(row || {})]
    .flatMap((value) => Array.isArray(value) ? value : [value]).map(normalize).filter(Boolean);
  const joined = candidates.join(' ');
  if (joined.includes('soleada')) return 'soleada';
  if (joined.includes('zenecohomes') || joined.includes('zeneco') || joined.includes('zeneohomes') || joined.includes('zenhomes') || joined.includes('zenecohome')) return 'zenecohomes';
  return 'other';
}
function brandLabel(key: CommissionBrandKey) { return key === 'soleada' ? 'Soleada' : key === 'zenecohomes' ? 'ZenEcoHomes' : 'Andre / ukjent'; }
function emptyBrand(key: CommissionBrandKey): BrandCommission { return { key, brand: brandLabel(key), totalEur: 0, totalNok: 0, count: 0, rawBrandIds: [], monthly: [] }; }
function salePriceValue(row: any): number { return toNumber(getAny(row, ['sale_price', 'salePrice', 'sales_price', 'pipeline_value', 'pipelineValue', 'property_price', 'purchase_price', 'price', 'budget', 'deal_value', 'sale_value', 'property_value', 'asking_price'])); }
function commissionPercentValue(row: any): number { return toNumber(getAny(row, ['commission_percent', 'commissionPercent', 'commission_pct', 'commissionPct', 'provision_percent', 'provisionPct'])); }
function plainAmountValue(row: any): number { return Math.abs(toNumber(getAny(row, ['amount', 'value', 'total', 'net', 'gross']))); }
function isWonCustomer(row: any): boolean {
  const status = normalize(getAny(row, ['pipeline_status', 'status', 'deal_status', 'stage', 'customer_status', 'lead_status']));
  const score = toNumber(getAny(row, ['buying_signal_score', 'purchase_signal_score', 'sentiment', 'score']));
  return ['won', 'customer', 'vip', 'completed', 'closed', 'sold', 'closedwon', 'vunnet', 'solgt', 'kunde'].some((value) => status.includes(value)) || score >= 100;
}
function amountValue(row: any, table = ''): number {
  const commissionAmount = getAny(row, [
    'amount_eur', 'net_eur', 'total_eur', 'realtyflow_net_eur', 'value_eur',
    'commission_amount', 'commissionAmount', 'our_commission', 'ourCommission', 'ourGrossCommission', 'our_gross_commission',
    'gross_commission', 'net_commission', 'ourNetCommission', 'our_net_commission', 'expected_amount',
    'payout_amount', 'payoutAmount', 'commission', 'total_commission', 'sales_commission', 'sale_commission', 'price_commission',
    'realtyflow_net_nok', 'amount_nok', 'net_nok', 'total_nok',
  ]);
  const directCommission = Math.abs(toNumber(commissionAmount));
  if (directCommission > 0) return directCommission;
  if (['business_financial_events', 'family_economy_realtyflow', 'family_economy_monthly', 'realtyflow_payouts', 'transactions'].includes(table)) {
    const plain = plainAmountValue(row);
    if (plain > 0) return plain;
  }
  const salePrice = salePriceValue(row);
  const pct = commissionPercentValue(row) || (table === 'contacts' && isWonCustomer(row) ? DEFAULT_COMMISSION_PERCENT : 0);
  if (salePrice > 0 && pct > 0) return salePrice * (pct / 100);
  return 0;
}
function customerName(row: any): string { return String(getAny(row, ['customer_name', 'client_name', 'name', 'buyer_name', 'contact_name', 'title', 'description']) || 'RealtyFlow-kunde'); }
function currencyValue(row: any): string { return String(getAny(row, ['currency', 'commission_currency', 'amount_currency']) || 'EUR').toUpperCase(); }
function amountIsNok(row: any) { if (getAny(row, ['realtyflow_net_nok', 'amount_nok', 'net_nok', 'total_nok']) !== undefined) return true; return currencyValue(row) === 'NOK'; }
function dateValue(row: any): string { return String(getAny(row, ['month', 'event_date', 'date', 'sale_date', 'created_at', 'expected_date', 'payment_date', 'payout_date', 'commission_paid_date', 'paid_date', 'sold_at', 'closed_at', 'updated_at']) || new Date().toISOString()).slice(0, 10); }
function payoutDateValue(row: any): string { return String(getAny(row, ['commission_paid_date', 'payout_date', 'payment_date', 'expected_payout_date', 'paid_date', 'expected_date', 'event_date', 'date', 'updated_at']) || dateValue(row)).slice(0, 10); }
function isRejectedRow(row: any): boolean {
  const text = normalize([getAny(row, ['direction', 'type', 'kind', 'status', 'event_type', 'pipeline_status', 'stream']), getAny(row, ['description', 'title'])].join(' '));
  return ['expense', 'cost', 'debit', 'outgoing', 'cancelled', 'canceled', 'deleted', 'lost', 'tapt'].some((x) => text.includes(x));
}
function isCommissionRow(row: any, table: string): boolean {
  if (table === 'business_financial_events') return brandKey(row) !== 'other' && plainAmountValue(row) > 0 && !isRejectedRow(row);
  if (['contacts', 'family_economy_realtyflow', 'realtyflow_payouts', 'family_economy_monthly'].includes(table)) return true;
  const text = [table, JSON.stringify(row || {})].map((x) => String(x || '').toLowerCase()).join(' ');
  return text.includes('commission') || text.includes('kommisjon') || text.includes('provisjon') || text.includes('provision') || text.includes('realtyflow') || amountValue(row, table) > 0;
}
function isIncomeRow(row: any, table: string): boolean {
  if (table === 'business_financial_events') return !isRejectedRow(row);
  const direction = String(getAny(row, ['direction', 'type', 'kind', 'status', 'event_type', 'pipeline_status', 'stream']) || '').toLowerCase();
  if (!direction) return true;
  return ['income', 'in', 'credit', 'paid', 'expected', 'recognized', 'pending', 'closed', 'won', 'customer', 'vip', 'sold', 'vunnet', 'solgt', 'kunde', 'commission', 'provision', 'revenue', 'sale', 'realtyflow'].some((x) => direction.includes(x));
}
async function withTimeout<T>(promise: Promise<T>, label: string, timeoutMs = READ_TIMEOUT_MS): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error(`${label}: timeout etter ${timeoutMs / 1000}s`)), timeoutMs); });
  try { return await Promise.race([promise, timeout]); } finally { clearTimeout(timer!); }
}
function isMissingTableError(errorText = '') { const lower = errorText.toLowerCase(); return lower.includes('404') || lower.includes('not found') || lower.includes('does not exist') || lower.includes('could not find the table') || lower.includes('schema cache'); }
async function readRows(table: string): Promise<{ rows: any[]; error?: string; missing?: boolean }> {
  try {
    const result: any = await withTimeout(supabasePublic.from(table).select('*').limit(2000), table);
    if (result.error) { const error = `${table}: ${result.error.message}`; return { rows: [], error, missing: isMissingTableError(error) }; }
    return { rows: result.data || [] };
  } catch (err: any) { const error = `${table}: ${err?.message || 'ukjent feil'}`; return { rows: [], error, missing: isMissingTableError(error) }; }
}
function rawBrandValue(row: any) { return String(getAny(row, ['brand_id', 'brand', 'business_unit', 'businessUnit', 'company', 'source_type', 'developer_name', 'developer', 'project_name', 'source', 'tenant', 'tenant_id']) || ''); }
function shouldIncludeOtherAsRealtyflow(table: string, row: any) {
  const text = `${table} ${JSON.stringify(row || {})}`.toLowerCase();
  return table === 'family_economy_realtyflow' || table === 'family_economy_monthly' || text.includes('realtyflow') || table === 'contacts' || table === 'business_financial_events' || table === 'realtyflow_payouts';
}
function stableSaleIdentity(row: any, table: string) {
  const strong = getAny(row, ['deal_id', 'dealId', 'contact_id', 'contactId', 'source_id', 'sourceId', 'customer_id', 'customerId']);
  if (strong) return `id:${normalize(strong)}`;
  const email = getAny(row, ['email', 'customer_email', 'client_email']);
  if (email) return `email:${normalize(email)}`;
  const phone = getAny(row, ['phone', 'telephone', 'mobile', 'customer_phone']);
  if (phone) return `phone:${normalize(phone)}`;
  const name = normalize(customerName(row));
  if (name && name !== 'realtyflowkunde') return `name:${name}`;
  const salePrice = salePriceValue(row);
  const payout = payoutDateValue(row);
  const amount = amountValue(row, table);
  return `fallback:${payout}:${Math.round(salePrice || amount)}`;
}
function candidateConfidence(table: string, row: any) {
  let score = 0;
  if (table === 'contacts') score += 100;
  if (isWonCustomer(row)) score += 80;
  if (getAny(row, ['commission_amount', 'commissionAmount', 'payout_amount', 'amount', 'amount_eur'])) score += 40;
  if (salePriceValue(row) > 0) score += 20;
  if (payoutDateValue(row)) score += 10;
  return score;
}
function makeCandidate(row: any, table: string, fxRate: number): SaleCandidate | null {
  if (brandKey(row) === 'other' && !shouldIncludeOtherAsRealtyflow(table, row)) return null;
  if (!isCommissionRow(row, table) || !isIncomeRow(row, table)) return null;
  if (table === 'contacts' && !isWonCustomer(row)) return null;
  const rawAmount = amountValue(row, table);
  if (!rawAmount) return null;
  const commissionEur = amountIsNok(row) ? rawAmount / fxRate : rawAmount;
  const brand = brandKey(row);
  return {
    identity: stableSaleIdentity(row, table),
    table,
    row,
    brandKey: brand,
    rawBrand: rawBrandValue(row),
    customerName: customerName(row),
    salePriceEur: salePriceValue(row),
    commissionEur,
    payoutDate: payoutDateValue(row),
    status: String(getAny(row, ['pipeline_status', 'status', 'deal_status']) || ''),
    confidence: candidateConfidence(table, row),
  };
}
function mergeCandidate(existing: SaleCandidate, incoming: SaleCandidate): SaleCandidate {
  const primary = incoming.confidence > existing.confidence ? incoming : existing;
  const secondary = primary === incoming ? existing : incoming;
  const commissionEur = primary.commissionEur || secondary.commissionEur;
  const salePriceEur = primary.salePriceEur || secondary.salePriceEur;
  const brand = primary.brandKey !== 'other' ? primary.brandKey : secondary.brandKey;
  return { ...primary, brandKey: brand, rawBrand: primary.rawBrand || secondary.rawBrand, commissionEur, salePriceEur, payoutDate: primary.payoutDate || secondary.payoutDate, customerName: primary.customerName || secondary.customerName };
}
function makeEvent(candidate: SaleCandidate, fxRate: number): RealtyflowCommissionEvent {
  return { id: candidate.identity, customerName: candidate.customerName, brandKey: candidate.brandKey, brand: brandLabel(candidate.brandKey), salePriceEur: candidate.salePriceEur, commissionEur: candidate.commissionEur, commissionNok: candidate.commissionEur * fxRate, payoutDate: candidate.payoutDate, status: candidate.status, sourceTable: candidate.table };
}
function addToBrand(item: BrandCommission, event: RealtyflowCommissionEvent, rawBrand?: string) {
  item.totalEur += event.commissionEur;
  item.count += 1;
  if (rawBrand && !item.rawBrandIds.includes(rawBrand)) item.rawBrandIds.push(rawBrand);
  const month = event.payoutDate.slice(0, 7) + '-01';
  const existing = item.monthly.find((x) => x.month === month);
  if (existing) existing.amountEur += event.commissionEur; else item.monthly.push({ month, amountEur: event.commissionEur });
}
function diagnosticSample(row: any) {
  const keys = Object.keys(row || {}).slice(0, 24);
  return keys.map((key) => `${key}=${JSON.stringify(row[key]).slice(0, 60)}`).join(', ');
}

export async function fetchRealtyflowCommissions(): Promise<RealtyflowSummary> {
  const fx = await getEurToNokRate();
  const fxRate = fx.rate || FALLBACK_FX;
  const baseDiagnostics = [`App-versjon: ${APP_VERSION}`, ...fx.diagnostics];
  const empty: RealtyflowSummary = { brands: [emptyBrand('soleada'), emptyBrand('zenecohomes')], totalEur: 0, totalNok: 0, fxRate, source: 'fallback', diagnostics: baseDiagnostics, events: [] };
  const tables = configuredTables();
  const usingExplicitTables = !!cleanEnv(env().VITE_REALTYFLOW_COMMISSION_TABLES || env().VITE_REALTYFLOW_TABLES || '');
  if (!isRealtyflowSupabaseConfigured()) return { ...empty, diagnostics: [...baseDiagnostics, 'RealtyFlow Supabase er ikke konfigurert. Sett VITE_REALTYFLOW_SUPABASE_URL og VITE_REALTYFLOW_SUPABASE_ANON_KEY.', `RealtyFlow URL: ${SUPABASE_REFS.realtyflow || 'mangler'}`, `RealtyFlow key-navn: ${SUPABASE_STATUS.realtyflowResolvedKeyName || 'mangler'}`, `RealtyFlow key-lengde: ${SUPABASE_STATUS.realtyflowKeyLength || 0}`] };

  const diagnostics: string[] = [...baseDiagnostics, `EUR/NOK-kilde: ${fx.source}`, `RealtyFlow URL: ${SUPABASE_REFS.realtyflow}`, `RealtyFlow key konfigurert: ${SUPABASE_STATUS.realtyflowKeyConfigured ? 'ja' : 'nei'}`, `RealtyFlow key-navn: ${SUPABASE_STATUS.realtyflowResolvedKeyName || 'mangler'}`, `RealtyFlow key-lengde: ${SUPABASE_STATUS.realtyflowKeyLength || 0}`, usingExplicitTables ? `RealtyFlow-tabeller fra env: ${tables.join(', ')}` : `RealtyFlow-tabeller autodetekteres: ${tables.join(', ')}`];
  const byIdentity = new Map<string, SaleCandidate>();
  const rawBrands = new Set<string>();
  const samples: string[] = [];
  let totalRows = 0, wonRows = 0, missingAmountRows = 0, missingTables = 0, existingTables = 0, rejectedRows = 0, duplicateRows = 0;
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
      if ((table === 'contacts' || table === 'business_financial_events') && samples.length < 6) samples.push(`${table}: ${diagnosticSample(row)}`);
      const rawBrand = rawBrandValue(row); if (rawBrand) rawBrands.add(rawBrand);
      if (table === 'contacts' && isWonCustomer(row)) wonRows += 1;
      const candidate = makeCandidate(row, table, fxRate);
      if (!candidate) {
        if (table === 'contacts' && isWonCustomer(row) && !amountValue(row, table)) missingAmountRows += 1;
        else rejectedRows += 1;
        continue;
      }
      const existing = byIdentity.get(candidate.identity);
      if (existing) {
        duplicateRows += 1;
        byIdentity.set(candidate.identity, mergeCandidate(existing, candidate));
      } else {
        byIdentity.set(candidate.identity, candidate);
      }
    }
  }

  const byBrand = new Map<CommissionBrandKey, BrandCommission>();
  byBrand.set('soleada', emptyBrand('soleada'));
  byBrand.set('zenecohomes', emptyBrand('zenecohomes'));
  byBrand.set('other', emptyBrand('other'));
  const events = Array.from(byIdentity.values()).map((candidate) => makeEvent(candidate, fxRate)).sort((a, b) => a.payoutDate.localeCompare(b.payoutDate));
  for (const event of events) addToBrand(byBrand.get(event.brandKey) || emptyBrand(event.brandKey), event, byIdentity.get(event.id)?.rawBrand);

  if (invalidKeySeen) diagnostics.push('RealtyFlow-nøkkelen er ugyldig i denne builden/cachet nettleser. Hvis desktop fungerer men mobil feiler, slett mobilens nettstedsdata eller åpne etter ny Vercel-deploy.');
  if (!usingExplicitTables && missingTables > 0) diagnostics.push(`${missingTables} standardtabeller finnes ikke i RealtyFlow og ble hoppet over uten å blokkere siden.`);
  if (existingTables === 0) diagnostics.push('Fant ingen lesbare RealtyFlow-tabeller. Sett VITE_REALTYFLOW_COMMISSION_TABLES til faktiske tabellnavn for salg/kommisjoner.');

  const brands = Array.from(byBrand.values()).filter((brand) => brand.key !== 'other' || brand.count > 0).map((b) => ({ ...b, totalNok: b.totalEur * fxRate, monthly: b.monthly.sort((a, b) => (a.month < b.month ? -1 : 1)) }));
  const totalEur = brands.reduce((sum, b) => sum + b.totalEur, 0);
  diagnostics.push(`Totalt leste rader: ${totalRows}`);
  diagnostics.push(`Vunnet/kunde-rader fra contacts: ${wonRows}`);
  diagnostics.push(`Unike RealtyFlow-salg etter deduplisering: ${events.length}`);
  diagnostics.push(`Dupliserte brand-/finansrader slått sammen: ${duplicateRows}`);
  diagnostics.push(`Filtrerte ikke-kommisjonsrader: ${rejectedRows}`);
  if (missingAmountRows > 0) diagnostics.push(`${missingAmountRows} vunnet/kunde-rader manglet commission_amount, amount, sale_price eller pipeline_value. Kontakter med salgspris bruker standard ${DEFAULT_COMMISSION_PERCENT}% provisjon.`);
  diagnostics.push(`RealtyFlow utbetalingshendelser med dato: ${events.filter((event) => !!event.payoutDate).length}`);
  if (rawBrands.size > 0) diagnostics.push(`Brand/business values funnet: ${Array.from(rawBrands).slice(0, 30).join(', ')}`);
  if (samples.length > 0) diagnostics.push(`Eksempel på felter lest: ${samples.join(' | ')}`);

  return { brands, totalEur, totalNok: totalEur * fxRate, fxRate, source: invalidKeySeen || existingTables === 0 ? 'fallback' : 'supabase', diagnostics, events };
}

export async function fetchRealtyflowCommissionEvents(): Promise<RealtyflowCommissionEvent[]> {
  const summary = await fetchRealtyflowCommissions();
  return summary.events || [];
}
