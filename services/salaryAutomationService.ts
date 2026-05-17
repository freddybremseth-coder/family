import { BankAccount, Currency, FamilyMember, Transaction, TransactionType } from '../types';

type SalaryAutomationResult = {
  transactions: Transaction[];
  bankAccounts: BankAccount[];
  added: number;
  removedDuplicates: number;
};

function monthKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function salaryDateFor(day: number, date = new Date()) {
  const year = date.getFullYear();
  const month = date.getMonth();
  const lastDay = new Date(year, month + 1, 0).getDate();
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(Math.min(Math.max(1, day), lastDay)).padStart(2, '0')}`;
}

function daysBetween(a: string, b: string) {
  const aa = new Date(`${a}T12:00:00`).getTime();
  const bb = new Date(`${b}T12:00:00`).getTime();
  return Math.abs(aa - bb) / (1000 * 60 * 60 * 24);
}

function closeAmount(a: number, b: number) {
  const aa = Math.abs(Number(a || 0));
  const bb = Math.abs(Number(b || 0));
  if (aa === 0 || bb === 0) return false;
  const diff = Math.abs(aa - bb);
  return diff <= 5 || diff / Math.max(aa, bb) <= 0.015;
}

function salaryTotal(member: FamilyMember) {
  return Number(member.monthlySalary || 0) + Number(member.monthlyBenefits || 0) + Number(member.monthlyChildBenefit || 0);
}

function salaryAutoRef(memberId: string, key = monthKey()) {
  return `salary-auto:${memberId}:${key}`;
}

function salaryAutoId(memberId: string, key = monthKey()) {
  return `salary-${memberId}-${key}`;
}

function isAutoSalary(tx: Transaction) {
  return String(tx.bankStatementRef || tx.id || '').startsWith('salary-auto:') || String(tx.id || '').startsWith('salary-');
}

function isImportedBankIncome(tx: Transaction) {
  return tx.type === TransactionType.INCOME && !isAutoSalary(tx) && (
    tx.verificationSource === 'bank_statement' ||
    !!tx.bankStatementRef ||
    /lønn|lonn|salary|payroll|utbetaling|nav|arbeidsgiver/i.test(`${tx.description || ''} ${tx.category || ''}`)
  );
}

function hasMatchingImportedSalary(transactions: Transaction[], member: FamilyMember, expectedDate: string, amount: number, accountId?: string) {
  return transactions.some((tx) => {
    if (!isImportedBankIncome(tx)) return false;
    if (!closeAmount(tx.amount, amount)) return false;
    if (daysBetween(tx.date, expectedDate) > 4) return false;
    if (accountId && tx.toAccountId && tx.toAccountId !== accountId) return false;
    const text = `${tx.description || ''} ${tx.category || ''}`.toLowerCase();
    const memberName = String(member.name || '').toLowerCase().split(' ')[0];
    return text.includes('lønn') || text.includes('lonn') || text.includes('salary') || text.includes('payroll') || text.includes('utbetaling') || (memberName && text.includes(memberName));
  });
}

function adjustAccount(accounts: BankAccount[], accountId: string | undefined, amount: number) {
  if (!accountId || !amount) return accounts;
  return accounts.map((account) => account.id === accountId ? { ...account, balance: Number(account.balance || 0) + amount } : account);
}

export function applySalaryAutomation(
  members: FamilyMember[],
  transactions: Transaction[],
  bankAccounts: BankAccount[],
  now = new Date()
): SalaryAutomationResult {
  const key = monthKey(now);
  const today = now.toISOString().slice(0, 10);
  let nextTransactions = [...transactions];
  let nextAccounts = [...bankAccounts];
  let added = 0;
  let removedDuplicates = 0;

  // If a real bank-imported salary appears later, remove the earlier auto-posting
  // and reverse only the balance effect from the auto-posting.
  for (const tx of [...nextTransactions]) {
    if (!isAutoSalary(tx)) continue;
    const member = members.find((m) => String(tx.bankStatementRef || tx.id).includes(m.id));
    if (!member) continue;
    const expectedDate = tx.date;
    const amount = Number(tx.amount || 0);
    const accountId = tx.toAccountId || member.salaryAccountId;
    if (hasMatchingImportedSalary(nextTransactions, member, expectedDate, amount, accountId)) {
      nextTransactions = nextTransactions.filter((candidate) => candidate.id !== tx.id);
      nextAccounts = adjustAccount(nextAccounts, accountId, -amount);
      removedDuplicates += 1;
    }
  }

  for (const member of members) {
    const amount = salaryTotal(member);
    const salaryDay = member.salaryDay || 0;
    const accountId = member.salaryAccountId;
    if (!amount || !salaryDay || !accountId) continue;
    const expectedDate = salaryDateFor(salaryDay, now);
    if (expectedDate > today) continue;
    const ref = salaryAutoRef(member.id, key);
    const id = salaryAutoId(member.id, key);
    const alreadyAuto = nextTransactions.some((tx) => tx.id === id || tx.bankStatementRef === ref);
    const alreadyImported = hasMatchingImportedSalary(nextTransactions, member, expectedDate, amount, accountId);
    if (alreadyAuto || alreadyImported) continue;

    const account = nextAccounts.find((a) => a.id === accountId);
    const tx: Transaction = {
      id,
      date: expectedDate,
      amount,
      currency: (account?.currency || 'NOK') as Currency,
      description: `Automatisk lønn: ${member.name}`,
      category: 'Lønn',
      type: TransactionType.INCOME,
      paymentMethod: 'Bank',
      isAccrual: false,
      toAccountId: accountId,
      isVerified: false,
      verificationSource: 'manual',
      bankStatementRef: ref,
    };
    nextTransactions = [tx, ...nextTransactions];
    nextAccounts = adjustAccount(nextAccounts, accountId, amount);
    added += 1;
  }

  return { transactions: nextTransactions, bankAccounts: nextAccounts, added, removedDuplicates };
}
