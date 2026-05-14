import { Currency, ScannedReceipt, Transaction, TransactionType } from '../types';
import { analyzeBankStatement, fileToBase64 } from './geminiService';
import { runBankStatementFallback } from './aiProviderService';

export interface BankStatementLine {
  id: string;
  date: string;
  description: string;
  amount: number;
  currency: Currency;
  type: TransactionType;
  confidence?: number;
  matchedTransactionId?: string;
  matchedReceiptId?: string;
  status: 'matched' | 'created' | 'unmatched';
}

export interface BankStatementImportResult {
  statementRef: string;
  lines: BankStatementLine[];
  matchedCount: number;
  createdCount: number;
  unmatchedCount: number;
}

function normalizeText(value = '') {
  return String(value).toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
}

function daysBetween(a: string, b: string) {
  const at = new Date(a).getTime();
  const bt = new Date(b).getTime();
  if (!Number.isFinite(at) || !Number.isFinite(bt)) return 999;
  return Math.abs(at - bt) / (1000 * 60 * 60 * 24);
}

function amountClose(a: number, b: number) {
  return Math.abs(Math.abs(Number(a || 0)) - Math.abs(Number(b || 0))) <= 0.75;
}

function inferCategory(description: string) {
  const text = normalizeText(description);
  if (/rema|kiwi|meny|coop|spar|mercadona|carrefour|aldi|lidl|supermercado|grocery|mat/.test(text)) return 'Dagligvarer';
  if (/restaurant|cafe|bar|pizza|burger|takeaway|kebab|sushi/.test(text)) return 'Restaurant';
  if (/fuel|diesel|gasolina|bensin|parking|parkering|taxi|uber|bolt|transport/.test(text)) return 'Transport';
  if (/pharmacy|apotek|farmacia|lege|doctor|health|helse/.test(text)) return 'Helse';
  if (/zara|hm|h m|clothes|klaer|sko|shoes/.test(text)) return 'Klær';
  if (/ikea|leroy|brico|bygg|home|bolig/.test(text)) return 'Bolig';
  if (/car|bil|taller|verksted|service|dekk/.test(text)) return 'Bil';
  return 'Diverse';
}

function parseAmount(value: any) {
  const raw = String(value ?? '').trim();
  if (!raw) return 0;
  const cleaned = raw.replace(/\s/g, '').replace(/[A-Z]{3}|kr|nok|eur|€/gi, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.').replace(/[^0-9.-]/g, '');
  return Number(cleaned || 0);
}

function normalizeDate(value: any) {
  const raw = String(value || '').trim();
  if (!raw) return new Date().toISOString().slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const dot = raw.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})$/);
  if (dot) {
    const day = dot[1].padStart(2, '0');
    const month = dot[2].padStart(2, '0');
    const year = dot[3].length === 2 ? `20${dot[3]}` : dot[3];
    return `${year}-${month}-${day}`;
  }
  const parsed = new Date(raw);
  if (Number.isFinite(parsed.getTime())) return parsed.toISOString().slice(0, 10);
  return new Date().toISOString().slice(0, 10);
}

function splitCsvLine(line: string, delimiter: string) {
  const cells: string[] = [];
  let current = '';
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"' && line[i + 1] === '"') { current += '"'; i += 1; continue; }
    if (char === '"') { quoted = !quoted; continue; }
    if (char === delimiter && !quoted) { cells.push(current.trim()); current = ''; continue; }
    current += char;
  }
  cells.push(current.trim());
  return cells;
}

function parseDelimitedStatement(text: string) {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (lines.length < 2) return [];
  const delimiter = [';', ',', '\t'].sort((a, b) => (lines[0].split(b).length - lines[0].split(a).length))[0];
  const headers = splitCsvLine(lines[0], delimiter).map(normalizeText);
  const findIndex = (patterns: RegExp[]) => headers.findIndex((h) => patterns.some((p) => p.test(h)));
  const dateIndex = findIndex([/dato|date|bokfor|valuter/]);
  const descIndex = findIndex([/tekst|beskrivelse|description|forklaring|mottaker|merchant|navn/]);
  const amountIndex = findIndex([/belop|amount|sum|ut.*inn|transaksjon/]);
  const outIndex = findIndex([/ut|debet|withdrawal|paid|trekk/]);
  const inIndex = findIndex([/inn|kredit|credit|deposit|mottatt/]);
  const currencyIndex = findIndex([/valuta|currency/]);
  return lines.slice(1).map((line, index) => {
    const cells = splitCsvLine(line, delimiter);
    const outAmount = outIndex >= 0 ? parseAmount(cells[outIndex]) : 0;
    const inAmount = inIndex >= 0 ? parseAmount(cells[inIndex]) : 0;
    const rawAmount = amountIndex >= 0 ? parseAmount(cells[amountIndex]) : inAmount || -Math.abs(outAmount);
    const amount = inAmount ? Math.abs(inAmount) : outAmount ? Math.abs(outAmount) : Math.abs(rawAmount);
    const type = inAmount > 0 || rawAmount > 0 ? TransactionType.INCOME : TransactionType.EXPENSE;
    const description = cells[descIndex] || cells.filter((_, i) => ![dateIndex, amountIndex, outIndex, inIndex, currencyIndex].includes(i)).join(' ').trim() || 'Banktransaksjon';
    const currencyRaw = String(cells[currencyIndex] || '').toUpperCase();
    return { date: normalizeDate(cells[dateIndex]), description, amount, currency: currencyRaw.includes('NOK') ? 'NOK' : 'EUR', type, confidence: 0.95, id: `csv-${Date.now()}-${index}`, status: 'unmatched' as const };
  }).filter((line) => line.amount > 0 && line.description);
}

