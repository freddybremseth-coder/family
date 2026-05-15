import { supabase, isSupabaseConfigured } from '../supabase';
import { FamilyMember, Transaction } from '../types';

const TX_SYNC_DISABLED_KEY = 'familyhub_tx_sync_disabled_until';
const MEMBER_SYNC_DISABLED_KEY = 'familyhub_member_sync_disabled_until';
const DISABLE_MS = 30 * 60 * 1000;

function cleanId(value: unknown, fallback: string) { return String(value || '').trim() || fallback; }
function cleanDay(value: unknown): number | undefined { const day = Number(value || 0); if (!Number.isFinite(day) || day < 1 || day > 31) return undefined; return Math.round(day); }
function nowIsoDate() { return new Date().toISOString().slice(0, 10); }

function isDisabled(key: string) {
  try {
    const until = Number(localStorage.getItem(key) || 0);
    if (until && until > Date.now()) return true;
    if (until) localStorage.removeItem(key);
  } catch {}
  return false;
}

function disable(key: string, label: string, error: any) {
  try { localStorage.setItem(key, String(Date.now() + DISABLE_MS)); } catch {}
  console.warn(`[familyPersistence] ${label} disabled for 30 minutes after Supabase rejected schema`, error);
}

function isSchemaError(error: any) {
  const text = `${error?.code || ''} ${error?.message || ''} ${error?.details || ''}`.toLowerCase();
  return text.includes('column') || text.includes('schema cache') || text.includes('pgrst204') || text.includes('pgrst204') || text.includes('bad request') || text.includes('400');
}

function safePaymentMethod(value: any) { return value || 'Bank'; }

export function mapTransactionRow(row: any): Transaction {
  return {
    ...row,
    amount: Number(row.amount || 0),
    paymentMethod: row.payment_method || row.paymentMethod || 'Bank',
    isAccrual: !!(row.is_accrual ?? row.isAccrual),
    fromAccountId: row.from_account_id || row.fromAccountId || undefined,
    toAccountId: row.to_account_id || row.toAccountId || undefined,
    isVerified: !!(row.is_verified ?? row.isVerified),
    verifiedAt: row.verified_at || row.verifiedAt || undefined,
    verificationSource: row.verification_source || row.verificationSource || undefined,
    matchedReceiptId: row.matched_receipt_id || row.matchedReceiptId || undefined,
    bankStatementRef: row.bank_statement_ref || row.bankStatementRef || undefined,
  } as Transaction;
}

export function mapMemberRow(row: any): FamilyMember {
  return {
    id: cleanId(row.id, `fm-${Date.now()}`),
    name: row.name || '',
    birthDate: row.birth_date || row.birthDate || nowIsoDate(),
    monthlySalary: Number(row.monthly_salary || row.monthlySalary || 0),
    monthlyBenefits: Number(row.monthly_benefits || row.monthlyBenefits || 0),
    monthlyChildBenefit: Number(row.monthly_child_benefit || row.monthlyChildBenefit || 0),
    salaryDay: cleanDay(row.salary_day || row.salaryDay),
    salaryAccountId: row.salary_account_id || row.salaryAccountId || undefined,
  };
}

function fullTransactionRow(userId: string, tx: Transaction) {
  return { id: cleanId(tx.id, `tx-${Date.now()}-${Math.random().toString(16).slice(2)}`), user_id: userId, date: tx.date || nowIsoDate(), amount: Number(tx.amount || 0), currency: tx.currency || 'EUR', description: tx.description || '', category: tx.category || 'Diverse', type: tx.type || 'EXPENSE', payment_method: safePaymentMethod(tx.paymentMethod), is_accrual: !!tx.isAccrual, from_account_id: tx.fromAccountId || null, to_account_id: tx.toAccountId || null, is_verified: !!tx.isVerified, verified_at: tx.verifiedAt || null, verification_source: tx.verificationSource || null, matched_receipt_id: tx.matchedReceiptId || null, bank_statement_ref: tx.bankStatementRef || null };
}
function snakeLegacyTransactionRow(userId: string, tx: Transaction) {
  return { id: cleanId(tx.id, `tx-${Date.now()}-${Math.random().toString(16).slice(2)}`), user_id: userId, date: tx.date || nowIsoDate(), amount: Number(tx.amount || 0), currency: tx.currency || 'EUR', description: tx.description || '', category: tx.category || 'Diverse', type: tx.type || 'EXPENSE', payment_method: safePaymentMethod(tx.paymentMethod) };
}
function camelLegacyTransactionRow(userId: string, tx: Transaction) {
  return { id: cleanId(tx.id, `tx-${Date.now()}-${Math.random().toString(16).slice(2)}`), user_id: userId, date: tx.date || nowIsoDate(), amount: Number(tx.amount || 0), currency: tx.currency || 'EUR', description: tx.description || '', category: tx.category || 'Diverse', type: tx.type || 'EXPENSE', paymentMethod: safePaymentMethod(tx.paymentMethod), isAccrual: !!tx.isAccrual };
}
function minimalTransactionRow(userId: string, tx: Transaction) {
  return { id: cleanId(tx.id, `tx-${Date.now()}-${Math.random().toString(16).slice(2)}`), user_id: userId, date: tx.date || nowIsoDate(), amount: Number(tx.amount || 0), description: tx.description || '', type: tx.type || 'EXPENSE' };
}

