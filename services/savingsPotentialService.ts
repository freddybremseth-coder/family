// Beregner potensielt månedlig sparebeløp ved å bytte til billigste butikk pr vare.
import { supabaseFamilyData, isSupabaseConfigured } from '../supabase';

export interface SavingsItem {
  name: string;
  timesBought: number;
  lastBoughtDate: string;
  currentVendor: string;
  currentPrice: number;
  cheapestVendor: string;
  cheapestPrice: number;
  savingsPerUnit: number;
  monthlyBuys: number;
  monthlySavings: number;
  currency: string;
}

export interface SavingsSummary {
  items: SavingsItem[];
  totalMonthlySavings: number;
  totalMonthlyCurrent: number;
  totalMonthlyCheapest: number;
  currency: string;
}

const DAYS_LOOKBACK = 120;

function normalize(name: string): string {
  return String(name || '').toLowerCase().replace(/\([^)]*\)/g, '').replace(/\d+[,.\d]*\s?(g|kg|l|ml|stk|ud|uds)?/g, '').replace(/[^\w\sáéíóúñ]/g, ' ').replace(/\s+/g, ' ').trim();
}

export async function computeSavingsPotential(userId: string): Promise<SavingsSummary> {
  const empty: SavingsSummary = { items: [], totalMonthlySavings: 0, totalMonthlyCurrent: 0, totalMonthlyCheapest: 0, currency: 'EUR' };
  if (!userId || !isSupabaseConfigured()) return empty;
  const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - DAYS_LOOKBACK);
  const cutoffStr = cutoff.toISOString().slice(0, 10);

  try {
    const { data, error } = await supabaseFamilyData
      .from('receipt_items')
      .select('name, normalized_name, vendor, total_price, currency, date, quantity')
      .eq('user_id', userId)
      .gte('date', cutoffStr);
    if (error || !data) return empty;

    // Grupper på normalized_name → { vendor → { minPrice, dates[] } }
    const groups = new Map<string, { name: string; buys: Array<{ vendor: string; price: number; date: string }> }>();
    for (const r of data as any[]) {
      const key = r.normalized_name || normalize(r.name);
      const qty = Number(r.quantity || 1);
      const unitPrice = qty > 0 ? Number(r.total_price) / qty : Number(r.total_price);
      if (!groups.has(key)) groups.set(key, { name: r.name, buys: [] });
      groups.get(key)!.buys.push({ vendor: r.vendor, price: unitPrice, date: r.date });
    }

    const items: SavingsItem[] = [];
    let totalCurrent = 0;
    let totalCheapest = 0;
    const currency = (data[0] as any)?.currency || 'EUR';

    for (const [, group] of groups) {
      if (group.buys.length < 2) continue;  // trenger minst 2 kjøp for å ha data
      // Finn billigste vendor
      const vendorMin: Record<string, number> = {};
      for (const b of group.buys) {
        if (!(b.vendor in vendorMin) || b.price < vendorMin[b.vendor]) vendorMin[b.vendor] = b.price;
      }
      const vendorEntries = Object.entries(vendorMin).sort((a, b) => a[1] - b[1]);
      if (vendorEntries.length < 2) continue;  // trenger flere vendorer for sammenligning
      const cheapest = vendorEntries[0];
      const others = vendorEntries.slice(1);
      if (others.length === 0) continue;

      // Sist brukte vendor
      const sortedByDate = [...group.buys].sort((a, b) => (a.date < b.date ? 1 : -1));
      const latest = sortedByDate[0];
      const savingsPerUnit = latest.price - cheapest[1];
      if (savingsPerUnit <= 0.01) continue;  // ingen ordentlig besparelse

      const monthlyBuys = group.buys.length / (DAYS_LOOKBACK / 30);
      const monthlySavings = savingsPerUnit * monthlyBuys;
      totalCurrent += latest.price * monthlyBuys;
      totalCheapest += cheapest[1] * monthlyBuys;

      items.push({
        name: group.name,
        timesBought: group.buys.length,
        lastBoughtDate: latest.date,
        currentVendor: latest.vendor,
        currentPrice: latest.price,
        cheapestVendor: cheapest[0],
        cheapestPrice: cheapest[1],
        savingsPerUnit,
        monthlyBuys,
        monthlySavings,
        currency,
      });
    }

    items.sort((a, b) => b.monthlySavings - a.monthlySavings);
    const totalMonthlySavings = items.reduce((s, i) => s + i.monthlySavings, 0);
    return { items, totalMonthlySavings, totalMonthlyCurrent: totalCurrent, totalMonthlyCheapest: totalCheapest, currency };
  } catch (e) {
    console.warn('[savings] computed failed', e);
    return empty;
  }
}
