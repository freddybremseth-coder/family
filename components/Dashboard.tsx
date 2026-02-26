
import React, { useMemo, useState, useEffect } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar, Cell, Legend
} from 'recharts';
import {
  Transaction, TransactionType, BankAccount, Asset, Language,
  FamilyMember, Task, CalendarEvent
} from '../types';
import {
  TrendingUp, TrendingDown, Wallet, Calendar, ShoppingCart,
  CheckSquare, RefreshCw, BrainCircuit, AlertTriangle,
  CheckCircle2, Clock, ArrowUpRight, ArrowDownRight,
  Sparkles, Heart
} from 'lucide-react';
import { EXCHANGE_RATE_EUR_TO_NOK, MEMBER_COLORS } from '../constants';
import { getFinancialStatusInsight } from '../services/geminiService';
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
}

const convertToPreferred = (amount: number, currency: string, preferred: string) => {
  if (preferred === 'NOK' && currency === 'EUR') return amount * EXCHANGE_RATE_EUR_TO_NOK;
  if (preferred === 'EUR' && currency === 'NOK') return amount / EXCHANGE_RATE_EUR_TO_NOK;
  return amount;
};

const formatMoney = (amount: number, currency: string) => {
  const sym = currency === 'NOK' ? 'kr' : '€';
  return `${sym} ${Math.round(amount).toLocaleString('no-NO')}`;
};

const getGreeting = (lang: Language) => {
  const t = translations[lang];
  const h = new Date().getHours();
  if (h < 12) return t.good_morning;
  if (h < 18) return t.good_afternoon;
  return t.good_evening;
};

const BUDGET_CATEGORIES = ['Mat', 'Bolig', 'Transport', 'Diverse'] as const;
const BUDGETS: Record<string, number> = { Mat: 8000, Bolig: 15000, Transport: 3000, Diverse: 5000 };

