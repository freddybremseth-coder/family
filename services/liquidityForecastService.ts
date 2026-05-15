import { BankAccount, FamilyMember, Transaction, TransactionType } from '../types';
import { fetchRealtyflowCommissionEvents } from './realtyflowService';

export interface LiquidityEvent {
  id: string;
  date: string;
  title: string;
  amount: number;
  currency: 'NOK' | 'EUR';
  type: TransactionType;
  source: 'salary' | 'benefit' | 'child_benefit' | 'realtyflow_commission' | 'mondeo_payment' | 'frank_loan' | 'rent' | 'utilities' | 'recurring_average';
  accountId?: string;
  confidence: 'fixed' | 'estimated';
}

export interface LiquidityForecast {
  openingBalanceNok: number;
  projectedBalanceNok: number;
  events: LiquidityEvent[];
}

const EUR_TO_NOK = 11.55;
const MONDEO_MONTHLY_PAYMENT_NOK = 35_000;
const FRANK_MONTHLY_LOAN_PAYMENT_NOK = 8_900;
const HOUSE_RENT_EUR = 1_550;
const ELECTRICITY_ESTIMATE_EUR = 90;
const WATER_ESTIMATE_EUR = 30;

const RECURRING_CATEGORY_MATCHES = [
  { key: 'groceries', title: 'Estimert dagligvarer', terms: ['dagligvarer', 'mat', 'grocery', 'groceries', 'supermarked', 'mercadona', 'rema', 'kiwi', 'meny', 'coop'] },
  { key: 'health', title: 'Estimert helse', terms: ['helse', 'lege', 'apotek', 'pharmacy', 'farmacia', 'medisin', 'doctor', 'health'] },
  { key: 'transport', title: 'Estimert transport', terms: ['transport', 'drivstoff', 'diesel', 'bensin', 'fuel', 'plenoil', 'shell', 'circle k', 'parkering', 'bom'] },
  { key: 'electricity', title: 'Estimert strøm fra historikk', terms: ['strøm', 'electricity', 'el', 'iberdrola', 'fortum', 'nordpool'] },
  { key: 'water', title: 'Estimert vann fra historikk', terms: ['vann', 'water', 'aqua', 'agua'] },
];

function isoDate(year: number, monthIndex: number, day: number) {
  const lastDay = new Date(year, monthIndex + 1, 0).getDate();
  const safeDay = Math.min(Math.max(1, day), lastDay);
  return new Date(year, monthIndex, safeDay).toISOString().slice(0, 10);
}

function horizonEndDate(monthsAhead: number) {
  const now = new Date();
  return isoDate(now.getFullYear(), now.getMonth() + Math.max(1, monthsAhead), now.getDate());
}

function nextMonthlyDates(day: number, monthsAhead = 4) {
  const now = new Date();
  const dates: string[] = [];
  for (let offset = 0; offset <= monthsAhead; offset += 1) {
    const date = isoDate(now.getFullYear(), now.getMonth() + offset, day);
    if (date >= now.toISOString().slice(0, 10) && date <= horizonEndDate(monthsAhead)) dates.push(date);
  }
  return dates;
}

function bankBalanceNok(accounts: BankAccount[]) {
  return accounts.reduce((sum, account) => sum + (account.currency === 'NOK' ? account.balance : account.balance * EUR_TO_NOK), 0);
}

function toNok(amount: number, currency?: string) {
  return String(currency || 'NOK').toUpperCase() === 'EUR' ? Number(amount || 0) * EUR_TO_NOK : Number(amount || 0);
}

function txMonthKey(date: string) {
  return String(date || '').slice(0, 7);
}

function normalize(value: unknown) {
  return String(value || '').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
}

function addFixedMonthlyLiquidity(events: LiquidityEvent[], monthsAhead: number) {
  nextMonthlyDates(1, monthsAhead).forEach((date) => {
    events.push({ id: `mondeo-payment-${date}`, date, title: 'Mondeo Eiendom AS · månedlig innbetaling', amount: MONDEO_MONTHLY_PAYMENT_NOK, currency: 'NOK', type: TransactionType.INCOME, source: 'mondeo_payment', confidence: 'fixed' });
    events.push({ id: `frank-loan-${date}`, date, title: 'Lån til Frank · månedlig betaling', amount: FRANK_MONTHLY_LOAN_PAYMENT_NOK, currency: 'NOK', type: TransactionType.EXPENSE, source: 'frank_loan', confidence: 'fixed' });
    events.push({ id: `rent-${date}`, date, title: 'Husleie · fast månedlig utgift', amount: Math.round(HOUSE_RENT_EUR * EUR_TO_NOK), currency: 'NOK', type: TransactionType.EXPENSE, source: 'rent', confidence: 'fixed' });
    events.push({ id: `electricity-${date}`, date, title: 'Strøm · estimat 90 €', amount: Math.round(ELECTRICITY_ESTIMATE_EUR * EUR_TO_NOK), currency: 'NOK', type: TransactionType.EXPENSE, source: 'utilities', confidence: 'estimated' });
    events.push({ id: `water-${date}`, date, title: 'Vann · estimat 30 €', amount: Math.round(WATER_ESTIMATE_EUR * EUR_TO_NOK), currency: 'NOK', type: TransactionType.EXPENSE, source: 'utilities', confidence: 'estimated' });
  });
}

