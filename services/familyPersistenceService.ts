import { supabase, isSupabaseConfigured } from '../supabase';
import { Asset, BankAccount, FamilyMember, Transaction } from '../types';

const TX_SYNC_DISABLED_KEY = 'familyhub_tx_sync_disabled_until';
const MEMBER_SYNC_DISABLED_KEY = 'familyhub_member_sync_disabled_until';
const ASSET_SYNC_DISABLED_KEY = 'familyhub_asset_sync_disabled_until';
const ACCOUNT_SYNC_DISABLED_KEY = 'familyhub_account_sync_disabled_until';
const OLD_MISSING_TABLES_KEY = 'familyhub_missing_supabase_tables_v1';
const DISABLE_MS = 30 * 60 * 1000;

type PersistenceTable = 'transactions' | 'members' | 'assets' | 'bank_accounts';
type SafeSelectResult = { rows: any[]; ok: boolean };

try { localStorage.removeItem(OLD_MISSING_TABLES_KEY); } catch {}

function cleanId(value: unknown, fallback: string) { return String(value || '').trim() || fallback; }
function cleanDay(value: unknown): number | undefined { const day = Number(value || 0); if (!Number.isFinite(day) || day < 1 || day > 31) return undefined; return Math.round(day); }
function nowIsoDate() { return new Date().toISOString().slice(0, 10); }
function numberValue(value: unknown) { const n = Number(value || 0); return Number.isFinite(n) ? n : 0; }
function assetValue(assetOrRow: any) { return numberValue(assetOrRow?.value ?? assetOrRow?.current_value ?? assetOrRow?.currentValue); }

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
  return text.includes('column') || text.includes('schema cache') || text.includes('pgrst204') || text.includes('bad request') || text.includes('400');
}

function isMissingTable(error: any) {
  const text = `${error?.code || ''} ${error?.message || ''} ${error?.details || ''}`.toLowerCase();
  return text.includes('404') || text.includes('pgrst205') || text.includes('does not exist') || text.includes('could not find') || text.includes('schema cache');
}

function safePaymentMethod(value: any) { return value || 'Bank'; }

export function mapTransactionRow(row: any): Transaction {
  return { ...row, amount: numberValue(row.amount), paymentMethod: row.payment_method || row.paymentMethod || 'Bank', isAccrual: !!(row.is_accrual ?? row.isAccrual), fromAccountId: row.from_account_id || row.fromAccountId || undefined, toAccountId: row.to_account_id || row.toAccountId || undefined, isVerified: !!(row.is_verified ?? row.isVerified), verifiedAt: row.verified_at || row.verifiedAt || undefined, verificationSource: row.verification_source || row.verificationSource || undefined, matchedReceiptId: row.matched_receipt_id || row.matchedReceiptId || undefined, bankStatementRef: row.bank_statement_ref || row.bankStatementRef || undefined } as Transaction;
}

export function mapMemberRow(row: any): FamilyMember {
  return { id: cleanId(row.id, `fm-${Date.now()}`), name: row.name || '', birthDate: row.birth_date || row.birthDate || nowIsoDate(), monthlySalary: numberValue(row.monthly_salary || row.monthlySalary), monthlyBenefits: numberValue(row.monthly_benefits || row.monthlyBenefits), monthlyChildBenefit: numberValue(row.monthly_child_benefit || row.monthlyChildBenefit), salaryDay: cleanDay(row.salary_day || row.salaryDay), salaryAccountId: row.salary_account_id || row.salaryAccountId || undefined };
}

export function mapAssetRow(row: any): Asset {
  const value = assetValue(row);
  return { ...row, id: cleanId(row.id, `asset-${Date.now()}`), name: row.name || row.asset_name || 'Eiendel', category: row.category || row.asset_category || row.type || 'OTHER', value, currentValue: value, currency: row.currency || 'NOK', purchasePrice: row.purchase_price ?? row.purchasePrice ?? undefined, purchaseDate: row.purchase_date || row.purchaseDate || undefined, linkedLoanAccountId: row.linked_loan_account_id || row.linkedLoanAccountId || undefined } as any;
}

