// Auto-budsjett fra handelshistorikk (transactions + receipt_items).
// Bruker de siste N månedene som referanse og foreslår månedlig budsjett
// pr kategori. Ivaretar sesongvariasjon ved å bruke median istedenfor gjennomsnitt
// hvis det er stor variasjon.

import { Transaction, TransactionType } from '../types';
import { supabaseFamilyData, isSupabaseConfigured } from '../supabase';

export interface CategoryBudgetSuggestion {
  category: string;
  averageMonthlyEUR: number;
  averageMonthlyNOK: number;
  medianMonthlyEUR: number;
  monthsUsed: number;
  transactionsCount: number;
  variability: 'low' | 'medium' | 'high';   // hvor mye det svinger
  topVendors: Array<{ vendor: string; total: number }>;
  suggestedBudget: number;                  // i EUR — rundet opp fra median
}

const EUR_TO_NOK = 11.55;

function median(nums: number[]): number {
  if (nums.length === 0) return 0;
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function stddev(nums: number[]): number {
  if (nums.length < 2) return 0;
  const avg = nums.reduce((s, v) => s + v, 0) / nums.length;
  const variance = nums.reduce((s, v) => s + (v - avg) ** 2, 0) / nums.length;
  return Math.sqrt(variance);
}

/**
 * Beregner budsjett-forslag basert på transaksjoner og receipt_items.
 * Sjekker siste 6 måneder.
 */
export async function suggestBudget(userId: string, transactions: Transaction[]): Promise<CategoryBudgetSuggestion[]> {
  if (!userId) return [];

  // 1. Bygg måned → kategori → totalEUR fra transactions
  const monthCatTotal: Record<string, Record<string, number>> = {};
  const vendorTotals: Record<string, Record<string, number>> = {}; // category → vendor → total

  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - 6);

  for (const tx of transactions) {
    if (tx.type !== TransactionType.EXPENSE) continue;
    if (!tx.date || new Date(tx.date) < cutoff) continue;
    const month = tx.date.slice(0, 7);
    const category = tx.category || 'Annet';
    const amountEUR = tx.currency === 'EUR' ? tx.amount : tx.amount / EUR_TO_NOK;
    if (!monthCatTotal[month]) monthCatTotal[month] = {};
    monthCatTotal[month][category] = (monthCatTotal[month][category] || 0) + amountEUR;
    if (!vendorTotals[category]) vendorTotals[category] = {};
    if (tx.description) {
      vendorTotals[category][tx.description] = (vendorTotals[category][tx.description] || 0) + amountEUR;
    }
  }

  // 2. Suppler med receipt_items (mer detaljert vendor-info hvis tilgjengelig)
  if (isSupabaseConfigured()) {
    try {
      const cutoffStr = cutoff.toISOString().slice(0, 10);
      const { data } = await supabaseFamilyData
        .from('receipt_items')
        .select('date, vendor, total_price, currency, category')
        .eq('user_id', userId)
        .gte('date', cutoffStr);
      if (data) {
        for (const r of data as any[]) {
          const category = r.category || 'Dagligvarer';
          const amountEUR = r.currency === 'EUR' ? Number(r.total_price) : Number(r.total_price) / EUR_TO_NOK;
          if (!vendorTotals[category]) vendorTotals[category] = {};
          vendorTotals[category][r.vendor] = (vendorTotals[category][r.vendor] || 0) + amountEUR;
        }
      }
    } catch (e) { console.warn('[budget] receipt_items fetch failed', e); }
  }

  // 3. Beregn pr kategori
  const categories = new Set<string>();
  for (const month in monthCatTotal) for (const cat in monthCatTotal[month]) categories.add(cat);

  const suggestions: CategoryBudgetSuggestion[] = [];
  for (const category of categories) {
    const monthlyValues: number[] = [];
    for (const month in monthCatTotal) {
      monthlyValues.push(monthCatTotal[month][category] || 0);
    }
    if (monthlyValues.length === 0) continue;
    const avg = monthlyValues.reduce((s, v) => s + v, 0) / monthlyValues.length;
    const med = median(monthlyValues);
    const sd = stddev(monthlyValues);
    const cv = avg > 0 ? sd / avg : 0; // koeffisient av variasjon
    const variability: CategoryBudgetSuggestion['variability'] = cv < 0.15 ? 'low' : cv < 0.4 ? 'medium' : 'high';

    // Suggested budget: median + 10% buffer, rundet opp til nærmeste 5€
    const suggested = Math.ceil((med * 1.1) / 5) * 5;

    const topVendors = Object.entries(vendorTotals[category] || {})
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([vendor, total]) => ({ vendor, total }));

    suggestions.push({
      category,
      averageMonthlyEUR: avg,
      averageMonthlyNOK: avg * EUR_TO_NOK,
      medianMonthlyEUR: med,
      monthsUsed: monthlyValues.length,
      transactionsCount: monthlyValues.filter(v => v > 0).length,
      variability,
      topVendors,
      suggestedBudget: suggested,
    });
  }

  suggestions.sort((a, b) => b.averageMonthlyEUR - a.averageMonthlyEUR);
  return suggestions;
}
