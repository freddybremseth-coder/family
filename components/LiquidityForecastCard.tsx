import React, { useEffect, useMemo, useState } from 'react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Banknote, CalendarClock, RefreshCw, Search, TrendingUp } from 'lucide-react';
import { BankAccount, FamilyMember, Transaction, TransactionType } from '../types';
import { fetchLiquidityForecast, LiquidityEvent, LiquidityForecast } from '../services/liquidityForecastService';

interface Props {
  familyMembers: FamilyMember[];
  bankAccounts: BankAccount[];
  transactions?: Transaction[];
}

function formatMoney(amount: number) {
  return new Intl.NumberFormat('nb-NO', { style: 'currency', currency: 'NOK', maximumFractionDigits: 0 }).format(Number.isFinite(amount) ? amount : 0);
}

function formatDate(date: string) {
  return new Date(date).toLocaleDateString('nb-NO', { day: '2-digit', month: 'short', year: 'numeric' });
}

function monthLabel(date: string) {
  return new Date(date).toLocaleDateString('nb-NO', { month: 'long', year: 'numeric' });
}

function sourceLabel(event: LiquidityEvent) {
  if (event.source === 'realtyflow_commission') return 'RealtyFlow';
  if (event.source === 'mondeo_payment') return 'Mondeo';
  if (event.source === 'frank_loan') return 'Frank';
  if (event.source === 'rent') return 'Husleie';
  if (event.source === 'utilities') return 'Strøm/vann';
  if (event.source === 'recurring_average') return 'Historisk snitt';
  if (event.source === 'salary') return 'Lønn';
  if (event.source === 'benefit') return 'Ytelse';
  return 'Barnetrygd/bidrag';
}

function monthKey(date: Date | string) {
  const d = typeof date === 'string' ? new Date(date) : date;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}
function monthName(date: string) { return new Date(date).toLocaleDateString('nb-NO', { month: 'short', year: '2-digit' }); }
function monthsInHorizon(monthsAhead: number) {
  const now = new Date();
  return Array.from({ length: monthsAhead + 1 }).map((_, i) => monthKey(new Date(now.getFullYear(), now.getMonth() + i, 1)));
}

