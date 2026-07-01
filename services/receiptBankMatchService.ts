// Matcher skannede kvitteringer mot bank-transaksjoner slik at brukeren ser
// hvilke transaksjoner har kvittering-detaljer og hvilke som mangler.

import { Transaction } from '../types';
import { supabaseFamilyData, isSupabaseConfigured } from '../supabase';

export interface ReceiptMatchRow {
  transactionId: string;
  transactionDate: string;
  transactionAmount: number;
  transactionCurrency: string;
  transactionDescription: string;
  hasReceipt: boolean;
  receiptItems?: Array<{ name: string; total_price: number }>;
  receiptVendor?: string;
  receiptDate?: string;
  matchConfidence: 'exact' | 'close' | 'none';
  daysDiff?: number;
}

const AMOUNT_TOLERANCE = 0.5;
const DATE_TOLERANCE_DAYS = 2;

function daysBetween(a: string, b: string): number {
  return Math.abs(Math.round((new Date(a).getTime() - new Date(b).getTime()) / 86400000));
}

export async function matchReceiptsToTransactions(userId: string, transactions: Transaction[]): Promise<ReceiptMatchRow[]> {
  if (!userId || !isSupabaseConfigured() || transactions.length === 0) return [];

  // Hent alle kvittering-hoder (gruppert på receipt_id + vendor + dato)
  try {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 90);
    const { data: items } = await supabaseFamilyData
      .from('receipt_items')
      .select('receipt_id, transaction_id, vendor, date, total_price, name')
      .eq('user_id', userId)
      .gte('date', cutoff.toISOString().slice(0, 10));
    if (!items) return [];

    // Grupper på receipt_id (eller transaction_id, eller vendor+date som fallback)
    const receipts = new Map<string, { vendor: string; date: string; total: number; items: Array<{ name: string; total_price: number }>; transactionId?: string }>();
    for (const r of items as any[]) {
      const key = r.transaction_id || r.receipt_id || `${r.vendor}-${r.date}`;
      if (!receipts.has(key)) receipts.set(key, { vendor: r.vendor, date: r.date, total: 0, items: [], transactionId: r.transaction_id });
      const receipt = receipts.get(key)!;
      receipt.items.push({ name: r.name, total_price: Number(r.total_price) });
      receipt.total += Number(r.total_price);
    }

    // Gå gjennom hver transaksjon og finn beste match
    const rows: ReceiptMatchRow[] = [];
    const usedReceipts = new Set<string>();

    for (const tx of transactions) {
      if (!tx.date || tx.type !== 'EXPENSE' as any) continue;

      let bestMatch: { key: string; receipt: typeof receipts extends Map<string, infer V> ? V : never; days: number; confidence: 'exact' | 'close' | 'none' } | null = null;

      for (const [key, receipt] of receipts) {
        if (usedReceipts.has(key)) continue;
        const days = daysBetween(tx.date, receipt.date);
        if (days > DATE_TOLERANCE_DAYS) continue;
        const amountDiff = Math.abs(tx.amount - receipt.total);
        if (amountDiff > AMOUNT_TOLERANCE + tx.amount * 0.02) continue;

        const confidence: 'exact' | 'close' = amountDiff < 0.01 && days === 0 ? 'exact' : 'close';
        if (!bestMatch || days < bestMatch.days) {
          bestMatch = { key, receipt, days, confidence };
        }
      }

      if (bestMatch) {
        usedReceipts.add(bestMatch.key);
        rows.push({
          transactionId: tx.id,
          transactionDate: tx.date,
          transactionAmount: tx.amount,
          transactionCurrency: tx.currency,
          transactionDescription: tx.description,
          hasReceipt: true,
          receiptItems: bestMatch.receipt.items,
          receiptVendor: bestMatch.receipt.vendor,
          receiptDate: bestMatch.receipt.date,
          matchConfidence: bestMatch.confidence,
          daysDiff: bestMatch.days,
        });
      } else {
        rows.push({
          transactionId: tx.id,
          transactionDate: tx.date,
          transactionAmount: tx.amount,
          transactionCurrency: tx.currency,
          transactionDescription: tx.description,
          hasReceipt: false,
          matchConfidence: 'none',
        });
      }
    }

    return rows;
  } catch (e) {
    console.warn('[matchReceipts] failed', e);
    return [];
  }
}
