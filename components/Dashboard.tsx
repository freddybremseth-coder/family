import React, { useEffect, useMemo, useState } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Transaction, TransactionType, BankAccount, Asset, Language, FamilyMember, Task, CalendarEvent, RealEstateDeal, AfterSaleCommission, FarmOperation } from '../types';
import { Wallet, Calendar, ShoppingCart, CheckSquare, RefreshCw, Sparkles, Heart, ArrowUpRight, ArrowDownRight, Landmark, Home, BriefcaseBusiness, TrendingUp } from 'lucide-react';
import { EXCHANGE_RATE_EUR_TO_NOK, MEMBER_COLORS } from '../constants';
import { getFinancialStatusInsight } from '../services/geminiService';
import { fetchFamilyEconomy, EconomySummary } from '../services/familyEconomyService';
import { translations } from '../translations';

interface Props {
  transactions: Transaction[];
  bankAccounts?: BankAccount[];
  assets?: Asset[];
  familyMembers?: FamilyMember[];
  tasks?: Task[];
  calendarEvents?: CalendarEvent[];
  groceryCount?: number;
  lang: Language;
  userId?: string;
  realEstateDeals?: RealEstateDeal[];
  afterSales?: AfterSaleCommission[];
  farmOps?: FarmOperation[];
}

const toNok = (amount: number, currency?: string) => currency === 'EUR' ? Number(amount || 0) * EXCHANGE_RATE_EUR_TO_NOK : Number(amount || 0);
const formatMoney = (amount: number) => new Intl.NumberFormat('nb-NO', { style: 'currency', currency: 'NOK', maximumFractionDigits: 0 }).format(Number(amount || 0));
const getGreeting = (lang: Language) => { const t = translations[lang]; const h = new Date().getHours(); if (h < 12) return t.good_morning || 'God morgen'; if (h < 18) return t.good_afternoon || 'God ettermiddag'; return t.good_evening || 'God kveld'; };

