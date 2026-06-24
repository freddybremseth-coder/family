// Parser ut sluttsaldo (utgående balanse) fra en kontoutskrift-PDF.
// Bruker pdfjs-dist for å hente ut all tekst og søker etter mønstre som
// "utgående balanse 3 125,33 EUR" eller "closing balance 12 345.67".

import { Currency } from '../types';

export interface PdfBalanceResult {
  amount: number;
  currency: Currency;
  rawMatch: string;
  source: 'utgaaende_balanse' | 'closing_balance' | 'final_balance' | 'sluttsaldo' | 'totalbeløp';
  // Hele PDF-teksten for debug, ikke vist i UI
  fullText?: string;
}

async function readPdfText(file: File): Promise<string> {
  // Dynamic import slik at pdfjs-dist bare lastes når brukeren trenger det
  const pdfjs = await import('pdfjs-dist');
  // pdfjs trenger worker — Vite kan importere worker-filen med ?url-suffiks
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
  // Håndter både "3 125,33", "3.125,33", "3,125.33", "3125.33"
  const cleaned = raw.replace(/[^\d.,-]/g, '').trim();
  if (!cleaned) return NaN;
  // Hvis komma er sist (norsk/spansk): "3.125,33" eller "3 125,33"
  if (cleaned.lastIndexOf(',') > cleaned.lastIndexOf('.')) {
    return Number(cleaned.replace(/\./g, '').replace(',', '.'));
  }
  // Engelsk: "3,125.33"
  return Number(cleaned.replace(/,/g, ''));
}

function detectCurrency(text: string, near: number): Currency {
  const window = text.slice(Math.max(0, near - 80), near + 80).toLowerCase();
  if (window.includes('eur') || window.includes('€')) return 'EUR';
  if (window.includes('nok') || window.includes('kr')) return 'NOK';
  return 'NOK';
}

const PATTERNS: Array<{ source: PdfBalanceResult['source']; regex: RegExp }> = [
  // Norsk: "Utgående balanse €3 125,33" eller "Utgående balanse  3 125,33"
  { source: 'utgaaende_balanse', regex: /utg[åa]ende\s+balanse[^\d€kr]{0,20}([\d.,\s€kr]+)/gi },
  // Spansk: "Saldo final"
  { source: 'sluttsaldo', regex: /saldo\s+final[^\d€kr]{0,20}([\d.,\s€kr]+)/gi },
  // Engelsk
  { source: 'closing_balance', regex: /closing\s+balance[^\d€kr]{0,20}([\d.,\s€kr]+)/gi },
  { source: 'final_balance', regex: /final\s+balance[^\d€kr]{0,20}([\d.,\s€kr]+)/gi },
  // Norsk: "Sluttsaldo"
  { source: 'sluttsaldo', regex: /sluttsaldo[^\d€kr]{0,20}([\d.,\s€kr]+)/gi },
  // "Totalbeløp" – siste fallback, ofte i samlerader
  { source: 'totalbeløp', regex: /totalbel[øo]p[^\d€kr]{0,20}([\d.,\s€kr]+)/gi },
];

export async function extractClosingBalance(file: File): Promise<PdfBalanceResult | null> {
  const text = await readPdfText(file);
  const lowerText = text.toLowerCase();

  // Søk gjennom mønstre i prioritert rekkefølge
  for (const { source, regex } of PATTERNS) {
    regex.lastIndex = 0;
    let match: RegExpExecArray | null;
    let last: { idx: number; value: number; raw: string } | null = null;
    while ((match = regex.exec(lowerText)) !== null) {
      const amount = parseAmount(match[1]);
      if (Number.isFinite(amount) && amount > 0) {
        last = { idx: match.index, value: amount, raw: match[0] };
      }
    }
    if (last) {
      const currency = detectCurrency(text, last.idx);
      return {
        amount: last.value,
        currency,
        rawMatch: last.raw.trim().slice(0, 200),
        source,
      };
    }
  }
  return null;
}
