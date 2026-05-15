import { supabase, isSupabaseConfigured } from '../supabase';
import { Asset, BankAccount, FamilyMember, Transaction } from '../types';

type PersistenceTable = 'transactions' | 'members' | 'assets' | 'bank_accounts';
type SafeSelectResult = { rows: any[]; ok: boolean };

try {
  localStorage.removeItem('familyhub_tx_sync_disabled_until');
  localStorage.removeItem('familyhub_member_sync_disabled_until');
  localStorage.removeItem('familyhub_asset_sync_disabled_until');
  localStorage.removeItem('familyhub_account_sync_disabled_until');
  localStorage.removeItem('familyhub_missing_supabase_tables_v1');
} catch {}

function backupKey(userId: string, name: string) { return `familyhub_backup_${name}_${userId}`; }
function readBackup<T>(userId: string, name: string): T[] { try { const data = JSON.parse(localStorage.getItem(backupKey(userId, name)) || '[]'); return Array.isArray(data) ? data : []; } catch { return []; } }
function writeBackup(userId: string, name: string, data: any[]) { try { if (Array.isArray(data) && data.length > 0) localStorage.setItem(backupKey(userId, name), JSON.stringify(data.slice(0, 5000))); } catch {} }
function cleanId(value: unknown, fallback: string) { return String(value || '').trim() || fallback; }
function cleanDay(value: unknown): number | undefined { const day = Number(value || 0); if (!Number.isFinite(day) || day < 1 || day > 31) return undefined; return Math.round(day); }
function nowIsoDate() { return new Date().toISOString().slice(0, 10); }
function numberValue(value: unknown) { const n = Number(value || 0); return Number.isFinite(n) ? n : 0; }
function assetValue(assetOrRow: any) { return numberValue(assetOrRow?.value ?? assetOrRow?.current_value ?? assetOrRow?.currentValue); }
function safePaymentMethod(value: any) { return value || 'Bank'; }
function isSchemaError(error: any) { const text = `${error?.code || ''} ${error?.message || ''} ${error?.details || ''}`.toLowerCase(); return text.includes('column') || text.includes('schema cache') || text.includes('pgrst204') || text.includes('bad request') || text.includes('400'); }
function isMissingTable(error: any) { const text = `${error?.code || ''} ${error?.message || ''} ${error?.details || ''}`.toLowerCase(); return text.includes('404') || text.includes('pgrst205') || text.includes('does not exist') || text.includes('could not find') || text.includes('schema cache'); }

export function mapTransactionRow(row: any): Transaction { return { ...row, amount: numberValue(row.amount), paymentMethod: row.payment_method || row.paymentMethod || 'Bank', isAccrual: !!(row.is_accrual ?? row.isAccrual), fromAccountId: row.from_account_id || row.fromAccountId || undefined, toAccountId: row.to_account_id || row.toAccountId || undefined, isVerified: !!(row.is_verified ?? row.isVerified), verifiedAt: row.verified_at || row.verifiedAt || undefined, verificationSource: row.verification_source || row.verificationSource || undefined, matchedReceiptId: row.matched_receipt_id || row.matchedReceiptId || undefined, bankStatementRef: row.bank_statement_ref || row.bankStatementRef || undefined } as Transaction; }
export function mapMemberRow(row: any): FamilyMember { return { id: cleanId(row.id, `fm-${Date.now()}`), name: row.name || '', birthDate: row.birth_date || row.birthDate || nowIsoDate(), monthlySalary: numberValue(row.monthly_salary || row.monthlySalary), monthlyBenefits: numberValue(row.monthly_benefits || row.monthlyBenefits), monthlyChildBenefit: numberValue(row.monthly_child_benefit || row.monthlyChildBenefit), salaryDay: cleanDay(row.salary_day || row.salaryDay), salaryAccountId: row.salary_account_id || row.salaryAccountId || undefined }; }
export function mapAssetRow(row: any): Asset { const value = assetValue(row); return { ...row, id: cleanId(row.id, `asset-${Date.now()}`), name: row.name || row.asset_name || 'Eiendel', category: row.category || row.asset_category || row.type || 'OTHER', value, currentValue: value, currency: row.currency || 'NOK', purchasePrice: row.purchase_price ?? row.purchasePrice ?? undefined, purchaseDate: row.purchase_date || row.purchaseDate || undefined, linkedLoanAccountId: row.linked_loan_account_id || row.linkedLoanAccountId || undefined } as any; }
export function mapBankAccountRow(row: any): BankAccount { return { id: cleanId(row.id, `account-${Date.now()}`), bankName: row.bank_name || row.bankName || row.bank || 'Bank', accountName: row.account_name || row.accountName || row.name || 'Konto', accountNumber: row.account_number || row.accountNumber || undefined, balance: numberValue(row.balance), currency: row.currency || 'NOK', type: row.type || row.account_type || row.accountType || 'CHECKING', interestRate: row.interest_rate ?? row.interestRate ?? undefined, creditLimit: row.credit_limit ?? row.creditLimit ?? undefined } as BankAccount; }

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
  if (result.error) { console.error(`[familyPersistence] ${table} load failed`, result.error); return { rows: [], ok: false }; }
  return { rows: result.data || [], ok: true };
}

