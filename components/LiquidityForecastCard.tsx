import React, { useEffect, useMemo, useState } from 'react';
import { Banknote, CalendarClock, RefreshCw, TrendingUp } from 'lucide-react';
import { BankAccount, FamilyMember, TransactionType } from '../types';
import { fetchLiquidityForecast, LiquidityForecast } from '../services/liquidityForecastService';

interface Props {
  familyMembers: FamilyMember[];
  bankAccounts: BankAccount[];
}

function formatMoney(amount: number) {
  return new Intl.NumberFormat('nb-NO', { style: 'currency', currency: 'NOK', maximumFractionDigits: 0 }).format(Number.isFinite(amount) ? amount : 0);
}

function formatDate(date: string) {
  return new Date(date).toLocaleDateString('nb-NO', { day: '2-digit', month: 'short' });
}

export const LiquidityForecastCard: React.FC<Props> = ({ familyMembers, bankAccounts }) => {
  const [forecast, setForecast] = useState<LiquidityForecast | null>(null);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      setForecast(await fetchLiquidityForecast(familyMembers, bankAccounts));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [familyMembers, bankAccounts]);

  const upcoming = useMemo(() => (forecast?.events || []).slice(0, 8), [forecast]);
  if (!loading && upcoming.length === 0) return null;

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
      <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-800">
            <CalendarClock className="h-3.5 w-3.5" /> Likviditet fremover
          </div>
          <h2 className="text-xl font-bold text-slate-900">Kommende innbetalinger</h2>
          <p className="mt-1 text-sm text-slate-500">Lønn fra familiemedlemmer og forventede RealtyFlow-kommisjoner.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-right">
            <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Prognose</p>
            <p className="text-2xl font-extrabold text-slate-900">{loading ? 'Henter…' : formatMoney(forecast?.projectedBalanceNok || 0)}</p>
          </div>
          <button onClick={load} disabled={loading} className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-50">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {upcoming.map((event) => (
          <div key={event.id} className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex min-w-0 items-center gap-3">
              <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${event.type === TransactionType.INCOME ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                {event.source === 'realtyflow_commission' ? <TrendingUp className="h-5 w-5" /> : <Banknote className="h-5 w-5" />}
              </div>
              <div className="min-w-0">
                <p className="truncate font-bold text-slate-900">{event.title}</p>
                <p className="text-xs text-slate-500">{formatDate(event.date)} · {event.confidence === 'fixed' ? 'fast' : 'estimert'}</p>
              </div>
            </div>
            <p className="shrink-0 font-extrabold text-emerald-700">+{formatMoney(event.amount)}</p>
          </div>
        ))}
      </div>
    </section>
  );
};