export const Dashboard: React.FC<Props> = ({
  transactions,
  bankAccounts = [],
  assets = [],
  familyMembers = [],
  tasks = [],
  calendarEvents = [],
  groceryCount = 0,
  lang,
}) => {
  const t = translations[lang];
  const currency = 'NOK';

  const [aiTip, setAiTip] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  // Stats
  const stats = useMemo(() => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    const monthlyTx = transactions.filter(tx => {
      const d = new Date(tx.date);
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    });

    const income = monthlyTx
      .filter(tx => tx.type === TransactionType.INCOME)
      .reduce((acc, tx) => acc + convertToPreferred(tx.amount, tx.currency, currency), 0);

    const expenses = monthlyTx
      .filter(tx => tx.type === TransactionType.EXPENSE)
      .reduce((acc, tx) => acc + convertToPreferred(tx.amount, tx.currency, currency), 0);

    const bankBalance = bankAccounts.reduce(
      (acc, a) => acc + convertToPreferred(a.balance, a.currency, currency), 0
    );
    const assetValue = assets.reduce(
      (acc, a) => acc + convertToPreferred(a.currentValue, a.currency, currency), 0
    );

    return { income, expenses, balance: income - expenses, bankBalance, assetValue };
  }, [transactions, bankAccounts, assets]);

  // Budget data for chart
  const budgetData = useMemo(() => {
    const now = new Date();
    const actuals: Record<string, number> = {};

    transactions
      .filter(tx => {
        const d = new Date(tx.date);
        return tx.type === TransactionType.EXPENSE &&
          d.getMonth() === now.getMonth() &&
          d.getFullYear() === now.getFullYear();
      })
      .forEach(tx => {
        const cat = BUDGET_CATEGORIES.includes(tx.category as any) ? tx.category : 'Diverse';
        actuals[cat] = (actuals[cat] || 0) + convertToPreferred(tx.amount, tx.currency, currency);
      });

    return BUDGET_CATEGORIES.map(cat => ({
      name: cat,
      Budsjett: BUDGETS[cat],
      Faktisk: Math.round(actuals[cat] || 0),
      over: (actuals[cat] || 0) > BUDGETS[cat],
    }));
  }, [transactions]);

  // Recent 6 months chart
  const monthlyChart = useMemo(() => {
    const months: { name: string; Inntekt: number; Utgifter: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const m = d.getMonth();
      const y = d.getFullYear();
      const label = d.toLocaleString(lang === 'no' ? 'no-NO' : 'en-US', { month: 'short' });
      const mTx = transactions.filter(tx => {
        const td = new Date(tx.date);
        return td.getMonth() === m && td.getFullYear() === y;
      });
      months.push({
        name: label,
        Inntekt: Math.round(mTx.filter(t => t.type === TransactionType.INCOME).reduce((a, t) => a + convertToPreferred(t.amount, t.currency, currency), 0)),
        Utgifter: Math.round(mTx.filter(t => t.type === TransactionType.EXPENSE).reduce((a, t) => a + convertToPreferred(t.amount, t.currency, currency), 0)),
      });
    }
    return months;
  }, [transactions, lang]);

  // Today's events & pending tasks
  const todayStr = new Date().toISOString().split('T')[0];
  const todayEvents = calendarEvents.filter(e => e.date === todayStr);
  const pendingTasks = tasks.filter(t => !t.isComplete).slice(0, 5);

  const fetchAiTip = async () => {
    setAiLoading(true);
    try {
      const result = await getFinancialStatusInsight(stats, assets);
      setAiTip(result?.message || null);
    } catch {
      // silent fail
    } finally {
      setAiLoading(false);
    }
  };

  useEffect(() => {
    fetchAiTip();
  }, [stats.bankBalance]);

  const getMemberName = (id: string) =>
    familyMembers.find(m => m.id === id)?.name || '—';

  const getMemberColor = (id: string) => {
    const idx = familyMembers.findIndex(m => m.id === id);
    return MEMBER_COLORS[idx % MEMBER_COLORS.length] || '#4F46E5';
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* GREETING HEADER */}
      <div className="bg-gradient-to-r from-indigo-600 to-violet-600 rounded-2xl p-6 text-white">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-indigo-200 text-sm font-medium mb-1">
              {new Date().toLocaleDateString(lang === 'no' ? 'no-NO' : 'en-US', { weekday: 'long', day: 'numeric', month: 'long' })}
            </p>
            <h1 className="text-2xl font-bold mb-1">{getGreeting(lang)}! 👋</h1>
            <p className="text-indigo-200 text-sm">Her er familiens oversikt for i dag</p>
          </div>
          <div className="flex -space-x-2">
            {familyMembers.slice(0, 4).map((m, i) => (
              <div
                key={m.id}
                className="w-9 h-9 rounded-full border-2 border-white flex items-center justify-center text-xs font-bold text-white shadow"
                style={{ background: MEMBER_COLORS[i % MEMBER_COLORS.length] }}
                title={m.name}
              >
                {m.name.charAt(0).toUpperCase()}
              </div>
            ))}
            {familyMembers.length === 0 && (
              <div className="flex items-center gap-1.5 text-indigo-200 text-sm">
                <Heart className="w-4 h-4" />
                <span>Familie</span>
              </div>
            )}
          </div>
        </div>

        {/* Quick stats row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-6">
          {[
            { label: 'Hendelser i dag', value: todayEvents.length.toString(), icon: <Calendar className="w-4 h-4" /> },
            { label: 'Ventende oppgaver', value: pendingTasks.length.toString(), icon: <CheckSquare className="w-4 h-4" /> },
            { label: 'Handlevarer', value: groceryCount.toString(), icon: <ShoppingCart className="w-4 h-4" /> },
            { label: 'Banksaldo', value: formatMoney(stats.bankBalance, currency), icon: <Wallet className="w-4 h-4" /> },
          ].map((s, i) => (
            <div key={i} className="bg-white/15 rounded-xl p-3 backdrop-blur-sm">
              <div className="flex items-center gap-1.5 text-indigo-200 text-xs mb-1">
                {s.icon}
                <span>{s.label}</span>
              </div>
              <p className="text-white font-bold text-lg leading-none">{s.value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* AI TIP */}
      {(aiTip || aiLoading) && (
        <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-3">
          <div className="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center shrink-0">
            <Sparkles className="w-4 h-4 text-amber-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-amber-700 mb-0.5">{t.ai_tip}</p>
            <p className={`text-sm text-amber-900 leading-relaxed ${aiLoading ? 'animate-pulse-soft' : ''}`}>
              {aiLoading ? 'Henter AI-innsikt...' : aiTip}
            </p>
          </div>
          <button onClick={fetchAiTip} disabled={aiLoading} className="p-1.5 hover:bg-amber-100 rounded-lg transition-colors shrink-0">
            <RefreshCw className={`w-4 h-4 text-amber-600 ${aiLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      )}

      {/* MAIN GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Left: Finance stats + chart */}
        <div className="lg:col-span-2 space-y-6">

          {/* Finance cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="stat-card">
              <div className="stat-icon bg-emerald-100">
                <ArrowUpRight className="w-5 h-5 text-emerald-600" />
              </div>
              <p className="stat-label text-slate-500">{t.total_income}</p>
              <p className="stat-value text-emerald-600">{formatMoney(stats.income, currency)}</p>
              <p className="text-xs text-slate-400 mt-1">{t.this_month}</p>
            </div>
            <div className="stat-card">
              <div className="stat-icon bg-rose-100">
                <ArrowDownRight className="w-5 h-5 text-rose-600" />
              </div>
              <p className="stat-label text-slate-500">{t.total_expenses}</p>
              <p className="stat-value text-rose-600">{formatMoney(stats.expenses, currency)}</p>
              <p className="text-xs text-slate-400 mt-1">{t.this_month}</p>
            </div>
            <div className="stat-card">
              <div className={`stat-icon ${stats.balance >= 0 ? 'bg-indigo-100' : 'bg-amber-100'}`}>
                {stats.balance >= 0
                  ? <TrendingUp className="w-5 h-5 text-indigo-600" />
                  : <TrendingDown className="w-5 h-5 text-amber-600" />}
              </div>
              <p className="stat-label text-slate-500">{t.monthly_ops}</p>
              <p className={`stat-value ${stats.balance >= 0 ? 'text-indigo-600' : 'text-amber-600'}`}>
                {formatMoney(stats.balance, currency)}
              </p>
              <p className="text-xs text-slate-400 mt-1">{t.this_month}</p>
            </div>
          </div>

          {/* Area chart – last 6 months */}
          <div className="card p-6">
            <h3 className="section-title mb-6">
              <TrendingUp className="w-5 h-5 text-indigo-500" />
              Inntekt vs. utgifter – siste 6 måneder
            </h3>
            <div className="h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={monthlyChart} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="incomeGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10B981" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="expGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#EF4444" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="#EF4444" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                  <XAxis dataKey="name" stroke="#94A3B8" fontSize={12} axisLine={false} tickLine={false} />
                  <YAxis stroke="#94A3B8" fontSize={11} axisLine={false} tickLine={false} tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
                  <Tooltip
                    contentStyle={{ background: 'white', border: '1px solid #E2E8F0', borderRadius: '10px', boxShadow: '0 4px 24px rgba(0,0,0,0.1)', fontSize: '13px' }}
                    formatter={(v: any) => [formatMoney(v, currency), '']}
                  />
                  <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '8px' }} />
                  <Area type="monotone" dataKey="Inntekt" stroke="#10B981" strokeWidth={2} fill="url(#incomeGrad)" dot={false} />
                  <Area type="monotone" dataKey="Utgifter" stroke="#EF4444" strokeWidth={2} fill="url(#expGrad)" dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Budget this month */}
          <div className="card p-6">
            <h3 className="section-title mb-6">
              <Wallet className="w-5 h-5 text-indigo-500" />
              {t.budget_control} – {t.this_month}
            </h3>
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={budgetData} barGap={4} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                  <XAxis dataKey="name" stroke="#94A3B8" fontSize={12} axisLine={false} tickLine={false} />
                  <YAxis stroke="#94A3B8" fontSize={11} axisLine={false} tickLine={false} tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
                  <Tooltip
                    contentStyle={{ background: 'white', border: '1px solid #E2E8F0', borderRadius: '10px', fontSize: '13px' }}
                    formatter={(v: any) => [formatMoney(v, currency), '']}
                  />
                  <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '8px' }} />
                  <Bar dataKey="Budsjett" fill="#E2E8F0" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Faktisk" radius={[4, 4, 0, 0]}>
                    {budgetData.map((entry, i) => (
                      <Cell key={i} fill={entry.over ? '#EF4444' : '#10B981'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Over-budget warnings */}
            {budgetData.some(b => b.over) && (
              <div className="mt-4 p-3 bg-red-50 border border-red-100 rounded-xl flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-red-700">{t.warnings}</p>
                  <p className="text-xs text-red-600 mt-0.5">
                    {budgetData.filter(b => b.over).map(b => b.name).join(', ')} er over budsjett denne måneden.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right sidebar */}
        <div className="space-y-6">

          {/* Today's events */}
          <div className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="section-title text-base">
                <Calendar className="w-4 h-4 text-indigo-500" />
                Hendelser i dag
              </h3>
              <span className="badge badge-primary">{t.today}</span>
            </div>

            {todayEvents.length === 0 ? (
              <div className="empty-state py-8">
                <Calendar className="w-8 h-8 text-slate-300 mb-2" />
                <p className="text-sm text-slate-400">{t.no_events_today}</p>
              </div>
            ) : (
              <div className="space-y-3">
                {todayEvents.map(event => (
                  <div key={event.id} className="flex items-start gap-3 p-3 bg-slate-50 rounded-xl">
                    <div
                      className="w-2 h-2 rounded-full mt-1.5 shrink-0"
                      style={{ background: getMemberColor(event.assignedToId) }}
                    />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-800 truncate">{event.description}</p>
                      <p className="text-xs text-slate-400 mt-0.5">{getMemberName(event.assignedToId)}</p>
                    </div>
                    <span className="badge badge-primary text-xs shrink-0">{event.type}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Pending tasks */}
          <div className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="section-title text-base">
                <CheckSquare className="w-4 h-4 text-indigo-500" />
                Oppgaver
              </h3>
              {pendingTasks.length > 0 && (
                <span className="badge badge-warning">{pendingTasks.length} igjen</span>
              )}
            </div>

            {pendingTasks.length === 0 ? (
              <div className="empty-state py-8">
                <CheckCircle2 className="w-8 h-8 text-emerald-300 mb-2" />
                <p className="text-sm text-slate-400">Ingen ventende oppgaver!</p>
              </div>
            ) : (
              <div className="space-y-2">
                {pendingTasks.map(task => {
                  const priorityStyle = task.priority === 'High'
                    ? 'bg-red-100 text-red-700'
                    : task.priority === 'Medium'
                      ? 'bg-amber-100 text-amber-700'
                      : 'bg-slate-100 text-slate-600';
                  return (
                    <div key={task.id} className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
                      <div
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ background: getMemberColor(task.assignedToId) }}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-800 truncate">{task.description}</p>
                        <p className="text-xs text-slate-400">{getMemberName(task.assignedToId)}</p>
                      </div>
                      <span className={`badge text-xs ${priorityStyle}`}>{task.priority}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Budget health mini */}
          <div className="card p-5">
            <h3 className="section-title text-base mb-4">
              <Wallet className="w-4 h-4 text-indigo-500" />
              {t.budget_health}
            </h3>
            <div className="space-y-4">
              {budgetData.map((b, i) => {
                const pct = Math.min((b.Faktisk / b.Budsjett) * 100, 100);
                return (
                  <div key={i}>
                    <div className="flex justify-between text-xs mb-1.5">
                      <span className="font-medium text-slate-700">{b.name}</span>
                      <span className={`font-semibold ${b.over ? 'text-red-600' : 'text-slate-500'}`}>
                        {formatMoney(b.Faktisk, currency)} {t.of} {formatMoney(b.Budsjett, currency)}
                      </span>
                    </div>
                    <div className="progress-bar">
                      <div
                        className="progress-fill"
                        style={{
                          width: `${pct}%`,
                          background: b.over ? '#EF4444' : pct > 80 ? '#F59E0B' : '#10B981',
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Family wealth */}
          {(stats.bankBalance > 0 || stats.assetValue > 0) && (
            <div className="card p-5 bg-gradient-to-br from-indigo-50 to-purple-50 border-indigo-100">
              <h3 className="section-title text-base mb-4">
                <TrendingUp className="w-4 h-4 text-indigo-500" />
                Familiens verdier
              </h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-slate-600">Banksaldo</span>
                  <span className="font-bold text-slate-800">{formatMoney(stats.bankBalance, currency)}</span>
                </div>
                {stats.assetValue > 0 && (
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-slate-600">Eiendeler</span>
                    <span className="font-bold text-slate-800">{formatMoney(stats.assetValue, currency)}</span>
                  </div>
                )}
                <div className="border-t border-indigo-100 pt-3 flex justify-between items-center">
                  <span className="text-sm font-semibold text-slate-700">{t.wealth_value}</span>
                  <span className="font-extrabold text-indigo-700 text-lg">
                    {formatMoney(stats.bankBalance + stats.assetValue, currency)}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