function fullMemberRows(userId: string, members: FamilyMember[]) { return members.map((m) => ({ id: cleanId(m.id, `fm-${Date.now()}-${Math.random().toString(16).slice(2)}`), user_id: userId, name: m.name || '', birth_date: m.birthDate || nowIsoDate(), monthly_salary: Number(m.monthlySalary || 0), monthly_benefits: Number(m.monthlyBenefits || 0), monthly_child_benefit: Number(m.monthlyChildBenefit || 0), salary_day: cleanDay(m.salaryDay) || null, salary_account_id: m.salaryAccountId || null })); }
function snakeLegacyMemberRows(userId: string, members: FamilyMember[]) { return members.map((m) => ({ id: cleanId(m.id, `fm-${Date.now()}-${Math.random().toString(16).slice(2)}`), user_id: userId, name: m.name || '', birth_date: m.birthDate || nowIsoDate(), monthly_salary: Number(m.monthlySalary || 0), monthly_benefits: Number(m.monthlyBenefits || 0), monthly_child_benefit: Number(m.monthlyChildBenefit || 0) })); }
function camelLegacyMemberRows(userId: string, members: FamilyMember[]) { return members.map((m) => ({ id: cleanId(m.id, `fm-${Date.now()}-${Math.random().toString(16).slice(2)}`), user_id: userId, name: m.name || '', birthDate: m.birthDate || nowIsoDate(), monthlySalary: Number(m.monthlySalary || 0), monthlyBenefits: Number(m.monthlyBenefits || 0), monthlyChildBenefit: Number(m.monthlyChildBenefit || 0) })); }
function minimalMemberRows(userId: string, members: FamilyMember[]) { return members.map((m) => ({ id: cleanId(m.id, `fm-${Date.now()}-${Math.random().toString(16).slice(2)}`), user_id: userId, name: m.name || '' })); }

export async function loadFamilyPersistentData(userId: string) {
  if (!isSupabaseConfigured() || !userId) return { transactions: [], members: [] };
  const [txResult, memberResult] = await Promise.all([
    supabase.from('transactions').select('*').eq('user_id', userId).order('date', { ascending: false }),
    supabase.from('members').select('*').eq('user_id', userId).order('name', { ascending: true }),
  ]);
  if (txResult.error) console.warn('[familyPersistence] transactions load failed', txResult.error);
  if (memberResult.error) console.warn('[familyPersistence] members load failed', memberResult.error);
  return { transactions: (txResult.data || []).map(mapTransactionRow), members: (memberResult.data || []).map(mapMemberRow) };
}

async function upsertWithFallbacks(table: 'transactions' | 'members', variants: any[]) {
  let lastError: any = null;
  for (const rows of variants) {
    const payload = Array.isArray(rows) ? rows : [rows];
    if (payload.length === 0) return null;
    const { error } = await supabase.from(table).upsert(payload, { onConflict: 'id' });
    if (!error) return null;
    lastError = error;
    if (!isSchemaError(error)) break;
  }
  return lastError;
}

async function upsertOneTransaction(userId: string, tx: Transaction) {
  const error = await upsertWithFallbacks('transactions', [fullTransactionRow(userId, tx), snakeLegacyTransactionRow(userId, tx), camelLegacyTransactionRow(userId, tx), minimalTransactionRow(userId, tx)]);
  if (error) throw error;
}

export async function saveTransactionToSupabase(userId: string, tx: Transaction) {
  if (!isSupabaseConfigured() || !userId || isDisabled(TX_SYNC_DISABLED_KEY)) return;
  try { await upsertOneTransaction(userId, tx); }
  catch (err) { disable(TX_SYNC_DISABLED_KEY, 'transaction sync', err); }
}

export async function saveTransactionsToSupabase(userId: string, transactions: Transaction[]) {
  if (!isSupabaseConfigured() || !userId || transactions.length === 0 || isDisabled(TX_SYNC_DISABLED_KEY)) return;
  try {
    for (const tx of transactions) await upsertOneTransaction(userId, tx);
  } catch (err) {
    disable(TX_SYNC_DISABLED_KEY, 'transaction sync', err);
  }
}

export async function syncTransactions(userId: string, transactions: Transaction[]) { await saveTransactionsToSupabase(userId, transactions); }

export async function deleteTransactionFromSupabase(userId: string, id: string) {
  if (!isSupabaseConfigured() || !userId || !id) return;
  const { error } = await supabase.from('transactions').delete().eq('user_id', userId).eq('id', id);
  if (error) console.warn('[familyPersistence] transaction delete failed', error);
}

export async function syncMembers(userId: string, members: FamilyMember[]) {
  if (!isSupabaseConfigured() || !userId || members.length === 0 || isDisabled(MEMBER_SYNC_DISABLED_KEY)) return;
  const variants = [fullMemberRows(userId, members), snakeLegacyMemberRows(userId, members), camelLegacyMemberRows(userId, members), minimalMemberRows(userId, members)];
  const error = await upsertWithFallbacks('members', variants);
  if (error) disable(MEMBER_SYNC_DISABLED_KEY, 'member sync', error);
}

export async function deleteMemberFromSupabase(userId: string, id: string) {
  if (!isSupabaseConfigured() || !userId || !id) return;
  const { error } = await supabase.from('members').delete().eq('user_id', userId).eq('id', id);
  if (error) console.warn('[familyPersistence] member delete failed', error);
}
