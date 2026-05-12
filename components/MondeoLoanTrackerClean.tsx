import React, { useEffect, useMemo, useState } from 'react';
import { Building2, Calculator, Plus, RefreshCw, Trash2 } from 'lucide-react';
import { MondeoLoanPayment, MondeoLoanSettings, Transaction, TransactionType } from '../types';
import { fetchNorgesBankPolicyRate } from '../services/norgesBankService';
import { isSupabaseConfigured, supabase, supabasePublic } from '../supabase';

interface Props {
  userId?: string;
  transactions?: Transaction[];
  setTransactions?: React.Dispatch<React.SetStateAction<Transaction[]>>;
}

const todayISO = () => new Date().toISOString().slice(0, 10);
const createId = () => `${Date.now()}-${Math.random().toString(36).slice(2)}`;

const formatNOK = (value: number) =>
  new Intl.NumberFormat('nb-NO', { style: 'currency', currency: 'NOK', maximumFractionDigits: 0 }).format(Number(value || 0));

const formatPercent = (value: number) =>
  `${Number(value || 0).toLocaleString('nb-NO', { maximumFractionDigits: 2 })} %`;

const defaultSettings: MondeoLoanSettings = {
  id: 'mondeo-default',
  initialPrincipal: 4800000,
  startDate: todayISO(),
  marginPct: 6,
  norgesBankRatePct: 4.5,
};

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-2xl border border-slate-200 bg-white shadow-sm ${className}`}>{children}</div>;
}

function MetricCard({ title, value, symbol }: { title: string; value: string; symbol: string }) {
  return (
    <Card>
      <div className="flex items-center justify-between p-5">
        <div>
          <p className="text-sm text-slate-500">{title}</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{value}</p>
        </div>
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-xl font-bold text-slate-600">{symbol}</div>
      </div>
    </Card>
  );
}

export const MondeoLoanTrackerClean: React.FC<Props> = ({ userId, setTransactions }) => {
  const [settings, setSettings] = useState<MondeoLoanSettings>(defaultSettings);
  const [payments, setPayments] = useState<MondeoLoanPayment[]>([]);
  const [paymentDate, setPaymentDate] = useState(todayISO());
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentNote, setPaymentNote] = useState('');
  const [loadingRate, setLoadingRate] = useState(false);

  const annualRate = useMemo(() => Number(settings.norgesBankRatePct || 0) + Number(settings.marginPct || 0), [settings.norgesBankRatePct, settings.marginPct]);
  const monthlyRate = annualRate / 100 / 12;

  useEffect(() => {
    if (!userId || !isSupabaseConfigured()) return;
    (async () => {
      const { data: settingsRow } = await supabase.from('mondeo_loan_settings').select('*').eq('user_id', userId).maybeSingle();
      if (settingsRow) {
        setSettings({
          id: settingsRow.id,
          initialPrincipal: Number(settingsRow.initial_principal),
          startDate: settingsRow.start_date,
          marginPct: Number(settingsRow.margin_pct),
          norgesBankRatePct: Number(settingsRow.norges_bank_rate_pct),
          norgesBankRateObservedAt: settingsRow.norges_bank_rate_observed_at ?? undefined,
          buyerName: settingsRow.buyer_name ?? undefined,
          notes: settingsRow.notes ?? undefined,
        });
      }
      const { data: paymentRows } = await supabase.from('mondeo_loan_payments').select('*').eq('user_id', userId).order('date', { ascending: true });
      if (paymentRows) {
        setPayments(paymentRows.map((r: any) => ({ id: r.id, date: r.date, amount: Number(r.amount), note: r.note ?? undefined, postedTransactionId: r.posted_transaction_id ?? undefined })));
      }
    })();
  }, [userId]);

  const refreshNorgesBank = async () => {
    setLoadingRate(true);
    try {
      const rate = await fetchNorgesBankPolicyRate();
      await persistSettings({ ...settings, norgesBankRatePct: rate.value, norgesBankRateObservedAt: rate.observedAt });
    } finally {
      setLoadingRate(false);
    }
  };

  const persistSettings = async (next: MondeoLoanSettings) => {
    setSettings(next);
    if (!userId || !isSupabaseConfigured()) return;
    await supabase.from('mondeo_loan_settings').upsert({
      id: next.id,
      user_id: userId,
      initial_principal: next.initialPrincipal,
      start_date: next.startDate,
      margin_pct: next.marginPct,
      norges_bank_rate_pct: next.norgesBankRatePct,
      norges_bank_rate_observed_at: next.norgesBankRateObservedAt ?? null,
      buyer_name: next.buyerName ?? null,
      notes: next.notes ?? null,
      updated_at: new Date().toISOString(),
    });
  };

  const ledger = useMemo(() => {
    let balance = Number(settings.initialPrincipal || 0);
    let lastDate = settings.startDate;
    return payments.slice().sort((a, b) => (a.date < b.date ? -1 : 1)).map((payment, index) => {
      const interestDue = balance * monthlyRate;
      const paid = Number(payment.amount || 0);
      const principalChange = paid - interestDue;
      const closingBalance = balance - principalChange;
      const row = { id: payment.id, nr: index + 1, fromDate: lastDate, date: payment.date, openingBalance: balance, interestDue, paid, principalChange, closingBalance, status: principalChange >= 0 ? 'Avdrag' : 'Lånet øker' };
      balance = closingBalance;
      lastDate = payment.date;
      return row;
    });
  }, [payments, settings.initialPrincipal, settings.startDate, monthlyRate]);

  const currentBalance = ledger.length ? ledger[ledger.length - 1].closingBalance : Number(settings.initialPrincipal || 0);
  const totalPaid = ledger.reduce((s, r) => s + r.paid, 0);
  const totalInterest = ledger.reduce((s, r) => s + r.interestDue, 0);
  const totalPrincipalChange = ledger.reduce((s, r) => s + r.principalChange, 0);
  const estimatedMonthlyInterest = currentBalance * monthlyRate;

  const addPayment = async () => {
    const amount = Number(paymentAmount || 0);
    if (!paymentDate || amount <= 0) return;
    const balanceBeforePayment = ledger.length ? ledger[ledger.length - 1].closingBalance : Number(settings.initialPrincipal || 0);
    const interestPortion = Math.min(amount, balanceBeforePayment * monthlyRate);
    const newPayment: MondeoLoanPayment = { id: createId(), date: paymentDate, amount, note: paymentNote || undefined };
    const interestTx: Transaction = {
      id: `tx-mondeo-${newPayment.id}`,
      date: paymentDate,
      amount: Math.round(interestPortion),
      currency: 'NOK',
      description: `Renteinntekt Mondeo Eiendom AS${paymentNote ? ` – ${paymentNote}` : ''}`,
      category: 'Renteinntekt',
      type: TransactionType.INCOME,
      paymentMethod: 'Bank',
      isAccrual: false,
    };
    newPayment.postedTransactionId = interestTx.id;
    setPayments(prev => [...prev, newPayment]);
    setTransactions?.(prev => [interestTx, ...prev]);
    setPaymentAmount('');
    setPaymentNote('');
    if (userId && isSupabaseConfigured()) {
      await supabase.from('mondeo_loan_payments').insert({ id: newPayment.id, user_id: userId, date: newPayment.date, amount: newPayment.amount, note: newPayment.note ?? null, posted_transaction_id: interestTx.id });
      await supabase.from('transactions').insert({ id: interestTx.id, user_id: userId, date: interestTx.date, amount: interestTx.amount, currency: interestTx.currency, description: interestTx.description, category: interestTx.category, type: interestTx.type, payment_method: interestTx.paymentMethod, is_accrual: false });
      await supabasePublic.from('business_financial_events').insert({ brand_id: 'family', source_type: 'manual', source_id: `mondeo:${newPayment.id}`, stream: 'manual_adjustment', direction: 'income', status: 'recognized', amount: interestTx.amount, currency: 'NOK', event_date: interestTx.date, description: interestTx.description, metadata: { source: 'family.mondeo', payment_id: newPayment.id } });
    }
  };

  const deletePayment = async (payment: MondeoLoanPayment) => {
    setPayments(prev => prev.filter(p => p.id !== payment.id));
    if (payment.postedTransactionId) setTransactions?.(prev => prev.filter(t => t.id !== payment.postedTransactionId));
    if (userId && isSupabaseConfigured()) {
      await supabase.from('mondeo_loan_payments').delete().eq('id', payment.id);
      if (payment.postedTransactionId) await supabase.from('transactions').delete().eq('id', payment.postedTransactionId);
    }
  };

  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-slate-900 text-white"><Building2 className="h-5 w-5" /></div>
            <span className="inline-flex rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">Mondeo Eiendom AS</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight md:text-5xl">Rente- og avregningsdashboard</h1>
          <p className="mt-3 max-w-3xl text-base text-slate-600 md:text-lg">Lånet til kjøper beregnes med én måneds rente per betaling. Saldoen øker hvis betaling er lavere enn renten, og reduseres hvis betaling er høyere.</p>
        </div>
        <button onClick={refreshNorgesBank} disabled={loadingRate} className="btn-secondary w-full md:w-auto"><RefreshCw className={`h-4 w-4 ${loadingRate ? 'animate-spin' : ''}`} /> Oppdater Norges Bank-rente</button>
      </section>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard title="Nåværende saldo" value={formatNOK(currentBalance)} symbol="kr" />
        <MetricCard title="Total rente hittil" value={formatNOK(totalInterest)} symbol="%" />
        <MetricCard title="Betalt totalt" value={formatNOK(totalPaid)} symbol="→" />
        <MetricCard title="Estimert månedsrente" value={formatNOK(estimatedMonthlyInterest)} symbol="30" />
      </section>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-1"><div className="space-y-5 p-5"><div><h2 className="text-xl font-bold">Innstillinger</h2><p className="mt-1 text-sm text-slate-500">Endre lånebeløp, rente og påslag.</p></div><label className="block space-y-2"><span className="text-sm font-medium text-slate-700">Startdato</span><input type="date" value={settings.startDate} onChange={e => persistSettings({ ...settings, startDate: e.target.value })} /></label><label className="block space-y-2"><span className="text-sm font-medium text-slate-700">Lånebeløp</span><input type="number" value={settings.initialPrincipal} onChange={e => persistSettings({ ...settings, initialPrincipal: Number(e.target.value) })} /></label><div className="grid grid-cols-2 gap-3"><label className="block space-y-2"><span className="text-sm font-medium text-slate-700">Norges Bank %</span><input type="number" step="0.01" value={settings.norgesBankRatePct} onChange={e => persistSettings({ ...settings, norgesBankRatePct: Number(e.target.value), norgesBankRateObservedAt: undefined })} /></label><label className="block space-y-2"><span className="text-sm font-medium text-slate-700">Påslag %</span><input type="number" step="0.01" value={settings.marginPct} onChange={e => persistSettings({ ...settings, marginPct: Number(e.target.value) })} /></label></div><div className="space-y-2 rounded-2xl bg-slate-100 p-4"><div className="flex justify-between text-sm"><span>Norges Bank</span><strong>{formatPercent(settings.norgesBankRatePct)}</strong></div><div className="flex justify-between text-sm"><span>Påslag</span><strong>{formatPercent(settings.marginPct)}</strong></div><div className="flex justify-between border-t border-slate-300 pt-2"><span className="font-semibold">Total årlig rente</span><strong>{formatPercent(annualRate)}</strong></div></div></div></Card>
        <Card className="xl:col-span-2"><div className="space-y-5 p-5"><div><h2 className="text-xl font-bold">Registrer betaling</h2><p className="mt-1 text-sm text-slate-500">Betaling sammenlignes med én måneds rente på saldoen før betaling.</p></div><div className="grid grid-cols-1 items-end gap-3 md:grid-cols-4"><label className="block space-y-2"><span className="text-sm font-medium text-slate-700">Dato</span><input type="date" value={paymentDate} onChange={e => setPaymentDate(e.target.value)} /></label><label className="block space-y-2"><span className="text-sm font-medium text-slate-700">Beløp</span><input type="number" placeholder="F.eks. 45000" value={paymentAmount} onChange={e => setPaymentAmount(e.target.value)} /></label><label className="block space-y-2"><span className="text-sm font-medium text-slate-700">Notat</span><input value={paymentNote} onChange={e => setPaymentNote(e.target.value)} placeholder="Valgfritt" /></label><button onClick={addPayment} className="btn-primary"><Plus className="h-4 w-4" /> Legg inn</button></div><div className="grid grid-cols-1 gap-4 md:grid-cols-2"><div className="rounded-2xl border border-slate-200 bg-white p-4"><p className="text-sm text-slate-500">Netto endring i lån</p><p className="mt-1 text-lg font-bold text-slate-900">{formatNOK(Math.abs(totalPrincipalChange))} {totalPrincipalChange >= 0 ? 'redusert' : 'økt'}</p></div><div className="rounded-2xl border border-slate-200 bg-white p-4"><p className="text-sm text-slate-500">Formel</p><p className="mt-1 font-medium text-slate-900">Ny saldo = gammel saldo + månedsrente − betaling</p></div></div></div></Card>
      </section>

      <Card><div className="p-5"><div className="mb-4 flex flex-col gap-2 md:flex-row md:items-center md:justify-between"><div><h2 className="text-xl font-bold">Avregningshistorikk</h2><p className="text-sm text-slate-500">Hver linje bruker saldoen fra forrige avregning og legger til én måneds rente.</p></div><span className="rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">{ledger.length} betalinger</span></div><div className="overflow-x-auto"><table className="w-full min-w-[900px] text-sm"><thead><tr className="border-b text-left text-slate-500"><th className="py-3 pr-4">#</th><th className="py-3 pr-4">Periode</th><th className="py-3 pr-4 text-right">Startsaldo</th><th className="py-3 pr-4 text-right">Rente</th><th className="py-3 pr-4 text-right">Betalt</th><th className="py-3 pr-4 text-right">Avdrag / økning</th><th className="py-3 pr-4 text-right">Ny saldo</th><th className="py-3 pr-4">Status</th><th className="py-3">Handling</th></tr></thead><tbody>{ledger.length === 0 ? <tr><td colSpan={9} className="py-8 text-center text-slate-500">Ingen betalinger registrert ennå.</td></tr> : ledger.map(row => { const payment = payments.find(p => p.id === row.id); return <tr key={row.id} className="border-b last:border-b-0"><td className="py-3 pr-4">{row.nr}</td><td className="whitespace-nowrap py-3 pr-4">{row.fromDate} → {row.date}</td><td className="whitespace-nowrap py-3 pr-4 text-right">{formatNOK(row.openingBalance)}</td><td className="whitespace-nowrap py-3 pr-4 text-right">{formatNOK(row.interestDue)}</td><td className="whitespace-nowrap py-3 pr-4 text-right">{formatNOK(row.paid)}</td><td className="whitespace-nowrap py-3 pr-4 text-right">{row.principalChange >= 0 ? '− ' : '+ '}{formatNOK(Math.abs(row.principalChange))}</td><td className="whitespace-nowrap py-3 pr-4 text-right font-semibold">{formatNOK(row.closingBalance)}</td><td className="py-3 pr-4"><span className={`rounded-full border px-3 py-1 text-xs font-semibold ${row.principalChange >= 0 ? 'border-emerald-200 bg-emerald-100 text-emerald-800' : 'border-red-200 bg-red-100 text-red-800'}`}>{row.status}</span></td><td className="py-3"><button className="rounded-xl px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100" onClick={() => payment && deletePayment(payment)}><Trash2 className="h-4 w-4" /></button></td></tr>; })}</tbody></table></div></div></Card>
    </div>
  );
};