function parsePlainTextStatement(text: string): BankStatementLine[] {
  const rawLines = text.split(/\r?\n/).map((line) => line.replace(/\s+/g, ' ').trim()).filter(Boolean);
  const rows: BankStatementLine[] = [];
  const amountPattern = /([-+]?\d{1,3}(?:[ .]\d{3})*(?:[,.]\d{2})|[-+]?\d+[,.]\d{2})\s*(?:NOK|EUR|kr|€)?/gi;
  const datePattern = /(\d{4}-\d{2}-\d{2}|\d{1,2}[./-]\d{1,2}[./-]\d{2,4})/;
  rawLines.forEach((line, index) => {
    const dateMatch = line.match(datePattern);
    if (!dateMatch) return;
    const amounts = Array.from(line.matchAll(amountPattern)).map((m) => ({ text: m[0], index: m.index || 0, value: parseAmount(m[0]) })).filter((m) => Math.abs(m.value) > 0);
    if (amounts.length === 0) return;
    const amountHit = amounts[amounts.length - 1];
    const beforeAmount = line.slice(0, amountHit.index).replace(dateMatch[0], '').trim();
    const description = beforeAmount || line.replace(dateMatch[0], '').replace(amountHit.text, '').trim() || 'Banktransaksjon';
    const lower = line.toLowerCase();
    const explicitOut = /\b(ut|debet|trekk|betaling|kortkjop|varekjop|withdrawal)\b/.test(lower);
    const explicitIn = /\b(inn|kredit|mottatt|deposit|salary|lønn|lonn)\b/.test(lower);
    const signed = amountHit.value;
    const type = explicitIn || signed > 0 && !explicitOut ? TransactionType.INCOME : TransactionType.EXPENSE;
    rows.push({ id: `pdf-text-${Date.now()}-${index}`, date: normalizeDate(dateMatch[0]), description, amount: Math.abs(signed), currency: lower.includes('nok') || lower.includes('kr') ? 'NOK' : 'EUR', type, confidence: 0.8, status: 'unmatched' });
  });
  return rows;
}

async function extractPdfText(file: File): Promise<string> {
  const pdfjs = await import('pdfjs-dist');
  const worker = await import('pdfjs-dist/build/pdf.worker.mjs?url');
  (pdfjs as any).GlobalWorkerOptions.workerSrc = (worker as any).default;
  const buffer = await file.arrayBuffer();
  const pdf = await (pdfjs as any).getDocument({ data: buffer }).promise;
  const pageTexts: string[] = [];
  for (let pageNo = 1; pageNo <= pdf.numPages; pageNo += 1) {
    const page = await pdf.getPage(pageNo);
    const content = await page.getTextContent();
    const text = content.items.map((item: any) => item.str || '').join(' ');
    pageTexts.push(text);
  }
  return pageTexts.join('\n');
}

async function tryParsePdfStatement(file: File) {
  const name = file.name.toLowerCase();
  const isPdf = file.type.includes('pdf') || name.endsWith('.pdf');
  if (!isPdf) return [];
  try {
    const text = await extractPdfText(file);
    const delimited = parseDelimitedStatement(text);
    if (delimited.length > 0) return delimited;
    return parsePlainTextStatement(text);
  } catch (err) {
    console.warn('[bankStatementService] local PDF text parse failed, using AI fallback', err);
    return [];
  }
}

function normalizeStatementLine(row: any, index: number): BankStatementLine {
  const rawAmount = Number(row?.amount ?? row?.belop ?? row?.value ?? 0);
  const amount = Math.abs(rawAmount);
  const rawType = String(row?.type || '').toUpperCase();
  const type = rawType === 'INCOME' || rawAmount > 0 ? TransactionType.INCOME : TransactionType.EXPENSE;
  const currency = (row?.currency === 'NOK' || row?.currency === 'EUR') ? row.currency : 'EUR';
  return { id: `stmt-line-${Date.now()}-${index}`, date: row?.date || new Date().toISOString().slice(0, 10), description: row?.description || row?.text || row?.merchant || 'Ukjent banktransaksjon', amount, currency, type, confidence: Number(row?.confidence || 0.75), status: 'unmatched' };
}

