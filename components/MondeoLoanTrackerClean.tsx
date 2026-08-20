import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle, Building2, Calculator, Calendar, Coins, Download, FileText, Plus,
  Printer, RefreshCw, Trash2, Upload, Users, Percent,
} from 'lucide-react';
import {
  MondeoAdditionalCharge, MondeoKpiAdjustment, MondeoLedgerRow, MondeoLoanPayment, MondeoLoanSettings,
  Transaction, TransactionType,
} from '../types';
import { fetchNorgesBankPolicyRate } from '../services/norgesBankService';
import { isSupabaseConfigured, supabase, supabaseFamilyData, supabasePublic } from '../supabase';

interface Props {
  userId?: string;
  transactions?: Transaction[];
  setTransactions?: React.Dispatch<React.SetStateAction<Transaction[]>>;
}

const todayISO = () => new Date().toISOString().slice(0, 10);
const createId = () => `${Date.now()}-${Math.random().toString(36).slice(2)}`;

// Avtale-defaults — overstyres av lagrede verdier i Supabase
// Generiske defaults — nye kunder starter tomme og fyller inn selv.
// Eksisterende brukere (som deg) har egne verdier i Supabase mondeo_loan_settings.
const DEFAULT_PRINCIPAL = 0;
const DEFAULT_MIN_MONTHLY = 0;
const DEFAULT_FIXED_RATE = 5; // 5% p.a. som nøytralt utgangspunkt
const DEFAULT_INTEREST_START = new Date().toISOString().slice(0, 10);

const formatNOK = (value: number) =>
  new Intl.NumberFormat('nb-NO', { style: 'currency', currency: 'NOK', maximumFractionDigits: 0 }).format(Number(value || 0));
const formatPercent = (value: number) =>
  `${Number(value || 0).toLocaleString('nb-NO', { maximumFractionDigits: 2 })} %`;
const formatDate = (iso?: string) => {
  if (!iso) return '—';
  try { return new Date(iso).toLocaleDateString('nb-NO', { day: 'numeric', month: 'short', year: 'numeric' }); } catch { return iso; }
};

