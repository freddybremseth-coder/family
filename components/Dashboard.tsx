import React, { useEffect, useMemo, useState } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Transaction, TransactionType, BankAccount, Asset, Language, FamilyMember, Task, CalendarEvent, RealEstateDeal, AfterSaleCommission, FarmOperation, Bill } from '../types';
import { Wallet, Calendar, ShoppingCart, CheckSquare, RefreshCw, Sparkles, Heart, ArrowUpRight, ArrowDownRight, Landmark, Home, BriefcaseBusiness, TrendingUp, Receipt, AlertTriangle, PiggyBank, Coins } from 'lucide-react';
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
  bills?: Bill[];
}

const CATEGORY_COLORS = ['#6366F1', '#EC4899', '#10B981', '#F59E0B', '#06B6D4', '#8B5CF6', '#F43F5E', '#14B8A6'];

const toNok = (amount: number, currency?: string) => currency === 'EUR' ? Number(amount || 0) * EXCHANGE_RATE_EUR_TO_NOK : Number(amount || 0);
const formatMoney = (amount: number) => new Intl.NumberFormat('nb-NO', { style: 'currency', currency: 'NOK', maximumFractionDigits: 0 }).format(Number(amount || 0));
const getGreeting = (lang: Language) => { const t = translations[lang]; const h = new Date().getHours(); if (h < 12) return t.good_morning || 'God morgen'; if (h < 18) return t.good_afternoon || 'God ettermiddag'; return t.good_evening || 'God kveld'; };