function findBestMatch(line: BankStatementLine, transactions: Transaction[], receipts: ScannedReceipt[]) {
  const lineText = normalizeText(line.description);
  const candidates = transactions.filter((tx) => tx.paymentMethod === 'Bank').filter((tx) => amountClose(tx.amount, line.amount)).filter((tx) => daysBetween(tx.date, line.date) <= 4).map((tx) => {
    const txText = normalizeText(tx.description);
    const textScore = txText && lineText && (lineText.includes(txText) || txText.includes(lineText)) ? 2 : 0;
    const receipt = receipts.find((r) => r.linkedTransactionId === tx.id || (amountClose(r.amount, line.amount) && daysBetween(r.date, line.date) <= 4));
    const receiptText = normalizeText(receipt?.vendor || '');
    const receiptScore = receiptText && lineText.includes(receiptText) ? 3 : receipt ? 1 : 0;
    return { tx, receipt, score: 5 - daysBetween(tx.date, line.date) + textScore + receiptScore };
  }).sort((a, b) => b.score - a.score);
  return candidates[0] || null;
}

function reconcileLines(lines: BankStatementLine[], transactions: Transaction[], receipts: ScannedReceipt[], statementRef: string): BankStatementImportResult {
  let matchedCount = 0;
  let createdCount = 0;
  let unmatchedCount = 0;
  const processed = lines.map((line) => {
    const match = findBestMatch(line, transactions, receipts);
    if (match?.tx) { matchedCount += 1; return { ...line, status: 'matched' as const, matchedTransactionId: match.tx.id, matchedReceiptId: match.receipt?.id }; }
    if (line.amount > 0) { createdCount += 1; return { ...line, status: 'created' as const }; }
    unmatchedCount += 1;
    return line;
  });
  return { statementRef, lines: processed, matchedCount, createdCount, unmatchedCount };
}

async function tryParseTextStatement(file: File) {
  const name = file.name.toLowerCase();
  const isTextLike = file.type.includes('csv') || file.type.includes('text') || /\.(csv|txt|tsv)$/.test(name);
  if (!isTextLike) return [];
  const text = await file.text();
  return parseDelimitedStatement(text);
}

export async function importBankStatementFile(file: File, transactions: Transaction[], receipts: ScannedReceipt[]): Promise<BankStatementImportResult> {
  const statementRef = `${file.name}-${Date.now()}`;
  const textLines = await tryParseTextStatement(file);
  if (textLines.length > 0) return reconcileLines(textLines, transactions, receipts, statementRef);
  const pdfLines = await tryParsePdfStatement(file);
  if (pdfLines.length > 0) return reconcileLines(pdfLines, transactions, receipts, statementRef);

  const mimeType = file.type || (file.name.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'image/jpeg');
  const b64 = await fileToBase64(file);
  const fallback = await runBankStatementFallback(b64, mimeType, () => analyzeBankStatement(b64, mimeType));
  const rows = Array.isArray(fallback?.result?.transactions) ? fallback.result.transactions : [];
  const lines = rows.map(normalizeStatementLine).filter((line) => line.amount > 0);
  return reconcileLines(lines, transactions, receipts, statementRef);
}

export function applyBankStatementImport(result: BankStatementImportResult, transactions: Transaction[]): Transaction[] {
  const verifiedAt = new Date().toISOString();
  const byId = new Map(transactions.map((tx) => [tx.id, tx]));
  result.lines.forEach((line) => {
    if (line.status === 'matched' && line.matchedTransactionId && byId.has(line.matchedTransactionId)) {
      const existing = byId.get(line.matchedTransactionId)!;
      byId.set(line.matchedTransactionId, { ...existing, isVerified: true, verifiedAt, verificationSource: 'bank_statement', matchedReceiptId: line.matchedReceiptId || existing.matchedReceiptId, bankStatementRef: result.statementRef });
    }
  });
  const createdTransactions = result.lines.filter((line) => line.status === 'created').map((line): Transaction => ({ id: `tx-bank-${Date.now()}-${Math.random().toString(16).slice(2)}`, date: line.date, amount: line.amount, currency: line.currency, description: line.description, category: inferCategory(line.description), type: line.type, paymentMethod: 'Bank', isAccrual: false, isVerified: true, verifiedAt, verificationSource: 'bank_statement', bankStatementRef: result.statementRef }));
  return [...createdTransactions, ...Array.from(byId.values())];
}
