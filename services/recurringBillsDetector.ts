// Detektor for faste regninger basert på transaksjonshistorikk.
// Bruker samme normalisering og kadens-deteksjon som likviditetsprognosen,
// men returnerer Bill-forslag istedenfor LiquidityEvent.

import { Bill, Currency, Transaction, TransactionType } from '../types';

export interface BillSuggestion {
  id: string;
  name: string;
  amount: number;
  currency: Currency;
  category: string;
  dueDay: number;            // dag i måneden (1-31)
  observations: number;      // antall historiske treff
  lastSeen: string;          // YYYY-MM-DD
  cadence: 'weekly' | 'biweekly' | 'monthly' | 'bimonthly' | 'quarterly';
  rationale: string;         // forklarende tekst til brukeren
  // Foreslår om dette ligner en eksisterende regning
  matchesExisting?: string;  // ID til eksisterende bill
}

function normalize(value: string): string {
  return String(value || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '');
}

function normalizeMerchant(description: string): string {
  return normalize(description)
    .replace(/\d{4,}/g, '')
    .replace(/ref[: ]?\w+/g, '')
    .replace(/faktura\s*\d+/g, '')
    .replace(/invoice\s*\d+/g, '')
    .replace(/\b(benidorm|finestrat|alicante|valencia|villajoyosa|cala finestrat|la marina|el campello|denia|granja de roc|mutxamel|cox|callosa de se|la sarga|alcobendas|madrid|pedreguer|ireland|singapore|ca|primevideo\.co|amzn\.com\/bill)\b/gi, '')
    .replace(/^(til|fra|to|from)[: ]/gi, '')
    .replace(/[^a-z0-9æøå ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function titleCase(s: string): string {
  return s.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = values.slice().sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function daysBetween(a: string, b: string): number {
  const da = new Date(a).getTime();
  const db = new Date(b).getTime();
  return Math.abs(Math.round((db - da) / (1000 * 60 * 60 * 24)));
}

// Heuristikker: hva slags merchant ligner en regning?
const BILL_LIKE_KEYWORDS = [
  'iberdrola', 'curenerg', 'fortum', 'tibber', 'strøm', 'nordpool',
  'hidraqua', 'agbar', 'aigues', 'water', 'vann',
  'digi', 'movistar', 'vodafone', 'orange', 'telia', 'telenor', 'tele2',
  'nodo networks', 'internet', 'broadband',
  'forsikring', 'insurance', 'allianz', 'mapfre', 'axa', 'tryg', 'gjensidige',
  'leasing', 'lease',
  'rent', 'leie', 'husleie',
  'gym', 'spa', 'membership', 'medlemskap',
  'subscription', 'abonnement',
  'youtube', 'netflix', 'spotify', 'icloud', 'google one', 'openai', 'supabase', 'dropbox',
];

const NOT_BILL = ['mercadona', 'lidl', 'carrefour', 'consum', 'tienda', 'amazon', 'leroy', 'decathlon', 'mat', 'restaurant', 'kfc', 'don dino', 'new york'];

function classify(merchant: string): { category: string; isLikelyBill: boolean } {
  const m = merchant.toLowerCase();
  if (NOT_BILL.some(w => m.includes(w))) return { category: 'Mat', isLikelyBill: false };
  if (m.includes('iberdrola') || m.includes('curenerg') || m.includes('strøm') || m.includes('fortum') || m.includes('tibber')) return { category: 'Strøm', isLikelyBill: true };
  if (m.includes('hidraqua') || m.includes('vann') || m.includes('aqua') || m.includes('aigues')) return { category: 'Vann', isLikelyBill: true };
  if (m.includes('digi') || m.includes('movistar') || m.includes('vodafone') || m.includes('orange') || m.includes('telia') || m.includes('telenor')) return { category: 'Telefon', isLikelyBill: true };
  if (m.includes('nodo') || m.includes('internet') || m.includes('broadband')) return { category: 'Internett', isLikelyBill: true };
  if (m.includes('forsikring') || m.includes('insurance') || m.includes('allianz') || m.includes('mapfre') || m.includes('tryg') || m.includes('gjensidige')) return { category: 'Forsikring', isLikelyBill: true };
  if (m.includes('youtube') || m.includes('netflix') || m.includes('spotify') || m.includes('google one') || m.includes('icloud') || m.includes('openai') || m.includes('supabase') || m.includes('dropbox') || m.includes('plus-abonnement')) return { category: 'Abonnement', isLikelyBill: true };
  if (m.includes('husleie') || m.includes('rent') || m.includes('leasing')) return { category: 'Bolig', isLikelyBill: true };
  if (m.includes('plenergy') || m.includes('gasexpress') || m.includes('shell') || m.includes('circle k')) return { category: 'Drivstoff', isLikelyBill: false };
  // Fallback: hvis amount er stort og kadens månedlig, behandle som "Fast utgift"
  return { category: 'Fast utgift', isLikelyBill: BILL_LIKE_KEYWORDS.some(k => m.includes(k)) };
}

interface DetectedCadence { cadence: BillSuggestion['cadence']; intervalDays: number; tolerance: number; }
function classifyCadence(intervalDays: number): DetectedCadence | null {
  if (intervalDays >= 26 && intervalDays <= 34) return { cadence: 'monthly',   intervalDays: 30, tolerance: 5 };
  if (intervalDays >= 55 && intervalDays <= 65) return { cadence: 'bimonthly', intervalDays: 60, tolerance: 7 };
  if (intervalDays >= 85 && intervalDays <= 95) return { cadence: 'quarterly', intervalDays: 90, tolerance: 10 };
  // For regninger ignorerer vi ukentlig/2-ukentlig — det er sjelden ekte regninger
  return null;
}

export function detectRecurringBills(transactions: Transaction[], existingBills: Bill[] = []): BillSuggestion[] {
  const now = new Date();
  const cutoff = new Date(now.getFullYear(), now.getMonth() - 4, 1).toISOString().slice(0, 10);

  const groups = new Map<string, { entries: { date: string; amount: number; currency: Currency }[] }>();
  transactions
    .filter(tx => tx.type === TransactionType.EXPENSE && tx.date >= cutoff && Number(tx.amount) > 0)
    .forEach(tx => {
      const merchant = normalizeMerchant(tx.description || '');
      if (!merchant || merchant.length < 3) return;
      const entry = { date: tx.date, amount: Number(tx.amount), currency: (tx.currency || 'NOK') as Currency };
      const g = groups.get(merchant);
      if (g) g.entries.push(entry);
      else groups.set(merchant, { entries: [entry] });
    });

  const suggestions: BillSuggestion[] = [];

  for (const [merchant, group] of groups) {
    const entries = group.entries.sort((a, b) => a.date.localeCompare(b.date));
    if (entries.length < 2) continue;

    const { category, isLikelyBill } = classify(merchant);
    if (!isLikelyBill) continue;

    const intervals: number[] = [];
    for (let i = 1; i < entries.length; i++) intervals.push(daysBetween(entries[i-1].date, entries[i].date));
    const medInt = median(intervals);
    const cadence = classifyCadence(medInt);
    if (!cadence) continue;

    const consistent = intervals.filter(d => Math.abs(d - cadence.intervalDays) <= cadence.tolerance).length;
    if (consistent / intervals.length < 0.5) continue;

    // Snitt fra siste 3 observasjoner
    const recent = entries.slice(-3);
    const avgAmount = Math.round(recent.reduce((s, x) => s + x.amount, 0) / recent.length);
    const last = entries[entries.length - 1];
    if (avgAmount < 5) continue; // microbeløp

    // Forfallsdato: bruk dagen-i-måneden fra siste observasjon
    const dueDay = new Date(last.date).getDate();
    const name = titleCase(merchant);

    // Sjekk om en eksisterende regning likner
    const matchesExisting = existingBills.find(b =>
      normalize(b.name).includes(merchant) || merchant.includes(normalize(b.name))
    )?.id;

    suggestions.push({
      id: `suggest-${merchant.replace(/\s/g, '-')}`,
      name,
      amount: avgAmount,
      currency: last.currency,
      category,
      dueDay,
      observations: entries.length,
      lastSeen: last.date,
      cadence: cadence.cadence,
      rationale: `${entries.length} treff de siste 4 mnd. Median intervall ${Math.round(medInt)} dager. Snitt fra siste 3: ${avgAmount} ${last.currency}.`,
      matchesExisting,
    });
  }

  // Sorter etter beløp (størst først)
  return suggestions.sort((a, b) => b.amount - a.amount);
}

// Konverter et forslag til en Bill ved akseptasjon
export function billFromSuggestion(s: BillSuggestion): Bill {
  // Beregn neste forfall basert på dueDay
  const today = new Date();
  const next = new Date(today.getFullYear(), today.getMonth(), s.dueDay);
  if (next < today) next.setMonth(next.getMonth() + 1);
  const dueDate = next.toISOString().slice(0, 10);

  return {
    id: `bill-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: s.name,
    amount: s.amount,
    currency: s.currency,
    dueDate,
    category: s.category,
    isPaid: false,
    isRecurring: true,
    frequency: s.cadence === 'monthly' ? 'monthly' : s.cadence === 'quarterly' ? 'quarterly' : 'monthly',
  } as any;
}
