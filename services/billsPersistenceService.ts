import { Bill, Currency } from '../types';
import { isSupabaseConfigured, supabaseFamilyData } from '../supabase';

const TABLE = 'bills';

function backupKey(userId: string) { return `familyhub_backup_bills_${userId}`; }
function readBackup(userId: string): Bill[] { try { const data = JSON.parse(localStorage.getItem(backupKey(userId)) || '[]'); return Array.isArray(data) ? data.map(mapBillRow) : []; } catch { return []; } }
function writeBackup(userId: string, data: Bill[]) { try { localStorage.setItem(backupKey(userId), JSON.stringify((data || []).slice(0, 2000))); } catch {} }
function numberValue(value: any) { const n = Number(value || 0); return Number.isFinite(n) ? n : 0; }
function todayIso() { return new Date().toISOString().slice(0, 10); }
function billDate(row: any) { return row.due_date || row.dueDate || (row.due_day ? `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-${String(row.due_day).padStart(2, '0')}` : todayIso()); }
function cleanDay(value: any) { const n = Number(value || 0); return Number.isFinite(n) && n >= 1 && n <= 31 ? Math.round(n) : undefined; }

export function mapBillRow(row: any): Bill & any {
  const dueDate = billDate(row);
  return {
    ...row,
    id: String(row.id || `bill-${Date.now()}-${Math.random().toString(16).slice(2)}`),
    name: row.name || row.title || row.description || 'Regning',
    amount: numberValue(row.amount),
    currency: (row.currency || 'EUR') as Currency,
    dueDate,
    dueDay: cleanDay(row.due_day || row.dueDay || dueDate.slice(8, 10)),
    category: row.category || 'Diverse',
    isPaid: !!(row.is_paid ?? row.isPaid),
    paidDate: row.paid_date || row.paidDate || undefined,
    isRecurring: !!(row.is_recurring ?? row.isRecurring),
    frequency: row.frequency || undefined,
    isAutoPay: !!(row.is_auto_pay ?? row.isAutoPay),
    notes: row.notes || undefined,
  };
}

function fullBillRow(userId: string, bill: Bill & any) {
  const dueDate = bill.dueDate || todayIso();
  return {
    id: String(bill.id || `bill-${Date.now()}-${Math.random().toString(16).slice(2)}`),
    user_id: userId,
    name: bill.name || 'Regning',
    amount: numberValue(bill.amount),
    currency: bill.currency || 'EUR',
    due_date: dueDate,
    due_day: cleanDay(bill.dueDay || dueDate.slice(8, 10)) || null,
    category: bill.category || 'Diverse',
    is_paid: !!bill.isPaid,
    paid_date: bill.paidDate || null,
    is_recurring: !!bill.isRecurring,
    frequency: bill.frequency || null,
    is_auto_pay: !!bill.isAutoPay,
    notes: bill.notes || null,
  };
}

function legacyBillRow(userId: string, bill: Bill & any) {
  const dueDate = bill.dueDate || todayIso();
  return {
    id: String(bill.id || `bill-${Date.now()}-${Math.random().toString(16).slice(2)}`),
    user_id: userId,
    name: bill.name || 'Regning',
    amount: numberValue(bill.amount),
    currency: bill.currency || 'EUR',
    due_day: cleanDay(bill.dueDay || dueDate.slice(8, 10)) || null,
    category: bill.category || 'Diverse',
    is_paid: !!bill.isPaid,
  };
}

function isSchemaError(error: any) { const text = `${error?.code || ''} ${error?.message || ''}`.toLowerCase(); return text.includes('schema cache') || text.includes('column') || text.includes('pgrst204') || text.includes('400'); }

export async function loadBills(userId: string): Promise<Bill[]> {
  if (!userId) return [];
  const fallback = readBackup(userId);
  if (!isSupabaseConfigured()) return fallback;
  const { data, error } = await supabaseFamilyData.from(TABLE).select('*').eq('user_id', userId).order('due_date', { ascending: true });
  if (error) {
    console.error('[billsPersistence] load failed', error);
    return fallback;
  }
  const bills = (data || []).map(mapBillRow);
  if (bills.length > 0) writeBackup(userId, bills);
  return bills.length > 0 ? bills : fallback;
}

export async function syncBills(userId: string, bills: Bill[]) {
  if (!userId) return;
  writeBackup(userId, bills || []);
  if (!isSupabaseConfigured()) return;
  const payload = (bills || []).map((bill) => fullBillRow(userId, bill as any));
  if (payload.length === 0) return;
  let result = await supabaseFamilyData.from(TABLE).upsert(payload, { onConflict: 'id' });
  if (result.error && isSchemaError(result.error)) {
    result = await supabaseFamilyData.from(TABLE).upsert((bills || []).map((bill) => legacyBillRow(userId, bill as any)), { onConflict: 'id' });
  }
  if (result.error) console.error('[billsPersistence] sync failed', result.error);
}

export async function deleteBill(userId: string, id: string) {
  if (!userId || !id) return;
  writeBackup(userId, readBackup(userId).filter((bill) => bill.id !== id));
  if (!isSupabaseConfigured()) return;
  const { error } = await supabaseFamilyData.from(TABLE).delete().eq('user_id', userId).eq('id', id);
  if (error) console.error('[billsPersistence] delete failed', error);
}
