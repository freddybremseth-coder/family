/**
 * Ren Mondeo-avregning etter kontrakten (Bindende intensjonsavtale, Vedlegg A punkt 4).
 * Ingen React, ingen Supabase — kun tall. Testes i mondeoLedgerCalc.test.ts.
 *
 * Kontraktsmodell:
 *  - Månedens rente = restgjeld × 9%/12 (fast 9% p.a.)
 *  - Terminbeløp 33 000/mnd forfall 1. i hver måned
 *  - Månedlig rente trekkes først fra terminbeløpet
 *  - Overskudd av terminbeløp reduserer restgjeld (avdrag)
 *  - Underskudd på rente kapitaliseres (negativ amortisering)
 *  - Ekstrainnbetaling (over terminbeløp) reduserer restgjeld ytterligere
 *  - Forsinkelsesrente = minstebeløp × 9%/365 pr dag fra 1. i mnd til
 *    kumulative innbetalinger (FIFO til eldste ubetalte måned) når minstebeløpet
 */

export interface Payment {
  date: string; // ISO YYYY-MM-DD
  amount: number;
}

export interface LedgerRow {
  kind: 'month-end' | 'payment' | 'late-fee' | 'charge' | 'kpi';
  date: string;
  openingBalance: number;
  monthInterest: number;
  paid: number;
  principalChange: number; // negativ = avdrag, positiv = økning
  closingBalance: number;
  status: string;
}

export interface LedgerInput {
  initialPrincipal: number;
  interestStartDate: string; // ISO YYYY-MM-DD
  annualRatePct: number; // 9 for 9% p.a.
  minMonthlyPayment: number; // 33 000
  payments: Payment[];
  charges?: Array<{ date: string; amount: number; type?: string }>;
  today: Date; // for testbarhet
  dueDayOfMonth?: number; // default 1
}

export function computeMonthInterest(balance: number, annualRatePct: number): number {
  return balance * (annualRatePct / 100) / 12;
}

export function computeLedger(input: LedgerInput): LedgerRow[] {
  const {
    initialPrincipal, interestStartDate, annualRatePct, minMonthlyPayment,
    payments, charges = [], today, dueDayOfMonth = 1,
  } = input;

  const monthlyRate = annualRatePct / 100 / 12;
  const dailyLateRate = annualRatePct / 100 / 365;
  const interestStart = new Date(interestStartDate);

  const rows: LedgerRow[] = [];

  // Bygg events
  interface Event { date: string; kind: LedgerRow['kind']; payload?: any; }
  const events: Event[] = [];
  for (const p of payments) events.push({ date: p.date, kind: 'payment', payload: p });
  for (const c of charges) events.push({ date: c.date, kind: 'charge', payload: c });

  // Månedsslutt-events
  const cursor = new Date(interestStart);
  while (cursor <= today) {
    const monthEnd = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0);
    if (monthEnd <= today) {
      events.push({ date: monthEnd.toISOString().slice(0, 10), kind: 'month-end' });
    }
    cursor.setMonth(cursor.getMonth() + 1);
  }

  // Forsinkelsesrente-events (FIFO over månedene)
  interface Cycle { month: string; accrualStart: Date; paid: number; paidReachDate: Date | null; }
  const cycles: Cycle[] = [];
  const iter = new Date(interestStart);
  while (iter <= today) {
    const y = iter.getFullYear();
    const m = iter.getMonth();
    const monthStart = new Date(y, m, 1);
    const accrualStart = interestStart > monthStart ? interestStart : new Date(y, m, dueDayOfMonth);
    if (accrualStart <= today) {
      cycles.push({
        month: `${y}-${String(m + 1).padStart(2, '0')}`,
        accrualStart, paid: 0, paidReachDate: null,
      });
    }
    iter.setMonth(iter.getMonth() + 1);
  }

  const sortedPayments = [...payments].filter(p => p.date).sort((a, b) => a.date < b.date ? -1 : 1);
  for (const p of sortedPayments) {
    let remaining = p.amount;
    const paidDate = new Date(p.date);
    for (const cycle of cycles) {
      if (remaining <= 0) break;
      if (cycle.paidReachDate) continue;
      const needed = minMonthlyPayment - cycle.paid;
      const apply = Math.min(remaining, needed);
      cycle.paid += apply;
      remaining -= apply;
      if (cycle.paid >= minMonthlyPayment - 0.01) cycle.paidReachDate = paidDate;
    }
  }

  for (const cycle of cycles) {
    const endDate = cycle.paidReachDate ?? today;
    const daysLate = Math.max(0, Math.round((endDate.getTime() - cycle.accrualStart.getTime()) / 86400000));
    if (daysLate > 0) {
      const fee = minMonthlyPayment * dailyLateRate * daysLate;
      events.push({
        date: endDate.toISOString().slice(0, 10),
        kind: 'late-fee',
        payload: { month: cycle.month, daysLate, fee },
      });
    }
  }

  // Sortering (kpi → payment → charge → month-end → late-fee)
  const kindOrder = { kpi: 0, payment: 1, charge: 2, 'month-end': 3, 'late-fee': 4 };
  events.sort((a, b) => a.date !== b.date ? (a.date < b.date ? -1 : 1) : kindOrder[a.kind] - kindOrder[b.kind]);

  // Loop
  let balance = initialPrincipal;
  for (const ev of events) {
    if (ev.kind === 'payment') {
      rows.push({
        kind: 'payment', date: ev.date, openingBalance: balance,
        monthInterest: 0, paid: ev.payload.amount, principalChange: 0,
        closingBalance: balance, status: 'Innbetaling mottatt',
      });
    } else if (ev.kind === 'charge') {
      const amt = ev.payload.amount;
      const opening = balance;
      balance += amt;
      rows.push({
        kind: 'charge', date: ev.date, openingBalance: opening,
        monthInterest: 0, paid: 0, principalChange: -amt,
        closingBalance: balance, status: `Tillegg ${ev.payload.type || 'påløpt'}`,
      });
    } else if (ev.kind === 'month-end') {
      const monthKey = ev.date.slice(0, 7);
      const monthInterest = computeMonthInterest(balance, annualRatePct);
      const paidThisMonth = payments.filter(p => p.date.slice(0, 7) === monthKey).reduce((s, p) => s + p.amount, 0);
      const termAmount = Math.min(paidThisMonth, minMonthlyPayment);
      const extraPayment = Math.max(0, paidThisMonth - minMonthlyPayment);
      const restInterest = Math.max(0, monthInterest - termAmount);
      const termPrincipalReduction = Math.max(0, termAmount - monthInterest);
      const netChange = restInterest - termPrincipalReduction - extraPayment;
      const opening = balance;
      balance += netChange;
      let status: string;
      if (paidThisMonth === 0) status = 'Rente kapitaliseres (ingen betaling)';
      else if (netChange > 0) status = 'Restrente kapitaliseres';
      else if (netChange < 0) status = 'Avdrag';
      else status = 'Rente dekket';
      rows.push({
        kind: 'month-end', date: ev.date, openingBalance: opening,
        monthInterest, paid: paidThisMonth, principalChange: -netChange,
        closingBalance: balance, status,
      });
    } else if (ev.kind === 'late-fee') {
      const fee = ev.payload.fee;
      const opening = balance;
      balance += fee;
      rows.push({
        kind: 'late-fee', date: ev.date, openingBalance: opening,
        monthInterest: fee, paid: 0, principalChange: -fee,
        closingBalance: balance, status: `Forsinkelsesrente ${ev.payload.month} (${ev.payload.daysLate}d)`,
      });
    }
  }

  return rows;
}
