// Handelshistorikk fra kvitteringer — forslag basert på hva familien pleier å kjøpe.

import { supabase, supabaseFamilyData, isSupabaseConfigured } from '../supabase';

const publicDb = supabaseFamilyData;  // receipt_items ligger i public

export interface ReceiptItemRow {
  id: string;
  userId: string;
  receiptId?: string;
  transactionId?: string;
  date: string;
  vendor: string;
  name: string;
  normalizedName: string;
  quantity: number;
  unit?: string;
  pricePerUnit?: number;
  totalPrice: number;
  currency: string;
  category?: string;
}

export interface ProductSuggestion {
  normalizedName: string;
  displayName: string;
  category?: string;
  timesBought: number;
  lastBoughtDate: string;
  daysSinceLastBuy: number;
  averageDaysBetween: number | null;   // interval mellom kjøp — null hvis kun 1 kjøp
  suggestReason: 'due-soon' | 'overdue' | 'frequent' | 'recent';
  lastVendor: string;
  averagePrice: number;
  lastPrice: number;
  currency: string;
  vendorPrices: Record<string, { price: number; date: string }>;   // Mercadona: 1.20€, Carrefour: 1.35€ osv.
}

function normalize(name: string): string {
  return String(name || '')
    .toLowerCase()
    .replace(/\([^)]*\)/g, '')     // fjern parenteser med innhold
    .replace(/\d+[,.\d]*\s?(g|kg|l|ml|stk|ud|uds)?/g, '')  // fjern mengder
    .replace(/[^\w\sáéíóúñ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Lagre ekstraherte kvittering-linjer i receipt_items-tabellen.
 * Returnerer antall som ble lagret.
 */
export async function persistReceiptItems(args: {
  userId: string;
  vendor: string;
  date: string;
  currency: string;
  items: Array<{ name: string; amount?: number; category?: string; quantity?: number; unit?: string; pricePerUnit?: number }>;
  receiptId?: string;
  transactionId?: string;
}): Promise<number> {
  if (!args.userId || !isSupabaseConfigured() || args.items.length === 0) return 0;
  const rows = args.items
    .filter(item => item.name && item.name.trim().length > 0)
    .map((item, idx) => ({
      id: `ri-${args.receiptId || args.transactionId || Date.now()}-${idx}`,
      user_id: args.userId,
      receipt_id: args.receiptId || null,
      transaction_id: args.transactionId || null,
      date: args.date || new Date().toISOString().slice(0, 10),
      vendor: args.vendor || 'Ukjent',
      name: item.name.trim(),
      normalized_name: normalize(item.name),
      quantity: Number(item.quantity || 1),
      unit: item.unit || null,
      price_per_unit: item.pricePerUnit ?? null,
      total_price: Number(item.amount || 0),
      currency: args.currency || 'EUR',
      category: item.category || null,
    }));
  if (rows.length === 0) return 0;
  try {
    const { error } = await publicDb.from('receipt_items').upsert(rows, { onConflict: 'id' });
    if (error) { console.warn('[shoppingHistory] insert failed', error); return 0; }
    return rows.length;
  } catch (e) {
    console.warn('[shoppingHistory] insert crashed', e);
    return 0;
  }
}

/**
 * Beregn hyppig-kjøpt-forslag basert på handelshistorikk.
 * Grupperer på normalized_name, teller kjøp, regner ut intervaller.
 */
export async function suggestFromHistory(userId: string, options?: { limit?: number; daysBack?: number }): Promise<ProductSuggestion[]> {
  if (!userId || !isSupabaseConfigured()) return [];
  const limit = options?.limit || 30;
  const daysBack = options?.daysBack || 180;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - daysBack);
  const cutoffStr = cutoff.toISOString().slice(0, 10);

  try {
    const { data, error } = await publicDb
      .from('receipt_items')
      .select('*')
      .eq('user_id', userId)
      .gte('date', cutoffStr)
      .order('date', { ascending: false });
    if (error || !data) { console.warn('[shoppingHistory] suggest fetch failed', error); return []; }

    // Grupper på normalized_name
    const grouped = new Map<string, ReceiptItemRow[]>();
    for (const r of data as any[]) {
      const key = r.normalized_name || normalize(r.name);
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)!.push({
        id: r.id, userId: r.user_id, receiptId: r.receipt_id, transactionId: r.transaction_id,
        date: r.date, vendor: r.vendor, name: r.name, normalizedName: key,
        quantity: Number(r.quantity), unit: r.unit, pricePerUnit: r.price_per_unit,
        totalPrice: Number(r.total_price), currency: r.currency, category: r.category,
      });
    }

    const now = Date.now();
    const suggestions: ProductSuggestion[] = [];

    for (const [key, items] of grouped) {
      if (items.length === 0) continue;
      // Beregn intervaller mellom kjøp
      const dates = items.map(i => new Date(i.date).getTime()).sort((a, b) => b - a);
      const lastDate = dates[0];
      const daysSinceLastBuy = Math.round((now - lastDate) / (86400 * 1000));
      let averageDaysBetween: number | null = null;
      if (dates.length >= 2) {
        const intervals: number[] = [];
        for (let i = 1; i < dates.length; i++) {
          intervals.push((dates[i - 1] - dates[i]) / (86400 * 1000));
        }
        averageDaysBetween = Math.round(intervals.reduce((s, v) => s + v, 0) / intervals.length);
      }

      // Butikkpris-oppslag
      const vendorPrices: Record<string, { price: number; date: string }> = {};
      for (const it of items) {
        const existing = vendorPrices[it.vendor];
        if (!existing || new Date(it.date) > new Date(existing.date)) {
          vendorPrices[it.vendor] = { price: it.totalPrice, date: it.date };
        }
      }

      const totalPrice = items.reduce((s, i) => s + i.totalPrice, 0);
      const averagePrice = totalPrice / items.length;

      // Klassifiser
      let reason: ProductSuggestion['suggestReason'] = 'recent';
      if (averageDaysBetween && daysSinceLastBuy > averageDaysBetween * 1.3) reason = 'overdue';
      else if (averageDaysBetween && daysSinceLastBuy >= averageDaysBetween * 0.8) reason = 'due-soon';
      else if (items.length >= 3) reason = 'frequent';

      // Displayed name — bruk sist brukte navn
      const displayName = items[0].name;
      const category = items[0].category || undefined;

      suggestions.push({
        normalizedName: key,
        displayName,
        category,
        timesBought: items.length,
        lastBoughtDate: items[0].date,
        daysSinceLastBuy,
        averageDaysBetween,
        suggestReason: reason,
        lastVendor: items[0].vendor,
        averagePrice,
        lastPrice: items[0].totalPrice,
        currency: items[0].currency,
        vendorPrices,
      });
    }

    // Sorter: overdue først, deretter due-soon, deretter frequent basert på antall kjøp
    const priorityScore = (s: ProductSuggestion) => {
      if (s.suggestReason === 'overdue') return 0;
      if (s.suggestReason === 'due-soon') return 1;
      if (s.suggestReason === 'frequent') return 2;
      return 3;
    };
    suggestions.sort((a, b) => {
      const pa = priorityScore(a), pb = priorityScore(b);
      if (pa !== pb) return pa - pb;
      return b.timesBought - a.timesBought;
    });

    return suggestions.slice(0, limit);
  } catch (e) {
    console.warn('[shoppingHistory] suggest crashed', e);
    return [];
  }
}