export function mapBankAccountRow(row: any): BankAccount {
  return { id: cleanId(row.id, `account-${Date.now()}`), bankName: row.bank_name || row.bankName || row.bank || 'Bank', accountName: row.account_name || row.accountName || row.name || 'Konto', accountNumber: row.account_number || row.accountNumber || undefined, balance: numberValue(row.balance), currency: row.currency || 'NOK', type: row.type || row.account_type || row.accountType || 'CHECKING', interestRate: row.interest_rate ?? row.interestRate ?? undefined, creditLimit: row.credit_limit ?? row.creditLimit ?? undefined } as BankAccount;
}

function fullTransactionRow(userId: string, tx: Transaction) { return { id: cleanId(tx.id, `tx-${Date.now()}-${Math.random().toString(16).slice(2)}`), user_id: userId, date: tx.date || nowIsoDate(), amount: numberValue(tx.amount), currency: tx.currency || 'EUR', description: tx.description || '', category: tx.category || 'Diverse', type: tx.type || 'EXPENSE', payment_method: safePaymentMethod(tx.paymentMethod), is_accrual: !!tx.isAccrual, from_account_id: tx.fromAccountId || null, to_account_id: tx.toAccountId || null, is_verified: !!tx.isVerified, verified_at: tx.verifiedAt || null, verification_source: tx.verificationSource || null, matched_receipt_id: tx.matchedReceiptId || null, bank_statement_ref: tx.bankStatementRef || null }; }
function snakeLegacyTransactionRow(userId: string, tx: Transaction) { return { id: cleanId(tx.id, `tx-${Date.now()}-${Math.random().toString(16).slice(2)}`), user_id: userId, date: tx.date || nowIsoDate(), amount: numberValue(tx.amount), currency: tx.currency || 'EUR', description: tx.description || '', category: tx.category || 'Diverse', type: tx.type || 'EXPENSE', payment_method: safePaymentMethod(tx.paymentMethod) }; }
function camelLegacyTransactionRow(userId: string, tx: Transaction) { return { id: cleanId(tx.id, `tx-${Date.now()}-${Math.random().toString(16).slice(2)}`), user_id: userId, date: tx.date || nowIsoDate(), amount: numberValue(tx.amount), currency: tx.currency || 'EUR', description: tx.description || '', category: tx.category || 'Diverse', type: tx.type || 'EXPENSE', paymentMethod: safePaymentMethod(tx.paymentMethod), isAccrual: !!tx.isAccrual }; }
function minimalTransactionRow(userId: string, tx: Transaction) { return { id: cleanId(tx.id, `tx-${Date.now()}-${Math.random().toString(16).slice(2)}`), user_id: userId, date: tx.date || nowIsoDate(), amount: numberValue(tx.amount), description: tx.description || '', type: tx.type || 'EXPENSE' }; }

function fullMemberRows(userId: string, members: FamilyMember[]) { return members.map((m) => ({ id: cleanId(m.id, `fm-${Date.now()}-${Math.random().toString(16).slice(2)}`), user_id: userId, name: m.name || '', birth_date: m.birthDate || nowIsoDate(), monthly_salary: numberValue(m.monthlySalary), monthly_benefits: numberValue(m.monthlyBenefits), monthly_child_benefit: numberValue(m.monthlyChildBenefit), salary_day: cleanDay(m.salaryDay) || null, salary_account_id: m.salaryAccountId || null })); }
function snakeLegacyMemberRows(userId: string, members: FamilyMember[]) { return members.map((m) => ({ id: cleanId(m.id, `fm-${Date.now()}-${Math.random().toString(16).slice(2)}`), user_id: userId, name: m.name || '', birth_date: m.birthDate || nowIsoDate(), monthly_salary: numberValue(m.monthlySalary), monthly_benefits: numberValue(m.monthlyBenefits), monthly_child_benefit: numberValue(m.monthlyChildBenefit) })); }
function camelLegacyMemberRows(userId: string, members: FamilyMember[]) { return members.map((m) => ({ id: cleanId(m.id, `fm-${Date.now()}-${Math.random().toString(16).slice(2)}`), user_id: userId, name: m.name || '', birthDate: m.birthDate || nowIsoDate(), monthlySalary: numberValue(m.monthlySalary), monthlyBenefits: numberValue(m.monthlyBenefits), monthlyChildBenefit: numberValue(m.monthlyChildBenefit) })); }
function minimalMemberRows(userId: string, members: FamilyMember[]) { return members.map((m) => ({ id: cleanId(m.id, `fm-${Date.now()}-${Math.random().toString(16).slice(2)}`), user_id: userId, name: m.name || '' })); }

