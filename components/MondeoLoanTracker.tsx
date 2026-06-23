import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  Building2,
  Calculator,
  Coins,
  FileText,
  Upload,
  Download,
  AlertTriangle,
  Plus,
  RefreshCw,
  Trash2,
  TrendingUp,
  Users,
  Calendar,
  Percent,
  Printer,
} from 'lucide-react';
import {
  MondeoKpiAdjustment,
  MondeoLedgerRow,
  MondeoLoanPayment,
  MondeoLoanSettings,
  Transaction,
  TransactionType,
} from '../types';
import { fetchNorgesBankPolicyRate } from '../services/norgesBankService';
import { isSupabaseConfigured, supabase, supabasePublic } from '../supabase';

interface Props {
  userId?: string;
  transactions: Transaction[];
  setTransactions: React.Dispatch<React.SetStateAction<Transaction[]>>;
}

const todayISO = () => new Date().toISOString().slice(0, 10);
const createId = () => `${Date.now()}-${Math.random().toString(36).slice(2)}`;

const formatNOK = (value: number) =>
  new Intl.NumberFormat('nb-NO', { style: 'currency', currency: 'NOK', maximumFractionDigits: 0 }).format(Number(value || 0));
const formatPercent = (value: number) =>
  `${Number(value || 0).toLocaleString('nb-NO', { maximumFractionDigits: 2 })} %`;
const formatDate = (iso: string) => {
  try { return new Date(iso).toLocaleDateString('nb-NO', { day: 'numeric', month: 'short', year: 'numeric' }); } catch { return iso; }
};
const monthKey = (iso: string) => (iso || '').slice(0, 7);

const defaultSettings: MondeoLoanSettings = {
  id: 'mondeo-default',
  initialPrincipal: 4800000,
  startDate: '2026-05-14',
  marginPct: 6,
  norgesBankRatePct: 4.5,
  fixedAnnualRatePct: 9,
  useFixedRate: true,
  interestStartDate: '2026-06-01',
  minMonthlyPayment: 33000,
  buyerName: 'Odin Jacobsen',
  buyerCompany: 'Nordic Invest AS',
  sellerEntity: 'Extrade Holding AS',
};

