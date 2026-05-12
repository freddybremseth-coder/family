import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Building2,
  Calculator,
  Coins,
  Percent,
  Plus,
  RefreshCw,
  Trash2,
  TrendingUp,
} from 'lucide-react';
import {
  MondeoLedgerRow,
  MondeoLoanPayment,
  MondeoLoanSettings,
  Transaction,
  TransactionType,
} from '../types';
import { fetchNorgesBankPolicyRate } from '../services/norgesBankService';
import { isSupabaseConfigured, supabase } from '../supabase';

interface Props {
  userId?: string;
  transactions: Transaction[];
  setTransactions: React.Dispatch<React.SetStateAction<Transaction[]>>;
}

const todayISO = () => new Date().toISOString().slice(0, 10);
const createId = () => `${Date.now()}-${Math.random().toString(36).slice(2)}`;

const formatNOK = (value: number) =>
  new Intl.NumberFormat('nb-NO', {
    style: 'currency',
    currency: 'NOK',
    maximumFractionDigits: 0,
  }).format(Number(value || 0));

const formatPercent = (value: number) =>
  `${Number(value || 0).toLocaleString('nb-NO', { maximumFractionDigits: 2 })} %`;

const defaultSettings: MondeoLoanSettings = {
  id: 'mondeo-default',
  initialPrincipal: 4800000,
  startDate: todayISO(),
  marginPct: 6,
  norgesBankRatePct: 4.5,
};