function fullAssetRows(userId: string, assets: Asset[]) { return assets.map((a: any) => ({ id: cleanId(a.id, `asset-${Date.now()}-${Math.random().toString(16).slice(2)}`), user_id: userId, name: a.name || 'Eiendel', category: a.category || a.type || 'OTHER', value: assetValue(a), currency: a.currency || 'NOK', purchase_price: a.purchasePrice ?? null, purchase_date: a.purchaseDate || null, linked_loan_account_id: a.linkedLoanAccountId || null })); }
function legacyAssetRows(userId: string, assets: Asset[]) { return assets.map((a: any) => ({ id: cleanId(a.id, `asset-${Date.now()}-${Math.random().toString(16).slice(2)}`), user_id: userId, name: a.name || 'Eiendel', category: a.category || a.type || 'OTHER', value: assetValue(a), currency: a.currency || 'NOK' })); }
function minimalAssetRows(userId: string, assets: Asset[]) { return assets.map((a: any) => ({ id: cleanId(a.id, `asset-${Date.now()}-${Math.random().toString(16).slice(2)}`), user_id: userId, name: a.name || 'Eiendel', value: assetValue(a) })); }

function fullBankRows(userId: string, accounts: BankAccount[]) { return accounts.map((a) => ({ id: cleanId(a.id, `account-${Date.now()}-${Math.random().toString(16).slice(2)}`), user_id: userId, bank_name: a.bankName || 'Bank', account_name: a.accountName || 'Konto', account_number: a.accountNumber || null, balance: numberValue(a.balance), currency: a.currency || 'NOK', type: a.type || 'CHECKING', interest_rate: a.interestRate ?? null, credit_limit: a.creditLimit ?? null })); }
function legacyBankRows(userId: string, accounts: BankAccount[]) { return accounts.map((a) => ({ id: cleanId(a.id, `account-${Date.now()}-${Math.random().toString(16).slice(2)}`), user_id: userId, bank_name: a.bankName || 'Bank', account_name: a.accountName || 'Konto', balance: numberValue(a.balance), currency: a.currency || 'NOK', type: a.type || 'CHECKING' })); }
function camelBankRows(userId: string, accounts: BankAccount[]) { return accounts.map((a) => ({ id: cleanId(a.id, `account-${Date.now()}-${Math.random().toString(16).slice(2)}`), user_id: userId, bankName: a.bankName || 'Bank', accountName: a.accountName || 'Konto', balance: numberValue(a.balance), currency: a.currency || 'NOK', type: a.type || 'CHECKING' })); }
function minimalBankRows(userId: string, accounts: BankAccount[]) { return accounts.map((a) => ({ id: cleanId(a.id, `account-${Date.now()}-${Math.random().toString(16).slice(2)}`), user_id: userId, balance: numberValue(a.balance), currency: a.currency || 'NOK' })); }

async function safeSelect(table: PersistenceTable, userId: string, orderColumn?: string): Promise<SafeSelectResult> {
  let query = supabase.from(table).select('*').eq('user_id', userId);
  if (orderColumn) query = query.order(orderColumn, { ascending: true });
  const result = await query;
  if (result.error) {
    if (isMissingTable(result.error)) console.warn(`[familyPersistence] ${table} finnes ikke i Supabase. Kjør migration for å aktivere lagring.`, result.error);
    else console.warn(`[familyPersistence] ${table} load failed`, result.error);
    return { rows: [], ok: false };
  }
  return { rows: result.data || [], ok: true };
}

export async function loadFamilyPersistentData(userId: string) {
  if (!isSupabaseConfigured() || !userId) return { transactions: null, members: null, assets: null, bankAccounts: null };
  const [tx, member, asset, bank] = await Promise.all([
    safeSelect('transactions', userId),
    safeSelect('members', userId, 'name'),
    safeSelect('assets', userId, 'name'),
    safeSelect('bank_accounts', userId, 'account_name'),
  ]);
  return {
    transactions: tx.ok ? tx.rows.map(mapTransactionRow).sort((a, b) => b.date.localeCompare(a.date)) : null,
    members: member.ok ? member.rows.map(mapMemberRow) : null,
    assets: asset.ok ? asset.rows.map(mapAssetRow) : null,
    bankAccounts: bank.ok ? bank.rows.map(mapBankAccountRow) : null,
  };
}