export const LiquidityForecastCard: React.FC<Props> = ({ familyMembers, bankAccounts, transactions = [] }) => {
  const [forecast, setForecast] = useState<LiquidityForecast | null>(null);
  const [loading, setLoading] = useState(false);
  const [monthsAhead, setMonthsAhead] = useState(6);
  const [searchTerm, setSearchTerm] = useState('');

  const load = async () => {
    setLoading(true);
    try { setForecast(await fetchLiquidityForecast(familyMembers, bankAccounts, monthsAhead, transactions)); }
    catch (err) { console.warn('[LiquidityForecastCard] load failed', err); setForecast({ openingBalanceNok: 0, projectedBalanceNok: 0, events: [] }); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [familyMembers, bankAccounts, monthsAhead, transactions.length]);
  const allEvents = forecast?.events || [];
  const filteredEvents = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return allEvents.filter((event) => !q || [event.title, event.date, event.source, event.confidence, sourceLabel(event)].join(' ').toLowerCase().includes(q));
  }, [allEvents, searchTerm]);
  const eventsByMonth = useMemo(() => {
    const groups = new Map<string, LiquidityEvent[]>();
    filteredEvents.forEach((event) => { const key = monthKey(event.date); groups.set(key, [...(groups.get(key) || []), event]); });
    return Array.from(groups.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [filteredEvents]);
  const chartData = useMemo(() => {
    let running = forecast?.openingBalanceNok || 0;
    const eventsByKey = new Map<string, LiquidityEvent[]>();
    allEvents.forEach((event) => { const key = monthKey(event.date); eventsByKey.set(key, [...(eventsByKey.get(key) || []), event]); });
    return monthsInHorizon(monthsAhead).map((key) => {
      const monthEvents = eventsByKey.get(key) || [];
      const incoming = monthEvents.filter((event) => event.type === TransactionType.INCOME).reduce((sum, event) => sum + event.amount, 0);
      const outgoing = monthEvents.filter((event) => event.type === TransactionType.EXPENSE).reduce((sum, event) => sum + event.amount, 0);
      running += incoming - outgoing;
      return { name: monthName(key), incoming, outgoing, balance: running };
    });
  }, [forecast, allEvents, monthsAhead]);

  const upcoming = filteredEvents.slice(0, 12);
  const projected = forecast?.projectedBalanceNok ?? chartData[chartData.length - 1]?.balance ?? 0;

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
      <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div><div className="mb-2 inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-800"><CalendarClock className="h-3.5 w-3.5" /> Likviditet fremover</div><h2 className="text-xl font-bold text-slate-900">Kommende betalinger og innbetalinger</h2><p className="mt-1 text-sm text-slate-500">Faste inn-/utbetalinger, husleie, strøm/vann og historisk snitt for repeterende utgifter.</p></div>
        <div className="flex items-center gap-3"><div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-right"><p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Likviditet etter {monthsAhead} mnd</p><p className="text-2xl font-extrabold text-slate-900">{loading ? 'Henter…' : formatMoney(projected)}</p></div><button onClick={load} disabled={loading} className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-50"><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /></button></div>
      </div>
      <div className="mb-5 grid grid-cols-1 gap-3 md:grid-cols-3"><label className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3"><span className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-slate-500">Vis måneder fremover</span><select value={monthsAhead} onChange={(e) => setMonthsAhead(Number(e.target.value))} className="w-full bg-transparent text-sm font-bold text-slate-900 outline-none"><option value={3}>3 måneder</option><option value={6}>6 måneder</option><option value={9}>9 måneder</option><option value={12}>12 måneder</option><option value={18}>18 måneder</option><option value={24}>24 måneder</option></select></label><label className="relative rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 md:col-span-2"><span className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-slate-500">Søk i inn-/utbetalinger</span><Search className="absolute bottom-3.5 left-4 h-4 w-4 text-slate-400" /><input value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Søk etter husleie, strøm, dagligvarer, Mondeo, Frank, RealtyFlow…" className="w-full bg-transparent pl-6 text-sm font-semibold text-slate-900 outline-none placeholder:text-slate-400" /></label></div>
      <div className="mb-5 rounded-2xl border border-slate-200 bg-slate-50 p-4"><div className="mb-3 flex items-center justify-between gap-3"><h3 className="text-sm font-bold text-slate-900">Grafisk likviditetsutvikling</h3><p className="text-xs text-slate-500">Start: {formatMoney(forecast?.openingBalanceNok || 0)}</p></div><div className="h-[240px]"><ResponsiveContainer width="100%" height="100%"><AreaChart data={chartData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}><CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} /><XAxis dataKey="name" stroke="#64748B" fontSize={12} axisLine={false} tickLine={false} /><YAxis stroke="#64748B" fontSize={11} axisLine={false} tickLine={false} tickFormatter={(value) => `${Math.round(Number(value) / 1000)}k`} /><Tooltip formatter={(value: any, name: any) => [formatMoney(Number(value)), name === 'balance' ? 'Likviditet' : name === 'incoming' ? 'Innbetalinger' : 'Utbetalinger']} contentStyle={{ background: 'white', border: '1px solid #E2E8F0', borderRadius: 14 }} /><Area type="monotone" dataKey="balance" stroke="#0F172A" strokeWidth={2} fill="#E2E8F0" dot /><Area type="monotone" dataKey="incoming" stroke="#059669" strokeWidth={2} fill="#D1FAE5" dot={false} /></AreaChart></ResponsiveContainer></div></div>
      <div className="mb-5 grid grid-cols-1 gap-3 md:grid-cols-2">{upcoming.length === 0 ? <div className="md:col-span-2 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5 text-center text-sm text-slate-500">Ingen kommende inn-/utbetalinger i valgt periode eller søk.</div> : upcoming.map((event) => <div key={event.id} className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4"><div className="flex min-w-0 items-center gap-3"><div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${event.type === TransactionType.INCOME ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>{event.source === 'realtyflow_commission' ? <TrendingUp className="h-5 w-5" /> : <Banknote className="h-5 w-5" />}</div><div className="min-w-0"><p className="truncate font-bold text-slate-900">{event.title}</p><p className="text-xs text-slate-500">{formatDate(event.date)} · {sourceLabel(event)} · {event.confidence === 'fixed' ? 'fast' : 'estimert'}</p></div></div><p className={`shrink-0 font-extrabold ${event.type === TransactionType.INCOME ? 'text-emerald-700' : 'text-rose-700'}`}>{event.type === TransactionType.INCOME ? '+' : '−'}{formatMoney(event.amount)}</p></div>)}</div>
      <div className="rounded-2xl border border-slate-200 bg-white p-4"><h3 className="mb-3 text-sm font-bold text-slate-900">Kalender for likviditet</h3>{eventsByMonth.length === 0 ? <p className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-center text-sm text-slate-500">Ingen treff i valgt periode.</p> : <div className="space-y-4">{eventsByMonth.map(([month, events]) => { const net = events.reduce((sum, event) => sum + (event.type === TransactionType.INCOME ? event.amount : -event.amount), 0); return <div key={month}><div className="mb-2 flex items-center justify-between border-b border-slate-200 pb-2"><p className="font-bold capitalize text-slate-900">{monthLabel(month)}</p><p className={`text-sm font-bold ${net >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>{net >= 0 ? '+' : '−'}{formatMoney(Math.abs(net))}</p></div><div className="grid grid-cols-1 gap-2 md:grid-cols-2">{events.map((event) => <div key={event.id} className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2 text-sm"><span className="min-w-0 truncate"><span className="font-bold">{formatDate(event.date)}</span> · {event.title}</span><span className={`shrink-0 font-bold ${event.type === TransactionType.INCOME ? 'text-emerald-700' : 'text-rose-700'}`}>{event.type === TransactionType.INCOME ? '+' : '−'}{formatMoney(event.amount)}</span></div>)}</div></div>; })}</div>}</div>
    </section>
  );
};
