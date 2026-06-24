// Parser ut sluttsaldo fra en kontoutskrift-PDF.
// Støtter Revolut-format ("Totalbeløp"-rad med 4 beløpskolonner) i tillegg til
// vanlige nøkkelord-mønstre ("Utgående balanse", "Closing balance" osv).

import { Currency } from '../types';

export interface BalanceCandidate {
  amount: number;
  currency: Currency;
  label: string;
  rawMatch: string;
  source: 'totalbeløp' | 'brukskonto' | 'utgaaende_balanse' | 'closing_balance' | 'final_balance' | 'sluttsaldo';
}

export interface PdfBalanceResult extends BalanceCandidate {
  candidates: BalanceCandidate[];
}

async function readPdfText(file: File): Promise<string> {
  const pdfjs = await import('pdfjs-dist');
  const worker = await import('pdfjs-dist/build/pdf.worker.mjs?url');
  (pdfjs as any).GlobalWorkerOptions.workerSrc = (worker as any).default;
  const buf = await file.arrayBuffer();
  const doc = await (pdfjs as any).getDocument({ data: buf }).promise;
  let text = '';
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    text += content.items.map((it: any) => it.str).join(' ') + '\n';
  }
  return text;
}

function parseAmount(raw: string): number {
  const cleaned = raw.replace(/[^\d.,-]/g, '').trim();
  if (!cleaned) return NaN;
  if (cleaned.lastIndexOf(',') > cleaned.lastIndexOf('.')) {
    return Number(cleaned.replace(/\./g, '').replace(',', '.'));
  }
  return Number(cleaned.replace(/,/g, ''));
}

function detectCurrencyAt(text: string, position: number): Currency {
  const window = text.slice(Math.max(0, position - 80), Math.min(text.length, position + 80)).toLowerCase();
  if (window.includes('eur') || window.includes('€')) return 'EUR';
  if (window.includes('nok') || window.includes('kr')) return 'NOK';
  return 'NOK';
}

// Finn alle beløp etter en posisjon (med toleranse for valutatag/whitespace)
const AMOUNT_REGEX = /(€|kr|nok|eur)?\s*([\d]{1,3}(?:[\s.,][\d]{3})*[.,][\d]{2})\s*(€|kr|nok|eur)?/gi;

function nextAmountsAfter(text: string, position: number, maxCount: number, withinChars: number): { value: number; raw: string; index: number }[] {
  AMOUNT_REGEX.lastIndex = position;
  const found: { value: number; raw: string; index: number }[] = [];
  let m: RegExpExecArray | null;
  while ((m = AMOUNT_REGEX.exec(text)) && m.index <= position + withinChars && found.length < maxCount) {
    const v = parseAmount(m[2]);
    if (Number.isFinite(v) && v > 0) found.push({ value: v, raw: m[0].trim(), index: m.index });
  }
  return found;
}

// Finn label + ta n-te beløp etter labelen
function findRowWithAmounts(text: string, labelRegex: RegExp, columnIndex: number, label: string, source: BalanceCandidate['source']): BalanceCandidate | null {
  labelRegex.lastIndex = 0;
  const m = labelRegex.exec(text);
  if (!m) return null;
  const amounts = nextAmountsAfter(text, m.index + m[0].length, 6, 200);
  const pick = amounts[columnIndex];
  if (!pick) return null;
  return {
    amount: pick.value,
    currency: detectCurrencyAt(text, pick.index),
    label,
    source,
    rawMatch: `${m[0]} … ${pick.raw}`.slice(0, 200),
  };
}

export async function extractClosingBalance(file: File): Promise<PdfBalanceResult | null> {
  const text = await readPdfText(file);
  const lowerText = text.toLowerCase();
  const candidates: BalanceCandidate[] = [];

  // Revolut: "Totalbeløp" + 4 kolonner (inngående, ut, inn, utgående)
  const total = findRowWithAmounts(lowerText, /totalbel[øo]p/gi, 3, 'Totalbeløp · utgående balanse', 'totalbeløp');
  if (total) candidates.push(total);

  // Revolut: "Konto (brukskonto)" + 4 kolonner
  const checking = findRowWithAmounts(lowerText, /konto\s*\(brukskonto\)|brukskonto|konto\s+brukskonto/gi, 3, 'Brukskonto · utgående balanse', 'brukskonto');
  if (checking) candidates.push(checking);

  // Generiske nøkkelord — bruk SISTE forekomst (typisk i samlerad)
  const keywordPatterns: Array<{ source: BalanceCandidate['source']; regex: RegExp; label: string; columnIndex: number }> = [
    { source: 'utgaaende_balanse', regex: /utg[åa]ende\s+balanse/gi,    label: 'Utgående balanse',  columnIndex: 0 },
    { source: 'sluttsaldo',        regex: /saldo\s+final/gi,           label: 'Saldo final',       columnIndex: 0 },
    { source: 'closing_balance',   regex: /closing\s+balance/gi,       label: 'Closing balance',   columnIndex: 0 },
    { source: 'final_balance',     regex: /final\s+balance/gi,         label: 'Final balance',     columnIndex: 0 },
    { source: 'sluttsaldo',        regex: /sluttsaldo/gi,              label: 'Sluttsaldo',        columnIndex: 0 },
  ];
  for (const p of keywordPatterns) {
    // Hent siste forekomst — i tabellen er header først, datarad sist
    p.regex.lastIndex = 0;
    let last: RegExpExecArray | null = null;
    let m: RegExpExecArray | null;
    while ((m = p.regex.exec(lowerText)) !== null) last = m;
    if (!last) continue;
    const amounts = nextAmountsAfter(lowerText, last.index + last[0].length, 4, 150);
    const pick = amounts[p.columnIndex];
    if (!pick) continue;
    candidates.push({
      amount: pick.value,
      currency: detectCurrencyAt(text, pick.index),
      label: p.label,
      source: p.source,
      rawMatch: `${last[0]} … ${pick.raw}`.slice(0, 200),
    });
  }

  if (candidates.length === 0) return null;

  // Dedup på (source + amount)
  const seen = new Set<string>();
  const dedup = candidates.filter(c => {
    const k = `${c.source}-${c.amount}-${c.currency}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });

  // Beste kandidat = først (totalbeløp prioriteres)
  return { ...dedup[0], candidates: dedup };
}
