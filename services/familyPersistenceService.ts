import { supabase, isSupabaseConfigured } from '../supabase';
import { FamilyMember, Transaction } from '../types';

function cleanId(value: unknown, fallback: string) {
  return String(value || '').trim() || fallback;
}

function cleanDay(value: unknown): number | undefined {
  const day = Number(value || 0);
  if (!Number.isFinite(day) || day < 1 || day > 31) return undefined;
  return Math.round(day);
}

function isSchemaError(error: any) {
  const text = `${error?.code || ''} ${error?.message || ''} ${error?.details || ''}`.toLowerCase();
  return text.includes('column') || text.includes('schema cache') || text.includes('pgrst204') || text.includes('bad request');
}

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
    birthDate: row.birth_date || row.birthDate || new Date().toISOString().slice(0, 10),
    monthlySalary: Number(row.monthly_salary || row.monthlySalary || 0),
    monthlyBenefits: Number(row.monthly_benefits || row.monthlyBenefits || 0),
    monthlyChildBenefit: Number(row.monthly_child_benefit || row.monthlyChildBenefit || 0),
    salaryDay: cleanDay(row.salary_day || row.salaryDay),
    salaryAccountId: row.salary_account_id || row.salaryAccountId || undefined,
  };
}

function fullTransactionRows(userId: string, transactions: Transaction[]) {
  return transactions.map((tx) => ({
    id: cleanId(tx.id, `tx-${Date.now()}-${Math.random().toString(16).slice(2)}`),
    user_id: userId,
    date: tx.date || new Date().toISOString().slice(0, 10),
    amount: Number(tx.amount || 0),
    currency: tx.currency || 'EUR',
    description: tx.description || '',
    category: tx.category || 'Diverse',
    type: tx.type || 'EXPENSE',
    payment_method: tx.paymentMethod || 'Bank',
    is_accrual: !!tx.isAccrual,
    from_account_id: tx.fromAccountId || null,
    to_account_id: tx.toAccountId || null,
    is_verified: !!tx.isVerified,
    verified_at: tx.verifiedAt || null,
    verification_source: tx.verificationSource || null,
    matched_receipt_id: tx.matchedReceiptId || null,
    bank_statement_ref: tx.bankStatementRef || null,
  }));
}

function legacyTransactionRows(userId: string, transactions: Transaction[]) {
  return transactions.map((tx) => ({
    id: cleanId(tx.id, `tx-${Date.now()}-${Math.random().toString(16).slice(2)}`),
    user_id: userId,
    date: tx.date || new Date().toISOString().slice(0, 10),
    amount: Number(tx.amount || 0),
    currency: tx.currency || 'EUR',
    description: tx.description || '',
    category: tx.category || 'Diverse',
    type: tx.type || 'EXPENSE',
    payment_method: tx.paymentMethod || 'Bank',
  }));
}

function fullMemberRows(userId: string, members: FamilyMember[]) {
  return members.map((member) => ({
    id: cleanId(member.id, `fm-${Date.now()}-${Math.random().toString(16).slice(2)}`),
    user_id: userId,
    name: member.name || '',
    birth_date: member.birthDate || new Date().toISOString().slice(0, 10),
    monthly_salary: Number(member.monthlySalary || 0),
    monthly_benefits: Number(member.monthlyBenefits || 0),
    monthly_child_benefit: Number(member.monthlyChildBenefit || 0),
    salary_day: cleanDay(member.salaryDay) || null,
    salary_account_id: member.salaryAccountId || null,
  }));
}

function legacyMemberRows(userId: string, members: FamilyMember[]) {
  return members.map((member) => ({
    id: cleanId(member.id, `fm-${Date.now()}-${Math.random().toString(16).slice(2)}`),
    user_id: userId,
    name: member.name || '',
    birth_date: member.birthDate || new Date().toISOString().slice(0, 10),
    monthly_salary: Number(member.monthlySalary || 0),
    monthly_benefits: Number(member.monthlyBenefits || 0),
    monthly_child_benefit: Number(member.monthlyChildBenefit || 0),
  }));
}

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

export async function syncTransactions(userId: string, transactions: Transaction[]) {
  if (!isSupabaseConfigured() || !userId) return;
  const deleteResult = await supabase.from('transactions').delete().eq('user_id', userId);
  if (deleteResult.error) { console.warn('[familyPersistence] transactions clear failed', deleteResult.error); return; }
  if (transactions.length === 0) return;
  let { error } = await supabase.from('transactions').insert(fullTransactionRows(userId, transactions));
  if (error && isSchemaError(error)) {
    console.warn('[familyPersistence] full transaction sync failed, retrying legacy columns', error);
    const retry = await supabase.from('transactions').insert(legacyTransactionRows(userId, transactions));
    error = retry.error;
  }
  if (error) console.warn('[familyPersistence] transactions sync failed', error);
}

export async function deleteTransactionFromSupabase(userId: string, id: string) {
  if (!isSupabaseConfigured() || !userId || !id) return;
  const { error } = await supabase.from('transactions').delete().eq('user_id', userId).eq('id', id);
  if (error) console.warn('[familyPersistence] transaction delete failed', error);
}

export async function syncMembers(userId: string, members: FamilyMember[]) {
  if (!isSupabaseConfigured() || !userId) return;
  const deleteResult = await supabase.from('members').delete().eq('user_id', userId);
  if (deleteResult.error) { console.warn('[familyPersistence] members clear failed', deleteResult.error); return; }
  if (members.length === 0) return;
  let { error } = await supabase.from('members').insert(fullMemberRows(userId, members));
  if (error && isSchemaError(error)) {
    console.warn('[familyPersistence] full member sync failed, retrying legacy columns', error);
    const retry = await supabase.from('members').insert(legacyMemberRows(userId, members));
    error = retry.error;
  }
  if (error) console.warn('[familyPersistence] members sync failed', error);
}

export async function deleteMemberFromSupabase(userId: string, id: string) {
  if (!isSupabaseConfigured() || !userId || !id) return;
  const { error } = await supabase.from('members').delete().eq('user_id', userId).eq('id', id);
  if (error) console.warn('[familyPersistence] member delete failed', error);
}