const defaultSettings: MondeoLoanSettings = {
  id: 'seller-credit-default',
  initialPrincipal: DEFAULT_PRINCIPAL,
  startDate: todayISO(),
  marginPct: 0,
  norgesBankRatePct: 4.5,
  fixedAnnualRatePct: DEFAULT_FIXED_RATE,
  useFixedRate: true,
  interestStartDate: DEFAULT_INTEREST_START,
  minMonthlyPayment: DEFAULT_MIN_MONTHLY,
  buyerName: '',
  buyerCompany: '',
  sellerEntity: '',
  notes: '',
};

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-2xl border border-slate-200 bg-white shadow-sm ${className}`}>{children}</div>;
}

function MetricCard({ title, value, symbol, hint, tone = 'neutral' }: { title: string; value: string; symbol: string; hint?: string; tone?: 'neutral' | 'success' | 'warning' | 'danger' }) {
  const toneClasses = tone === 'success' ? 'bg-emerald-100 text-emerald-700' : tone === 'warning' ? 'bg-amber-100 text-amber-700' : tone === 'danger' ? 'bg-rose-100 text-rose-700' : 'bg-slate-100 text-slate-600';
  return (
    <Card>
      <div className="flex items-center justify-between p-5">
        <div>
          <p className="text-sm text-slate-500">{title}</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{value}</p>
          {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
        </div>
        <div className={`flex h-11 w-11 items-center justify-center rounded-2xl text-base font-bold ${toneClasses}`}>{symbol}</div>
      </div>
    </Card>
  );
}

export const MondeoLoanTrackerClean: React.FC<Props> = ({ userId, setTransactions }) => {
  const [settings, setSettings] = useState<MondeoLoanSettings>(defaultSettings);
  const [payments, setPayments] = useState<MondeoLoanPayment[]>([]);
  const [kpiAdjustments, setKpiAdjustments] = useState<MondeoKpiAdjustment[]>([]);
  const [charges, setCharges] = useState<MondeoAdditionalCharge[]>([]);

  const [chargeDate, setChargeDate] = useState<string>(todayISO());
  const [chargeAmount, setChargeAmount] = useState<string>('');
  const [chargeType, setChargeType] = useState<MondeoAdditionalCharge['type']>('Strøm');
  const [chargeNote, setChargeNote] = useState<string>('');

  const [paymentDate, setPaymentDate] = useState<string>(todayISO());
  const [paymentAmount, setPaymentAmount] = useState<string>(String(DEFAULT_MIN_MONTHLY));
  const [paymentNote, setPaymentNote] = useState<string>('Minimum terminbeløp iht. avtale');
  const [paymentMethod, setPaymentMethod] = useState<string>('Bank');

  const [kpiYear, setKpiYear] = useState<number>(new Date().getFullYear() + 1);
  const [kpiPct, setKpiPct] = useState<string>('');
  const [kpiNote, setKpiNote] = useState<string>('');

  const [loadingRate, setLoadingRate] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const printAreaRef = useRef<HTMLDivElement>(null);

  // Forfallsdag (dag i måneden) — 1. iht. kontrakt. Persisteres i localStorage.
  const [latePaymentDueDay, setLatePaymentDueDayState] = useState<number>(() => {
    try {
      const stored = localStorage.getItem('mondeo_late_due_day');
      const n = stored ? Number(stored) : 1;
      return Number.isFinite(n) && n >= 1 && n <= 28 ? n : 1;
    } catch { return 1; }
  });
  const setLatePaymentDueDay = (day: number) => {
    setLatePaymentDueDayState(day);
    try { localStorage.setItem('mondeo_late_due_day', String(day)); } catch {}
  };

  // Bankkonto for renteinntekter — persisteres i localStorage.
  // Nye kunder starter tomme og legger inn sine egne bankdetaljer.
  interface MondeoBankInfo { bankName: string; accountName: string; accountNumber: string; iban: string; currency: string; }
  const DEFAULT_MONDEO_ACCOUNT: MondeoBankInfo = {
    bankName: '',
    accountName: '',
    accountNumber: '',
    iban: '',
    currency: 'NOK',
  };
  const [mondeoAccount, setMondeoAccountState] = useState<MondeoBankInfo>(() => {
    try {
      const stored = localStorage.getItem('mondeo_income_account');
      if (stored) return { ...DEFAULT_MONDEO_ACCOUNT, ...JSON.parse(stored) };
    } catch {}
    return DEFAULT_MONDEO_ACCOUNT;
  });
  const setMondeoAccount = (next: MondeoBankInfo) => {
    setMondeoAccountState(next);
    try { localStorage.setItem('mondeo_income_account', JSON.stringify(next)); } catch {}
  };

  // Privatlån-modul (annuitetslån). Nye kunder starter tomme.
  interface FrankLoanConfig { principal: number; monthlyPayment: number; annualRatePct: number; asOfDate: string; }
  interface FrankPayment { id: string; date: string; amount: number; postedTransactionId?: string; }
  const DEFAULT_FRANK: FrankLoanConfig = { principal: 0, monthlyPayment: 0, annualRatePct: 0, asOfDate: new Date().toISOString().slice(0, 10) };
  const [frankConfig, setFrankConfigState] = useState<FrankLoanConfig>(() => {
    try {
      const stored = localStorage.getItem('mondeo_frank_config');
      if (stored) return { ...DEFAULT_FRANK, ...JSON.parse(stored) };
    } catch {}
    return DEFAULT_FRANK;
  });
  const setFrankConfig = (next: FrankLoanConfig) => {
    setFrankConfigState(next);
    try { localStorage.setItem('mondeo_frank_config', JSON.stringify(next)); } catch {}
  };
  const [frankPayments, setFrankPaymentsState] = useState<FrankPayment[]>(() => {
    try {
      const stored = localStorage.getItem('mondeo_frank_payments');
      return stored ? JSON.parse(stored) : [];
    } catch { return []; }
  });
  const setFrankPayments = (next: FrankPayment[]) => {
    setFrankPaymentsState(next);
    try { localStorage.setItem('mondeo_frank_payments', JSON.stringify(next)); } catch {}
  };

  // Annuitets-simulering: fra asOfDate til i dag, akkumuler rente + trekk betalinger i kronologisk rekkefølge
  const frankStatus = useMemo(() => {
    const cfg = frankConfig;
    const monthlyR = cfg.annualRatePct / 100 / 12;
    const sorted = [...frankPayments].sort((a, b) => a.date.localeCompare(b.date));
    let balance = cfg.principal;
    let cursor = new Date(cfg.asOfDate);
    const now = new Date();
    const rows: Array<{ date: string; interest: number; principalPart: number; paid: number; balance: number; kind: 'payment' | 'accrual' }> = [];
    const applyInterestUntil = (target: Date) => {
      while (cursor < target) {
        const monthEnd = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
        const to = monthEnd < target ? monthEnd : target;
        const daysInMonth = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate();
        const segDays = Math.max(0, Math.round((to.getTime() - cursor.getTime()) / 86400000));
        if (segDays > 0) {
          const monthlyInterest = balance * monthlyR;
          balance += monthlyInterest * (segDays / daysInMonth);
        }
        cursor = to;
      }
    };
    for (const p of sorted) {
      const pDate = new Date(p.date);
      applyInterestUntil(pDate);
      const monthlyInterestAtPayment = balance * monthlyR;
      const interestPortion = Math.min(p.amount, monthlyInterestAtPayment);
      const principalPart = p.amount - interestPortion;
      balance -= p.amount;
      rows.push({ date: p.date, interest: monthlyInterestAtPayment, principalPart, paid: p.amount, balance, kind: 'payment' });
    }
    applyInterestUntil(now);
    return { balance, rows, monthlyInterestNow: balance * monthlyR, nextPaymentDue: new Date(now.getFullYear(), now.getMonth() + 1, latePaymentDueDay).toISOString().slice(0, 10) };
  }, [frankConfig, frankPayments, latePaymentDueDay]);

  const annualRate = useMemo(() => {
    if (settings.useFixedRate) return Number(settings.fixedAnnualRatePct ?? DEFAULT_FIXED_RATE);
    return Number(settings.norgesBankRatePct || 0) + Number(settings.marginPct || 0);
  }, [settings.useFixedRate, settings.fixedAnnualRatePct, settings.norgesBankRatePct, settings.marginPct]);
  const monthlyRate = annualRate / 100 / 12;

  // Last lagrede data
  useEffect(() => {
    if (!userId || !isSupabaseConfigured()) return;
    (async () => {
      const { data: settingsRow } = await supabase.from('mondeo_loan_settings').select('*').eq('user_id', userId).maybeSingle();
      if (settingsRow) {
        setSettings({
          id: settingsRow.id,
          initialPrincipal: Number(settingsRow.initial_principal || DEFAULT_PRINCIPAL),
          startDate: settingsRow.start_date || todayISO(),
          marginPct: Number(settingsRow.margin_pct ?? 6),
          norgesBankRatePct: Number(settingsRow.norges_bank_rate_pct ?? 4.5),
          norgesBankRateObservedAt: settingsRow.norges_bank_rate_observed_at ?? undefined,
          fixedAnnualRatePct: Number(settingsRow.fixed_annual_rate_pct ?? DEFAULT_FIXED_RATE),
          useFixedRate: settingsRow.use_fixed_rate ?? true,
          interestStartDate: settingsRow.interest_start_date ?? DEFAULT_INTEREST_START,
          minMonthlyPayment: Number(settingsRow.min_monthly_payment ?? DEFAULT_MIN_MONTHLY),
          buyerName: settingsRow.buyer_name ?? '',
          buyerCompany: settingsRow.buyer_company ?? '',
          buyerOrgNumber: settingsRow.buyer_org_number ?? undefined,
          buyerEmail: settingsRow.buyer_email ?? undefined,
          sellerEntity: settingsRow.seller_entity ?? '',
          sellerOrgNumber: settingsRow.seller_org_number ?? undefined,
          contractStoragePath: settingsRow.contract_storage_path ?? undefined,
          contractFileName: settingsRow.contract_file_name ?? undefined,
          notes: settingsRow.notes ?? defaultSettings.notes,
        });
      } else {
        await persistSettings(defaultSettings);
      }
      const { data: paymentRows } = await supabase.from('mondeo_loan_payments').select('*').eq('user_id', userId).order('date', { ascending: true });
      if (paymentRows) {
        setPayments(paymentRows.map((r: any) => ({ id: r.id, date: r.date, amount: Number(r.amount), note: r.note ?? undefined, postedTransactionId: r.posted_transaction_id ?? undefined })));
      }
      const { data: kpiRows } = await supabase.from('mondeo_kpi_adjustments').select('*').eq('user_id', userId).order('year', { ascending: true });
      if (kpiRows) {
        setKpiAdjustments(kpiRows.map((r: any) => ({
          id: r.id, year: Number(r.year), kpiPct: Number(r.kpi_pct), appliedAt: r.applied_at ?? undefined,
          principalBefore: r.principal_before ? Number(r.principal_before) : undefined,
          principalAfter: r.principal_after ? Number(r.principal_after) : undefined,
          note: r.note ?? undefined,
        })));
      }
      // Tillegg (strøm, kommunalt) — fra Supabase med localStorage-fallback
      let loadedFromDb = false;
      try {
        const { data: chargeRows, error } = await supabaseFamilyData.from('mondeo_additional_charges').select('*').eq('user_id', userId).order('date', { ascending: true });
        if (!error && chargeRows && chargeRows.length > 0) {
          setCharges(chargeRows.map((r: any) => ({ id: r.id, date: r.date, amount: Number(r.amount), type: r.type, note: r.note ?? undefined })));
          loadedFromDb = true;
        } else if (error) {
          console.warn('[Mondeo] charges-tabell ikke tilgjengelig (kjør 20260629_mondeo_additional_charges.sql):', error.message);
        }
      } catch (e) {
        console.warn('[Mondeo] charges-fetch feil:', e);
      }
      if (!loadedFromDb) {
        try {
          const local = localStorage.getItem(`mondeo_charges_${userId}`);
          if (local) setCharges(JSON.parse(local));
        } catch {}
      }
    })();
  }, [userId]);

  const refreshNorgesBank = async () => {
    setLoadingRate(true);
    try {
      const rate = await fetchNorgesBankPolicyRate();
      await persistSettings({ ...settings, norgesBankRatePct: rate.value, norgesBankRateObservedAt: rate.observedAt });
    } finally { setLoadingRate(false); }
  };

  const persistSettings = async (next: MondeoLoanSettings) => {
    setSettings(next);
    if (!userId || !isSupabaseConfigured()) return;
    await supabase.from('mondeo_loan_settings').upsert({
      id: next.id, user_id: userId,
      initial_principal: next.initialPrincipal, start_date: next.startDate,
      margin_pct: next.marginPct, norges_bank_rate_pct: next.norgesBankRatePct,
      norges_bank_rate_observed_at: next.norgesBankRateObservedAt ?? null,
      fixed_annual_rate_pct: next.fixedAnnualRatePct ?? DEFAULT_FIXED_RATE,
      use_fixed_rate: next.useFixedRate ?? true,
      interest_start_date: next.interestStartDate ?? DEFAULT_INTEREST_START,
      min_monthly_payment: next.minMonthlyPayment ?? DEFAULT_MIN_MONTHLY,
      buyer_name: next.buyerName ?? null, buyer_company: next.buyerCompany ?? null,
      buyer_org_number: next.buyerOrgNumber ?? null, buyer_email: next.buyerEmail ?? null,
      seller_entity: next.sellerEntity ?? null, seller_org_number: next.sellerOrgNumber ?? null,
      contract_storage_path: next.contractStoragePath ?? null,
      contract_file_name: next.contractFileName ?? null,
      notes: next.notes ?? null,
      updated_at: new Date().toISOString(),
    });
  };

  // DAGLIG RENTE-AVREGNER (månedskorrekt):
  // - Månedsrente = balance × monthlyRate (0.75% ved 9 % årlig)
  //   → 36 000 kr/mnd ved 4.8M saldo, uansett antall dager i måneden
  // - Fordeles proporsjonalt over dagene i den aktuelle måneden:
  //   dailyRate = monthlyRate / daysInMonth
  //   juni (30d): 1 200/dag, juli (31d): 1 161/dag → begge totalt 36 000
  // - Ved betaling: allokerer først til påløpt rente, deretter avdrag
  //   → tidlig i mnd = mindre rente akkumulert, sent = mer
  // - Ved månedsslutt kapitaliseres ubetalt rente til hovedstol
  const ledger: MondeoLedgerRow[] = useMemo(() => {
    let balance = Number(settings.initialPrincipal || 0);
    const interestStart = settings.interestStartDate || settings.startDate;
    const rows: MondeoLedgerRow[] = [];
    if (!interestStart) return rows;

    // Månedens rente = balance × 9%/12 (konstant per måned, ikke pro-ratert daglig).
    // Hvis renteoppstart er midt i måneden, pro-rater bare den første måneden.
    const monthInterestFor = (monthEndDate: Date, currentBalance: number): number => {
      const y = monthEndDate.getFullYear();
      const m = monthEndDate.getMonth();
      const monthStart = new Date(y, m, 1);
      const startInt = new Date(interestStart);
      // Ingen rente hvis renteperioden ikke har startet ennå
      if (startInt > monthEndDate) return 0;
      const daysInMonth = new Date(y, m + 1, 0).getDate();
      // Første måned: pro-rater fra startInt til månedsslutt
      if (startInt > monthStart) {
        const activeDays = daysInMonth - startInt.getDate() + 1;
        return currentBalance * monthlyRate * (activeDays / daysInMonth);
      }
      return currentBalance * monthlyRate;
    };

    // Bygg kronologisk liste av alle hendelser
    interface Event { date: string; kind: 'payment' | 'charge' | 'kpi' | 'month-end' | 'late-fee'; payload?: any; }
    const events: Event[] = [];
    for (const p of payments) if (p.date) events.push({ date: p.date, kind: 'payment', payload: p });
    for (const c of charges) if (c.date) events.push({ date: c.date, kind: 'charge', payload: c });
    for (const k of kpiAdjustments) if (k.kpiPct) events.push({ date: `${k.year}-01-01`, kind: 'kpi', payload: k });

    // Legg til månedsslutt-hendelser fra interestStart til i dag
    const now = new Date();
    const nowStrForLate = now.toISOString().slice(0, 10);
    const cursor = new Date(interestStart);
    while (cursor <= now) {
      const monthEnd = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0);
      if (monthEnd <= now) {
        events.push({ date: monthEnd.toISOString().slice(0, 10), kind: 'month-end' });
      }
      cursor.setMonth(cursor.getMonth() + 1);
    }

    // Forsinkelsesrente: minstebeløp × 9%/365 pr dag fra 1. i måneden (eller renteoppstart)
    // frem til kumulative innbetalinger (FIFO til eldste ubetalte måned) når 33 000 for den måneden.
    const dailyLateRate = annualRate / 100 / 365;
    const minMonthlyForFee = settings.minMonthlyPayment ?? DEFAULT_MIN_MONTHLY;
    interface Cycle { month: string; accrualStart: Date; paid: number; paidReachDate: Date | null; }
    const cycles: Cycle[] = [];
    const iter = new Date(interestStart);
    while (iter <= now) {
      const y = iter.getFullYear();
      const m = iter.getMonth();
      const monthStart = new Date(y, m, 1);
      const accrualStart = new Date(interestStart) > monthStart ? new Date(interestStart) : monthStart;
      if (accrualStart <= now) {
        cycles.push({
          month: `${y}-${String(m + 1).padStart(2, '0')}`,
          accrualStart,
          paid: 0,
          paidReachDate: null,
        });
      }
      iter.setMonth(iter.getMonth() + 1);
    }

    // FIFO-anvend innbetalinger på eldste ubetalte måned
    const sortedPayments = [...payments].filter((p) => p.date).sort((a, b) => (a.date < b.date ? -1 : 1));
    for (const p of sortedPayments) {
      let remaining = Number(p.amount || 0);
      const paidDate = new Date(p.date);
      for (const cycle of cycles) {
        if (remaining <= 0) break;
        if (cycle.paidReachDate) continue;
        const needed = minMonthlyForFee - cycle.paid;
        const apply = Math.min(remaining, needed);
        cycle.paid += apply;
        remaining -= apply;
        if (cycle.paid >= minMonthlyForFee - 0.01) {
          cycle.paidReachDate = paidDate;
        }
      }
    }

    // Generer late-fee events
    for (const cycle of cycles) {
      const endDate = cycle.paidReachDate ?? now;
      const daysLate = Math.max(0, Math.round((endDate.getTime() - cycle.accrualStart.getTime()) / 86400000));
      if (daysLate > 0) {
        const fee = minMonthlyForFee * dailyLateRate * daysLate;
        events.push({
          date: endDate.toISOString().slice(0, 10),
          kind: 'late-fee',
          payload: {
            month: cycle.month,
            shortfall: minMonthlyForFee,
            daysLate,
            fee,
            dueDate: cycle.accrualStart.toISOString().slice(0, 10),
            paidAt: cycle.paidReachDate ? cycle.paidReachDate.toISOString().slice(0, 10) : null,
          },
        });
      }
    }

    // Sortering ved samme dato: kpi → payment → charge → month-end → late-fee
    const kindOrder = { kpi: 0, payment: 1, charge: 2, 'month-end': 3, 'late-fee': 4 };
    events.sort((a, b) => {
      if (a.date !== b.date) return a.date < b.date ? -1 : 1;
      return kindOrder[a.kind] - kindOrder[b.kind];
    });

    let lastDate = interestStart;
    let nr = 0;
    for (const ev of events) {
      if (ev.kind === 'kpi') {
        const factor = 1 + Number(ev.payload.kpiPct || 0) / 100;
        const newBalance = balance * factor;
        const adjustment = newBalance - balance;
        nr += 1;
        rows.push({ id: `kpi-${ev.payload.id}`, nr, fromDate: lastDate, date: ev.date, openingBalance: balance, interestDue: 0, paid: 0, charges: 0, principalChange: -adjustment, closingBalance: newBalance, status: 'KPI-justering' });
        balance = newBalance;
      } else if (ev.kind === 'payment') {
        // Innbetalinger vises som informativ rad — den faktiske avregningen
        // (rente/avdrag/kapitalisering) skjer ved månedsslutt iht. kontrakten.
        const paid = Number(ev.payload.amount || 0);
        nr += 1;
        rows.push({
          id: ev.payload.id, nr,
          fromDate: lastDate, date: ev.date,
          openingBalance: balance,
          interestDue: 0,
          paid,
          charges: 0,
          principalChange: 0,
          closingBalance: balance,
          status: 'Innbetaling mottatt (avregnes månedsslutt)',
        });
      } else if (ev.kind === 'charge') {
        const chargeAmt = Number(ev.payload.amount || 0);
        const newBalance = balance + chargeAmt;
        nr += 1;
        rows.push({
          id: `charge-${ev.payload.id}`, nr,
          fromDate: lastDate, date: ev.date,
          openingBalance: balance,
          interestDue: 0,
          paid: 0,
          charges: chargeAmt,
          principalChange: -chargeAmt,
          closingBalance: newBalance,
          status: 'Tillegg påløpt',
        });
        balance = newBalance;
      } else if (ev.kind === 'month-end') {
        // Kontraktens avregning (Vedlegg A, punkt 4):
        //  1. Månedens rente = restgjeld × 9%/12
        //  2. Terminbeløp (33 000) trekkes fra rente. Overskudd av terminbeløp reduserer restgjeld.
        //  3. Restrente kapitaliseres til restgjeld (negativ amortisering).
        //  4. Ekstrainnbetaling (over terminbeløp) reduserer restgjeld ytterligere.
        const monthEndDate = new Date(ev.date);
        const monthKey = ev.date.slice(0, 7);
        const monthInterest = monthInterestFor(monthEndDate, balance);
        const paidThisMonth = payments
          .filter((p) => p.date && p.date.slice(0, 7) === monthKey)
          .reduce((s, p) => s + Number(p.amount || 0), 0);
        const minMonthly = settings.minMonthlyPayment ?? DEFAULT_MIN_MONTHLY;
        const termAmount = Math.min(paidThisMonth, minMonthly);
        const extraPayment = Math.max(0, paidThisMonth - minMonthly);
        const restInterest = Math.max(0, monthInterest - termAmount);
        const termPrincipalReduction = Math.max(0, termAmount - monthInterest);
        const netChange = restInterest - termPrincipalReduction - extraPayment;
        if (Math.abs(netChange) > 0.01 || monthInterest > 0.01) {
          const openingBalance = balance;
          balance += netChange;
          nr += 1;
          let status: string;
          if (paidThisMonth === 0) status = `Rente kapitaliseres (mnd.rente ${Math.round(monthInterest)}, ingen betaling)`;
          else if (netChange > 0) status = `Restrente ${Math.round(restInterest)} kapitaliseres (betalt ${Math.round(paidThisMonth)}, rente ${Math.round(monthInterest)})`;
          else if (netChange < 0) status = `Avdrag (betalt ${Math.round(paidThisMonth)}, rente ${Math.round(monthInterest)}, avdrag ${Math.round(Math.abs(netChange))})`;
          else status = `Rente ${Math.round(monthInterest)} dekket av innbetaling`;
          rows.push({
            id: `me-${ev.date}`, nr,
            fromDate: lastDate, date: ev.date,
            openingBalance,
            interestDue: monthInterest,
            paid: paidThisMonth,
            charges: 0,
            principalChange: -netChange,
            closingBalance: balance,
            status,
          });
        }
      } else if (ev.kind === 'late-fee') {
        const fee = Number(ev.payload.fee || 0);
        if (fee > 0.01) {
          balance += fee;
          nr += 1;
          rows.push({
            id: `late-${ev.payload.month}`, nr,
            fromDate: ev.payload.dueDate, date: ev.date,
            openingBalance: balance - fee,
            interestDue: fee,
            paid: 0,
            charges: 0,
            principalChange: -fee,
            closingBalance: balance,
            status: `Forsinkelsesrente ${ev.payload.month} (${ev.payload.daysLate} d)`,
          });
        }
      }

      lastDate = ev.date;
    }

    return rows;
  }, [payments, charges, kpiAdjustments, settings.initialPrincipal, settings.interestStartDate, settings.startDate, monthlyRate, annualRate, latePaymentDueDay]);

  const currentBalance = ledger.length ? ledger[ledger.length - 1].closingBalance : Number(settings.initialPrincipal || 0);
  // Summer faktiske innbetalinger – IKKE ledger-radenes `paid`. Hver betaling
  // finnes i to rader (informativ «Innbetaling mottatt» + månedsslutt-avregning),
  // så en ledger-sum ville dobbelttalt (f.eks. 36 060 → 72 120).
  const totalPaid = payments.reduce((s, p) => s + Number(p.amount || 0), 0);
  const totalInterest = ledger.reduce((s, r) => s + r.interestDue, 0);
  const totalPrincipalChange = ledger.reduce((s, r) => s + r.principalChange, 0);
  const estimatedMonthlyInterest = currentBalance * monthlyRate;
  const minMonthly = settings.minMonthlyPayment ?? DEFAULT_MIN_MONTHLY;
  const monthlyDifferenceAtMinimum = minMonthly - estimatedMonthlyInterest;
  const annualNegativeAmortizationAtMinimum = monthlyDifferenceAtMinimum < 0 ? Math.abs(monthlyDifferenceAtMinimum) * 12 : 0;

  // Min-betaling pr måned
  const minPaymentStatus = useMemo(() => {
    const interestStart = settings.interestStartDate || settings.startDate;
    const start = new Date(interestStart);
    const now = new Date();
    const months: Array<{ key: string; sum: number; required: number; missing: number }> = [];
    const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
    while (cursor <= now) {
      const key = cursor.toISOString().slice(0, 7);
      const sum = payments.filter((p) => p.date && p.date.slice(0, 7) === key).reduce((s, p) => s + Number(p.amount || 0), 0);
      months.push({ key, sum, required: minMonthly, missing: Math.max(0, minMonthly - sum) });
      cursor.setMonth(cursor.getMonth() + 1);
    }
    const totalMissing = months.reduce((s, m) => s + m.missing, 0);
    const monthsBehind = months.filter((m) => m.missing > 0).length;
    return { months, totalMissing, monthsBehind };
  }, [payments, minMonthly, settings.interestStartDate, settings.startDate]);

  const addPayment = async () => {
    const requested = Number(paymentAmount || 0);
    if (!paymentDate || requested <= 0) return;
    const balanceBeforePayment = ledger.length ? ledger[ledger.length - 1].closingBalance : Number(settings.initialPrincipal || 0);
    const newPayment: MondeoLoanPayment = { id: createId(), date: paymentDate, amount: requested, note: paymentNote || undefined };
    // Hele innbetalingen registreres som renteinntekt (ingen avdrag på hovedstol).
    const interestTx: Transaction = {
      id: `tx-mondeo-${newPayment.id}`, date: paymentDate, amount: Math.round(requested), currency: 'NOK',
      description: `Renteinntekt ${settings.sellerEntity || 'selgerkreditt'}${paymentNote ? ` – ${paymentNote}` : ''}${mondeoAccount.bankName ? ` (inn på ${mondeoAccount.bankName} ${mondeoAccount.accountNumber})` : ''}`,
      category: 'Renteinntekt', type: TransactionType.INCOME, paymentMethod: paymentMethod as any, isAccrual: false,
    };
    newPayment.postedTransactionId = interestTx.id;

    if (userId && isSupabaseConfigured()) {
      const { error: payErr } = await supabase.from('mondeo_loan_payments').insert({ id: newPayment.id, user_id: userId, date: newPayment.date, amount: newPayment.amount, note: newPayment.note ?? null, posted_transaction_id: interestTx.id });
      if (payErr) {
        console.error('[MondeoClean] mondeo_loan_payments insert failed', payErr);
        const msg = payErr.message || payErr.details || 'ukjent DB-feil';
        if (msg.includes('business_financial_events')) {
          alert('Databasen har en trigger som prøver å skrive til business_financial_events, men verdien blir avvist av en check-constraint.\n\nFeilmelding fra Postgres:\n' + msg + '\n\nLøsning: kjør denne SQL i Supabase for å fjerne den gamle trigger-en:\n\nDROP TRIGGER IF EXISTS mondeo_loan_payments_to_business_events ON family.mondeo_loan_payments;\n\n(eller tilsvarende navn — sjekk pg_trigger)\n\nInnbetalingen ble IKKE lagret.');
        } else {
          alert('Klarte ikke lagre innbetaling: ' + msg + '\n\nBeløpet er IKKE lagret. Prøv igjen eller sjekk konsollet.');
        }
        return;
      }
    }

    setPayments((prev) => [...prev, newPayment]);
    setTransactions?.((prev) => [interestTx, ...prev]);
    setPaymentAmount(String(minMonthly));
    setPaymentNote('Minimum terminbeløp iht. avtale');
  };

  const deletePayment = async (payment: MondeoLoanPayment) => {
    setPayments((prev) => prev.filter((p) => p.id !== payment.id));
    if (payment.postedTransactionId) setTransactions?.((prev) => prev.filter((t) => t.id !== payment.postedTransactionId));
    if (userId && isSupabaseConfigured()) {
      await supabase.from('mondeo_loan_payments').delete().eq('id', payment.id);
      if (payment.postedTransactionId) await supabase.from('transactions').delete().eq('id', payment.postedTransactionId);
    }
  };

  // TILLEGG (strøm, kommunalt, andre utlegg)
  const persistCharges = async (next: MondeoAdditionalCharge[]) => {
    setCharges(next);
    if (!userId) return;
    try { localStorage.setItem(`mondeo_charges_${userId}`, JSON.stringify(next)); } catch {}
    if (isSupabaseConfigured()) {
      const { error } = await supabaseFamilyData.from('mondeo_additional_charges').upsert(next.map(c => ({ id: c.id, user_id: userId, date: c.date, amount: c.amount, type: c.type, note: c.note ?? null })));
      if (error) {
        console.error('[Mondeo] tillegg-lagring feilet:', error);
        alert('Kunne ikke lagre tillegg til Supabase: ' + (error.message || 'ukjent feil') + '\n\nTillegget er lagret lokalt, men vil ikke synke mellom enheter før tabellen mondeo_additional_charges finnes i public-schema.');
      }
    }
  };

  const addCharge = async () => {
    const amount = Number(chargeAmount || 0);
    if (!chargeDate || amount <= 0) return;
    const next: MondeoAdditionalCharge = { id: createId(), date: chargeDate, amount, type: chargeType, note: chargeNote || undefined };
    await persistCharges([...charges, next].sort((a, b) => (a.date < b.date ? -1 : 1)));
    setChargeAmount(''); setChargeNote('');
  };

  const deleteCharge = async (id: string) => {
    if (userId && isSupabaseConfigured()) {
      try { await supabaseFamilyData.from('mondeo_additional_charges').delete().eq('id', id); } catch {}
    }
    await persistCharges(charges.filter(c => c.id !== id));
  };

  // Frank-avdrag: registrer betaling → oppretter Transaction som utgift fra DNB Mondeo-konto
  const addFrankPayment = (date: string, amount: number) => {
    if (!date || amount <= 0) return;
    const p: FrankPayment = { id: createId(), date, amount };
    const tx: Transaction = {
      id: `tx-frank-${p.id}`,
      date,
      amount: Math.round(amount * 100) / 100,
      currency: 'NOK',
      description: `Avdrag lån Frank (fra ${mondeoAccount.bankName} ${mondeoAccount.accountNumber})`,
      category: 'Renteutgift',
      type: TransactionType.EXPENSE,
      paymentMethod: 'Bank' as any,
      isAccrual: false,
    };
    p.postedTransactionId = tx.id;
    setFrankPayments([...frankPayments, p]);
    setTransactions?.((prev) => [tx, ...prev]);
  };

  const deleteFrankPayment = (id: string) => {
    const p = frankPayments.find(x => x.id === id);
    setFrankPayments(frankPayments.filter(x => x.id !== id));
    if (p?.postedTransactionId) setTransactions?.((prev) => prev.filter(t => t.id !== p.postedTransactionId));
  };

  // KPI
  const addKpiAdjustment = async () => {
    const pct = Number(kpiPct || 0);
    if (!kpiYear || pct === 0) return;
    const yearStart = `${kpiYear}-01-01`;
    let principalBefore = Number(settings.initialPrincipal || 0);
    for (const row of ledger) { if (row.date < yearStart) principalBefore = row.closingBalance; }
    const principalAfter = principalBefore * (1 + pct / 100);
    const adj: MondeoKpiAdjustment = { id: createId(), year: kpiYear, kpiPct: pct, appliedAt: todayISO(), principalBefore, principalAfter, note: kpiNote || undefined };
    setKpiAdjustments((prev) => [...prev.filter((k) => k.year !== kpiYear), adj]);
    setKpiPct(''); setKpiNote('');
    if (userId && isSupabaseConfigured()) {
      await supabase.from('mondeo_kpi_adjustments').upsert({ id: adj.id, user_id: userId, year: adj.year, kpi_pct: adj.kpiPct, applied_at: adj.appliedAt, principal_before: adj.principalBefore, principal_after: adj.principalAfter, note: adj.note ?? null }, { onConflict: 'user_id,year' });
    }
  };

  const deleteKpiAdjustment = async (adj: MondeoKpiAdjustment) => {
    setKpiAdjustments((prev) => prev.filter((k) => k.id !== adj.id));
    if (userId && isSupabaseConfigured()) {
      await supabase.from('mondeo_kpi_adjustments').delete().eq('id', adj.id);
    }
  };

  // Kontrakt-opplasting
  const uploadContract = async (file: File) => {
    if (!userId || !isSupabaseConfigured()) {
      setUploadMsg({ kind: 'error', text: 'Du må være innlogget for å laste opp kontrakt.' });
      return;
    }
    setUploading(true);
    setUploadMsg(null);
    try {
      const path = `${userId}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.\-_]/g, '_')}`;
      const { error: upError } = await supabase.storage.from('mondeo-documents').upload(path, file, { upsert: true });
      if (upError) throw upError;
      await persistSettings({ ...settings, contractStoragePath: path, contractFileName: file.name });
      setUploadMsg({ kind: 'success', text: `Lagret «${file.name}».` });
    } catch (err: any) {
      setUploadMsg({ kind: 'error', text: err?.message || 'Opplasting feilet.' });
    } finally { setUploading(false); }
  };

  const downloadContract = async () => {
    if (!settings.contractStoragePath || !isSupabaseConfigured()) return;
    const { data, error } = await supabase.storage.from('mondeo-documents').createSignedUrl(settings.contractStoragePath, 600);
    if (error || !data?.signedUrl) {
      setUploadMsg({ kind: 'error', text: error?.message || 'Klarte ikke å åpne kontrakten.' });
      return;
    }
    window.open(data.signedUrl, '_blank');
  };

  // Print / PDF
  const handlePrint = () => {
    if (!printAreaRef.current) { window.print(); return; }
    const html = printAreaRef.current.innerHTML;
    const win = window.open('', '_blank', 'width=900,height=1200');
    if (!win) return;
    win.document.write(`<!doctype html><html lang="no"><head><meta charset="utf-8"><title>Mondeo regnskap</title>
      <style>
        body { font-family: -apple-system, Segoe UI, Roboto, sans-serif; padding: 32px; color: #0f172a; }
        h1 { font-size: 22px; margin: 0 0 4px; }
        h2 { font-size: 14px; margin: 24px 0 8px; color: #475569; text-transform: uppercase; letter-spacing: 0.06em; }
        table { width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 16px; }
        th, td { padding: 6px 8px; border-bottom: 1px solid #e2e8f0; text-align: left; vertical-align: top; }
        th { background: #f1f5f9; }
        td.num { text-align: right; font-variant-numeric: tabular-nums; }
        .kv { display: grid; grid-template-columns: 200px 1fr; gap: 4px 16px; font-size: 13px; }
        .kv dt { color: #64748b; }
        .kv dd { margin: 0; font-weight: 600; }
        .meta { color: #64748b; font-size: 11px; margin-bottom: 24px; }
        .summary-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin: 12px 0 18px; }
        .summary-card { border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; background: #f8fafc; }
        .summary-card .lbl { font-size: 10px; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; }
        .summary-card .val { font-size: 18px; font-weight: 800; margin-top: 4px; font-variant-numeric: tabular-nums; }
        .summary-card.danger .val { color: #b91c1c; }
        .summary-card.success .val { color: #047857; }
        .summary-card.warn .val { color: #b45309; }
        .page-break { page-break-after: always; }
        .summary-section { padding-bottom: 8px; }
      </style></head><body>${html}</body></html>`);
    win.document.close();
    setTimeout(() => win.print(), 300);
  };

  const headerSubtitle = settings.useFixedRate
    ? `Avtalen er lagt inn med lånebeløp ${formatNOK(settings.initialPrincipal)}, minimum ${formatNOK(minMonthly)}/mnd og fast rente ${formatPercent(settings.fixedAnnualRatePct ?? DEFAULT_FIXED_RATE)} fra ${formatDate(settings.interestStartDate)}. Hvis betalingen er lavere enn renten økes hovedstolen tilsvarende.`
    : `Avtalen er lagt inn med lånebeløp ${formatNOK(settings.initialPrincipal)}, minimum ${formatNOK(minMonthly)}/mnd og rente = Norges Banks styringsrente + ${formatPercent(settings.marginPct)}.`;

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <section className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-slate-900 text-white"><Building2 className="h-5 w-5" /></div>
            <span className="inline-flex rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">{settings.sellerEntity || 'Selgerkreditt'}</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight md:text-5xl">Rente- og avregningsdashboard</h1>
          <p className="mt-3 max-w-3xl text-base text-slate-600 md:text-lg">{headerSubtitle}</p>
        </div>
        <div className="flex flex-col gap-2 md:items-end">
          <button onClick={handlePrint} className="btn-primary"><Printer className="h-4 w-4" /> Skriv ut / PDF</button>
          {!settings.useFixedRate && (
            <button onClick={refreshNorgesBank} disabled={loadingRate} className="btn-secondary">
              <RefreshCw className={`h-4 w-4 ${loadingRate ? 'animate-spin' : ''}`} /> Oppdater Norges Bank
            </button>
          )}
        </div>
      </section>

      {/* METRICS */}
      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard title="Nåværende saldo" value={formatNOK(currentBalance)} symbol="kr" hint={`Kjøper: ${settings.buyerName}`} />
        <MetricCard title="Minimum termin" value={formatNOK(minMonthly)} symbol="1" hint="Absolutt minimum per måned" />
        <MetricCard title="Månedsrente" value={formatNOK(estimatedMonthlyInterest)} symbol="%" hint={`${formatPercent(annualRate)} årlig ÷ 12 = fast pr måned. Fordeles daglig — tidlig betaling reduserer akkumulert rente.`} />
        <MetricCard title="Ved minimum" value={monthlyDifferenceAtMinimum >= 0 ? `${formatNOK(monthlyDifferenceAtMinimum)} avdrag` : `${formatNOK(Math.abs(monthlyDifferenceAtMinimum))} økning`} symbol="±" hint={monthlyDifferenceAtMinimum < 0 ? `${formatNOK(annualNegativeAmortizationAtMinimum)} økning/år` : 'Positiv amortisering'} tone={monthlyDifferenceAtMinimum < 0 ? 'warning' : 'success'} />
      </section>

      {/* RESTGJELDEN VOKSER — aggregert pr måned med synlig regnestykke */}
      {(() => {
        // Aggreger rente + tillegg pr kalendermåned (ekskl. KPI-justering),
        // og hent faktisk betalt fra innbetalingene (unngår dobbelttelling).
        const monthMap = new Map<string, { rente: number; tillegg: number }>();
        for (const r of ledger) {
          if (r.status === 'KPI-justering') continue;
          const key = r.date.slice(0, 7);
          const m = monthMap.get(key) ?? { rente: 0, tillegg: 0 };
          m.rente += r.interestDue;
          m.tillegg += r.charges;
          monthMap.set(key, m);
        }
        const growthRows = Array.from(monthMap.entries())
          .map(([key, m]) => {
            const betalt = payments
              .filter((p) => p.date && p.date.slice(0, 7) === key)
              .reduce((s, p) => s + Number(p.amount || 0), 0);
            return { key, rente: m.rente, tillegg: m.tillegg, betalt, okning: m.rente + m.tillegg - betalt };
          })
          .filter((m) => m.okning > 0.5)
          .sort((a, b) => (a.key < b.key ? -1 : 1));
        if (growthRows.length === 0) return null;
        const totalGrowth = growthRows.reduce((s, m) => s + m.okning, 0);
        const sum = (pick: (m: (typeof growthRows)[number]) => number) => growthRows.reduce((s, m) => s + pick(m), 0);
        const fmtMonth = (key: string) => {
          const [y, mo] = key.split('-');
          const d = new Date(Number(y), Number(mo) - 1, 1).toLocaleDateString('nb-NO', { month: 'short', year: 'numeric' });
          return d.charAt(0).toUpperCase() + d.slice(1);
        };
        return (
          <section className="rounded-2xl border border-amber-300 bg-amber-50 p-5 text-sm text-slate-800">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700"><AlertTriangle className="h-5 w-5" /></div>
              <div className="min-w-0 flex-1">
                <p className="text-base font-bold text-slate-900">Restgjelden vokser</p>
                <p className="mt-1 text-slate-600">I {growthRows.length} {growthRows.length === 1 ? 'måned' : 'måneder'} har rente + tillegg vært større enn innbetalingen. Differansen legges da til hovedstolen.</p>
                <div className="mt-3 flex flex-wrap items-baseline gap-x-2 gap-y-1">
                  <span className="text-2xl font-bold text-rose-700">+ {formatNOK(totalGrowth)}</span>
                  <span className="text-slate-500">samlet økning i restgjeld</span>
                </div>

                <div className="mt-4 overflow-x-auto rounded-xl border border-amber-200 bg-white">
                  <table className="w-full min-w-[520px] text-sm">
                    <thead>
                      <tr className="border-b border-amber-100 text-left text-xs uppercase tracking-wide text-slate-500">
                        <th className="px-3 py-2 font-semibold">Måned</th>
                        <th className="px-3 py-2 text-right font-semibold">Rente</th>
                        <th className="px-3 py-2 text-right font-semibold">+ Tillegg</th>
                        <th className="px-3 py-2 text-right font-semibold">− Betalt</th>
                        <th className="px-3 py-2 text-right font-semibold">= Økning</th>
                      </tr>
                    </thead>
                    <tbody>
                      {growthRows.map((m) => (
                        <tr key={m.key} className="border-b border-slate-50 last:border-b-0">
                          <td className="px-3 py-2 font-medium text-slate-900">{fmtMonth(m.key)}</td>
                          <td className="px-3 py-2 text-right tabular-nums text-slate-700">{formatNOK(m.rente)}</td>
                          <td className="px-3 py-2 text-right tabular-nums text-slate-700">{m.tillegg > 0 ? formatNOK(m.tillegg) : '–'}</td>
                          <td className="px-3 py-2 text-right tabular-nums text-emerald-700">{m.betalt > 0 ? formatNOK(m.betalt) : '–'}</td>
                          <td className="px-3 py-2 text-right font-semibold tabular-nums text-rose-700">+ {formatNOK(m.okning)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t border-amber-200 bg-amber-50/60">
                        <td className="px-3 py-2 font-bold text-slate-900">Sum</td>
                        <td className="px-3 py-2 text-right font-semibold tabular-nums text-slate-700">{formatNOK(sum((m) => m.rente))}</td>
                        <td className="px-3 py-2 text-right font-semibold tabular-nums text-slate-700">{formatNOK(sum((m) => m.tillegg))}</td>
                        <td className="px-3 py-2 text-right font-semibold tabular-nums text-emerald-700">{formatNOK(sum((m) => m.betalt))}</td>
                        <td className="px-3 py-2 text-right font-bold tabular-nums text-rose-700">+ {formatNOK(totalGrowth)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>

                <p className="mt-3 text-xs text-slate-500">Slik stopper veksten: betal minst <strong>rente + tillegg</strong> for måneden. Betaling ut over dette reduserer hovedstolen.</p>
              </div>
            </div>
          </section>
        );
      })()}

      <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        <div className="flex gap-3"><AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" /><div><p className="font-bold">Avtalegrunnlag</p><p>Fast rente {formatPercent(settings.fixedAnnualRatePct ?? DEFAULT_FIXED_RATE)} fra {formatDate(settings.interestStartDate)}. Restgjeld KPI-justeres årlig 1. januar. Innbetalinger fra kjøper øker formuen til <strong>{settings.sellerEntity}</strong> som eier aksjene inntil fullt oppgjør.</p></div></div>
      </section>

      {/* KONTRAKTSVILKÅR + PARTER + KONTRAKT */}
      <section className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        {/* Kontraktsvilkår */}
        <Card>
          <div className="space-y-4 p-5">
            <div><h2 className="text-xl font-bold flex items-center gap-2"><Calculator className="h-5 w-5 text-slate-500" /> Kontraktsvilkår</h2><p className="mt-1 text-sm text-slate-500">Avtaleverdier — justér hvis signert avtale endres.</p></div>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Hovedstol (NOK)" type="number" value={settings.initialPrincipal} onChange={(v) => persistSettings({ ...settings, initialPrincipal: Number(v) })} />
              <Field label="Kontraktsdato" type="date" value={settings.startDate} onChange={(v) => persistSettings({ ...settings, startDate: v })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Renteoppstart" type="date" value={settings.interestStartDate || DEFAULT_INTEREST_START} onChange={(v) => persistSettings({ ...settings, interestStartDate: v })} />
              <Field label="Min mnd. (NOK)" type="number" value={settings.minMonthlyPayment ?? DEFAULT_MIN_MONTHLY} onChange={(v) => persistSettings({ ...settings, minMonthlyPayment: Number(v) })} />
            </div>
            <div className="grid grid-cols-1 gap-3">
              <Field label={`Forfallsdag (dag i mnd) — ${annualRate}% rente på utestående / 365 pr dag forsinket`} type="number" value={latePaymentDueDay} onChange={(v) => { const n = Math.max(1, Math.min(28, Number(v) || 1)); setLatePaymentDueDay(n); }} />
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2">
              <p className="text-xs font-semibold uppercase tracking-widest text-slate-600">Bankkonto for renteinntekt{settings.sellerEntity ? ` (${settings.sellerEntity})` : ''}</p>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Bank" value={mondeoAccount.bankName} onChange={(v) => setMondeoAccount({ ...mondeoAccount, bankName: String(v) })} />
                <Field label="Kontohaver" value={mondeoAccount.accountName} onChange={(v) => setMondeoAccount({ ...mondeoAccount, accountName: String(v) })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Kontonummer" value={mondeoAccount.accountNumber} onChange={(v) => setMondeoAccount({ ...mondeoAccount, accountNumber: String(v) })} />
                <Field label="IBAN" value={mondeoAccount.iban} onChange={(v) => setMondeoAccount({ ...mondeoAccount, iban: String(v) })} />
              </div>
              <p className="text-[11px] text-slate-500 italic">Denne kontoen brukes til å motta månedlige renteinntekter fra kjøper. Eventuelle privatlån-avdrag trekkes normalt fra samme konto.</p>
            </div>

            <div className="rounded-xl border border-rose-200 bg-rose-50/40 p-3 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-widest text-rose-700">Privatlån (annuitet{mondeoAccount.bankName ? ` — trekkes fra ${mondeoAccount.bankName} ${mondeoAccount.accountNumber}` : ''})</p>
                <p className="text-sm font-mono font-bold text-rose-800">Saldo nå: {formatNOK(frankStatus.balance)}</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Hovedstol pr dato (NOK)" type="number" step="0.01" value={frankConfig.principal} onChange={(v) => setFrankConfig({ ...frankConfig, principal: Number(v) })} />
                <Field label="Pr dato" type="date" value={frankConfig.asOfDate} onChange={(v) => setFrankConfig({ ...frankConfig, asOfDate: String(v) })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Månedlig avdrag (NOK)" type="number" step="0.01" value={frankConfig.monthlyPayment} onChange={(v) => setFrankConfig({ ...frankConfig, monthlyPayment: Number(v) })} />
                <Field label="Årlig rente %" type="number" step="0.01" value={frankConfig.annualRatePct} onChange={(v) => setFrankConfig({ ...frankConfig, annualRatePct: Number(v) })} />
              </div>
              <div className="grid grid-cols-3 gap-3 text-xs">
                <div><span className="text-slate-500">Månedlig rente nå:</span><br /><span className="font-mono font-bold">{formatNOK(frankStatus.monthlyInterestNow)}</span></div>
                <div><span className="text-slate-500">Neste forfall:</span><br /><span className="font-mono font-bold">{frankStatus.nextPaymentDue}</span></div>
                <div><span className="text-slate-500">Antall avdrag:</span><br /><span className="font-mono font-bold">{frankPayments.length}</span></div>
              </div>
              <button
                type="button"
                onClick={() => addFrankPayment(todayISO(), frankConfig.monthlyPayment)}
                className="w-full rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-black uppercase tracking-widest py-2.5"
              >
                Bokfør månedens avdrag ({formatNOK(frankConfig.monthlyPayment)}) — {todayISO()}
              </button>
              {frankPayments.length > 0 && (
                <div className="text-[11px]">
                  <p className="font-semibold text-slate-600 mb-1">Registrerte avdrag ({frankPayments.length}):</p>
                  <ul className="space-y-1 max-h-40 overflow-y-auto">
                    {[...frankPayments].sort((a, b) => b.date.localeCompare(a.date)).map(p => (
                      <li key={p.id} className="flex justify-between items-center border-b border-rose-100 py-1">
                        <span className="font-mono">{p.date}</span>
                        <span className="font-mono">{formatNOK(p.amount)}</span>
                        <button type="button" onClick={() => deleteFrankPayment(p.id)} className="text-rose-600 hover:text-rose-800 text-[10px]">Slett</button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2">
              <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                <input type="checkbox" checked={!!settings.useFixedRate} onChange={(e) => persistSettings({ ...settings, useFixedRate: e.target.checked })} />
                Fast avtalt rente (anbefalt – 9 %)
              </label>
              {settings.useFixedRate ? (
                <Field label="Fast årlig rente %" type="number" step="0.01" value={settings.fixedAnnualRatePct ?? DEFAULT_FIXED_RATE} onChange={(v) => persistSettings({ ...settings, fixedAnnualRatePct: Number(v) })} />
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  <Field label="Norges Bank %" type="number" step="0.01" value={settings.norgesBankRatePct} onChange={(v) => persistSettings({ ...settings, norgesBankRatePct: Number(v), norgesBankRateObservedAt: undefined })} />
                  <Field label="Margin %" type="number" step="0.01" value={settings.marginPct} onChange={(v) => persistSettings({ ...settings, marginPct: Number(v) })} />
                </div>
              )}
              <div className="flex justify-between border-t border-slate-300 pt-2 text-sm"><span className="font-semibold">Total årlig rente</span><strong>{formatPercent(annualRate)}</strong></div>
            </div>
          </div>
        </Card>

        {/* Parter */}
        <Card>
          <div className="space-y-4 p-5">
            <div><h2 className="text-xl font-bold flex items-center gap-2"><Users className="h-5 w-5 text-slate-500" /> Parter</h2><p className="mt-1 text-sm text-slate-500">Selger og kjøper i kontrakten.</p></div>
            <Field label="Selger (entitet)" value={settings.sellerEntity ?? ''} onChange={(v) => persistSettings({ ...settings, sellerEntity: v })} placeholder="F.eks. Ditt Selskap AS" />
            <Field label="Selger org.nr" value={settings.sellerOrgNumber ?? ''} onChange={(v) => persistSettings({ ...settings, sellerOrgNumber: v })} placeholder="9xx xxx xxx" />
            <div className="border-t border-slate-200 my-2" />
            <Field label="Kjøper" value={settings.buyerName ?? ''} onChange={(v) => persistSettings({ ...settings, buyerName: v })} placeholder="F.eks. Ola Nordmann" />
            <Field label="Kjøper selskap" value={settings.buyerCompany ?? ''} onChange={(v) => persistSettings({ ...settings, buyerCompany: v })} placeholder="F.eks. Kjøper AS" />
            <div className="grid grid-cols-2 gap-3">
              <Field label="Org.nr" value={settings.buyerOrgNumber ?? ''} onChange={(v) => persistSettings({ ...settings, buyerOrgNumber: v })} placeholder="9xx xxx xxx" />
              <Field label="E-post" value={settings.buyerEmail ?? ''} onChange={(v) => persistSettings({ ...settings, buyerEmail: v })} placeholder="odin@…" />
            </div>
          </div>
        </Card>

        {/* Kontrakt-fil */}
        <Card>
          <div className="space-y-4 p-5">
            <div><h2 className="text-xl font-bold flex items-center gap-2"><FileText className="h-5 w-5 text-slate-500" /> Kontrakt</h2><p className="mt-1 text-sm text-slate-500">Signert avtale lagres sikkert i Supabase Storage.</p></div>
            {settings.contractStoragePath ? (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 space-y-3">
                <div className="flex items-center gap-2 text-emerald-800">
                  <FileText className="h-4 w-4" />
                  <span className="font-bold text-sm truncate">{settings.contractFileName || 'Kontrakt lagret'}</span>
                </div>
                <div className="flex gap-2">
                  <button onClick={downloadContract} className="flex-1 btn-secondary justify-center"><Download className="h-4 w-4" /> Åpne</button>
                  <button onClick={() => fileInputRef.current?.click()} className="btn-secondary"><Upload className="h-4 w-4" /> Bytt</button>
                </div>
              </div>
            ) : (
              <button onClick={() => fileInputRef.current?.click()} disabled={uploading} className="w-full rounded-xl border-2 border-dashed border-slate-300 p-6 hover:bg-slate-50 transition-all flex flex-col items-center gap-2 text-slate-600">
                <Upload className="h-6 w-6" />
                <p className="text-sm font-bold">{uploading ? 'Laster opp …' : 'Last opp signert kontrakt'}</p>
                <p className="text-xs text-slate-500">PDF, bilde eller dokument</p>
              </button>
            )}
            <input ref={fileInputRef} type="file" accept=".pdf,.doc,.docx,.png,.jpg,.jpeg" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadContract(f); e.target.value = ''; }} />
            {uploadMsg && (<p className={`text-xs ${uploadMsg.kind === 'success' ? 'text-emerald-700' : 'text-rose-700'}`}>{uploadMsg.text}</p>)}
          </div>
        </Card>
      </section>

      {/* REGISTRER BETALING */}
      <Card>
        <div className="space-y-5 p-5">
          <div><h2 className="text-xl font-bold flex items-center gap-2"><Coins className="h-5 w-5 text-slate-500" /> Registrer betaling fra kjøper</h2><p className="mt-1 text-sm text-slate-500">Renteandelen bokføres automatisk som inntekt for {settings.sellerEntity}. Påløpt månedsrente ≈ {formatNOK(estimatedMonthlyInterest)}. Betalt under dette → resten kapitaliseres til hovedstolen. Betalt over min ({formatNOK(minMonthly)}) → ekstra avdrag.</p></div>
          <div className="grid grid-cols-1 items-end gap-3 md:grid-cols-5">
            <label className="block space-y-1"><span className="text-xs font-medium text-slate-700">Dato</span><input type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} /></label>
            <label className="block space-y-1"><span className="text-xs font-medium text-slate-700">Beløp (inkl. evt. ekstra)</span><input type="number" placeholder={String(minMonthly)} value={paymentAmount} onChange={(e) => setPaymentAmount(e.target.value)} /></label>
            <label className="block space-y-1"><span className="text-xs font-medium text-slate-700">Metode</span><select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}><option>Bank</option><option>Kontant</option><option>On-Chain</option></select></label>
            <label className="block space-y-1"><span className="text-xs font-medium text-slate-700">Notat</span><input value={paymentNote} onChange={(e) => setPaymentNote(e.target.value)} placeholder="F.eks. Min termin + 10k ekstra" /></label>
            <button onClick={addPayment} className="btn-primary justify-center"><Plus className="h-4 w-4" /> Legg inn</button>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="rounded-xl border border-slate-200 bg-white p-4"><p className="text-sm text-slate-500">Total rente hittil</p><p className="mt-1 text-lg font-bold text-slate-900">{formatNOK(totalInterest)}</p></div>
            <div className="rounded-xl border border-slate-200 bg-white p-4"><p className="text-sm text-slate-500">Betalt totalt</p><p className="mt-1 text-lg font-bold text-slate-900">{formatNOK(totalPaid)}</p></div>
            <div className="rounded-xl border border-slate-200 bg-white p-4"><p className="text-sm text-slate-500">Formel</p><p className="mt-1 font-medium text-slate-900">Ny saldo = gammel saldo + månedsrente − betaling</p></div>
          </div>
        </div>
      </Card>

      {/* TILLEGG (strøm, kommunalt, andre utlegg) */}
      <Card>
        <div className="space-y-5 p-5">
          <div><h2 className="text-xl font-bold flex items-center gap-2"><Plus className="h-5 w-5 text-slate-500" /> Tillegg til hovedstol — strøm, kommunalt, andre utlegg</h2><p className="mt-1 text-sm text-slate-500">Kostnader som {settings.sellerEntity} har dekket på vegne av kjøper, men som ikke er overført til {settings.buyerName}. Tillegges hovedstolen i den måneden de er datert.</p></div>
          <div className="grid grid-cols-1 items-end gap-3 md:grid-cols-12">
            <label className="block space-y-1 md:col-span-2"><span className="text-xs font-medium text-slate-700">Dato</span><input type="date" value={chargeDate} onChange={(e) => setChargeDate(e.target.value)} /></label>
            <label className="block space-y-1 md:col-span-2"><span className="text-xs font-medium text-slate-700">Beløp NOK</span><input type="number" value={chargeAmount} onChange={(e) => setChargeAmount(e.target.value)} placeholder="F.eks. 1850" /></label>
            <label className="block space-y-1 md:col-span-2"><span className="text-xs font-medium text-slate-700">Type</span><select value={chargeType} onChange={(e) => setChargeType(e.target.value as MondeoAdditionalCharge['type'])}>
              <option>Strøm</option>
              <option>Kommunalt</option>
              <option>Forsikring</option>
              <option>Eiendomsskatt</option>
              <option>Vedlikehold</option>
              <option>Annet</option>
            </select></label>
            <label className="block space-y-1 md:col-span-4"><span className="text-xs font-medium text-slate-700">Notat</span><input value={chargeNote} onChange={(e) => setChargeNote(e.target.value)} placeholder="Periode / fakturanummer" /></label>
            <button onClick={addCharge} className="btn-primary justify-center md:col-span-2"><Plus className="h-4 w-4" /> Tillegg</button>
          </div>
          {charges.length > 0 && (
            <div className="rounded-2xl border border-slate-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr><th className="px-4 py-3 text-left">Dato</th><th className="px-4 py-3 text-left">Type</th><th className="px-4 py-3 text-right">Beløp</th><th className="px-4 py-3 text-left">Notat</th><th className="px-4 py-3"></th></tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {charges.map((c) => (
                    <tr key={c.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 whitespace-nowrap">{formatDate(c.date)}</td>
                      <td className="px-4 py-3">{c.type}</td>
                      <td className="px-4 py-3 text-right font-mono font-bold text-rose-700">+ {formatNOK(c.amount)}</td>
                      <td className="px-4 py-3 text-slate-600">{c.note || '—'}</td>
                      <td className="px-4 py-3 text-right"><button onClick={() => deleteCharge(c.id)} className="text-slate-400 hover:text-rose-600"><Trash2 className="h-4 w-4" /></button></td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-slate-50 text-sm">
                  <tr><td colSpan={2} className="px-4 py-3 font-bold">Sum tillegg som ikke er overført</td><td className="px-4 py-3 text-right font-mono font-bold text-rose-700">+ {formatNOK(charges.reduce((s, c) => s + Number(c.amount || 0), 0))}</td><td colSpan={2}></td></tr>
                </tfoot>
              </table>
            </div>
          )}
          <p className="text-xs text-slate-500">💡 Disse beløpene tillegges hovedstolen automatisk i den måneden de er datert, slik at gjelden til {settings.buyerName} reflekterer det totale tilgodehavendet til {settings.sellerEntity}.</p>
        </div>
      </Card>

      {/* KPI-JUSTERING */}
      <Card>
        <div className="space-y-4 p-5">
          <div><h2 className="text-xl font-bold flex items-center gap-2"><Percent className="h-5 w-5 text-slate-500" /> Årlig KPI-justering</h2><p className="mt-1 text-sm text-slate-500">Legg inn KPI fra SSB hver 1. januar — hovedstolen justeres opp og påvirker fremtidig rente.</p></div>
          <div className="grid grid-cols-1 items-end gap-3 md:grid-cols-4">
            <label className="block space-y-1"><span className="text-xs font-medium text-slate-700">År</span><input type="number" value={kpiYear} onChange={(e) => setKpiYear(Number(e.target.value))} /></label>
            <label className="block space-y-1"><span className="text-xs font-medium text-slate-700">KPI %</span><input type="number" step="0.01" value={kpiPct} onChange={(e) => setKpiPct(e.target.value)} placeholder="F.eks. 3.2" /></label>
            <label className="block space-y-1 md:col-span-1"><span className="text-xs font-medium text-slate-700">Notat</span><input value={kpiNote} onChange={(e) => setKpiNote(e.target.value)} placeholder="Ref. SSB-tabell" /></label>
            <button onClick={addKpiAdjustment} className="btn-primary justify-center"><Plus className="h-4 w-4" /> Bokfør</button>
          </div>
          {kpiAdjustments.length > 0 && (
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-sm">
                <thead className="bg-slate-50"><tr className="text-left text-slate-600"><th className="py-3 px-4">År</th><th className="py-3 px-4 text-right">KPI</th><th className="py-3 px-4 text-right">Før</th><th className="py-3 px-4 text-right">Etter</th><th className="py-3 px-4">Notat</th><th className="py-3 px-4"></th></tr></thead>
                <tbody>
                  {kpiAdjustments.sort((a, b) => a.year - b.year).map((adj) => (
                    <tr key={adj.id} className="border-t border-slate-100">
                      <td className="py-3 px-4 font-semibold">{adj.year}</td>
                      <td className="py-3 px-4 text-right">{formatPercent(adj.kpiPct)}</td>
                      <td className="py-3 px-4 text-right">{adj.principalBefore ? formatNOK(adj.principalBefore) : '—'}</td>
                      <td className="py-3 px-4 text-right font-semibold">{adj.principalAfter ? formatNOK(adj.principalAfter) : '—'}</td>
                      <td className="py-3 px-4 text-slate-600 italic">{adj.note || ''}</td>
                      <td className="py-3 px-4 text-right"><button onClick={() => deleteKpiAdjustment(adj)} className="text-slate-500 hover:text-rose-600"><Trash2 className="h-4 w-4" /></button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </Card>

      {/* LEDGER */}
      <Card>
        <div className="p-5">
          <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div><h2 className="text-xl font-bold">Avregningshistorikk</h2><p className="text-sm text-slate-500">Hver linje bruker saldoen fra forrige avregning og legger til én måneds rente. KPI-justeringer vises som egne linjer.</p></div>
            <span className="rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">{ledger.length} hendelser</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1100px] text-sm">
              <thead><tr className="border-b text-left text-slate-500"><th className="py-3 pr-4">#</th><th className="py-3 pr-4">Periode</th><th className="py-3 pr-4 text-right">Startsaldo</th><th className="py-3 pr-4 text-right">Rente</th><th className="py-3 pr-4 text-right">Betalt</th><th className="py-3 pr-4 text-right">Tillegg</th><th className="py-3 pr-4 text-right">Avdrag / økning</th><th className="py-3 pr-4 text-right">Ny saldo</th><th className="py-3 pr-4">Status / spesifikasjon</th><th className="py-3">Handling</th></tr></thead>
              <tbody>
                {ledger.length === 0 ? (
                  <tr><td colSpan={10} className="py-8 text-center text-slate-500">Ingen hendelser registrert ennå.</td></tr>
                ) : ledger.map((row) => {
                  const payment = payments.find((p) => p.id === row.id);
                  const monthKey = row.date.slice(0, 7);
                  const rowCharges = charges.filter((c) => c.date && c.date.slice(0, 7) === monthKey);
                  return (
                    <tr key={row.id} className="border-b last:border-b-0 align-top">
                      <td className="py-3 pr-4">{row.nr}</td>
                      <td className="whitespace-nowrap py-3 pr-4">{row.fromDate} → {row.date}</td>
                      <td className="whitespace-nowrap py-3 pr-4 text-right">{formatNOK(row.openingBalance)}</td>
                      <td className="whitespace-nowrap py-3 pr-4 text-right">{formatNOK(row.interestDue)}</td>
                      <td className="whitespace-nowrap py-3 pr-4 text-right">{formatNOK(row.paid)}</td>
                      <td className="whitespace-nowrap py-3 pr-4 text-right">{row.charges ? <span className="text-rose-700 font-semibold">+ {formatNOK(row.charges)}</span> : '—'}</td>
                      <td className="whitespace-nowrap py-3 pr-4 text-right">{row.principalChange >= 0 ? '− ' : '+ '}{formatNOK(Math.abs(row.principalChange))}</td>
                      <td className="whitespace-nowrap py-3 pr-4 text-right font-semibold">{formatNOK(row.closingBalance)}</td>
                      <td className="py-3 pr-4">
                        <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                          row.status === 'KPI-justering' ? 'border-indigo-200 bg-indigo-100 text-indigo-800' :
                          row.principalChange >= 0 ? 'border-emerald-200 bg-emerald-100 text-emerald-800' :
                          'border-red-200 bg-red-100 text-red-800'
                        }`}>{row.status}</span>
                        {rowCharges.length > 0 && (
                          <div className="mt-1 space-y-0.5">
                            {rowCharges.map((c) => (
                              <p key={c.id} className="text-[11px] text-slate-600">• {c.type}: {formatNOK(c.amount)}{c.note ? ` – ${c.note}` : ''}</p>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="py-3">{payment && (<button className="rounded-xl px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100" onClick={() => deletePayment(payment)}><Trash2 className="h-4 w-4" /></button>)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </Card>

      {/* SKJULT UTSKRIFTSOMRÅDE */}
      <div ref={printAreaRef} style={{ display: 'none' }}>
        <h1>{settings.sellerEntity || 'Selgerkreditt'} · Regnskap</h1>
        <p className="meta">Utskrift: {new Date().toLocaleString('nb-NO')} · {settings.sellerEntity} → {settings.buyerName} ({settings.buyerCompany}) · v5 (kontrakt-avregning: terminbeløp {formatNOK(settings.minMonthlyPayment ?? DEFAULT_MIN_MONTHLY)}, forfall {latePaymentDueDay}., forsinkelsesrente {annualRate}%/365)</p>
        <p className="meta">Innbetalinger til: {mondeoAccount.bankName} · {mondeoAccount.accountName} · {mondeoAccount.accountNumber} · {mondeoAccount.iban} · {mondeoAccount.currency}</p>

        {/* SAMMENDRAG ØVERST */}
        <div className="summary-section">
          <h2>Sammendrag</h2>
          <div className="summary-grid">
            <div className="summary-card"><div className="lbl">Hovedstol (start)</div><div className="val">{formatNOK(settings.initialPrincipal)}</div></div>
            <div className="summary-card danger"><div className="lbl">Nåværende saldo</div><div className="val">{formatNOK(currentBalance)}</div></div>
            <div className="summary-card success"><div className="lbl">Innbetalt totalt</div><div className="val">{formatNOK(totalPaid)}</div></div>
            <div className="summary-card warn"><div className="lbl">Renteinntekt hittil</div><div className="val">{formatNOK(totalInterest)}</div></div>
            <div className="summary-card"><div className="lbl">Tillegg påløpt (sum)</div><div className="val">{formatNOK(charges.reduce((s, c) => s + Number(c.amount || 0), 0))}</div></div>
            <div className="summary-card"><div className="lbl">Antall tillegg</div><div className="val">{charges.length}</div></div>
            <div className="summary-card"><div className="lbl">Antall innbetalinger</div><div className="val">{payments.length}</div></div>
            <div className="summary-card"><div className="lbl">Avregningsperioder</div><div className="val">{ledger.length}</div></div>
          </div>
          {(() => {
            const monthsWithGrowth = ledger.filter((r) => r.principalChange < 0 && r.status !== 'KPI-justering');
            const growth = monthsWithGrowth.reduce((s, r) => s + Math.abs(r.principalChange), 0);
            if (growth > 0) {
              return <p style={{ fontSize: '11px', color: '#b91c1c', margin: '4px 0 12px' }}><strong>⚠ Hovedstolen har vokst med {formatNOK(growth)}</strong> fordelt på {monthsWithGrowth.length} {monthsWithGrowth.length === 1 ? 'måned' : 'måneder'} hvor rente + tillegg har vært større enn innbetalingen.</p>;
            }
            return null;
          })()}
        </div>
        <hr style={{ border: 0, borderTop: '2px solid #0f172a', margin: '8px 0 16px' }} />

        <h2>Parter</h2>
        <dl className="kv">
          <dt>Selger</dt><dd>{settings.sellerEntity} {settings.sellerOrgNumber && `(${settings.sellerOrgNumber})`}</dd>
          <dt>Kjøper</dt><dd>{settings.buyerName} — {settings.buyerCompany} {settings.buyerOrgNumber && `(${settings.buyerOrgNumber})`}</dd>
          <dt>Kontakt</dt><dd>{settings.buyerEmail || '—'}</dd>
        </dl>

        <h2>Kontraktsvilkår</h2>
        <dl className="kv">
          <dt>Hovedstol</dt><dd>{formatNOK(settings.initialPrincipal)}</dd>
          <dt>Kontraktsdato</dt><dd>{formatDate(settings.startDate)}</dd>
          <dt>Renteoppstart</dt><dd>{formatDate(settings.interestStartDate)}</dd>
          <dt>Årlig rente</dt><dd>{formatPercent(annualRate)} {settings.useFixedRate ? '(fast)' : '(NB + margin)'}</dd>
          <dt>Min mnd. betaling</dt><dd>{formatNOK(minMonthly)}</dd>
        </dl>

        <h2>Status</h2>
        <dl className="kv">
          <dt>Nåværende saldo</dt><dd>{formatNOK(currentBalance)}</dd>
          <dt>Renteinntekt hittil</dt><dd>{formatNOK(totalInterest)}</dd>
          <dt>Innbetalt totalt</dt><dd>{formatNOK(totalPaid)}</dd>
          <dt>Netto endring hovedstol</dt><dd>{formatNOK(Math.abs(totalPrincipalChange))} {totalPrincipalChange >= 0 ? '(redusert)' : '(økt)'}</dd>
          {minPaymentStatus.totalMissing > 0 && (<><dt>Manglende min.bet.</dt><dd>{formatNOK(minPaymentStatus.totalMissing)} fordelt på {minPaymentStatus.monthsBehind} mnd</dd></>)}
        </dl>

        {kpiAdjustments.length > 0 && (<>
          <h2>KPI-justeringer</h2>
          <table>
            <thead><tr><th>År</th><th>KPI %</th><th className="num">Før</th><th className="num">Etter</th><th>Notat</th></tr></thead>
            <tbody>
              {kpiAdjustments.map((k) => (
                <tr key={k.id}><td>{k.year}</td><td>{formatPercent(k.kpiPct)}</td><td className="num">{k.principalBefore ? formatNOK(k.principalBefore) : '—'}</td><td className="num">{k.principalAfter ? formatNOK(k.principalAfter) : '—'}</td><td>{k.note || ''}</td></tr>
              ))}
            </tbody>
          </table>
        </>)}

        {charges.length > 0 && (<>
          <h2>Påløpte tillegg til hovedstol</h2>
          <p style={{ fontSize: '11px', color: '#475569', margin: '4px 0 8px' }}>
            Kostnader som {settings.sellerEntity} har dekket på vegne av {settings.buyerName}, men som ikke er overført til kjøper. Tillegges hovedstolen i den måneden de er datert.
          </p>
          <table>
            <thead><tr><th>Dato</th><th>Type</th><th className="num">Beløp</th><th>Spesifikasjon / fakturareferanse</th></tr></thead>
            <tbody>
              {charges.map((c) => (
                <tr key={c.id}>
                  <td>{formatDate(c.date)}</td>
                  <td>{c.type}</td>
                  <td className="num">+ {formatNOK(c.amount)}</td>
                  <td>{c.note || '—'}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ fontWeight: 'bold', borderTop: '2px solid #0f172a' }}>
                <td colSpan={2}>Sum tillegg</td>
                <td className="num">+ {formatNOK(charges.reduce((s, c) => s + Number(c.amount || 0), 0))}</td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </>)}

        {payments.length > 0 && (<>
          <h2>Innbetalinger fra {settings.buyerName}</h2>
          <p style={{ fontSize: '11px', color: '#475569', margin: '4px 0 8px' }}>
            Registrerte innbetalinger i tidsrekkefølge. Rente beregnes daglig — tidlig betaling reduserer påløpt rente, sen betaling øker den.
          </p>
          <table>
            <thead><tr><th>Dato</th><th className="num">Beløp</th><th>Notat</th></tr></thead>
            <tbody>
              {[...payments].sort((a, b) => (a.date < b.date ? -1 : 1)).map((p) => (
                <tr key={p.id}>
                  <td>{formatDate(p.date)}</td>
                  <td className="num" style={{ color: '#047857', fontWeight: 700 }}>{formatNOK(p.amount)}</td>
                  <td>{p.note || '—'}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ fontWeight: 'bold', borderTop: '2px solid #0f172a' }}>
                <td>Sum innbetalinger ({payments.length})</td>
                <td className="num" style={{ color: '#047857' }}>{formatNOK(totalPaid)}</td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </>)}

        <h2>Avregningshistorikk (daglig rente)</h2>
        <p style={{ fontSize: '11px', color: '#475569', margin: '4px 0 8px' }}>
          Månedsrente = {formatPercent(annualRate)} årlig ÷ 12 = <strong>{formatNOK(estimatedMonthlyInterest)} pr måned</strong> ved dagens saldo — fordeles daglig innenfor måneden ({formatNOK(estimatedMonthlyInterest / 30)}/dag i juni, {formatNOK(estimatedMonthlyInterest / 31)}/dag i juli).
          Ved betaling allokeres beløpet først til påløpt rente, resten reduserer hovedstolen.
          Ubetalt rente ved månedsslutt kapitaliseres (legges til hovedstolen).
        </p>
        <table>
          <thead><tr><th>#</th><th>Periode</th><th className="num">Startsaldo</th><th className="num">Rente</th><th className="num">Betalt</th><th className="num">Tillegg</th><th className="num">Avdrag/økning</th><th className="num">Ny saldo</th><th>Status / spesifikasjon</th></tr></thead>
          <tbody>
            {ledger.map((row) => {
              // Slå opp tillegg-detaljer for raden — vis type+notat-liste i status-kolonnen
              const monthKey = row.date.slice(0, 7);
              const rowCharges = charges.filter((c) => c.date && c.date.slice(0, 7) === monthKey);
              const chargeSpec = rowCharges.length > 0
                ? rowCharges.map((c) => `${c.type}: ${formatNOK(c.amount)}${c.note ? ` (${c.note})` : ''}`).join('; ')
                : '';
              return (
                <tr key={row.id}>
                  <td>{row.nr}</td>
                  <td>{row.fromDate} → {row.date}</td>
                  <td className="num">{formatNOK(row.openingBalance)}</td>
                  <td className="num">{formatNOK(row.interestDue)}</td>
                  <td className="num">{formatNOK(row.paid)}</td>
                  <td className="num">{row.charges ? `+ ${formatNOK(row.charges)}` : '—'}</td>
                  <td className="num">{row.principalChange >= 0 ? '−' : '+'}{formatNOK(Math.abs(row.principalChange))}</td>
                  <td className="num">{formatNOK(row.closingBalance)}</td>
                  <td>
                    <div>{row.status}</div>
                    {chargeSpec && <div style={{ fontSize: '10px', color: '#475569', marginTop: '2px' }}>{chargeSpec}</div>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

function Field({ label, value, onChange, type = 'text', step, placeholder }: { label: string; value: any; onChange: (v: string) => void; type?: string; step?: string; placeholder?: string }) {
  return (
    <label className="block space-y-1">
      <span className="text-xs font-medium text-slate-700">{label}</span>
      <input type={type} step={step} value={value ?? ''} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}