export async function loadFamilyPersistentData(userId: string) {
  const fallback = { transactions: readBackup<Transaction>(userId, 'transactions'), members: readBackup<FamilyMember>(userId, 'members'), assets: readBackup<Asset>(userId, 'assets'), bankAccounts: readBackup<BankAccount>(userId, 'bank_accounts') };
  if (!isSupabaseConfigured() || !userId) return fallback;
  const [tx, member, asset, bank] = await Promise.all([safeSelect('transactions', userId), safeSelect('members', userId, 'name'), safeSelect('assets', userId, 'name'), safeSelect('bank_accounts', userId, 'account_name')]);
  const transactions = tx.ok && tx.rows.length > 0 ? tx.rows.map(mapTransactionRow).sort((a, b) => b.date.localeCompare(a.date)) : fallback.transactions;
  const members = member.ok && member.rows.length > 0 ? member.rows.map(mapMemberRow) : fallback.members;
  const assets = asset.ok && asset.rows.length > 0 ? asset.rows.map(mapAssetRow) : fallback.assets;
  const bankAccounts = bank.ok && bank.rows.length > 0 ? bank.rows.map(mapBankAccountRow) : fallback.bankAccounts;
  writeBackup(userId, 'transactions', transactions);
  writeBackup(userId, 'members', members);
  writeBackup(userId, 'assets', assets);
  writeBackup(userId, 'bank_accounts', bankAccounts);
  return { transactions, members, assets, bankAccounts };
}

async function upsertWithFallbacks(table: PersistenceTable, variants: any[]) {
  let lastError: any = null;
  for (const rows of variants) {
    const payload = Array.isArray(rows) ? rows : [rows];
    if (payload.length === 0) return null;
    const { error } = await supabase.from(table).upsert(payload, { onConflict: 'id' });
    if (!error) return null;
    lastError = error;
    if (isMissingTable(error) || !isSchemaError(error)) break;
  }
  console.error(`[familyPersistence] ${table} upsert failed`, lastError);
  return lastError;
}
async function upsertOneTransaction(userId: string, tx: Transaction) { const error = await upsertWithFallbacks('transactions', [fullTransactionRow(userId, tx), snakeLegacyTransactionRow(userId, tx), camelLegacyTransactionRow(userId, tx), minimalTransactionRow(userId, tx)]); if (error) throw error; }
export async function saveTransactionToSupabase(userId: string, tx: Transaction) { if (!userId) return; writeBackup(userId, 'transactions', [tx, ...readBackup<Transaction>(userId, 'transactions').filter((t: any) => t.id !== tx.id)]); if (!isSupabaseConfigured()) return; try { await upsertOneTransaction(userId, tx); } catch (err) { console.error('[familyPersistence] transaction sync failed', err); } }
export async function saveTransactionsToSupabase(userId: string, transactions: Transaction[]) { if (!userId || transactions.length === 0) return; writeBackup(userId, 'transactions', transactions); if (!isSupabaseConfigured()) return; try { for (const tx of transactions) await upsertOneTransaction(userId, tx); } catch (err) { console.error('[familyPersistence] transaction sync failed', err); } }
export async function syncTransactions(userId: string, transactions: Transaction[]) { await saveTransactionsToSupabase(userId, transactions); }
export async function deleteTransactionFromSupabase(userId: string, id: string) { if (!userId || !id) return; writeBackup(userId, 'transactions', readBackup<Transaction>(userId, 'transactions').filter((t: any) => t.id !== id)); if (!isSupabaseConfigured()) return; const { error } = await supabase.from('transactions').delete().eq('user_id', userId).eq('id', id); if (error) console.error('[familyPersistence] transaction delete failed', error); }
export async function syncMembers(userId: string, members: FamilyMember[]) { if (!userId || members.length === 0) return; writeBackup(userId, 'members', members); if (!isSupabaseConfigured()) return; const error = await upsertWithFallbacks('members', [fullMemberRows(userId, members), snakeLegacyMemberRows(userId, members), camelLegacyMemberRows(userId, members), minimalMemberRows(userId, members)]); if (error) console.error('[familyPersistence] member sync failed', error); }
export async function deleteMemberFromSupabase(userId: string, id: string) { if (!isSupabaseConfigured() || !userId || !id) return; const { error } = await supabase.from('members').delete().eq('user_id', userId).eq('id', id); if (error) console.error('[familyPersistence] member delete failed', error); }
export async function syncAssets(userId: string, assets: Asset[]) { if (!userId || assets.length === 0) return; writeBackup(userId, 'assets', assets); if (!isSupabaseConfigured()) return; const error = await upsertWithFallbacks('assets', [fullAssetRows(userId, assets), legacyAssetRows(userId, assets), minimalAssetRows(userId, assets)]); if (error) console.error('[familyPersistence] asset sync failed', error); }
export async function deleteAssetFromSupabase(userId: string, id: string) { if (!userId || !id) return; writeBackup(userId, 'assets', readBackup<Asset>(userId, 'assets').filter((a: any) => a.id !== id)); if (!isSupabaseConfigured()) return; const { error } = await supabase.from('assets').delete().eq('user_id', userId).eq('id', id); if (error) console.error('[familyPersistence] asset delete failed', error); }
export async function syncBankAccounts(userId: string, accounts: BankAccount[]) { if (!userId || accounts.length === 0) return; writeBackup(userId, 'bank_accounts', accounts); if (!isSupabaseConfigured()) return; const error = await upsertWithFallbacks('bank_accounts', [fullBankRows(userId, accounts), legacyBankRows(userId, accounts), camelBankRows(userId, accounts), minimalBankRows(userId, accounts)]); if (error) console.error('[familyPersistence] bank account sync failed', error); }
export async function deleteBankAccountFromSupabase(userId: string, id: string) { if (!userId || !id) return; writeBackup(userId, 'bank_accounts', readBackup<BankAccount>(userId, 'bank_accounts').filter((a: any) => a.id !== id)); if (!isSupabaseConfigured()) return; const { error } = await supabase.from('bank_accounts').delete().eq('user_id', userId).eq('id', id); if (error) console.error('[familyPersistence] bank account delete failed', error); }