export const MondeoLoanTracker: React.FC<Props> = ({ userId, transactions, setTransactions }) => {
  const [settings, setSettings] = useState<MondeoLoanSettings>(defaultSettings);
  const [payments, setPayments] = useState<MondeoLoanPayment[]>([]);
  const [paymentDate, setPaymentDate] = useState<string>(todayISO());
  const [paymentAmount, setPaymentAmount] = useState<string>('');
  const [paymentNote, setPaymentNote] = useState<string>('');
  const [loadingRate, setLoadingRate] = useState(false);
  const [rateSource, setRateSource] = useState<'norges-bank' | 'cache' | 'fallback' | 'manual'>(
    'manual',
  );

  const annualRate = useMemo(
    () => Number(settings.norgesBankRatePct || 0) + Number(settings.marginPct || 0),
    [settings.norgesBankRatePct, settings.marginPct],
  );
  const monthlyRate = annualRate / 100 / 12;

  const refreshNorgesBank = useCallback(async () => {
    setLoadingRate(true);
    try {
      const rate = await fetchNorgesBankPolicyRate();
      setSettings((prev) => ({
        ...prev,
        norgesBankRatePct: rate.value,
        norgesBankRateObservedAt: rate.observedAt,
      }));
      setRateSource(rate.source);
    } finally {
      setLoadingRate(false);
    }
  }, []);

  // Last lagrede data fra Supabase
  useEffect(() => {
    if (!userId || !isSupabaseConfigured()) return;

    (async () => {
      const { data: settingsRow } = await supabase
        .from('mondeo_loan_settings')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

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

      const { data: paymentRows } = await supabase
        .from('mondeo_loan_payments')
        .select('*')
        .eq('user_id', userId)
        .order('date', { ascending: true });

      if (paymentRows) {
        setPayments(
          paymentRows.map((r) => ({
            id: r.id,
            date: r.date,
            amount: Number(r.amount),
            note: r.note ?? undefined,
            postedTransactionId: r.posted_transaction_id ?? undefined,
          })),
        );
      }
    })();
  }, [userId]);

  // Hent live styringsrente ved oppstart hvis vi ikke har lagret en
  useEffect(() => {
    if (settings.norgesBankRateObservedAt) return;
    refreshNorgesBank();
  }, [settings.norgesBankRateObservedAt, refreshNorgesBank]);

  const ledger: MondeoLedgerRow[] = useMemo(() => {
    let balance = Number(settings.initialPrincipal || 0);
    let lastDate = settings.startDate;

    return payments
      .slice()
      .sort((a, b) => (a.date < b.date ? -1 : 1))
      .map((payment, idx) => {
        const interestDue = balance * monthlyRate;
        const paid = Number(payment.amount || 0);
        const principalChange = paid - interestDue;
        const newBalance = balance - principalChange;

        const row: MondeoLedgerRow = {
          id: payment.id,
          nr: idx + 1,
          fromDate: lastDate,
          date: payment.date,
          openingBalance: balance,
          interestDue,
          paid,
          principalChange,
          closingBalance: newBalance,
          status: principalChange >= 0 ? 'Avdrag' : 'Lånet øker',
        };

        balance = newBalance;
        lastDate = payment.date;
        return row;
      });
  }, [payments, settings.initialPrincipal, settings.startDate, monthlyRate]);

  const currentBalance = ledger.length
    ? ledger[ledger.length - 1].closingBalance
    : Number(settings.initialPrincipal || 0);
  const totalPaid = ledger.reduce((s, r) => s + r.paid, 0);
  const totalInterest = ledger.reduce((s, r) => s + r.interestDue, 0);
  const totalPrincipalChange = ledger.reduce((s, r) => s + r.principalChange, 0);
  const estimatedMonthlyInterest = currentBalance * monthlyRate;

  const persistSettings = async (next: MondeoLoanSettings) => {
    setSettings(next);
    if (!userId || !isSupabaseConfigured()) return;
    await supabase
      .from('mondeo_loan_settings')
      .upsert({
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

  const addPayment = async () => {
    const amount = Number(paymentAmount || 0);
    if (!paymentDate || amount <= 0) return;

    // Beregn renteandel på saldoen før betaling, så vi vet hva som
    // er renteinntekt (auto-postes som INCOME).
    const balanceBeforePayment = ledger.length
      ? ledger[ledger.length - 1].closingBalance
      : Number(settings.initialPrincipal || 0);
    const interestPortion = Math.min(amount, balanceBeforePayment * monthlyRate);

    const newPayment: MondeoLoanPayment = {
      id: createId(),
      date: paymentDate,
      amount,
      note: paymentNote || undefined,
    };

    // Bokfør renteinntekt automatisk i hovedboka
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

    setPayments((prev) => [...prev, newPayment]);
    setTransactions((prev) => [interestTx, ...prev]);
    setPaymentAmount('');
    setPaymentNote('');

    if (userId && isSupabaseConfigured()) {
      await supabase.from('mondeo_loan_payments').insert({
        id: newPayment.id,
        user_id: userId,
        date: newPayment.date,
        amount: newPayment.amount,
        note: newPayment.note ?? null,
        posted_transaction_id: interestTx.id,
      });
      await supabase.from('transactions').insert({
        id: interestTx.id,
        user_id: userId,
        date: interestTx.date,
        amount: interestTx.amount,
        currency: interestTx.currency,
        description: interestTx.description,
        category: interestTx.category,
        type: interestTx.type,
        payment_method: interestTx.paymentMethod,
        is_accrual: false,
      });
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
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in">
      {/* HEADER */}
      <div className="glass-panel p-6 border-l-4 border-l-amber-500 bg-amber-500/5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Building2 className="w-4 h-4 text-amber-400" />
              <span className="text-[10px] font-black uppercase tracking-widest text-amber-300">
                Mondeo Eiendom AS – Salgsfinansiering
              </span>
            </div>
            <h2 className="text-2xl font-black text-white uppercase tracking-tight">
              Lån til kjøper · {formatNOK(settings.initialPrincipal)}
            </h2>
            <p className="text-[11px] text-slate-400 mt-2 max-w-2xl">
              Kjøper bestemmer selv avdrag. Lånesaldo kan øke eller minke per måned.
              Rente = Norges Bank styringsrente + {formatPercent(settings.marginPct)} margin.
              Renteandel av hver betaling postes automatisk som inntekt i hovedboka.
            </p>
          </div>
          <button
            onClick={refreshNorgesBank}
            disabled={loadingRate}
            className="shrink-0 flex items-center gap-2 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-amber-300 border border-amber-500/40 hover:bg-amber-500/10 transition-all disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loadingRate ? 'animate-spin' : ''}`} />
            Oppdater rente
          </button>
        </div>
      </div>

      {/* METRICS */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="glass-panel p-5 border-l-4 border-l-cyan-500 bg-cyan-500/5">
          <p className="text-[10px] uppercase text-slate-400 font-black tracking-widest mb-1">
            Nåværende saldo
          </p>
          <p className="text-xl font-black text-white font-mono">{formatNOK(currentBalance)}</p>
        </div>
        <div className="glass-panel p-5 border-l-4 border-l-emerald-500 bg-emerald-500/5">
          <p className="text-[10px] uppercase text-slate-400 font-black tracking-widest mb-1">
            Renteinntekt hittil
          </p>
          <p className="text-xl font-black text-emerald-400 font-mono">{formatNOK(totalInterest)}</p>
        </div>
        <div className="glass-panel p-5 border-l-4 border-l-fuchsia-500 bg-fuchsia-500/5">
          <p className="text-[10px] uppercase text-slate-400 font-black tracking-widest mb-1">
            Innbetalt totalt
          </p>
          <p className="text-xl font-black text-white font-mono">{formatNOK(totalPaid)}</p>
        </div>
        <div className="glass-panel p-5 border-l-4 border-l-amber-500 bg-amber-500/5">
          <p className="text-[10px] uppercase text-slate-400 font-black tracking-widest mb-1">
            Estimert månedsrente
          </p>
          <p className="text-xl font-black text-amber-300 font-mono">
            {formatNOK(estimatedMonthlyInterest)}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* INNSTILLINGER */}
        <div className="glass-panel p-6 border-l-4 border-l-amber-500 xl:col-span-1">
          <div className="flex items-center gap-2 mb-5">
            <Calculator className="w-4 h-4 text-amber-400" />
            <h3 className="text-xs font-black uppercase tracking-widest text-white">
              Innstillinger
            </h3>
          </div>

          <div className="space-y-4">
            <div>
              <label className="text-[9px] uppercase font-black text-slate-500 tracking-widest block mb-1">
                Startdato for lånet
              </label>
              <input
                type="date"
                value={settings.startDate}
                onChange={(e) =>
                  persistSettings({ ...settings, startDate: e.target.value })
                }
                className="w-full bg-black border border-white/10 p-2.5 text-white text-xs font-mono outline-none focus:border-amber-500"
              />
            </div>

            <div>
              <label className="text-[9px] uppercase font-black text-slate-500 tracking-widest block mb-1">
                Lånebeløp (NOK)
              </label>
              <input
                type="number"
                value={settings.initialPrincipal}
                onChange={(e) =>
                  persistSettings({
                    ...settings,
                    initialPrincipal: Number(e.target.value),
                  })
                }
                className="w-full bg-black border border-white/10 p-2.5 text-white text-xs font-mono outline-none focus:border-amber-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[9px] uppercase font-black text-slate-500 tracking-widest block mb-1">
                  Norges Bank %
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={settings.norgesBankRatePct}
                  onChange={(e) => {
                    setRateSource('manual');
                    persistSettings({
                      ...settings,
                      norgesBankRatePct: Number(e.target.value),
                      norgesBankRateObservedAt: undefined,
                    });
                  }}
                  className="w-full bg-black border border-white/10 p-2.5 text-white text-xs font-mono outline-none focus:border-amber-500"
                />
              </div>
              <div>
                <label className="text-[9px] uppercase font-black text-slate-500 tracking-widest block mb-1">
                  Margin %
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={settings.marginPct}
                  onChange={(e) =>
                    persistSettings({ ...settings, marginPct: Number(e.target.value) })
                  }
                  className="w-full bg-black border border-white/10 p-2.5 text-white text-xs font-mono outline-none focus:border-amber-500"
                />
              </div>
            </div>

            <div>
              <label className="text-[9px] uppercase font-black text-slate-500 tracking-widest block mb-1">
                Kjøper (valgfritt)
              </label>
              <input
                type="text"
                value={settings.buyerName ?? ''}
                onChange={(e) =>
                  persistSettings({ ...settings, buyerName: e.target.value })
                }
                placeholder="Navn på kjøper"
                className="w-full bg-black border border-white/10 p-2.5 text-white text-xs outline-none focus:border-amber-500"
              />
            </div>

            <div className="rounded-md bg-black/40 border border-white/5 p-4 space-y-2">
              <div className="flex justify-between text-[11px] text-slate-400">
                <span className="flex items-center gap-1">
                  <Percent className="w-3 h-3" /> Norges Bank
                </span>
                <strong className="text-white font-mono">
                  {formatPercent(settings.norgesBankRatePct)}
                </strong>
              </div>
              <div className="flex justify-between text-[11px] text-slate-400">
                <span>Margin</span>
                <strong className="text-white font-mono">
                  {formatPercent(settings.marginPct)}
                </strong>
              </div>
              <div className="flex justify-between border-t border-white/10 pt-2">
                <span className="text-[10px] uppercase font-black tracking-widest text-amber-300">
                  Total årlig rente
                </span>
                <strong className="text-amber-300 font-mono font-black">
                  {formatPercent(annualRate)}
                </strong>
              </div>
              {settings.norgesBankRateObservedAt && (
                <p className="text-[9px] text-slate-500 italic pt-1">
                  Kilde: {rateSource === 'norges-bank' ? 'Norges Bank live' : rateSource} ·{' '}
                  observert {settings.norgesBankRateObservedAt}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* REGISTRER BETALING */}
        <div className="glass-panel p-6 border-l-4 border-l-emerald-500 xl:col-span-2">
          <div className="flex items-center gap-2 mb-5">
            <Coins className="w-4 h-4 text-emerald-400" />
            <h3 className="text-xs font-black uppercase tracking-widest text-white">
              Registrer betaling
            </h3>
          </div>
          <p className="text-[11px] text-slate-400 mb-4">
            Hver betaling sammenlignes med én måneds rente på saldoen før betaling.
            Renteandelen bokføres automatisk som inntekt under «Renteinntekt».
          </p>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
            <div>
              <label className="text-[9px] uppercase font-black text-slate-500 tracking-widest block mb-1">
                Dato
              </label>
              <input
                type="date"
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
                className="w-full bg-black border border-white/10 p-2.5 text-white text-xs font-mono outline-none focus:border-emerald-500"
              />
            </div>
            <div>
              <label className="text-[9px] uppercase font-black text-slate-500 tracking-widest block mb-1">
                Beløp (NOK)
              </label>
              <input
                type="number"
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
                placeholder="F.eks. 45 000"
                className="w-full bg-black border border-white/10 p-2.5 text-white text-xs font-mono outline-none focus:border-emerald-500"
              />
            </div>
            <div>
              <label className="text-[9px] uppercase font-black text-slate-500 tracking-widest block mb-1">
                Notat
              </label>
              <input
                type="text"
                value={paymentNote}
                onChange={(e) => setPaymentNote(e.target.value)}
                placeholder="Valgfritt"
                className="w-full bg-black border border-white/10 p-2.5 text-white text-xs outline-none focus:border-emerald-500"
              />
            </div>
            <button
              onClick={addPayment}
              className="flex items-center justify-center gap-2 px-4 py-3 bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-[10px] font-black uppercase tracking-widest hover:bg-emerald-500/30 transition-all"
            >
              <Plus className="w-4 h-4" /> Legg inn
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
            <div className="rounded-md bg-black/40 border border-white/5 p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded bg-white/5 flex items-center justify-center">
                {totalPrincipalChange >= 0 ? (
                  <TrendingUp className="w-5 h-5 text-emerald-400" />
                ) : (
                  <TrendingUp className="w-5 h-5 text-rose-400 rotate-180" />
                )}
              </div>
              <div>
                <p className="text-[10px] uppercase text-slate-500 font-black tracking-widest">
                  Netto endring i lån
                </p>
                <p className="text-sm font-black text-white font-mono">
                  {formatNOK(Math.abs(totalPrincipalChange))}{' '}
                  {totalPrincipalChange >= 0 ? 'redusert' : 'økt'}
                </p>
              </div>
            </div>
            <div className="rounded-md bg-black/40 border border-white/5 p-4">
              <p className="text-[10px] uppercase text-slate-500 font-black tracking-widest mb-1">
                Formel
              </p>
              <p className="text-xs text-slate-300 font-mono">
                ny saldo = gammel saldo + månedsrente − betaling
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* LEDGER */}
      <div className="glass-panel overflow-hidden border-l-4 border-l-cyan-500">
        <div className="p-5 flex flex-col gap-2 md:flex-row md:items-center md:justify-between border-b border-white/5">
          <div>
            <h3 className="text-xs font-black uppercase tracking-widest text-white">
              Avregningshistorikk
            </h3>
            <p className="text-[10px] text-slate-500 italic">
              Hver linje bruker saldoen fra forrige avregning og legger til én måneds rente.
            </p>
          </div>
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 border border-white/10 px-3 py-1 rounded">
            {ledger.length} betalinger
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
                <tr>
                  <td colSpan={9} className="py-10 text-center text-slate-500 italic">
                    Ingen betalinger registrert ennå.
                  </td>
                </tr>
              ) : (
                ledger.map((row) => {
                  const original = payments.find((p) => p.id === row.id);
                  return (
                    <tr key={row.id} className="hover:bg-cyan-500/5 transition-all">
                      <td className="px-4 py-3 font-mono text-slate-400">{row.nr}</td>
                      <td className="px-4 py-3 whitespace-nowrap font-mono text-[11px] text-slate-300">
                        {row.fromDate} → {row.date}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-white">
                        {formatNOK(row.openingBalance)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-amber-300">
                        {formatNOK(row.interestDue)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-white">
                        {formatNOK(row.paid)}
                      </td>
                      <td
                        className={`px-4 py-3 text-right font-mono ${
                          row.principalChange >= 0 ? 'text-emerald-400' : 'text-rose-400'
                        }`}
                      >
                        {row.principalChange >= 0 ? '− ' : '+ '}
                        {formatNOK(Math.abs(row.principalChange))}
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-black text-white">
                        {formatNOK(row.closingBalance)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`px-2 py-0.5 text-[8px] font-black uppercase border ${
                            row.principalChange >= 0
                              ? 'border-emerald-500 text-emerald-400'
                              : 'border-rose-500 text-rose-400'
                          }`}
                        >
                          {row.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {original && (
                          <button
                            onClick={() => deletePayment(original)}
                            className="text-slate-500 hover:text-rose-400 transition-all"
                            title="Slett betaling"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