async function upsertWithFallbacks(table: PersistenceTable, variants: any[]) {
  let lastError: any = null;
  for (const rows of variants) {
    const payload = Array.isArray(rows) ? rows : [rows];
    if (payload.length === 0) return null;
    const { error } = await supabase.from(table).upsert(payload, { onConflict: 'id' });
    if (!error) return null;
    lastError = error;
    if (isMissingTable(error)) break;
    if (!isSchemaError(error)) break;
  }
  return lastError;
}

async function upsertOneTransaction(userId: string, tx: Transaction) { const error = await upsertWithFallbacks('transactions', [fullTransactionRow(userId, tx), snakeLegacyTransactionRow(userId, tx), camelLegacyTransactionRow(userId, tx), minimalTransactionRow(userId, tx)]); if (error) throw error; }
export async function saveTransactionToSupabase(userId: string, tx: Transaction) { if (!isSupabaseConfigured() || !userId || isDisabled(TX_SYNC_DISABLED_KEY)) return; try { await upsertOneTransaction(userId, tx); } catch (err) { disable(TX_SYNC_DISABLED_KEY, 'transaction sync', err); } }
export async function saveTransactionsToSupabase(userId: string, transactions: Transaction[]) { if (!isSupabaseConfigured() || !userId || transactions.length === 0 || isDisabled(TX_SYNC_DISABLED_KEY)) return; try { for (const tx of transactions) await upsertOneTransaction(userId, tx); } catch (err) { disable(TX_SYNC_DISABLED_KEY, 'transaction sync', err); } }
export async function syncTransactions(userId: string, transactions: Transaction[]) { await saveTransactionsToSupabase(userId, transactions); }
export async function deleteTransactionFromSupabase(userId: string, id: string) { if (!isSupabaseConfigured() || !userId || !id) return; const { error } = await supabase.from('transactions').delete().eq('user_id', userId).eq('id', id); if (error) console.warn('[familyPersistence] transaction delete failed', error); }
export async function syncMembers(userId: string, members: FamilyMember[]) { if (!isSupabaseConfigured() || !userId || members.length === 0 || isDisabled(MEMBER_SYNC_DISABLED_KEY)) return; const error = await upsertWithFallbacks('members', [fullMemberRows(userId, members), snakeLegacyMemberRows(userId, members), camelLegacyMemberRows(userId, members), minimalMemberRows(userId, members)]); if (error) disable(MEMBER_SYNC_DISABLED_KEY, 'member sync', error); }
export async function deleteMemberFromSupabase(userId: string, id: string) { if (!isSupabaseConfigured() || !userId || !id) return; const { error } = await supabase.from('members').delete().eq('user_id', userId).eq('id', id); if (error) console.warn('[familyPersistence] member delete failed', error); }
export async function syncAssets(userId: string, assets: Asset[]) { if (!isSupabaseConfigured() || !userId || assets.length === 0 || isDisabled(ASSET_SYNC_DISABLED_KEY)) return; const error = await upsertWithFallbacks('assets', [fullAssetRows(userId, assets), legacyAssetRows(userId, assets), minimalAssetRows(userId, assets)]); if (error) disable(ASSET_SYNC_DISABLED_KEY, 'asset sync', error); }
export async function deleteAssetFromSupabase(userId: string, id: string) { if (!isSupabaseConfigured() || !userId || !id) return; const { error } = await supabase.from('assets').delete().eq('user_id', userId).eq('id', id); if (error) console.warn('[familyPersistence] asset delete failed', error); }
export async function syncBankAccounts(userId: string, accounts: BankAccount[]) { if (!isSupabaseConfigured() || !userId || accounts.length === 0 || isDisabled(ACCOUNT_SYNC_DISABLED_KEY)) return; const error = await upsertWithFallbacks('bank_accounts', [fullBankRows(userId, accounts), legacyBankRows(userId, accounts), camelBankRows(userId, accounts), minimalBankRows(userId, accounts)]); if (error) disable(ACCOUNT_SYNC_DISABLED_KEY, 'bank account sync', error); }
export async function deleteBankAccountFromSupabase(userId: string, id: string) { if (!isSupabaseConfigured() || !userId || !id) return; const { error } = await supabase.from('bank_accounts').delete().eq('user_id', userId).eq('id', id); if (error) console.warn('[familyPersistence] bank account delete failed', error); }
