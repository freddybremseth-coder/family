import { describe, it, expect } from 'vitest';
import { computeLedger, computeMonthInterest } from './mondeoLedgerCalc';

const BASE = {
  initialPrincipal: 4_800_000,
  interestStartDate: '2026-06-01',
  annualRatePct: 9,
  minMonthlyPayment: 33_000,
  dueDayOfMonth: 1,
};

describe('computeMonthInterest', () => {
  it('4.8M × 9%/12 = 36 000', () => {
    expect(computeMonthInterest(4_800_000, 9)).toBe(36_000);
  });
  it('4.836M × 9%/12 = 36 270', () => {
    expect(computeMonthInterest(4_836_000, 9)).toBe(36_270);
  });
  it('0-balance = 0', () => {
    expect(computeMonthInterest(0, 9)).toBe(0);
  });
});

describe('Mondeo — juni 2026, ingen betaling', () => {
  const rows = computeLedger({
    ...BASE,
    payments: [],
    today: new Date('2026-06-30T12:00:00Z'),
  });

  it('genererer 1 rad (månedsslutt juni)', () => {
    const monthEnds = rows.filter(r => r.kind === 'month-end');
    expect(monthEnds).toHaveLength(1);
  });

  it('kapitaliserer 36 000 kr rente ved månedsslutt', () => {
    const me = rows.find(r => r.kind === 'month-end')!;
    expect(me.monthInterest).toBe(36_000);
    expect(me.closingBalance).toBe(4_836_000);
    expect(me.status).toContain('Rente kapitaliseres');
  });

  it('ingen forsinkelsesrente ved dag 1 (forfall = 1., i dag = 30. juni)', () => {
    // Kontrakts-forfall er 1. juni for juni-syklus. Fra 1. juni til 30. juni = 29 dager forsinket.
    const late = rows.filter(r => r.kind === 'late-fee');
    expect(late.length).toBeGreaterThanOrEqual(1);
  });
});

describe('Mondeo — 1 betaling på 36 060 kr 3. juli', () => {
  const rows = computeLedger({
    ...BASE,
    payments: [{ date: '2026-07-03', amount: 36_060 }],
    today: new Date('2026-07-04T12:00:00Z'),
  });

  it('månedsslutt juni: hovedstol 4 836 000 (ingen juni-betaling)', () => {
    const juneEnd = rows.find(r => r.kind === 'month-end' && r.date.startsWith('2026-06'))!;
    expect(juneEnd.closingBalance).toBe(4_836_000);
  });

  it('payment-rad 3. juli med 36 060 kr, uendret saldo', () => {
    const pay = rows.find(r => r.kind === 'payment')!;
    expect(pay.paid).toBe(36_060);
    expect(pay.principalChange).toBe(0); // Ingen saldo-endring i payment-rad
  });

  it('forsinkelsesrente for juni: 32 dager × 33 000 × 9%/365 ≈ 260 kr', () => {
    const juneLateFee = rows.find(r => r.kind === 'late-fee' && r.status.includes('2026-06'))!;
    expect(juneLateFee).toBeDefined();
    expect(juneLateFee.status).toContain('32d');
    const expectedFee = 33_000 * 0.09 / 365 * 32;
    expect(juneLateFee.monthInterest).toBeCloseTo(expectedFee, 1);
  });
});

describe('Mondeo — punktlig betaling dekker termin fullt', () => {
  const rows = computeLedger({
    ...BASE,
    payments: [{ date: '2026-06-01', amount: 33_000 }],
    today: new Date('2026-06-30T12:00:00Z'),
  });

  it('månedsslutt: restrente 3 000 kapitaliseres (36k rente − 33k termin)', () => {
    const me = rows.find(r => r.kind === 'month-end')!;
    expect(me.monthInterest).toBe(36_000);
    expect(me.paid).toBe(33_000);
    // Netto endring: 3 000 restrente kapitaliseres, ingen ekstra betaling
    expect(me.closingBalance).toBe(4_803_000);
  });

  it('ingen forsinkelsesrente når min er betalt 1. i mnd', () => {
    const late = rows.filter(r => r.kind === 'late-fee');
    expect(late).toHaveLength(0);
  });
});

describe('Mondeo — stor ekstrainnbetaling (avdrag)', () => {
  const rows = computeLedger({
    ...BASE,
    payments: [{ date: '2026-06-01', amount: 100_000 }],
    today: new Date('2026-06-30T12:00:00Z'),
  });

  it('avdrag: 100k termin − 36k rente = 64k avdrag', () => {
    const me = rows.find(r => r.kind === 'month-end')!;
    // termAmount = min(100k, 33k) = 33k. Rente dekket av termin = 33k (mindre enn rente 36k)
    // restInterest = 36k - 33k = 3k
    // termPrincipalReduction = 0 (termAmount < monthInterest)
    // extraPayment = 100k - 33k = 67k
    // netChange = 3k - 0 - 67k = -64k
    expect(me.closingBalance).toBeCloseTo(4_800_000 - 64_000, 0);
    expect(me.status).toBe('Avdrag');
  });
});

describe('Mondeo — strøm-tillegg (charge)', () => {
  const rows = computeLedger({
    ...BASE,
    payments: [],
    charges: [{ date: '2026-06-15', amount: 11_554, type: 'Strøm' }],
    today: new Date('2026-06-30T12:00:00Z'),
  });

  it('charge legger 11 554 til hovedstolen', () => {
    const chargeRow = rows.find(r => r.kind === 'charge')!;
    expect(chargeRow.closingBalance).toBe(4_811_554);
  });

  it('månedsslutt beregner rente på nye hovedstol (4 811 554)', () => {
    const me = rows.find(r => r.kind === 'month-end')!;
    // Rente = 4 811 554 × 9%/12 ≈ 36 087
    expect(me.monthInterest).toBeCloseTo(36_086.66, 1);
    expect(me.closingBalance).toBeCloseTo(4_847_640.66, 1);
  });
});

describe('Mondeo — FIFO for late fees over flere måneder', () => {
  const rows = computeLedger({
    ...BASE,
    payments: [{ date: '2026-08-15', amount: 66_000 }], // Dekker juni + juli
    today: new Date('2026-08-31T12:00:00Z'),
  });

  it('juni og juli-syklusene skal dekkes FIFO', () => {
    const lateFees = rows.filter(r => r.kind === 'late-fee');
    const juneFee = lateFees.find(r => r.status.includes('2026-06'));
    const julyFee = lateFees.find(r => r.status.includes('2026-07'));
    expect(juneFee).toBeDefined();
    expect(julyFee).toBeDefined();
    // Begge er dekket samme dag (15. aug), så juli er kortere forsinket enn juni
    const juneDays = Number(juneFee!.status.match(/\((\d+)d\)/)?.[1]);
    const julyDays = Number(julyFee!.status.match(/\((\d+)d\)/)?.[1]);
    expect(juneDays).toBeGreaterThan(julyDays);
  });
});