function MetricCard({ title, value, hint, symbol }: { title: string; value: string; hint?: string; symbol: React.ReactNode }) {
  return <div className="card p-5"><div className="flex items-center justify-between gap-4"><div><p className="text-sm text-slate-500">{title}</p><p className="mt-1 text-2xl font-bold text-slate-900">{value}</p>{hint && <p className="mt-1 text-sm text-slate-500">{hint}</p>}</div><div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-600">{symbol}</div></div></div>;
}
function EmptyState({ text }: { text: string }) { return <p className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-slate-500">{text}</p>; }

export const Dashboard: React.FC<Props> = ({ transactions, bankAccounts = [], assets = [], familyMembers = [], tasks = [], calendarEvents = [], groceryCount = 0, lang, userId, realEstateDeals = [], afterSales = [], farmOps = [] }) => {
  const [aiTip, setAiTip] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [economy, setEconomy] = useState<EconomySummary | null>(null);
  useEffect(() => { if (userId) fetchFamilyEconomy(userId).then(setEconomy).catch(() => setEconomy(null)); }, [userId]);
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];

  const businessStats = useMemo(() => {
    const dealPipeline = realEstateDeals.reduce((sum, deal) => sum + toNok(deal.ourNetCommission || deal.ourGrossCommission || 0, deal.currency), 0);
    const pendingDealCommissions = realEstateDeals.flatMap(d => d.commissionPayouts || []).filter(p => p.status !== 'Paid').reduce((sum, p) => sum + toNok(p.amount || 0, p.currency), 0);
    const afterSaleRevenue = afterSales.reduce((sum, sale) => sum + toNok(sale.ourCommissionAmount || 0, sale.currency), 0);
    const farmNet = farmOps.reduce((sum, op) => sum + (op.type === 'Income' ? toNok(op.amount, op.currency) : -toNok(op.amount, op.currency)), 0);
    return { dealPipeline, pendingDealCommissions, afterSaleRevenue, farmNet, total: dealPipeline + afterSaleRevenue + farmNet, count: realEstateDeals.length + afterSales.length + farmOps.length };
  }, [realEstateDeals, afterSales, farmOps]);

  const stats = useMemo(() => {
    const currentMonth = now.getMonth(); const currentYear = now.getFullYear();
    const monthlyTx = transactions.filter(tx => { const d = new Date(tx.date); return d.getMonth() === currentMonth && d.getFullYear() === currentYear; });
    const income = monthlyTx.filter(tx => tx.type === TransactionType.INCOME).reduce((sum, tx) => sum + toNok(tx.amount, tx.currency), 0);
    const expenses = monthlyTx.filter(tx => tx.type === TransactionType.EXPENSE).reduce((sum, tx) => sum + toNok(tx.amount, tx.currency), 0);
    const bankBalance = bankAccounts.reduce((sum, account) => sum + toNok(account.balance, account.currency), 0);
    const assetValue = assets.reduce((sum, asset) => sum + toNok(asset.currentValue, asset.currency), 0);
    return { income, expenses, balance: income - expenses, bankBalance, assetValue, netWorthBase: bankBalance + assetValue + businessStats.total };
  }, [transactions, bankAccounts, assets, businessStats.total]);

  const monthlyChart = useMemo(() => Array.from({ length: 6 }).map((_, index) => { const d = new Date(); d.setMonth(d.getMonth() - (5 - index)); const month = d.getMonth(); const year = d.getFullYear(); const monthTx = transactions.filter(tx => { const txDate = new Date(tx.date); return txDate.getMonth() === month && txDate.getFullYear() === year; }); return { name: d.toLocaleString(lang === 'no' ? 'no-NO' : 'en-US', { month: 'short' }), Inntekt: Math.round(monthTx.filter(tx => tx.type === TransactionType.INCOME).reduce((sum, tx) => sum + toNok(tx.amount, tx.currency), 0)), Utgifter: Math.round(monthTx.filter(tx => tx.type === TransactionType.EXPENSE).reduce((sum, tx) => sum + toNok(tx.amount, tx.currency), 0)) }; }), [transactions, lang]);
  const categoryData = useMemo(() => { const currentMonth = now.getMonth(); const currentYear = now.getFullYear(); const categories = new Map<string, number>(); transactions.filter(tx => { const d = new Date(tx.date); return tx.type === TransactionType.EXPENSE && d.getMonth() === currentMonth && d.getFullYear() === currentYear; }).forEach(tx => categories.set(tx.category || 'Uten kategori', (categories.get(tx.category || 'Uten kategori') || 0) + toNok(tx.amount, tx.currency))); return Array.from(categories.entries()).sort((a, b) => b[1] - a[1]).slice(0, 6); }, [transactions]);
  const todayEvents = calendarEvents.filter(event => event.date === todayStr);
  const pendingTasks = tasks.filter(task => !task.isComplete).slice(0, 5);
  const getMemberName = (id?: string) => familyMembers.find(member => member.id === id)?.name || 'Ikke valgt';
  const getMemberColor = (id?: string) => { const index = familyMembers.findIndex(member => member.id === id); return MEMBER_COLORS[index >= 0 ? index % MEMBER_COLORS.length : 0] || '#64748B'; };
  const fetchAiTip = async () => { setAiLoading(true); try { const result = await getFinancialStatusInsight({ ...stats, businessStats }, assets); setAiTip(result?.message || null); } finally { setAiLoading(false); } };
  useEffect(() => { if (transactions.length > 0 || bankAccounts.length > 0 || assets.length > 0 || businessStats.count > 0) fetchAiTip(); }, [stats.bankBalance, stats.assetValue, transactions.length, businessStats.count, businessStats.total]);

  return <div className="space-y-6 animate-fade-in">
    <section className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between"><div><div className="mb-2 flex items-center gap-2"><div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-slate-900 text-white"><Heart className="h-5 w-5" /></div><span className="inline-flex rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">FamilieHub</span></div><h1 className="text-3xl font-bold tracking-tight text-slate-900 md:text-5xl">{getGreeting(lang)}</h1><p className="mt-3 max-w-3xl text-base text-slate-600 md:text-lg">Her er dagens oversikt basert på transaksjoner, kontoer, eiendeler, Business, kalender og oppgaver.</p></div><div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600 shadow-sm">{now.toLocaleDateString(lang === 'no' ? 'no-NO' : 'en-US', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</div></section>
    <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4"><MetricCard title="Banksaldo" value={formatMoney(stats.bankBalance)} hint={`${bankAccounts.length} kontoer`} symbol={<Landmark className="h-5 w-5" />} /><MetricCard title="Eiendeler" value={formatMoney(stats.assetValue)} hint={`${assets.length} registrert`} symbol={<Home className="h-5 w-5" />} /><MetricCard title="Inntekt denne måneden" value={formatMoney(stats.income)} symbol={<ArrowUpRight className="h-5 w-5" />} /><MetricCard title="Utgifter denne måneden" value={formatMoney(stats.expenses)} symbol={<ArrowDownRight className="h-5 w-5" />} /></section>
    {businessStats.count > 0 && <section className="card p-5 md:p-6"><div className="mb-5 flex flex-col gap-2 md:flex-row md:items-center md:justify-between"><div><h2 className="text-xl font-bold text-slate-900">Business i Oversikt</h2><p className="mt-1 text-sm text-slate-500">Tall fra Business-modulen vises når det finnes avtaler, aftersales eller gårdsoperasjoner.</p></div><p className="text-2xl font-bold text-slate-900">{formatMoney(businessStats.total)}</p></div><div className="grid grid-cols-1 gap-3 md:grid-cols-4"><MetricCard title="Provisjon pipeline" value={formatMoney(businessStats.dealPipeline)} hint={`${realEstateDeals.length} avtaler`} symbol={<BriefcaseBusiness className="h-5 w-5" />} /><MetricCard title="Ventende provisjon" value={formatMoney(businessStats.pendingDealCommissions)} symbol={<TrendingUp className="h-5 w-5" />} /><MetricCard title="AfterSale" value={formatMoney(businessStats.afterSaleRevenue)} hint={`${afterSales.length} poster`} symbol={<ArrowUpRight className="h-5 w-5" />} /><MetricCard title="Dona Anna netto" value={formatMoney(businessStats.farmNet)} hint={`${farmOps.length} føringer`} symbol={<Home className="h-5 w-5" />} /></div></section>}
    {economy && economy.rows.length > 0 && <section className="card p-5 md:p-6"><div className="mb-5 flex flex-col gap-2 md:flex-row md:items-center md:justify-between"><div><h2 className="text-xl font-bold text-slate-900">Konsolidert familieøkonomi</h2><p className="mt-1 text-sm text-slate-500">Hittil i år fra delt økonomiview hvis tilgjengelig.</p></div><p className="text-2xl font-bold text-slate-900">{formatMoney(economy.ytd.totalNet)}</p></div><div className="grid grid-cols-1 gap-3 md:grid-cols-3"><MetricCard title="Dona Anna" value={formatMoney(economy.ytd.oliviaNet)} symbol="D" /><MetricCard title="RealtyFlow" value={formatMoney(economy.ytd.realtyflowNet)} symbol="R" /><MetricCard title="Mondeo rente" value={formatMoney(economy.ytd.mondeoInterest)} symbol="M" /></div></section>}
    {(aiTip || aiLoading) && <section className="card p-4"><div className="flex items-start gap-3"><div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-slate-700"><Sparkles className="h-4 w-4" /></div><div className="min-w-0 flex-1"><p className="text-sm font-bold text-slate-900">AI-innsikt</p><p className="mt-1 text-sm text-slate-600">{aiLoading ? 'Henter AI-innsikt...' : aiTip}</p></div><button onClick={fetchAiTip} disabled={aiLoading} className="btn-secondary shrink-0"><RefreshCw className={`h-4 w-4 ${aiLoading ? 'animate-spin' : ''}`} /></button></div></section>}
    <section className="grid grid-cols-1 gap-6 xl:grid-cols-3"><div className="space-y-6 xl:col-span-2"><div className="card p-5 md:p-6"><h2 className="mb-5 text-xl font-bold text-slate-900">Inntekt og utgifter</h2>{transactions.length === 0 ? <EmptyState text="Ingen transaksjoner registrert ennå." /> : <div className="h-[240px]"><ResponsiveContainer width="100%" height="100%"><AreaChart data={monthlyChart} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}><CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} /><XAxis dataKey="name" stroke="#64748B" fontSize={12} axisLine={false} tickLine={false} /><YAxis stroke="#64748B" fontSize={11} axisLine={false} tickLine={false} tickFormatter={value => `${Math.round(Number(value) / 1000)}k`} /><Tooltip formatter={(value: any) => [formatMoney(Number(value)), '']} contentStyle={{ background: 'white', border: '1px solid #E2E8F0', borderRadius: 14 }} /><Area type="monotone" dataKey="Inntekt" stroke="#0F172A" strokeWidth={2} fill="#E2E8F0" dot={false} /><Area type="monotone" dataKey="Utgifter" stroke="#DC2626" strokeWidth={2} fill="#FEE2E2" dot={false} /></AreaChart></ResponsiveContainer></div>}</div><div className="card p-5 md:p-6"><h2 className="mb-5 text-xl font-bold text-slate-900">Utgifter etter kategori denne måneden</h2>{categoryData.length === 0 ? <EmptyState text="Ingen utgifter registrert denne måneden." /> : <div className="space-y-3">{categoryData.map(([category, amount]) => { const percent = stats.expenses > 0 ? Math.round((amount / stats.expenses) * 100) : 0; return <div key={category} className="rounded-2xl border border-slate-200 bg-white p-4"><div className="mb-2 flex items-center justify-between gap-4"><p className="font-semibold text-slate-800">{category}</p><p className="font-bold text-slate-900">{formatMoney(amount)}</p></div><div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-slate-900" style={{ width: `${percent}%` }} /></div></div>; })}</div>}</div></div><aside className="space-y-6"><div className="card p-5"><h2 className="mb-4 flex items-center gap-2 text-lg font-bold text-slate-900"><Calendar className="h-5 w-5" /> I dag</h2>{todayEvents.length === 0 ? <EmptyState text="Ingen hendelser i dag." /> : <div className="space-y-2">{todayEvents.map(event => <div key={event.id} className="rounded-2xl border border-slate-200 bg-white p-3"><p className="font-bold text-slate-900">{event.description}</p><p className="mt-1 text-sm text-slate-500">{getMemberName(event.assignedToId)} · {event.type}</p></div>)}</div>}</div><div className="card p-5"><h2 className="mb-4 flex items-center gap-2 text-lg font-bold text-slate-900"><CheckSquare className="h-5 w-5" /> Oppgaver</h2>{pendingTasks.length === 0 ? <EmptyState text="Ingen ventende oppgaver." /> : <div className="space-y-2">{pendingTasks.map(task => <div key={task.id} className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white p-3"><span className="mt-1 h-2.5 w-2.5 rounded-full" style={{ background: getMemberColor(task.assignedToId) }} /><div><p className="font-bold text-slate-900">{task.description}</p><p className="mt-1 text-sm text-slate-500">{getMemberName(task.assignedToId)} · {task.priority}</p></div></div>)}</div>}</div><div className="card p-5"><h2 className="mb-4 flex items-center gap-2 text-lg font-bold text-slate-900"><ShoppingCart className="h-5 w-5" /> Handleliste</h2><MetricCard title="Gjenstår" value={numberWithText(groceryCount, 'varer')} symbol={<ShoppingCart className="h-5 w-5" />} /></div><div className="card p-5"><h2 className="mb-4 flex items-center gap-2 text-lg font-bold text-slate-900"><Wallet className="h-5 w-5" /> Grunnverdi</h2><p className="text-sm text-slate-500">Bankkontoer + eiendeler + Business-verdi når Business har tall.</p><p className="mt-3 text-2xl font-bold text-slate-900">{formatMoney(stats.netWorthBase)}</p></div></aside></section>
  </div>;
};

function numberWithText(value: number, label: string) { return `${new Intl.NumberFormat('nb-NO').format(Number(value || 0))} ${label}`; }