function MetricCard({ title, value, hint, symbol }: { title: string; value: string; hint?: string; symbol: React.ReactNode }) {
  return <div className="card p-5"><div className="flex items-center justify-between gap-4"><div><p className="text-sm text-slate-500">{title}</p><p className="mt-1 text-2xl font-bold text-slate-900">{value}</p>{hint && <p className="mt-1 text-sm text-slate-500">{hint}</p>}</div><div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-600">{symbol}</div></div></div>;
}
function EmptyState({ text }: { text: string }) { return <p className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-slate-500">{text}</p>; }

export const Dashboard: React.FC<Props> = ({ transactions, bankAccounts = [], assets = [], familyMembers = [], tasks = [], calendarEvents = [], groceryCount = 0, lang, userId, realEstateDeals = [], afterSales = [], farmOps = [], bills = [] }) => {
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
  // FAMILIEREGNSKAP – samlet finansoversikt
  const incomeBySource = useMemo(() => {
    const m = new Map<string, number>();
    const yyyy = now.getFullYear();
    const mm = now.getMonth();
    transactions
      .filter(tx => tx.type === TransactionType.INCOME)
      .filter(tx => { const d = new Date(tx.date); return d.getFullYear() === yyyy && d.getMonth() === mm; })
      .forEach(tx => {
        const key = tx.category || tx.description || 'Annet';
        m.set(key, (m.get(key) || 0) + toNok(tx.amount, tx.currency));
      });
    return Array.from(m.entries()).sort((a, b) => b[1] - a[1]);
  }, [transactions]);

  const billStats = useMemo(() => {
    const today = new Date(now); today.setHours(0, 0, 0, 0);
    const in7days = new Date(today); in7days.setDate(in7days.getDate() + 7);
    const yyyy = today.getFullYear(); const mm = today.getMonth();
    const paidThisMonth = bills.filter(b => {
      if (!b.isPaid || !b.dueDate) return false;
      const d = new Date(b.dueDate); return d.getFullYear() === yyyy && d.getMonth() === mm;
    });
    const unpaid = bills.filter(b => !b.isPaid);
    const overdue = unpaid.filter(b => b.dueDate && new Date(b.dueDate) < today);
    const upcoming = unpaid.filter(b => b.dueDate && new Date(b.dueDate) >= today && new Date(b.dueDate) <= in7days);
    const totalUnpaid = unpaid.reduce((s, b) => s + toNok(b.amount, b.currency as any), 0);
    const totalPaidThisMonth = paidThisMonth.reduce((s, b) => s + toNok(b.amount, b.currency as any), 0);
    return { paidThisMonth, unpaid, overdue, upcoming, totalUnpaid, totalPaidThisMonth };
  }, [bills]);

  const netResult = stats.income - stats.expenses;
  const savingsRate = stats.income > 0 ? (netResult / stats.income) * 100 : 0;
  const netWorth = stats.bankBalance + stats.assetValue - billStats.totalUnpaid;

  const todayEvents = calendarEvents.filter(event => event.date === todayStr);
  const pendingTasks = tasks.filter(task => !task.isComplete).slice(0, 5);
  const getMemberName = (id?: string) => familyMembers.find(member => member.id === id)?.name || 'Ikke valgt';
  const getMemberColor = (id?: string) => { const index = familyMembers.findIndex(member => member.id === id); return MEMBER_COLORS[index >= 0 ? index % MEMBER_COLORS.length : 0] || '#64748B'; };
  const fetchAiTip = async () => { setAiLoading(true); try { const result = await getFinancialStatusInsight({ ...stats, businessStats }, assets); setAiTip(result?.message || null); } finally { setAiLoading(false); } };
  useEffect(() => { if (transactions.length > 0 || bankAccounts.length > 0 || assets.length > 0 || businessStats.count > 0) fetchAiTip(); }, [stats.bankBalance, stats.assetValue, transactions.length, businessStats.count, businessStats.total]);

  return <div className="space-y-6 animate-fade-in">
    <section className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between"><div><div className="mb-2 flex items-center gap-2"><div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-slate-900 text-white"><Heart className="h-5 w-5" /></div><span className="inline-flex rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">FamilieHub</span></div><h1 className="text-3xl font-bold tracking-tight text-slate-900 md:text-5xl">{getGreeting(lang)}</h1><p className="mt-3 max-w-3xl text-base text-slate-600 md:text-lg">Her er dagens oversikt basert på transaksjoner, kontoer, eiendeler, Business, kalender og oppgaver.</p></div><div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600 shadow-sm">{now.toLocaleDateString(lang === 'no' ? 'no-NO' : 'en-US', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</div></section>
    <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4"><MetricCard title="Banksaldo" value={formatMoney(stats.bankBalance)} hint={`${bankAccounts.length} kontoer`} symbol={<Landmark className="h-5 w-5" />} /><MetricCard title="Eiendeler" value={formatMoney(stats.assetValue)} hint={`${assets.length} registrert`} symbol={<Home className="h-5 w-5" />} /><MetricCard title="Inntekt denne måneden" value={formatMoney(stats.income)} symbol={<ArrowUpRight className="h-5 w-5" />} /><MetricCard title="Utgifter denne måneden" value={formatMoney(stats.expenses)} symbol={<ArrowDownRight className="h-5 w-5" />} /></section>

    {/* FAMILIEREGNSKAP – samlet visning av kontantstrøm, regninger og formue */}
    <section className="card p-5 md:p-6">
      <div className="mb-5 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <PiggyBank className="h-5 w-5 text-indigo-500" /> Familieregnskap · {now.toLocaleString('nb-NO', { month: 'long', year: 'numeric' })}
          </h2>
          <p className="mt-1 text-sm text-slate-500">Hva som kom inn, hvor det gikk, og hva som står igjen.</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2 text-right">
          <p className="text-[11px] uppercase font-bold tracking-wide text-slate-500">Nettoresultat denne måneden</p>
          <p className={`text-2xl font-extrabold tracking-tight ${netResult >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
            {netResult >= 0 ? '+' : ''}{formatMoney(netResult)}
          </p>
          <p className="text-[11px] text-slate-500">Sparerate: {savingsRate.toFixed(0)}%</p>
        </div>
      </div>

      {/* 4 nøkkeltall: inntekt, utgift, regninger, formue */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4 mb-6">
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
          <div className="flex items-center gap-2 text-emerald-700 text-[11px] font-bold uppercase tracking-wide"><ArrowUpRight className="h-3.5 w-3.5" /> Inn på konto</div>
          <p className="mt-1 text-2xl font-extrabold text-slate-900">{formatMoney(stats.income)}</p>
          <p className="text-[11px] text-slate-500">{incomeBySource.length} kilde{incomeBySource.length === 1 ? '' : 'r'}</p>
        </div>
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4">
          <div className="flex items-center gap-2 text-rose-700 text-[11px] font-bold uppercase tracking-wide"><ArrowDownRight className="h-3.5 w-3.5" /> Ut av konto</div>
          <p className="mt-1 text-2xl font-extrabold text-slate-900">{formatMoney(stats.expenses)}</p>
          <p className="text-[11px] text-slate-500">{categoryData.length} kategori{categoryData.length === 1 ? '' : 'er'}</p>
        </div>
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <div className="flex items-center gap-2 text-amber-700 text-[11px] font-bold uppercase tracking-wide"><Receipt className="h-3.5 w-3.5" /> Ubetalte regninger</div>
          <p className="mt-1 text-2xl font-extrabold text-slate-900">{formatMoney(billStats.totalUnpaid)}</p>
          <p className="text-[11px] text-slate-500">
            {billStats.unpaid.length} stk{billStats.overdue.length > 0 && <span className="text-rose-600 font-bold"> · {billStats.overdue.length} forfalt</span>}
          </p>
        </div>
        <div className="rounded-2xl border border-indigo-200 bg-indigo-50 p-4">
          <div className="flex items-center gap-2 text-indigo-700 text-[11px] font-bold uppercase tracking-wide"><Coins className="h-3.5 w-3.5" /> Nettoformue</div>
          <p className="mt-1 text-2xl font-extrabold text-slate-900">{formatMoney(netWorth)}</p>
          <p className="text-[11px] text-slate-500">Bank + eiendeler − gjeld</p>
        </div>
      </div>

      {/* Kontantstrøm: inntekt → bank → utgift */}
      <div className="rounded-2xl border border-slate-200 bg-gradient-to-r from-emerald-50 via-white to-rose-50 p-5 mb-6">
        <p className="text-[11px] uppercase font-bold tracking-wide text-slate-500 mb-3">Kontantstrøm denne måneden</p>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3 items-center">
          <div className="md:col-span-1">
            <p className="text-xs text-slate-500">Inntekt</p>
            <p className="text-lg font-extrabold text-emerald-600">{formatMoney(stats.income)}</p>
          </div>
          <div className="hidden md:flex justify-center text-emerald-400"><ArrowUpRight className="h-6 w-6 rotate-90" /></div>
          <div className="md:col-span-1 text-center">
            <p className="text-xs text-slate-500">Bank</p>
            <p className="text-lg font-extrabold text-slate-900">{formatMoney(stats.bankBalance)}</p>
          </div>
          <div className="hidden md:flex justify-center text-rose-400"><ArrowDownRight className="h-6 w-6 -rotate-90" /></div>
          <div className="md:col-span-1 text-right">
            <p className="text-xs text-slate-500">Utgifter + regninger</p>
            <p className="text-lg font-extrabold text-rose-600">{formatMoney(stats.expenses + billStats.totalUnpaid)}</p>
          </div>
        </div>
      </div>

      {/* Inntektskilder + kategorifordeling i to kolonner */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Inntektskilder */}
        <div>
          <h3 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
            <ArrowUpRight className="h-4 w-4 text-emerald-500" /> Inntektskilder
          </h3>
          {incomeBySource.length === 0 ? <EmptyState text="Ingen inntekter registrert denne måneden." /> : (
            <div className="space-y-2">
              {incomeBySource.slice(0, 5).map(([source, amount], i) => {
                const percent = stats.income > 0 ? (amount / stats.income) * 100 : 0;
                return (
                  <div key={source} className="rounded-xl border border-slate-200 bg-white p-3">
                    <div className="flex items-center justify-between gap-3 mb-1.5">
                      <p className="font-semibold text-slate-800 text-sm truncate flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: CATEGORY_COLORS[i % CATEGORY_COLORS.length] }} />
                        {source}
                      </p>
                      <p className="font-bold text-slate-900 text-sm shrink-0">{formatMoney(amount)}</p>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                      <div className="h-full rounded-full" style={{ width: `${percent}%`, background: CATEGORY_COLORS[i % CATEGORY_COLORS.length] }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Utgifter etter kategori med pie-chart */}
        <div>
          <h3 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
            <ArrowDownRight className="h-4 w-4 text-rose-500" /> Utgifter etter kategori
          </h3>
          {categoryData.length === 0 ? <EmptyState text="Ingen utgifter registrert denne måneden." /> : (
            <div className="grid grid-cols-1 sm:grid-cols-5 gap-3 items-center">
              <div className="sm:col-span-2 h-[160px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={categoryData.map(([name, value]) => ({ name, value }))} cx="50%" cy="50%" innerRadius={40} outerRadius={70} paddingAngle={2} dataKey="value">
                      {categoryData.map((_, i) => <Cell key={i} fill={CATEGORY_COLORS[i % CATEGORY_COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(value: any) => formatMoney(Number(value))} contentStyle={{ background: 'white', border: '1px solid #E2E8F0', borderRadius: 12, fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="sm:col-span-3 space-y-1.5">
                {categoryData.slice(0, 5).map(([category, amount], i) => (
                  <div key={category} className="flex items-center justify-between gap-2 text-xs">
                    <span className="flex items-center gap-1.5 truncate min-w-0">
                      <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: CATEGORY_COLORS[i % CATEGORY_COLORS.length] }} />
                      <span className="font-medium text-slate-700 truncate">{category}</span>
                    </span>
                    <span className="font-bold text-slate-900 shrink-0">{formatMoney(amount)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Regninger som forfaller eller er forfalt */}
      {(billStats.overdue.length > 0 || billStats.upcoming.length > 0) && (
        <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-4">
          <h3 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
            <Receipt className="h-4 w-4 text-amber-500" /> Regninger som krever oppmerksomhet
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {billStats.overdue.map(b => (
              <div key={b.id} className="rounded-xl border border-rose-200 bg-rose-50 p-3 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-semibold text-slate-900 text-sm truncate flex items-center gap-1.5"><AlertTriangle className="h-3.5 w-3.5 text-rose-500" /> {b.name}</p>
                  <p className="text-[11px] text-rose-600">Forfalt {b.dueDate}</p>
                </div>
                <p className="font-bold text-slate-900 text-sm shrink-0">{formatMoney(toNok(b.amount, b.currency as any))}</p>
              </div>
            ))}
            {billStats.upcoming.map(b => (
              <div key={b.id} className="rounded-xl border border-amber-200 bg-amber-50 p-3 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-semibold text-slate-900 text-sm truncate">{b.name}</p>
                  <p className="text-[11px] text-amber-700">Forfaller {b.dueDate}</p>
                </div>
                <p className="font-bold text-slate-900 text-sm shrink-0">{formatMoney(toNok(b.amount, b.currency as any))}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
    {businessStats.count > 0 && <section className="card p-5 md:p-6"><div className="mb-5 flex flex-col gap-2 md:flex-row md:items-center md:justify-between"><div><h2 className="text-xl font-bold text-slate-900">Business i Oversikt</h2><p className="mt-1 text-sm text-slate-500">Tall fra Business-modulen vises når det finnes avtaler, aftersales eller gårdsoperasjoner.</p></div><p className="text-2xl font-bold text-slate-900">{formatMoney(businessStats.total)}</p></div><div className="grid grid-cols-1 gap-3 md:grid-cols-4"><MetricCard title="Provisjon pipeline" value={formatMoney(businessStats.dealPipeline)} hint={`${realEstateDeals.length} avtaler`} symbol={<BriefcaseBusiness className="h-5 w-5" />} /><MetricCard title="Ventende provisjon" value={formatMoney(businessStats.pendingDealCommissions)} symbol={<TrendingUp className="h-5 w-5" />} /><MetricCard title="AfterSale" value={formatMoney(businessStats.afterSaleRevenue)} hint={`${afterSales.length} poster`} symbol={<ArrowUpRight className="h-5 w-5" />} /><MetricCard title="Dona Anna netto" value={formatMoney(businessStats.farmNet)} hint={`${farmOps.length} føringer`} symbol={<Home className="h-5 w-5" />} /></div></section>}
    {economy && economy.rows.length > 0 && <section className="card p-5 md:p-6"><div className="mb-5 flex flex-col gap-2 md:flex-row md:items-center md:justify-between"><div><h2 className="text-xl font-bold text-slate-900">Konsolidert familieøkonomi</h2><p className="mt-1 text-sm text-slate-500">Hittil i år fra delt økonomiview hvis tilgjengelig.</p></div><p className="text-2xl font-bold text-slate-900">{formatMoney(economy.ytd.totalNet)}</p></div><div className="grid grid-cols-1 gap-3 md:grid-cols-3"><MetricCard title="Dona Anna" value={formatMoney(economy.ytd.oliviaNet)} symbol="D" /><MetricCard title="RealtyFlow" value={formatMoney(economy.ytd.realtyflowNet)} symbol="R" /><MetricCard title="Mondeo rente" value={formatMoney(economy.ytd.mondeoInterest)} symbol="M" /></div></section>}
    {(aiTip || aiLoading) && <section className="card p-4"><div className="flex items-start gap-3"><div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-slate-700"><Sparkles className="h-4 w-4" /></div><div className="min-w-0 flex-1"><p className="text-sm font-bold text-slate-900">AI-innsikt</p><p className="mt-1 text-sm text-slate-600">{aiLoading ? 'Henter AI-innsikt...' : aiTip}</p></div><button onClick={fetchAiTip} disabled={aiLoading} className="btn-secondary shrink-0"><RefreshCw className={`h-4 w-4 ${aiLoading ? 'animate-spin' : ''}`} /></button></div></section>}
    <section className="grid grid-cols-1 gap-6 xl:grid-cols-3"><div className="space-y-6 xl:col-span-2"><div className="card p-5 md:p-6"><h2 className="mb-5 text-xl font-bold text-slate-900">Inntekt og utgifter</h2>{transactions.length === 0 ? <EmptyState text="Ingen transaksjoner registrert ennå." /> : <div className="h-[240px]"><ResponsiveContainer width="100%" height="100%"><AreaChart data={monthlyChart} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}><CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} /><XAxis dataKey="name" stroke="#64748B" fontSize={12} axisLine={false} tickLine={false} /><YAxis stroke="#64748B" fontSize={11} axisLine={false} tickLine={false} tickFormatter={value => `${Math.round(Number(value) / 1000)}k`} /><Tooltip formatter={(value: any) => [formatMoney(Number(value)), '']} contentStyle={{ background: 'white', border: '1px solid #E2E8F0', borderRadius: 14 }} /><Area type="monotone" dataKey="Inntekt" stroke="#0F172A" strokeWidth={2} fill="#E2E8F0" dot={false} /><Area type="monotone" dataKey="Utgifter" stroke="#DC2626" strokeWidth={2} fill="#FEE2E2" dot={false} /></AreaChart></ResponsiveContainer></div>}</div><div className="card p-5 md:p-6"><h2 className="mb-5 text-xl font-bold text-slate-900">Utgifter etter kategori denne måneden</h2>{categoryData.length === 0 ? <EmptyState text="Ingen utgifter registrert denne måneden." /> : <div className="space-y-3">{categoryData.map(([category, amount]) => { const percent = stats.expenses > 0 ? Math.round((amount / stats.expenses) * 100) : 0; return <div key={category} className="rounded-2xl border border-slate-200 bg-white p-4"><div className="mb-2 flex items-center justify-between gap-4"><p className="font-semibold text-slate-800">{category}</p><p className="font-bold text-slate-900">{formatMoney(amount)}</p></div><div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-slate-900" style={{ width: `${percent}%` }} /></div></div>; })}</div>}</div></div><aside className="space-y-6"><div className="card p-5"><h2 className="mb-4 flex items-center gap-2 text-lg font-bold text-slate-900"><Calendar className="h-5 w-5" /> I dag</h2>{todayEvents.length === 0 ? <EmptyState text="Ingen hendelser i dag." /> : <div className="space-y-2">{todayEvents.map(event => <div key={event.id} className="rounded-2xl border border-slate-200 bg-white p-3"><p className="font-bold text-slate-900">{event.description}</p><p className="mt-1 text-sm text-slate-500">{getMemberName(event.assignedToId)} · {event.type}</p></div>)}</div>}</div><div className="card p-5"><h2 className="mb-4 flex items-center gap-2 text-lg font-bold text-slate-900"><CheckSquare className="h-5 w-5" /> Oppgaver</h2>{pendingTasks.length === 0 ? <EmptyState text="Ingen ventende oppgaver." /> : <div className="space-y-2">{pendingTasks.map(task => <div key={task.id} className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white p-3"><span className="mt-1 h-2.5 w-2.5 rounded-full" style={{ background: getMemberColor(task.assignedToId) }} /><div><p className="font-bold text-slate-900">{task.description}</p><p className="mt-1 text-sm text-slate-500">{getMemberName(task.assignedToId)} · {task.priority}</p></div></div>)}</div>}</div><div className="card p-5"><h2 className="mb-4 flex items-center gap-2 text-lg font-bold text-slate-900"><ShoppingCart className="h-5 w-5" /> Handleliste</h2><MetricCard title="Gjenstår" value={numberWithText(groceryCount, 'varer')} symbol={<ShoppingCart className="h-5 w-5" />} /></div><div className="card p-5"><h2 className="mb-4 flex items-center gap-2 text-lg font-bold text-slate-900"><Wallet className="h-5 w-5" /> Grunnverdi</h2><p className="text-sm text-slate-500">Bankkontoer + eiendeler + Business-verdi når Business har tall.</p><p className="mt-3 text-2xl font-bold text-slate-900">{formatMoney(stats.netWorthBase)}</p></div></aside></section>
  </div>;
};

function numberWithText(value: number, label: string) { return `${new Intl.NumberFormat('nb-NO').format(Number(value || 0))} ${label}`; }
