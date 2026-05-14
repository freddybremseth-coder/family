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
  return String(value)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
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

function normalizeStatementLine(row: any, index: number): BankStatementLine {
  const amount = Math.abs(Number(row?.amount ?? row?.belop ?? row?.value ?? 0));
  const rawType = String(row?.type || '').toUpperCase();
  const type = rawType === 'INCOME' || Number(row?.amount) > 0 ? TransactionType.INCOME : TransactionType.EXPENSE;
  const currency = (row?.currency === 'NOK' || row?.currency === 'EUR') ? row.currency : 'EUR';
  return {
    id: `stmt-line-${Date.now()}-${index}`,
    date: row?.date || new Date().toISOString().slice(0, 10),
    description: row?.description || row?.text || row?.merchant || 'Ukjent banktransaksjon',
    amount,
    currency,
    type,
    confidence: Number(row?.confidence || 0.75),
    status: 'unmatched',
  };
}

function findBestMatch(line: BankStatementLine, transactions: Transaction[], receipts: ScannedReceipt[]) {
  const lineText = normalizeText(line.description);
  const candidates = transactions
    .filter((tx) => tx.paymentMethod === 'Bank')
    .filter((tx) => amountClose(tx.amount, line.amount))
    .filter((tx) => daysBetween(tx.date, line.date) <= 4)
    .map((tx) => {
      const txText = normalizeText(tx.description);
      const textScore = txText && lineText && (lineText.includes(txText) || txText.includes(lineText)) ? 2 : 0;
      const receipt = receipts.find((r) => r.linkedTransactionId === tx.id || (amountClose(r.amount, line.amount) && daysBetween(r.date, line.date) <= 4));
      const receiptText = normalizeText(receipt?.vendor || '');
      const receiptScore = receiptText && lineText.includes(receiptText) ? 3 : receipt ? 1 : 0;
      return { tx, receipt, score: 5 - daysBetween(tx.date, line.date) + textScore + receiptScore };
    })
    .sort((a, b) => b.score - a.score);

  return candidates[0] || null;
}

export async function importBankStatementFile(
  file: File,
  transactions: Transaction[],
  receipts: ScannedReceipt[],
): Promise<BankStatementImportResult> {
  const mimeType = file.type || (file.name.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'image/jpeg');
  const b64 = await fileToBase64(file);
  const fallback = await runBankStatementFallback(b64, mimeType, () => analyzeBankStatement(b64, mimeType));
  const rows = Array.isArray(fallback?.result?.transactions) ? fallback.result.transactions : [];
  const statementRef = `${file.name}-${Date.now()}`;
  const lines = rows.map(normalizeStatementLine);

  let matchedCount = 0;
  let createdCount = 0;
  let unmatchedCount = 0;

  const processed = lines.map((line) => {
    const match = findBestMatch(line, transactions, receipts);
    if (match?.tx) {
      matchedCount += 1;
      return { ...line, status: 'matched' as const, matchedTransactionId: match.tx.id, matchedReceiptId: match.receipt?.id };
    }
    if (line.amount > 0) {
      createdCount += 1;
      return { ...line, status: 'created' as const };
    }
    unmatchedCount += 1;
    return line;
  });

  return { statementRef, lines: processed, matchedCount, createdCount, unmatchedCount };
}

export function applyBankStatementImport(
  result: BankStatementImportResult,
  transactions: Transaction[],
): Transaction[] {
  const verifiedAt = new Date().toISOString();
  const byId = new Map(transactions.map((tx) => [tx.id, tx]));

  result.lines.forEach((line) => {
    if (line.status === 'matched' && line.matchedTransactionId && byId.has(line.matchedTransactionId)) {
      const existing = byId.get(line.matchedTransactionId)!;
      byId.set(line.matchedTransactionId, {
        ...existing,
        isVerified: true,
        verifiedAt,
        verificationSource: 'bank_statement',
        matchedReceiptId: line.matchedReceiptId || existing.matchedReceiptId,
        bankStatementRef: result.statementRef,
      });
    }
  });

  const createdTransactions = result.lines
    .filter((line) => line.status === 'created')
    .map((line): Transaction => ({
      id: `tx-bank-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      date: line.date,
      amount: line.amount,
      currency: line.currency,
      description: line.description,
      category: inferCategory(line.description),
      type: line.type,
      paymentMethod: 'Bank',
      isAccrual: false,
      isVerified: true,
      verifiedAt,
      verificationSource: 'bank_statement',
      bankStatementRef: result.statementRef,
    }));

  return [...createdTransactions, ...Array.from(byId.values())];
}
