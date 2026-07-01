// Genererer en HTML-print-vennlig familieøkonomi-rapport
// og åpner den i nytt vindu for utskrift/PDF-eksport.

import { Transaction, TransactionType, BankAccount, Asset, Bill, FamilyMember } from '../types';
import { EXCHANGE_RATE_EUR_TO_NOK } from '../constants';

interface ReportInput {
  transactions: Transaction[];
  bankAccounts: BankAccount[];
  assets: Asset[];
  bills: Bill[];
  familyMembers: FamilyMember[];
  period: { from: string; to: string; label: string };
  familyName: string;
}

const toNOK = (amount: number, currency?: string) => currency === 'EUR' ? amount * EXCHANGE_RATE_EUR_TO_NOK : amount;
const fmtNOK = (v: number) => new Intl.NumberFormat('nb-NO', { style: 'currency', currency: 'NOK', maximumFractionDigits: 0 }).format(v);

export function generateFinancialReport(input: ReportInput): string {
  const { transactions, bankAccounts, assets, bills, familyMembers, period, familyName } = input;
  const start = new Date(period.from);
  const end = new Date(period.to);
  const inPeriod = (dateStr: string) => {
    const d = new Date(dateStr);
    return d >= start && d <= end;
  };

  const periodTx = transactions.filter(t => inPeriod(t.date));
  const totalIncome = periodTx.filter(t => t.type === TransactionType.INCOME).reduce((s, t) => s + toNOK(t.amount, t.currency), 0);
  const totalExpense = periodTx.filter(t => t.type === TransactionType.EXPENSE).reduce((s, t) => s + toNOK(t.amount, t.currency), 0);
  const netCash = totalIncome - totalExpense;

  // Kategori-sum (utgifter)
  const catMap = new Map<string, number>();
  for (const t of periodTx.filter(t => t.type === TransactionType.EXPENSE)) {
    const c = t.category || 'Annet';
    catMap.set(c, (catMap.get(c) || 0) + toNOK(t.amount, t.currency));
  }
  const catSorted = Array.from(catMap.entries()).sort((a, b) => b[1] - a[1]);

  // Måned-over-måned (siste 6 mnd innen perioden)
  const monthly: Record<string, { income: number; expense: number }> = {};
  for (const t of periodTx) {
    const key = t.date.slice(0, 7);
    if (!monthly[key]) monthly[key] = { income: 0, expense: 0 };
    if (t.type === TransactionType.INCOME) monthly[key].income += toNOK(t.amount, t.currency);
    else if (t.type === TransactionType.EXPENSE) monthly[key].expense += toNOK(t.amount, t.currency);
  }
  const monthKeys = Object.keys(monthly).sort();

  const bankTotal = bankAccounts.reduce((s, a) => s + toNOK(a.balance || 0, a.currency), 0);
  const assetTotal = assets.reduce((s, a) => s + toNOK(a.value || 0, a.currency), 0);
  const memberIncome = familyMembers.reduce((s, m) => s + (m.monthlySalary || 0) + (m.monthlyBenefits || 0) + (m.monthlyChildBenefit || 0), 0);
  const activeBills = bills.filter(b => !b.isPaid);
  const monthlyBillsTotal = activeBills.reduce((s, b) => s + toNOK(b.amount || 0, b.currency), 0);

  const summaryCards = `
    <div class="summary-grid">
      <div class="summary-card"><div class="lbl">Inntekt i perioden</div><div class="val income">${fmtNOK(totalIncome)}</div></div>
      <div class="summary-card"><div class="lbl">Utgifter i perioden</div><div class="val expense">${fmtNOK(totalExpense)}</div></div>
      <div class="summary-card ${netCash >= 0 ? 'ok' : 'warn'}"><div class="lbl">Netto</div><div class="val">${netCash >= 0 ? '+' : ''}${fmtNOK(netCash)}</div></div>
      <div class="summary-card"><div class="lbl">Månedslønn familien</div><div class="val">${fmtNOK(memberIncome)}</div></div>
      <div class="summary-card"><div class="lbl">Bank totalt</div><div class="val">${fmtNOK(bankTotal)}</div></div>
      <div class="summary-card"><div class="lbl">Eiendeler totalt</div><div class="val">${fmtNOK(assetTotal)}</div></div>
      <div class="summary-card"><div class="lbl">Antall transaksjoner</div><div class="val">${periodTx.length}</div></div>
      <div class="summary-card"><div class="lbl">Åpne regninger</div><div class="val">${activeBills.length} · ${fmtNOK(monthlyBillsTotal)}</div></div>
    </div>
  `;

  const monthlyRows = monthKeys.map(k => {
    const { income, expense } = monthly[k];
    const net = income - expense;
    return `<tr><td>${k}</td><td class="num">${fmtNOK(income)}</td><td class="num">${fmtNOK(expense)}</td><td class="num" style="color:${net >= 0 ? '#047857' : '#b91c1c'}">${net >= 0 ? '+' : ''}${fmtNOK(net)}</td></tr>`;
  }).join('');

  const categoryRows = catSorted.map(([cat, amt]) => {
    const pct = totalExpense > 0 ? Math.round((amt / totalExpense) * 100) : 0;
    return `<tr><td>${cat}</td><td class="num">${fmtNOK(amt)}</td><td class="num">${pct} %</td></tr>`;
  }).join('');

  const bankRows = bankAccounts.map(a => `<tr><td>${a.accountName || a.bankName}</td><td>${a.bankName || ''}</td><td>${a.accountNumber || a.iban || ''}</td><td class="num">${fmtNOK(toNOK(a.balance || 0, a.currency))}</td></tr>`).join('');
  const assetRows = assets.map(a => `<tr><td>${a.name}</td><td>${a.category || ''}</td><td class="num">${fmtNOK(toNOK(a.value || 0, a.currency))}</td></tr>`).join('');
  const billRows = activeBills.map(b => `<tr><td>${b.name}</td><td>${b.category || ''}</td><td>${b.dueDay || '-'}. hver mnd</td><td class="num">${fmtNOK(toNOK(b.amount || 0, b.currency))}</td></tr>`).join('');

  return `<!doctype html><html lang="no"><head><meta charset="utf-8"><title>${familyName} — Økonomirapport ${period.label}</title>
<style>
  body { font-family: -apple-system, Segoe UI, Roboto, sans-serif; padding: 32px; color: #0f172a; margin: 0; }
  h1 { font-size: 24px; margin: 0 0 4px; }
  h2 { font-size: 14px; margin: 20px 0 8px; color: #475569; text-transform: uppercase; letter-spacing: 0.06em; }
  .meta { color: #64748b; font-size: 12px; margin-bottom: 24px; }
  .summary-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin: 12px 0 20px; }
  .summary-card { border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; background: #f8fafc; }
  .summary-card .lbl { font-size: 10px; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; }
  .summary-card .val { font-size: 18px; font-weight: 800; margin-top: 4px; font-variant-numeric: tabular-nums; }
  .summary-card .val.income { color: #047857; }
  .summary-card .val.expense { color: #b91c1c; }
  .summary-card.ok .val { color: #047857; }
  .summary-card.warn .val { color: #b91c1c; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 16px; }
  th, td { padding: 8px 10px; border-bottom: 1px solid #e2e8f0; text-align: left; vertical-align: top; }
  th { background: #f1f5f9; font-size: 11px; text-transform: uppercase; letter-spacing: 0.04em; color: #475569; }
  td.num { text-align: right; font-variant-numeric: tabular-nums; }
  .separator { border: 0; border-top: 2px solid #0f172a; margin: 12px 0 16px; }
  @media print { body { padding: 16px; } }
</style></head><body>
  <h1>${familyName} — Økonomirapport</h1>
  <p class="meta">Periode: ${period.label} (${period.from} → ${period.to}) · Utskrift: ${new Date().toLocaleString('nb-NO')}</p>

  <h2>Sammendrag</h2>
  ${summaryCards}
  <hr class="separator" />

  <h2>Måned for måned</h2>
  ${monthKeys.length > 0 ? `<table>
    <thead><tr><th>Måned</th><th class="num">Inntekt</th><th class="num">Utgift</th><th class="num">Netto</th></tr></thead>
    <tbody>${monthlyRows}</tbody>
  </table>` : '<p style="font-size:12px;color:#94a3b8">Ingen transaksjoner i perioden.</p>'}

  <h2>Utgifter etter kategori</h2>
  ${catSorted.length > 0 ? `<table>
    <thead><tr><th>Kategori</th><th class="num">Sum</th><th class="num">% av total</th></tr></thead>
    <tbody>${categoryRows}</tbody>
  </table>` : '<p style="font-size:12px;color:#94a3b8">Ingen utgifter registrert.</p>'}

  <h2>Bankkontoer</h2>
  ${bankAccounts.length > 0 ? `<table>
    <thead><tr><th>Konto</th><th>Bank</th><th>Nr / IBAN</th><th class="num">Saldo (NOK)</th></tr></thead>
    <tbody>${bankRows}</tbody>
  </table>` : '<p style="font-size:12px;color:#94a3b8">Ingen kontoer.</p>'}

  <h2>Eiendeler</h2>
  ${assets.length > 0 ? `<table>
    <thead><tr><th>Navn</th><th>Kategori</th><th class="num">Verdi (NOK)</th></tr></thead>
    <tbody>${assetRows}</tbody>
  </table>` : '<p style="font-size:12px;color:#94a3b8">Ingen eiendeler.</p>'}

  <h2>Åpne regninger</h2>
  ${activeBills.length > 0 ? `<table>
    <thead><tr><th>Regning</th><th>Kategori</th><th>Forfaller</th><th class="num">Beløp (NOK)</th></tr></thead>
    <tbody>${billRows}</tbody>
  </table>` : '<p style="font-size:12px;color:#94a3b8">Ingen aktive regninger.</p>'}
</body></html>`;
}

export function printFinancialReport(input: ReportInput): void {
  const html = generateFinancialReport(input);
  const win = window.open('', '_blank', 'width=1000,height=1300');
  if (!win) { alert('Popup blokkert — tillat popups for å skrive ut.'); return; }
  win.document.write(html);
  win.document.close();
  setTimeout(() => win.print(), 400);
}
