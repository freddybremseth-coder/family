import { BankAccount, FamilyMember, TransactionType } from '../types';
import { fetchRealtyflowCommissionEvents } from './realtyflowService';

export interface LiquidityEvent {
  id: string;
  date: string;
  title: string;
  amount: number;
  currency: 'NOK' | 'EUR';
  type: TransactionType;
  source: 'salary' | 'benefit' | 'child_benefit' | 'realtyflow_commission';
  accountId?: string;
  confidence: 'fixed' | 'estimated';
}

export interface LiquidityForecast {
  openingBalanceNok: number;
  projectedBalanceNok: number;
  events: LiquidityEvent[];
}

function isoDate(year: number, monthIndex: number, day: number) {
  const lastDay = new Date(year, monthIndex + 1, 0).getDate();
  const safeDay = Math.min(Math.max(1, day), lastDay);
  return new Date(year, monthIndex, safeDay).toISOString().slice(0, 10);
}

function nextMonthlyDates(day: number, monthsAhead = 4) {
  const now = new Date();
  const dates: string[] = [];
  for (let offset = 0; offset < monthsAhead; offset += 1) {
    const date = isoDate(now.getFullYear(), now.getMonth() + offset, day);
    if (date >= now.toISOString().slice(0, 10)) dates.push(date);
  }
  return dates;
}

function bankBalanceNok(accounts: BankAccount[]) {
  return accounts.reduce((sum, account) => sum + (account.currency === 'NOK' ? account.balance : account.balance * 11.55), 0);
}

export async function fetchLiquidityForecast(members: FamilyMember[], accounts: BankAccount[]): Promise<LiquidityForecast> {
  const events: LiquidityEvent[] = [];

  members.forEach((member) => {
    const salaryDay = member.salaryDay || 25;
    nextMonthlyDates(salaryDay, 4).forEach((date) => {
      if (member.monthlySalary > 0) {
        events.push({ id: `salary-${member.id}-${date}`, date, title: `Lønn ${member.name}`, amount: member.monthlySalary, currency: 'NOK', type: TransactionType.INCOME, source: 'salary', accountId: member.salaryAccountId, confidence: 'fixed' });
      }
      if (member.monthlyBenefits > 0) {
        events.push({ id: `benefit-${member.id}-${date}`, date, title: `Ytelser ${member.name}`, amount: member.monthlyBenefits, currency: 'NOK', type: TransactionType.INCOME, source: 'benefit', accountId: member.salaryAccountId, confidence: 'fixed' });
      }
      if (member.monthlyChildBenefit > 0) {
        events.push({ id: `child-${member.id}-${date}`, date, title: `Barnetrygd/bidrag ${member.name}`, amount: member.monthlyChildBenefit, currency: 'NOK', type: TransactionType.INCOME, source: 'child_benefit', accountId: member.salaryAccountId, confidence: 'fixed' });
      }
    });
  });

  try {
    const realtyflowEvents = await fetchRealtyflowCommissionEvents();
    realtyflowEvents
      .filter((event) => event.commissionNok > 0 && event.payoutDate)
      .forEach((event) => {
        events.push({
          id: `realtyflow-${event.id}`,
          date: event.payoutDate,
          title: `${event.customerName} · ${event.brand}`,
          amount: event.commissionNok,
          currency: 'NOK',
          type: TransactionType.INCOME,
          source: 'realtyflow_commission',
          confidence: 'estimated',
        });
      });
  } catch (err) {
    console.warn('[liquidityForecast] RealtyFlow commission forecast failed', err);
  }

  const sorted = events.sort((a, b) => a.date.localeCompare(b.date));
  const openingBalanceNok = bankBalanceNok(accounts);
  const projectedBalanceNok = openingBalanceNok + sorted.reduce((sum, event) => sum + (event.type === TransactionType.INCOME ? event.amount : -event.amount), 0);
  return { openingBalanceNok, projectedBalanceNok, events: sorted };
}
