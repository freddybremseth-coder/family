import { supabase, isSupabaseConfigured } from '../supabase';
import { FamilyMember, Transaction } from '../types';

function cleanId(value: unknown, fallback: string) {
  return String(value || '').trim() || fallback;
}

export function mapTransactionRow(row: any): Transaction {
  return {
    ...row,
    amount: Number(row.amount || 0),
    paymentMethod: row.paymentMethod || row.payment_method || 'Bank',
    isAccrual: !!row.isAccrual,
    isVerified: !!row.isVerified,
  } as Transaction;
}

export function mapMemberRow(row: any): FamilyMember {
  return {
    id: cleanId(row.id, `fm-${Date.now()}`),
    name: row.name || '',
    birthDate: row.birthDate || row.birth_date || new Date().toISOString().slice(0, 10),
    monthlySalary: Number(row.monthlySalary || row.monthly_salary || 0),
    monthlyBenefits: Number(row.monthlyBenefits || row.monthly_benefits || 0),
    monthlyChildBenefit: Number(row.monthlyChildBenefit || row.monthly_child_benefit || 0),
  };
}

export async function loadFamilyPersistentData(userId: string) {
  if (!isSupabaseConfigured() || !userId) return { transactions: [], members: [] };

  const [txResult, memberResult] = await Promise.all([
    supabase.from('transactions').select('*').eq('user_id', userId).order('date', { ascending: false }),
    supabase.from('members').select('*').eq('user_id', userId).order('name', { ascending: true }),
  ]);

  if (txResult.error) console.warn('[familyPersistence] transactions load failed', txResult.error);
  if (memberResult.error) console.warn('[familyPersistence] members load failed', memberResult.error);

  return {
    transactions: (txResult.data || []).map(mapTransactionRow),
    members: (memberResult.data || []).map(mapMemberRow),
  };
}

export async function syncTransactions(userId: string, transactions: Transaction[]) {
  if (!isSupabaseConfigured() || !userId) return;
  const rows = transactions.map((tx) => ({
    id: cleanId(tx.id, `tx-${Date.now()}-${Math.random().toString(16).slice(2)}`),
    user_id: userId,
    date: tx.date || new Date().toISOString().slice(0, 10),
    amount: Number(tx.amount || 0),
    currency: tx.currency || 'EUR',
    description: tx.description || '',
    category: tx.category || 'Diverse',
    type: tx.type || 'EXPENSE',
    paymentMethod: tx.paymentMethod || 'Bank',
    payment_method: tx.paymentMethod || 'Bank',
    isAccrual: !!tx.isAccrual,
    fromAccountId: tx.fromAccountId || null,
    toAccountId: tx.toAccountId || null,
    isVerified: !!tx.isVerified,
    verifiedAt: tx.verifiedAt || null,
    verificationSource: tx.verificationSource || null,
    matchedReceiptId: tx.matchedReceiptId || null,
    bankStatementRef: tx.bankStatementRef || null,
  }));
  if (rows.length === 0) return;
  const { error } = await supabase.from('transactions').upsert(rows, { onConflict: 'id' });
  if (error) console.warn('[familyPersistence] transactions sync failed', error);
}

export async function deleteTransactionFromSupabase(userId: string, id: string) {
  if (!isSupabaseConfigured() || !userId || !id) return;
  const { error } = await supabase.from('transactions').delete().eq('user_id', userId).eq('id', id);
  if (error) console.warn('[familyPersistence] transaction delete failed', error);
}

export async function syncMembers(userId: string, members: FamilyMember[]) {
  if (!isSupabaseConfigured() || !userId) return;
  const rows = members.map((member) => ({
    id: cleanId(member.id, `fm-${Date.now()}-${Math.random().toString(16).slice(2)}`),
    user_id: userId,
    name: member.name || '',
    birthDate: member.birthDate || new Date().toISOString().slice(0, 10),
    monthlySalary: Number(member.monthlySalary || 0),
    monthlyBenefits: Number(member.monthlyBenefits || 0),
    monthlyChildBenefit: Number(member.monthlyChildBenefit || 0),
  }));
  if (rows.length === 0) return;
  const { error } = await supabase.from('members').upsert(rows, { onConflict: 'id' });
  if (error) console.warn('[familyPersistence] members sync failed', error);
}

export async function deleteMemberFromSupabase(userId: string, id: string) {
  if (!isSupabaseConfigured() || !userId || !id) return;
  const { error } = await supabase.from('members').delete().eq('user_id', userId).eq('id', id);
  if (error) console.warn('[familyPersistence] member delete failed', error);
}
