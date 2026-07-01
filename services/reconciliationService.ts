// Sammenligner transaksjoner fra en importert bank-PDF med eksisterende
// transaksjoner i databasen, og flagger sannsynlige duplikater.

import { Transaction } from '../types';

export interface ImportedTx {
  date: string;         // YYYY-MM-DD
  amount: number;       // Positiv = inntekt, negativ = utgift (eller absoluttverdi + type)
  description?: string;
  currency?: string;
}

export interface ReconciliationMatch {
  imported: ImportedTx;
  existing?: Transaction;
  matchScore: number;   // 0-100
  reason: 'exact' | 'same_day_amount' | 'close_amount' | 'no_match';
}

const DATE_TOLERANCE_DAYS = 2;      // ±2 dager anses som samme betaling
const AMOUNT_TOLERANCE_PCT = 1;     // ±1 % avvik godtas

function daysBetween(a: string, b: string): number {
  const da = new Date(a).getTime();
  const db = new Date(b).getTime();
  return Math.abs(Math.round((da - db) / (1000 * 60 * 60 * 24)));
}

function normalizeAmount(t: Transaction | ImportedTx): number {
  return Math.abs(Number(t.amount || 0));
}

function descriptionSimilarity(a?: string, b?: string): number {
  if (!a || !b) return 0;
  const na = a.toLowerCase().trim();
  const nb = b.toLowerCase().trim();
  if (na === nb) return 100;
  if (na.includes(nb) || nb.includes(na)) return 70;
  // Ordoverlapping
  const wordsA = new Set(na.split(/\W+/).filter(w => w.length > 2));
  const wordsB = new Set(nb.split(/\W+/).filter(w => w.length > 2));
  if (wordsA.size === 0 || wordsB.size === 0) return 0;
  let hits = 0;
  for (const w of wordsA) if (wordsB.has(w)) hits += 1;
  return Math.min(60, Math.round((hits / Math.max(wordsA.size, wordsB.size)) * 100));
}

/**
 * For hver importert transaksjon, finn beste match blant eksisterende.
 * Returnerer et array som er like langt som `imported`.
 */
export function reconcileImports(imported: ImportedTx[], existing: Transaction[]): ReconciliationMatch[] {
  const results: ReconciliationMatch[] = [];
  const usedExisting = new Set<string>();

  for (const imp of imported) {
    const impAmt = normalizeAmount(imp);
    let best: { tx: Transaction; score: number; reason: ReconciliationMatch['reason'] } | null = null;

    for (const ex of existing) {
      if (usedExisting.has(ex.id)) continue;
      const days = daysBetween(imp.date, ex.date);
      if (days > DATE_TOLERANCE_DAYS) continue;
      const exAmt = normalizeAmount(ex);
      if (impAmt === 0) continue;
      const diffPct = Math.abs(exAmt - impAmt) / impAmt * 100;
      if (diffPct > AMOUNT_TOLERANCE_PCT * 3) continue;

      // Score: dato-nærhet + beløps-nøyaktighet + beskrivelse
      const dateScore = Math.max(0, 40 - days * 15);
      const amountScore = diffPct === 0 ? 45 : diffPct <= AMOUNT_TOLERANCE_PCT ? 40 : diffPct <= AMOUNT_TOLERANCE_PCT * 3 ? 20 : 0;
      const descScore = Math.round(descriptionSimilarity(imp.description, ex.description) * 0.15);
      const total = dateScore + amountScore + descScore;

      let reason: ReconciliationMatch['reason'] = 'no_match';
      if (days === 0 && diffPct === 0) reason = 'exact';
      else if (diffPct <= AMOUNT_TOLERANCE_PCT) reason = 'same_day_amount';
      else reason = 'close_amount';

      if (!best || total > best.score) best = { tx: ex, score: total, reason };
    }

    if (best && best.score >= 40) {
      usedExisting.add(best.tx.id);
      results.push({ imported: imp, existing: best.tx, matchScore: best.score, reason: best.reason });
    } else {
      results.push({ imported: imp, matchScore: 0, reason: 'no_match' });
    }
  }

  return results;
}

/**
 * Oppsummeringstall for en reconciliation-analyse.
 */
export function summarizeReconciliation(matches: ReconciliationMatch[]) {
  const exact = matches.filter(m => m.reason === 'exact').length;
  const same = matches.filter(m => m.reason === 'same_day_amount').length;
  const close = matches.filter(m => m.reason === 'close_amount').length;
  const none = matches.filter(m => m.reason === 'no_match').length;
  return {
    total: matches.length,
    duplicatesLikely: exact + same,
    duplicatesPossible: close,
    newTransactions: none,
  };
}