function categoryForRecurringAverage(tx: Transaction) {
  const text = normalize(`${tx.category || ''} ${tx.description || ''}`);
  return RECURRING_CATEGORY_MATCHES.find((item) => item.terms.some((term) => text.includes(term))) || null;
}

function addHistoricalRecurringExpenseForecast(events: LiquidityEvent[], transactions: Transaction[], monthsAhead: number) {
  const expenseTx = transactions
    .filter((tx) => tx.type === TransactionType.EXPENSE && Number(tx.amount || 0) > 0 && tx.date)
    .filter((tx) => categoryForRecurringAverage(tx));

  const now = new Date();
  const cutoff = new Date(now.getFullYear(), now.getMonth() - 6, 1).toISOString().slice(0, 10);
  const monthKeys = new Set<string>();
  const totals = new Map<string, { title: string; total: number; months: Set<string> }>();

  expenseTx.filter((tx) => tx.date >= cutoff).forEach((tx) => {
    const match = categoryForRecurringAverage(tx);
    if (!match) return;
    const month = txMonthKey(tx.date);
    monthKeys.add(month);
    const current = totals.get(match.key) || { title: match.title, total: 0, months: new Set<string>() };
    current.total += toNok(Number(tx.amount || 0), tx.currency);
    current.months.add(month);
    totals.set(match.key, current);
  });

  if (monthKeys.size < 2) return;

  totals.forEach((value, key) => {
    const avg = Math.round(value.total / Math.max(1, value.months.size));
    if (avg < 100) return;
    // Strøm og vann har eksplisitte estimater over. Bruk historikk bare hvis den er vesentlig høyere.
    if (key === 'electricity' && avg <= ELECTRICITY_ESTIMATE_EUR * EUR_TO_NOK * 1.25) return;
    if (key === 'water' && avg <= WATER_ESTIMATE_EUR * EUR_TO_NOK * 1.25) return;
    nextMonthlyDates(15, monthsAhead).forEach((date) => {
      events.push({ id: `avg-${key}-${date}`, date, title: `${value.title} · snitt fra historikk`, amount: avg, currency: 'NOK', type: TransactionType.EXPENSE, source: 'recurring_average', confidence: 'estimated' });
    });
  });
}

export async function fetchLiquidityForecast(members: FamilyMember[], accounts: BankAccount[], monthsAhead = 4, transactions: Transaction[] = []): Promise<LiquidityForecast> {
  const events: LiquidityEvent[] = [];
  const today = new Date().toISOString().slice(0, 10);
  const endDate = horizonEndDate(monthsAhead);

  addFixedMonthlyLiquidity(events, monthsAhead);
  addHistoricalRecurringExpenseForecast(events, transactions, monthsAhead);

  members.forEach((member) => {
    const salaryDay = member.salaryDay || 25;
    nextMonthlyDates(salaryDay, monthsAhead).forEach((date) => {
      if (member.monthlySalary > 0) events.push({ id: `salary-${member.id}-${date}`, date, title: `Lønn ${member.name}`, amount: member.monthlySalary, currency: 'NOK', type: TransactionType.INCOME, source: 'salary', accountId: member.salaryAccountId, confidence: 'fixed' });
      if (member.monthlyBenefits > 0) events.push({ id: `benefit-${member.id}-${date}`, date, title: `Ytelser ${member.name}`, amount: member.monthlyBenefits, currency: 'NOK', type: TransactionType.INCOME, source: 'benefit', accountId: member.salaryAccountId, confidence: 'fixed' });
      if (member.monthlyChildBenefit > 0) events.push({ id: `child-${member.id}-${date}`, date, title: `Barnetrygd/bidrag ${member.name}`, amount: member.monthlyChildBenefit, currency: 'NOK', type: TransactionType.INCOME, source: 'child_benefit', accountId: member.salaryAccountId, confidence: 'fixed' });
    });
  });

  try {
    const realtyflowEvents = await fetchRealtyflowCommissionEvents();
    realtyflowEvents
      .filter((event) => event.commissionNok > 0 && event.payoutDate && event.payoutDate >= today && event.payoutDate <= endDate)
      .forEach((event) => {
        events.push({ id: `realtyflow-${event.id}`, date: event.payoutDate, title: `${event.customerName} · ${event.brand}`, amount: event.commissionNok, currency: 'NOK', type: TransactionType.INCOME, source: 'realtyflow_commission', confidence: 'estimated' });
      });
  } catch (err) {
    console.warn('[liquidityForecast] RealtyFlow commission forecast failed', err);
  }

  const sorted = events.sort((a, b) => a.date.localeCompare(b.date) || a.title.localeCompare(b.title));
  const openingBalanceNok = bankBalanceNok(accounts);
  const projectedBalanceNok = openingBalanceNok + sorted.reduce((sum, event) => sum + (event.type === TransactionType.INCOME ? event.amount : -event.amount), 0);
  return { openingBalanceNok, projectedBalanceNok, events: sorted };
}