export const MondeoLoanTracker: React.FC<Props> = ({ userId, transactions, setTransactions }) => {
  const [settings, setSettings] = useState<MondeoLoanSettings>(defaultSettings);
  const [payments, setPayments] = useState<MondeoLoanPayment[]>([]);
  const [kpiAdjustments, setKpiAdjustments] = useState<MondeoKpiAdjustment[]>([]);

  const [paymentDate, setPaymentDate] = useState<string>(todayISO());
  const [paymentAmount, setPaymentAmount] = useState<string>('');
  const [paymentNote, setPaymentNote] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<string>('Bank');

  const [kpiYear, setKpiYear] = useState<number>(new Date().getFullYear() + 1);
  const [kpiPct, setKpiPct] = useState<string>('');
  const [kpiNote, setKpiNote] = useState<string>('');

  const [loadingRate, setLoadingRate] = useState(false);
  const [rateSource, setRateSource] = useState<'norges-bank' | 'cache' | 'fallback' | 'manual'>('manual');
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const printAreaRef = useRef<HTMLDivElement>(null);

  // --- Rente-beregning ---
  const annualRate = useMemo(() => {
    if (settings.useFixedRate) return Number(settings.fixedAnnualRatePct || 9);
    return Number(settings.norgesBankRatePct || 0) + Number(settings.marginPct || 0);
  }, [settings.useFixedRate, settings.fixedAnnualRatePct, settings.norgesBankRatePct, settings.marginPct]);
  const monthlyRate = annualRate / 100 / 12;

  const refreshNorgesBank = useCallback(async () => {
    setLoadingRate(true);
    try {
      const rate = await fetchNorgesBankPolicyRate();
      setSettings((prev) => ({ ...prev, norgesBankRatePct: rate.value, norgesBankRateObservedAt: rate.observedAt }));
      setRateSource(rate.source);
    } finally { setLoadingRate(false); }
  }, []);

  // --- Last lagrede data fra Supabase ---
  useEffect(() => {
    if (!userId || !isSupabaseConfigured()) return;
    (async () => {
      const { data: settingsRow } = await supabase
        .from('mondeo_loan_settings').select('*').eq('user_id', userId).maybeSingle();
      if (settingsRow) {
        setSettings({
          id: settingsRow.id,
          initialPrincipal: Number(settingsRow.initial_principal),
          startDate: settingsRow.start_date,
          marginPct: Number(settingsRow.margin_pct),
          norgesBankRatePct: Number(settingsRow.norges_bank_rate_pct),
          norgesBankRateObservedAt: settingsRow.norges_bank_rate_observed_at ?? undefined,
          fixedAnnualRatePct: Number(settingsRow.fixed_annual_rate_pct ?? 9),
          useFixedRate: settingsRow.use_fixed_rate ?? true,
          interestStartDate: settingsRow.interest_start_date ?? '2026-06-01',
          minMonthlyPayment: Number(settingsRow.min_monthly_payment ?? 33000),
          buyerName: settingsRow.buyer_name ?? undefined,
          buyerCompany: settingsRow.buyer_company ?? undefined,
          buyerOrgNumber: settingsRow.buyer_org_number ?? undefined,
          buyerEmail: settingsRow.buyer_email ?? undefined,
          sellerEntity: settingsRow.seller_entity ?? undefined,
          sellerOrgNumber: settingsRow.seller_org_number ?? undefined,
          contractStoragePath: settingsRow.contract_storage_path ?? undefined,
          contractFileName: settingsRow.contract_file_name ?? undefined,
          notes: settingsRow.notes ?? undefined,
        });
      }

      const { data: paymentRows } = await supabase
        .from('mondeo_loan_payments').select('*').eq('user_id', userId).order('date', { ascending: true });
      if (paymentRows) {
        setPayments(paymentRows.map((r) => ({
          id: r.id, date: r.date, amount: Number(r.amount),
          note: r.note ?? undefined, postedTransactionId: r.posted_transaction_id ?? undefined,
        })));
      }

      const { data: kpiRows } = await supabase
        .from('mondeo_kpi_adjustments').select('*').eq('user_id', userId).order('year', { ascending: true });
      if (kpiRows) {
        setKpiAdjustments(kpiRows.map((r: any) => ({
          id: r.id, year: Number(r.year), kpiPct: Number(r.kpi_pct), appliedAt: r.applied_at ?? undefined,
          principalBefore: r.principal_before ? Number(r.principal_before) : undefined,
          principalAfter: r.principal_after ? Number(r.principal_after) : undefined,
          note: r.note ?? undefined,
        })));
      }
    })();
  }, [userId]);

  useEffect(() => {
    if (settings.norgesBankRateObservedAt) return;
    if (settings.useFixedRate) return;
    refreshNorgesBank();
  }, [settings.norgesBankRateObservedAt, settings.useFixedRate, refreshNorgesBank]);

  // --- Ledger med KPI-justeringer flettet inn på årsslutt ---
  const ledger: MondeoLedgerRow[] = useMemo(() => {
    let balance = Number(settings.initialPrincipal || 0);
    let lastDate = settings.startDate;
    const rows: MondeoLedgerRow[] = [];

    const events: Array<{ kind: 'payment' | 'kpi'; date: string; payload: any }> = [
      ...payments.map((p) => ({ kind: 'payment' as const, date: p.date, payload: p })),
      ...kpiAdjustments
        .filter((k) => k.kpiPct)
        .map((k) => ({ kind: 'kpi' as const, date: `${k.year}-01-01`, payload: k })),
    ].sort((a, b) => (a.date < b.date ? -1 : 1));

    let nr = 0;
    for (const ev of events) {
      if (ev.kind === 'payment') {
        const interestDue = balance * monthlyRate;
        const paid = Number(ev.payload.amount || 0);
        const principalChange = paid - interestDue;
        const newBalance = balance - principalChange;
        nr += 1;
        rows.push({
          id: ev.payload.id, nr, fromDate: lastDate, date: ev.payload.date,
          openingBalance: balance, interestDue, paid, principalChange, closingBalance: newBalance,
          status: principalChange >= 0 ? 'Avdrag' : 'Lånet øker',
        });
        balance = newBalance;
        lastDate = ev.payload.date;
      } else {
        const factor = 1 + Number(ev.payload.kpiPct || 0) / 100;
        const newBalance = balance * factor;
        const adjustment = newBalance - balance;
        nr += 1;
        rows.push({
          id: ev.payload.id, nr, fromDate: lastDate, date: ev.payload.date,
          openingBalance: balance, interestDue: 0, paid: 0, principalChange: -adjustment,
          closingBalance: newBalance, status: 'KPI-justering',
        });
        balance = newBalance;
        lastDate = ev.payload.date;
      }
    }
    return rows;
  }, [payments, kpiAdjustments, settings.initialPrincipal, settings.startDate, monthlyRate]);

  const chartData = useMemo(() => {
    const startPoint = { date: settings.startDate, saldo: Number(settings.initialPrincipal || 0), rente: 0, betalt: 0 };
    let cumulativeInterest = 0;
    let cumulativePaid = 0;
    const points = ledger.map((row) => {
      cumulativeInterest += row.interestDue;
      cumulativePaid += row.paid;
      return { date: row.date, saldo: Math.round(row.closingBalance), rente: Math.round(cumulativeInterest), betalt: Math.round(cumulativePaid) };
    });
    return [startPoint, ...points];
  }, [ledger, settings.initialPrincipal, settings.startDate]);

  const currentBalance = ledger.length ? ledger[ledger.length - 1].closingBalance : Number(settings.initialPrincipal || 0);
  const totalPaid = ledger.reduce((s, r) => s + r.paid, 0);
  const totalInterest = ledger.reduce((s, r) => s + r.interestDue, 0);
  const totalPrincipalChange = ledger.reduce((s, r) => s + r.principalChange, 0);
  const estimatedMonthlyInterest = currentBalance * monthlyRate;

  // --- Min-betaling-status pr måned ---
  const minPaymentStatus = useMemo(() => {
    const min = Number(settings.minMonthlyPayment || 0);
    const interestStart = settings.interestStartDate || settings.startDate;
    const start = new Date(interestStart);
    const now = new Date();
    const months: Array<{ key: string; sum: number; required: number; missing: number }> = [];
    const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
    while (cursor <= now) {
      const key = cursor.toISOString().slice(0, 7);
      const sum = payments
        .filter((p) => p.date && p.date.slice(0, 7) === key)
        .reduce((s, p) => s + Number(p.amount || 0), 0);
      months.push({ key, sum, required: min, missing: Math.max(0, min - sum) });
      cursor.setMonth(cursor.getMonth() + 1);
    }
    const totalMissing = months.reduce((s, m) => s + m.missing, 0);
    const monthsBehind = months.filter((m) => m.missing > 0).length;
    return { months, totalMissing, monthsBehind };
  }, [payments, settings.minMonthlyPayment, settings.interestStartDate, settings.startDate]);

  // --- Persistering ---
  const persistSettings = async (next: MondeoLoanSettings) => {
    setSettings(next);
    if (!userId || !isSupabaseConfigured()) return;
    await supabase.from('mondeo_loan_settings').upsert({
      id: next.id, user_id: userId,
      initial_principal: next.initialPrincipal, start_date: next.startDate,
      margin_pct: next.marginPct, norges_bank_rate_pct: next.norgesBankRatePct,
      norges_bank_rate_observed_at: next.norgesBankRateObservedAt ?? null,
      fixed_annual_rate_pct: next.fixedAnnualRatePct ?? 9,
      use_fixed_rate: next.useFixedRate ?? true,
      interest_start_date: next.interestStartDate ?? null,
      min_monthly_payment: next.minMonthlyPayment ?? 33000,
      buyer_name: next.buyerName ?? null, buyer_company: next.buyerCompany ?? null,
      buyer_org_number: next.buyerOrgNumber ?? null, buyer_email: next.buyerEmail ?? null,
      seller_entity: next.sellerEntity ?? null, seller_org_number: next.sellerOrgNumber ?? null,
      contract_storage_path: next.contractStoragePath ?? null,
      contract_file_name: next.contractFileName ?? null,
      notes: next.notes ?? null,
      updated_at: new Date().toISOString(),
    });
  };

  const addPayment = async () => {
    const amount = Number(paymentAmount || 0);
    if (!paymentDate || amount <= 0) return;
    const balanceBeforePayment = ledger.length ? ledger[ledger.length - 1].closingBalance : Number(settings.initialPrincipal || 0);
    const interestPortion = Math.min(amount, balanceBeforePayment * monthlyRate);
    const newPayment: MondeoLoanPayment = { id: createId(), date: paymentDate, amount, note: paymentNote || undefined };

    const interestTx: Transaction = {
      id: `tx-mondeo-${newPayment.id}`, date: paymentDate, amount: Math.round(interestPortion), currency: 'NOK',
      description: `Renteinntekt Mondeo Eiendom AS${paymentNote ? ` – ${paymentNote}` : ''}`,
      category: 'Renteinntekt', type: TransactionType.INCOME, paymentMethod: paymentMethod as any, isAccrual: false,
    };
    newPayment.postedTransactionId = interestTx.id;

    setPayments((prev) => [...prev, newPayment]);
    setTransactions((prev) => [interestTx, ...prev]);
    setPaymentAmount('');
    setPaymentNote('');

    if (userId && isSupabaseConfigured()) {
      await supabase.from('mondeo_loan_payments').insert({
        id: newPayment.id, user_id: userId, date: newPayment.date,
        amount: newPayment.amount, note: newPayment.note ?? null, method: paymentMethod,
        posted_transaction_id: interestTx.id,
      });
      await supabase.from('transactions').insert({
        id: interestTx.id, user_id: userId, date: interestTx.date, amount: interestTx.amount,
        currency: interestTx.currency, description: interestTx.description, category: interestTx.category,
        type: interestTx.type, payment_method: interestTx.paymentMethod, is_accrual: false,
      });
      supabasePublic.from('business_financial_events').insert({
        brand_id: 'family', source_type: 'manual', source_id: `mondeo:${newPayment.id}`,
        stream: 'manual_adjustment', direction: 'income', status: 'recognized',
        amount: interestTx.amount, currency: 'NOK', event_date: interestTx.date,
        description: interestTx.description, metadata: { source: 'family.mondeo', payment_id: newPayment.id },
      }).then(({ error }) => { if (error) console.warn('[Mondeo] mirror', error); });
    }
  };

  const deletePayment = async (payment: MondeoLoanPayment) => {
    setPayments((prev) => prev.filter((p) => p.id !== payment.id));
    if (payment.postedTransactionId) {
      setTransactions((prev) => prev.filter((t) => t.id !== payment.postedTransactionId));
    }
    if (userId && isSupabaseConfigured()) {
      await supabase.from('mondeo_loan_payments').delete().eq('id', payment.id);
      if (payment.postedTransactionId) {
        await supabase.from('transactions').delete().eq('id', payment.postedTransactionId);
      }
      supabasePublic.from('business_financial_events').delete().eq('source_id', `mondeo:${payment.id}`).then(() => {});
    }
  };

  // --- KPI-justering ---
  const addKpiAdjustment = async () => {
    const pct = Number(kpiPct || 0);
    if (!kpiYear || pct === 0) return;
    const yearStart = `${kpiYear}-01-01`;
    let principalBefore = Number(settings.initialPrincipal || 0);
    for (const row of ledger) {
      if (row.date < yearStart) principalBefore = row.closingBalance;
    }
    const principalAfter = principalBefore * (1 + pct / 100);

    const adj: MondeoKpiAdjustment = {
      id: createId(), year: kpiYear, kpiPct: pct, appliedAt: todayISO(),
      principalBefore, principalAfter, note: kpiNote || undefined,
    };
    setKpiAdjustments((prev) => [...prev.filter((k) => k.year !== kpiYear), adj]);
    setKpiPct(''); setKpiNote('');

    if (userId && isSupabaseConfigured()) {
      await supabase.from('mondeo_kpi_adjustments').upsert({
        id: adj.id, user_id: userId, year: adj.year, kpi_pct: adj.kpiPct, applied_at: adj.appliedAt,
        principal_before: adj.principalBefore, principal_after: adj.principalAfter, note: adj.note ?? null,
      }, { onConflict: 'user_id,year' });
    }
  };

  const deleteKpiAdjustment = async (adj: MondeoKpiAdjustment) => {
    setKpiAdjustments((prev) => prev.filter((k) => k.id !== adj.id));
    if (userId && isSupabaseConfigured()) {
      await supabase.from('mondeo_kpi_adjustments').delete().eq('id', adj.id);
    }
  };

  // --- Kontrakt-opplasting ---
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
      const next = { ...settings, contractStoragePath: path, contractFileName: file.name };
      await persistSettings(next);
      setUploadMsg({ kind: 'success', text: `Lagret «${file.name}». Knyttet til kontrakten.` });
    } catch (err: any) {
      setUploadMsg({ kind: 'error', text: err?.message || 'Opplasting feilet.' });
    } finally {
      setUploading(false);
    }
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

  // --- PDF / utskrift ---
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
        th, td { padding: 6px 8px; border-bottom: 1px solid #e2e8f0; text-align: left; }
        th { background: #f1f5f9; }
        td.num { text-align: right; font-variant-numeric: tabular-nums; }
        .kv { display: grid; grid-template-columns: 200px 1fr; gap: 4px 16px; font-size: 13px; }
        .kv dt { color: #64748b; }
        .kv dd { margin: 0; font-weight: 600; }
        .meta { color: #64748b; font-size: 11px; margin-bottom: 24px; }
      </style></head><body>${html}</body></html>`);
    win.document.close();
    setTimeout(() => win.print(), 300);
  };

  return (
    <div className="space-y-8 animate-in fade-in">
      {/* HEADER */}
      <div className="glass-panel p-6 border-l-4 border-l-amber-500 bg-amber-500/5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Building2 className="w-4 h-4 text-amber-400" />
              <span className="text-[10px] font-black uppercase tracking-widest text-amber-300">
                Mondeo Eiendom AS · Salgskontrakt
              </span>
            </div>
            <h2 className="text-2xl font-black text-white uppercase tracking-tight">
              Selgerkreditt · {formatNOK(settings.initialPrincipal)}
            </h2>
            <p className="text-[11px] text-slate-400 mt-2 max-w-2xl">
              Kjøper {settings.buyerName} ({settings.buyerCompany}) overtar aksjene fra {settings.sellerEntity}.
              Fast rente {formatPercent(annualRate)}. Min {formatNOK(settings.minMonthlyPayment || 0)} / mnd fra {formatDate(settings.interestStartDate || '')}.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={handlePrint} className="px-4 py-2 text-[10px] font-black uppercase tracking-widest text-white bg-indigo-600 hover:bg-indigo-700 rounded flex items-center gap-2">
              <Printer className="w-3.5 h-3.5" /> Skriv ut / PDF
            </button>
            {!settings.useFixedRate && (
              <button onClick={refreshNorgesBank} disabled={loadingRate} className="flex items-center gap-2 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-amber-300 border border-amber-500/40 hover:bg-amber-500/10 transition-all disabled:opacity-50 rounded">
                <RefreshCw className={`w-3.5 h-3.5 ${loadingRate ? 'animate-spin' : ''}`} /> Oppdater rente
              </button>
            )}
          </div>
        </div>
      </div>

      {/* METRICS */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="glass-panel p-5 border-l-4 border-l-cyan-500 bg-cyan-500/5">
          <p className="text-[10px] uppercase text-slate-400 font-black tracking-widest mb-1">Nåværende saldo</p>
          <p className="text-xl font-black text-white font-mono">{formatNOK(currentBalance)}</p>
        </div>
        <div className="glass-panel p-5 border-l-4 border-l-emerald-500 bg-emerald-500/5">
          <p className="text-[10px] uppercase text-slate-400 font-black tracking-widest mb-1">Renteinntekt hittil</p>
          <p className="text-xl font-black text-emerald-400 font-mono">{formatNOK(totalInterest)}</p>
        </div>
        <div className="glass-panel p-5 border-l-4 border-l-fuchsia-500 bg-fuchsia-500/5">
          <p className="text-[10px] uppercase text-slate-400 font-black tracking-widest mb-1">Innbetalt totalt</p>
          <p className="text-xl font-black text-white font-mono">{formatNOK(totalPaid)}</p>
        </div>
        <div className="glass-panel p-5 border-l-4 border-l-amber-500 bg-amber-500/5">
          <p className="text-[10px] uppercase text-slate-400 font-black tracking-widest mb-1">Estimert månedsrente</p>
          <p className="text-xl font-black text-amber-300 font-mono">{formatNOK(estimatedMonthlyInterest)}</p>
        </div>
      </div>

      {/* MIN-BETALING-VARSEL */}
      {minPaymentStatus.totalMissing > 0 && (
        <div className="glass-panel p-5 border-l-4 border-l-rose-500 bg-rose-500/10">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-black text-white uppercase tracking-wide">
                Lånet øker pga manglende minimumsbetaling
              </p>
              <p className="text-xs text-rose-200 mt-1">
                {minPaymentStatus.monthsBehind} måned{minPaymentStatus.monthsBehind === 1 ? '' : 'er'} med under {formatNOK(settings.minMonthlyPayment || 0)}.
                Total mangel: <span className="font-black">{formatNOK(minPaymentStatus.totalMissing)}</span> som legges til hovedstolen iht. avtale.
              </p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-3">
                {minPaymentStatus.months.filter((m) => m.missing > 0).slice(-8).map((m) => (
                  <div key={m.key} className="rounded bg-black/40 border border-rose-500/30 p-2 text-[10px]">
                    <p className="text-rose-300 font-bold">{m.key}</p>
                    <p className="text-white font-mono">Betalt: {formatNOK(m.sum)}</p>
                    <p className="text-rose-300 font-mono">Mangler: {formatNOK(m.missing)}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* KONTRAKTSDETALJER + KJØPER + KONTRAKT-FIL */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Innstillinger / kontrakt */}
        <div className="glass-panel p-6 border-l-4 border-l-amber-500 xl:col-span-1">
          <div className="flex items-center gap-2 mb-5">
            <Calculator className="w-4 h-4 text-amber-400" />
            <h3 className="text-xs font-black uppercase tracking-widest text-white">Kontrakts-vilkår</h3>
          </div>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Hovedstol (NOK)" type="number" value={settings.initialPrincipal}
                onChange={(v) => persistSettings({ ...settings, initialPrincipal: Number(v) })} />
              <Field label="Kontrakts­dato" type="date" value={settings.startDate}
                onChange={(v) => persistSettings({ ...settings, startDate: v })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Renteoppstart" type="date" value={settings.interestStartDate || '2026-06-01'}
                onChange={(v) => persistSettings({ ...settings, interestStartDate: v })} />
              <Field label="Min mnd. (NOK)" type="number" value={settings.minMonthlyPayment ?? 33000}
                onChange={(v) => persistSettings({ ...settings, minMonthlyPayment: Number(v) })} />
            </div>
            <div className="rounded bg-black/40 border border-white/5 p-3 space-y-2">
              <label className="flex items-center gap-2 text-[11px] text-slate-300 font-bold">
                <input type="checkbox" checked={!!settings.useFixedRate}
                  onChange={(e) => persistSettings({ ...settings, useFixedRate: e.target.checked })} />
                Fast avtalt rente (anbefalt – {formatPercent(9)})
              </label>
              {settings.useFixedRate ? (
                <Field label="Fast årlig rente %" type="number" step="0.01" value={settings.fixedAnnualRatePct ?? 9}
                  onChange={(v) => persistSettings({ ...settings, fixedAnnualRatePct: Number(v) })} />
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  <Field label="Norges Bank %" type="number" step="0.01" value={settings.norgesBankRatePct}
                    onChange={(v) => { setRateSource('manual'); persistSettings({ ...settings, norgesBankRatePct: Number(v), norgesBankRateObservedAt: undefined }); }} />
                  <Field label="Margin %" type="number" step="0.01" value={settings.marginPct}
                    onChange={(v) => persistSettings({ ...settings, marginPct: Number(v) })} />
                </div>
              )}
              <div className="flex justify-between text-[11px] pt-2 border-t border-white/10">
                <span className="text-slate-400">Total årlig rente</span>
                <strong className="text-amber-300 font-mono">{formatPercent(annualRate)}</strong>
              </div>
            </div>
          </div>
        </div>

        {/* Partsinfo */}
        <div className="glass-panel p-6 border-l-4 border-l-cyan-500 xl:col-span-1">
          <div className="flex items-center gap-2 mb-5">
            <Users className="w-4 h-4 text-cyan-400" />
            <h3 className="text-xs font-black uppercase tracking-widest text-white">Parter</h3>
          </div>
          <div className="space-y-3">
            <Field label="Selger (entitet)" value={settings.sellerEntity ?? ''}
              onChange={(v) => persistSettings({ ...settings, sellerEntity: v })} placeholder="Extrade Holding AS" />
            <Field label="Selger org.nr" value={settings.sellerOrgNumber ?? ''}
              onChange={(v) => persistSettings({ ...settings, sellerOrgNumber: v })} placeholder="9xx xxx xxx" />
            <div className="border-t border-white/10 my-3" />
            <Field label="Kjøper" value={settings.buyerName ?? ''}
              onChange={(v) => persistSettings({ ...settings, buyerName: v })} placeholder="Odin Jacobsen" />
            <Field label="Kjøper selskap" value={settings.buyerCompany ?? ''}
              onChange={(v) => persistSettings({ ...settings, buyerCompany: v })} placeholder="Nordic Invest AS" />
            <Field label="Kjøper org.nr" value={settings.buyerOrgNumber ?? ''}
              onChange={(v) => persistSettings({ ...settings, buyerOrgNumber: v })} placeholder="9xx xxx xxx" />
            <Field label="Kjøper e-post" value={settings.buyerEmail ?? ''}
              onChange={(v) => persistSettings({ ...settings, buyerEmail: v })} placeholder="odin@…" />
          </div>
        </div>

        {/* Kontrakt-fil */}
        <div className="glass-panel p-6 border-l-4 border-l-fuchsia-500 xl:col-span-1">
          <div className="flex items-center gap-2 mb-5">
            <FileText className="w-4 h-4 text-fuchsia-400" />
            <h3 className="text-xs font-black uppercase tracking-widest text-white">Kontrakt</h3>
          </div>
          {settings.contractStoragePath ? (
            <div className="rounded bg-black/40 border border-fuchsia-500/30 p-4 space-y-3">
              <div className="flex items-center gap-2 text-fuchsia-200">
                <FileText className="w-4 h-4" />
                <span className="text-sm font-bold truncate">{settings.contractFileName || 'Kontrakt'}</span>
              </div>
              <div className="flex gap-2">
                <button onClick={downloadContract} className="flex-1 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-fuchsia-200 border border-fuchsia-500/40 hover:bg-fuchsia-500/10 rounded flex items-center justify-center gap-1.5">
                  <Download className="w-3.5 h-3.5" /> Åpne
                </button>
                <button onClick={() => fileInputRef.current?.click()} className="px-3 py-2 text-[10px] font-black uppercase tracking-widest text-slate-300 border border-white/10 hover:bg-white/5 rounded flex items-center gap-1.5">
                  <Upload className="w-3.5 h-3.5" /> Bytt
                </button>
              </div>
            </div>
          ) : (
            <button onClick={() => fileInputRef.current?.click()} disabled={uploading}
              className="w-full rounded border-2 border-dashed border-fuchsia-500/40 p-6 hover:bg-fuchsia-500/5 transition-all flex flex-col items-center gap-2 text-fuchsia-200">
              <Upload className="w-6 h-6" />
              <p className="text-xs font-bold uppercase">{uploading ? 'Laster opp …' : 'Last opp signert kontrakt'}</p>
              <p className="text-[10px] text-slate-400">PDF, bilde eller dokument</p>
            </button>
          )}
          <input ref={fileInputRef} type="file" accept=".pdf,.doc,.docx,.png,.jpg,.jpeg" className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadContract(f); e.target.value = ''; }} />
          {uploadMsg && (
            <p className={`mt-3 text-[11px] ${uploadMsg.kind === 'success' ? 'text-emerald-300' : 'text-rose-300'}`}>
              {uploadMsg.text}
            </p>
          )}
        </div>
      </div>

      {/* REGISTRER BETALING */}
      <div className="glass-panel p-6 border-l-4 border-l-emerald-500">
        <div className="flex items-center gap-2 mb-5">
          <Coins className="w-4 h-4 text-emerald-400" />
          <h3 className="text-xs font-black uppercase tracking-widest text-white">Registrer betaling fra kjøper</h3>
        </div>
        <p className="text-[11px] text-slate-400 mb-4">
          Renteandelen bokføres automatisk som inntekt for Extrade Holding AS. Hvis betalingen er mindre enn minimum
          ({formatNOK(settings.minMonthlyPayment || 0)} / mnd) varsles det og differansen øker lånet ved månedsslutt.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
          <div>
            <label className="text-[9px] uppercase font-black text-slate-500 tracking-widest block mb-1">Dato</label>
            <input type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)}
              className="w-full bg-black border border-white/10 p-2.5 text-white text-xs font-mono outline-none focus:border-emerald-500" />
          </div>
          <div>
            <label className="text-[9px] uppercase font-black text-slate-500 tracking-widest block mb-1">Beløp (NOK)</label>
            <input type="number" value={paymentAmount} onChange={(e) => setPaymentAmount(e.target.value)}
              placeholder="F.eks. 33000"
              className="w-full bg-black border border-white/10 p-2.5 text-white text-xs font-mono outline-none focus:border-emerald-500" />
          </div>
          <div>
            <label className="text-[9px] uppercase font-black text-slate-500 tracking-widest block mb-1">Metode</label>
            <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}
              className="w-full bg-black border border-white/10 p-2.5 text-white text-xs outline-none focus:border-emerald-500">
              <option>Bank</option>
              <option>Kontant</option>
              <option>On-Chain</option>
            </select>
          </div>
          <div>
            <label className="text-[9px] uppercase font-black text-slate-500 tracking-widest block mb-1">Notat</label>
            <input type="text" value={paymentNote} onChange={(e) => setPaymentNote(e.target.value)}
              placeholder="Valgfritt"
              className="w-full bg-black border border-white/10 p-2.5 text-white text-xs outline-none focus:border-emerald-500" />
          </div>
          <button onClick={addPayment}
            className="flex items-center justify-center gap-2 px-4 py-3 bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-[10px] font-black uppercase tracking-widest hover:bg-emerald-500/30 transition-all rounded">
            <Plus className="w-4 h-4" /> Legg inn
          </button>
        </div>
      </div>

      {/* KPI-JUSTERING */}
      <div className="glass-panel p-6 border-l-4 border-l-indigo-500">
        <div className="flex items-center gap-2 mb-3">
          <Percent className="w-4 h-4 text-indigo-400" />
          <h3 className="text-xs font-black uppercase tracking-widest text-white">Årlig KPI-justering</h3>
        </div>
        <p className="text-[11px] text-slate-400 mb-4">
          Hver 1. januar justeres hovedstolen og dermed boligens verdi opp med KPI fra SSB. Pris­justeringen
          legges inn i ledger som egen linje og påvirker fremtidig rente.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end mb-4">
          <div>
            <label className="text-[9px] uppercase font-black text-slate-500 tracking-widest block mb-1">År</label>
            <input type="number" value={kpiYear} onChange={(e) => setKpiYear(Number(e.target.value))}
              className="w-full bg-black border border-white/10 p-2.5 text-white text-xs font-mono outline-none focus:border-indigo-500" />
          </div>
          <div>
            <label className="text-[9px] uppercase font-black text-slate-500 tracking-widest block mb-1">KPI %</label>
            <input type="number" step="0.01" value={kpiPct} onChange={(e) => setKpiPct(e.target.value)}
              placeholder="F.eks. 3.2"
              className="w-full bg-black border border-white/10 p-2.5 text-white text-xs font-mono outline-none focus:border-indigo-500" />
          </div>
          <div className="md:col-span-2 flex gap-2">
            <input type="text" value={kpiNote} onChange={(e) => setKpiNote(e.target.value)}
              placeholder="Notat (SSB-tabell, ref. dato …)"
              className="flex-1 bg-black border border-white/10 p-2.5 text-white text-xs outline-none focus:border-indigo-500" />
            <button onClick={addKpiAdjustment}
              className="flex items-center gap-2 px-4 py-2.5 bg-indigo-500/20 border border-indigo-500/40 text-indigo-300 text-[10px] font-black uppercase tracking-widest hover:bg-indigo-500/30 rounded">
              <Plus className="w-3.5 h-3.5" /> Bokfør
            </button>
          </div>
        </div>
        {kpiAdjustments.length > 0 && (
          <div className="rounded bg-black/40 border border-white/5">
            <table className="w-full text-xs">
              <thead className="bg-white/5 text-[9px] uppercase font-black tracking-widest text-slate-400">
                <tr>
                  <th className="px-3 py-2 text-left">År</th>
                  <th className="px-3 py-2 text-right">KPI</th>
                  <th className="px-3 py-2 text-right">Før</th>
                  <th className="px-3 py-2 text-right">Etter</th>
                  <th className="px-3 py-2 text-left">Notat</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {kpiAdjustments.sort((a, b) => a.year - b.year).map((adj) => (
                  <tr key={adj.id}>
                    <td className="px-3 py-2 font-mono text-white">{adj.year}</td>
                    <td className="px-3 py-2 text-right font-mono text-indigo-300">{formatPercent(adj.kpiPct)}</td>
                    <td className="px-3 py-2 text-right font-mono text-slate-300">{adj.principalBefore ? formatNOK(adj.principalBefore) : '—'}</td>
                    <td className="px-3 py-2 text-right font-mono text-white">{adj.principalAfter ? formatNOK(adj.principalAfter) : '—'}</td>
                    <td className="px-3 py-2 text-slate-400 italic">{adj.note || ''}</td>
                    <td className="px-3 py-2 text-right">
                      <button onClick={() => deleteKpiAdjustment(adj)} className="text-slate-500 hover:text-rose-400">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* GRAF */}
      <div className="glass-panel p-6 border-l-4 border-l-cyan-500">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="text-sm font-black uppercase tracking-widest text-white">Saldo & akkumulert rente</h3>
            <p className="text-[11px] text-slate-400 italic mt-1">Hvordan lånet utvikler seg etter hver registrerte betaling og KPI-justering</p>
          </div>
          <div className="flex gap-4 text-[10px] uppercase tracking-widest font-black">
            <Legend color="#06B6D4" label="Saldo" />
            <Legend color="#F59E0B" label="Akk. rente" />
            <Legend color="#10B981" label="Akk. betalt" />
          </div>
        </div>
        <div style={{ width: '100%', height: 280 }}>
          <ResponsiveContainer>
            <AreaChart data={chartData} margin={{ top: 10, right: 20, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="mondeoSaldoFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#06B6D4" stopOpacity={0.6} />
                  <stop offset="100%" stopColor="#06B6D4" stopOpacity={0.05} />
                </linearGradient>
                <linearGradient id="mondeoRenteFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#F59E0B" stopOpacity={0.5} />
                  <stop offset="100%" stopColor="#F59E0B" stopOpacity={0.05} />
                </linearGradient>
                <linearGradient id="mondeoBetaltFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10B981" stopOpacity={0.5} />
                  <stop offset="100%" stopColor="#10B981" stopOpacity={0.05} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
              <XAxis dataKey="date" stroke="#94A3B8" fontSize={11}
                tickFormatter={(d) => new Date(d).toLocaleDateString('no-NO', { month: 'short', year: '2-digit' })} />
              <YAxis stroke="#94A3B8" fontSize={11} tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
              <Tooltip contentStyle={{ background: '#0F172A', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 12 }}
                labelStyle={{ color: '#E2E8F0' }} formatter={(value: any) => formatNOK(Number(value))} />
              <Area type="monotone" dataKey="saldo" stroke="#06B6D4" strokeWidth={2.5} fill="url(#mondeoSaldoFill)" name="Saldo" />
              <Area type="monotone" dataKey="rente" stroke="#F59E0B" strokeWidth={2} fill="url(#mondeoRenteFill)" name="Akk. rente" />
              <Area type="monotone" dataKey="betalt" stroke="#10B981" strokeWidth={2} fill="url(#mondeoBetaltFill)" name="Akk. betalt" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* LEDGER */}
      <div className="glass-panel overflow-hidden border-l-4 border-l-cyan-500">
        <div className="p-5 flex flex-col gap-2 md:flex-row md:items-center md:justify-between border-b border-white/5">
          <div>
            <h3 className="text-xs font-black uppercase tracking-widest text-white">Avregningshistorikk</h3>
            <p className="text-[10px] text-slate-500 italic">Hver linje bruker saldoen fra forrige avregning og legger til én måneds rente.</p>
          </div>
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 border border-white/10 px-3 py-1 rounded">
            {ledger.length} hendelser
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm min-w-[900px]">
            <thead className="bg-white/5 uppercase text-[9px] font-black tracking-widest border-b border-white/5 text-slate-400">
              <tr>
                <th className="px-4 py-3">#</th>
                <th className="px-4 py-3">Periode</th>
                <th className="px-4 py-3 text-right">Startsaldo</th>
                <th className="px-4 py-3 text-right">Rente</th>
                <th className="px-4 py-3 text-right">Betalt</th>
                <th className="px-4 py-3 text-right">Avdrag / økning</th>
                <th className="px-4 py-3 text-right">Ny saldo</th>
                <th className="px-4 py-3 text-center">Status</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {ledger.length === 0 ? (
                <tr><td colSpan={9} className="py-10 text-center text-slate-500 italic">Ingen hendelser registrert ennå.</td></tr>
              ) : ledger.map((row) => {
                const original = payments.find((p) => p.id === row.id);
                return (
                  <tr key={row.id} className="hover:bg-cyan-500/5 transition-all">
                    <td className="px-4 py-3 font-mono text-slate-400">{row.nr}</td>
                    <td className="px-4 py-3 whitespace-nowrap font-mono text-[11px] text-slate-300">{row.fromDate} → {row.date}</td>
                    <td className="px-4 py-3 text-right font-mono text-white">{formatNOK(row.openingBalance)}</td>
                    <td className="px-4 py-3 text-right font-mono text-amber-300">{formatNOK(row.interestDue)}</td>
                    <td className="px-4 py-3 text-right font-mono text-white">{formatNOK(row.paid)}</td>
                    <td className={`px-4 py-3 text-right font-mono ${row.principalChange >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {row.principalChange >= 0 ? '− ' : '+ '}{formatNOK(Math.abs(row.principalChange))}
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-black text-white">{formatNOK(row.closingBalance)}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`px-2 py-0.5 text-[8px] font-black uppercase border ${
                        row.status === 'KPI-justering' ? 'border-indigo-500 text-indigo-300' :
                        row.principalChange >= 0 ? 'border-emerald-500 text-emerald-400' :
                        'border-rose-500 text-rose-400'
                      }`}>{row.status}</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {original && (
                        <button onClick={() => deletePayment(original)} className="text-slate-500 hover:text-rose-400" title="Slett">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* SKJULT UTSKRIFTSOMRÅDE (rendres til PDF/print) */}
      <div ref={printAreaRef} style={{ display: 'none' }}>
        <h1>Mondeo Eiendom AS · Salgskontrakt — Regnskap</h1>
        <p className="meta">Utskrift: {new Date().toLocaleString('nb-NO')}</p>

        <h2>Parter</h2>
        <dl className="kv">
          <dt>Selger</dt><dd>{settings.sellerEntity} {settings.sellerOrgNumber && `(${settings.sellerOrgNumber})`}</dd>
          <dt>Kjøper</dt><dd>{settings.buyerName} — {settings.buyerCompany} {settings.buyerOrgNumber && `(${settings.buyerOrgNumber})`}</dd>
          <dt>Kontaktet</dt><dd>{settings.buyerEmail || '—'}</dd>
        </dl>

        <h2>Kontraktsvilkår</h2>
        <dl className="kv">
          <dt>Hovedstol</dt><dd>{formatNOK(settings.initialPrincipal)}</dd>
          <dt>Kontraktsdato</dt><dd>{formatDate(settings.startDate)}</dd>
          <dt>Renteoppstart</dt><dd>{formatDate(settings.interestStartDate || '')}</dd>
          <dt>Årlig rente</dt><dd>{formatPercent(annualRate)} {settings.useFixedRate ? '(fast)' : '(Norges Bank + margin)'}</dd>
          <dt>Min mnd. betaling</dt><dd>{formatNOK(settings.minMonthlyPayment || 0)}</dd>
        </dl>

        <h2>Status</h2>
        <dl className="kv">
          <dt>Nåværende saldo</dt><dd>{formatNOK(currentBalance)}</dd>
          <dt>Renteinntekt hittil</dt><dd>{formatNOK(totalInterest)}</dd>
          <dt>Innbetalt totalt</dt><dd>{formatNOK(totalPaid)}</dd>
          <dt>Netto endring hovedstol</dt><dd>{formatNOK(Math.abs(totalPrincipalChange))} {totalPrincipalChange >= 0 ? '(redusert)' : '(økt)'}</dd>
          {minPaymentStatus.totalMissing > 0 && (<>
            <dt>Manglende min.bet.</dt><dd>{formatNOK(minPaymentStatus.totalMissing)} fordelt på {minPaymentStatus.monthsBehind} mnd</dd>
          </>)}
        </dl>

        {kpiAdjustments.length > 0 && (<>
          <h2>KPI-justeringer</h2>
          <table>
            <thead><tr><th>År</th><th>KPI %</th><th className="num">Før</th><th className="num">Etter</th><th>Notat</th></tr></thead>
            <tbody>
              {kpiAdjustments.map((k) => (
                <tr key={k.id}>
                  <td>{k.year}</td>
                  <td>{formatPercent(k.kpiPct)}</td>
                  <td className="num">{k.principalBefore ? formatNOK(k.principalBefore) : '—'}</td>
                  <td className="num">{k.principalAfter ? formatNOK(k.principalAfter) : '—'}</td>
                  <td>{k.note || ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>)}

        <h2>Avregningshistorikk</h2>
        <table>
          <thead><tr>
            <th>#</th><th>Periode</th><th className="num">Startsaldo</th><th className="num">Rente</th>
            <th className="num">Betalt</th><th className="num">Avdrag/økning</th><th className="num">Ny saldo</th><th>Status</th>
          </tr></thead>
          <tbody>
            {ledger.map((row) => (
              <tr key={row.id}>
                <td>{row.nr}</td>
                <td>{row.fromDate} → {row.date}</td>
                <td className="num">{formatNOK(row.openingBalance)}</td>
                <td className="num">{formatNOK(row.interestDue)}</td>
                <td className="num">{formatNOK(row.paid)}</td>
                <td className="num">{row.principalChange >= 0 ? '−' : '+'}{formatNOK(Math.abs(row.principalChange))}</td>
                <td className="num">{formatNOK(row.closingBalance)}</td>
                <td>{row.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// --- Små helper-komponenter for å holde JSX kort ---
function Field({ label, value, onChange, type = 'text', step, placeholder }: { label: string; value: any; onChange: (v: string) => void; type?: string; step?: string; placeholder?: string }) {
  return (
    <div>
      <label className="text-[9px] uppercase font-black text-slate-500 tracking-widest block mb-1">{label}</label>
      <input type={type} value={value ?? ''} step={step} placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-black border border-white/10 p-2.5 text-white text-xs font-mono outline-none focus:border-amber-500" />
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-3 h-3 rounded-sm" style={{ background: color }} />
      <span className="text-slate-300">{label}</span>
    </div>
  );
}
