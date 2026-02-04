
import React, { useMemo, useState, useEffect } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, BarChart, Bar, Cell } from 'recharts';
import { Transaction, TransactionType, RealEstateDeal, AfterSaleCommission, FarmOperation, BankAccount, Asset, CommissionPayoutStatus, Language } from '../types';
import { TrendingUp, TrendingDown, Clock, Wallet, ArrowLeft, Briefcase, Sprout, Banknote, BarChart3, ShieldAlert, Home, Globe, Zap, Percent, Calendar, TrendingUp as TrendIcon, BrainCircuit, RefreshCw, Scale, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { EXCHANGE_RATE_EUR_TO_NOK } from '../constants';
import { getFinancialStatusInsight } from '../services/geminiService';
import { translations } from '../translations';

interface Props {
  transactions: Transaction[];
  realEstateDeals?: RealEstateDeal[];
  afterSales?: AfterSaleCommission[];
  farmOps?: FarmOperation[];
  bankAccounts?: BankAccount[];
  assets?: Asset[];
  lang: Language;
}

const convertToEur = (amount: number, currency: string) => {
  return currency === 'NOK' ? amount / EXCHANGE_RATE_EUR_TO_NOK : amount;
};

const formatCurrency = (amount: number, currency: string) => {
  const symbol = currency === 'NOK' ? 'kr' : '€';
  return `${symbol} ${amount.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
};

export const Dashboard: React.FC<Props> = ({ 
  transactions, 
  realEstateDeals = [], 
  bankAccounts = [],
  assets = [],
  lang
}) => {
  const [aiStatus, setAiStatus] = useState<{message: string, sentiment: string} | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(false);
  const t = translations[lang];

  const budgetData = useMemo(() => {
    const budgets: Record<string, number> = {
      'Mat': 800,
      'Bolig': 1500,
      'Transport': 300,
      'Diverse': 500,
      'Forretning': 1000
    };

    const actuals: Record<string, number> = {};
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();

    transactions
      .filter(t => {
        const d = new Date(t.date);
        return t.type === TransactionType.EXPENSE && d.getMonth() === currentMonth && d.getFullYear() === currentYear;
      })
      .forEach(t => {
        const cat = budgets[t.category] ? t.category : 'Diverse';
        actuals[cat] = (actuals[cat] || 0) + convertToEur(t.amount, t.currency);
      });

    return Object.keys(budgets).map(cat => ({
      category: cat,
      Budsjett: budgets[cat],
      Faktisk: Math.round(actuals[cat] || 0),
      Status: (actuals[cat] || 0) > budgets[cat] ? 'Over' : 'OK'
    }));
  }, [transactions]);

  const stats = useMemo(() => {
    const totalIncome = transactions
      .filter(t => t.type === TransactionType.INCOME)
      .reduce((acc, t) => acc + convertToEur(t.amount, t.currency), 0);
    
    const totalExpenses = transactions
      .filter(t => t.type === TransactionType.EXPENSE)
      .reduce((acc, t) => acc + convertToEur(t.amount, t.currency), 0);

    const taxLiability = transactions.reduce((acc, t) => acc + (t.taxAmount || 0), 0);
    const bankBalance = bankAccounts.reduce((acc, account) => acc + convertToEur(account.balance, account.currency), 0);
    const netLiquidity = bankBalance - taxLiability;

    const totalBusinessRev = realEstateDeals.reduce((acc, d) => acc + d.ourNetCommission, 0);

    return { 
      monthlyIncomeAvg: totalIncome / 3 || 0,
      monthlyExpenseAvg: totalExpenses / 3 || 0,
      taxLiability,
      netLiquidity,
      bankBalance,
      totalBusinessRev
    };
  }, [transactions, realEstateDeals, bankAccounts]);

  const fetchAIStatus = async () => {
    setLoadingStatus(true);
    try {
      const insight = await getFinancialStatusInsight(stats, assets);
      setAiStatus(insight);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingStatus(false);
    }
  };

  useEffect(() => {
    fetchAIStatus();
  }, [stats.netLiquidity]);

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      {/* AI STATUS TICKER */}
      <div className="glass-panel p-4 border-l-4 border-l-cyan-500 bg-cyan-500/5 relative overflow-hidden group">
        <div className="absolute top-0 right-0 p-2 opacity-10 group-hover:opacity-20 transition-all">
          <BrainCircuit className="w-12 h-12 text-cyan-400" />
        </div>
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className={`w-2 h-2 rounded-full animate-pulse ${
              aiStatus?.sentiment === 'positive' ? 'bg-emerald-500 shadow-[0_0_8px_#10b981]' : 
              aiStatus?.sentiment === 'negative' ? 'bg-rose-500 shadow-[0_0_8px_#f43f5e]' : 
              'bg-cyan-500 shadow-[0_0_8px_#00f3ff]'
            }`} />
            <div className="flex flex-col">
              <span className="text-[9px] font-black uppercase tracking-[0.3em] text-slate-500 mb-0.5">Neural Financial Insight // Status</span>
              <p className={`text-xs font-bold uppercase tracking-tight italic ${loadingStatus ? 'animate-pulse text-slate-400' : 'text-white'}`}>
                {loadingStatus ? '...' : aiStatus?.message || '...'}
              </p>
            </div>
          </div>
          <button onClick={fetchAIStatus} disabled={loadingStatus} className="p-2 border border-white/10 hover:border-cyan-500 text-slate-500 hover:text-cyan-400 transition-all">
            <RefreshCw className={`w-3 h-3 ${loadingStatus ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* OVERSIKTSKORT */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="glass-panel p-6 border-l-4 border-l-cyan-500 bg-cyan-500/5">
            <p className="text-[10px] uppercase text-slate-500 font-black mb-1 tracking-widest">{t.net_liquidity}</p>
            <p className="text-2xl font-black text-white font-mono">{formatCurrency(stats.netLiquidity, 'EUR')}</p>
        </div>
        <div className="glass-panel p-6 border-l-4 border-l-magenta-500 bg-magenta-500/5">
            <p className="text-[10px] uppercase text-slate-500 font-black mb-1 tracking-widest">{t.wealth_value}</p>
            <p className="text-2xl font-black text-white font-mono">{formatCurrency(stats.netLiquidity + assets.reduce((acc, a) => acc + a.currentValue, 0), 'EUR')}</p>
        </div>
        <div className="glass-panel p-6 border-l-4 border-l-yellow-500 bg-yellow-500/5">
            <p className="text-[10px] uppercase text-slate-500 font-black mb-1 tracking-widest">{t.monthly_ops}</p>
            <p className={`text-2xl font-black font-mono ${(stats.monthlyIncomeAvg - stats.monthlyExpenseAvg) >= 0 ? 'text-emerald-400' : 'text-rose-500'}`}>
                {formatCurrency(stats.monthlyIncomeAvg - stats.monthlyExpenseAvg, 'EUR')}
            </p>
        </div>
        <div className="glass-panel p-6 border-l-4 border-l-emerald-500 bg-emerald-500/5">
            <p className="text-[10px] uppercase text-slate-500 font-black mb-1 tracking-widest">{t.business_revenue}</p>
            <p className="text-2xl font-black text-emerald-400 font-mono">{formatCurrency(stats.totalBusinessRev, 'EUR')}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Budsjett vs Faktisk BarChart */}
        <div className="lg:col-span-2 glass-panel p-8 border-l-4 border-l-yellow-500">
           <h3 className="text-xl font-black text-white uppercase tracking-tighter flex items-center gap-3 mb-8">
             <Scale className="text-yellow-400" /> {t.budget_control}
           </h3>
           <div className="h-[300px] w-full">
             <ResponsiveContainer width="100%" height="100%">
               <BarChart data={budgetData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                 <CartesianGrid strokeDasharray="3 3" stroke="#222" vertical={false} />
                 <XAxis dataKey="category" stroke="#555" fontSize={10} axisLine={false} tickLine={false} />
                 <YAxis stroke="#555" fontSize={10} axisLine={false} tickLine={false} />
                 <Tooltip contentStyle={{ backgroundColor: '#050505', border: '1px solid #333', fontSize: '10px' }} />
                 <Legend wrapperStyle={{ fontSize: '10px', textTransform: 'uppercase', paddingTop: '10px' }} />
                 <Bar dataKey="Budsjett" fill="#222" radius={[4, 4, 0, 0]} />
                 <Bar dataKey="Faktisk" radius={[4, 4, 0, 0]}>
                   {budgetData.map((entry, index) => (
                     <Cell key={`cell-${index}`} fill={entry.Faktisk > entry.Budsjett ? '#f43f5e' : '#10b981'} />
                   ))}
                 </Bar>
               </BarChart>
             </ResponsiveContainer>
           </div>
        </div>

        {/* Budget Health Panel */}
        <div className="space-y-6">
          <div className="glass-panel p-6 border-l-4 border-l-emerald-500">
            <h4 className="text-xs font-black text-white uppercase tracking-widest mb-6 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" /> {t.budget_health}
            </h4>
            <div className="space-y-4">
              {budgetData.map((b, i) => (
                <div key={i} className="flex justify-between items-center p-3 bg-white/5 border border-white/5">
                   <div>
                     <p className="text-[10px] font-black text-white uppercase">{b.category}</p>
                     <p className="text-[8px] text-slate-500 font-mono uppercase">Av {b.Budsjett}€</p>
                   </div>
                   <div className="text-right">
                     <p className={`text-sm font-black font-mono ${b.Faktisk > b.Budsjett ? 'text-rose-500' : 'text-emerald-400'}`}>
                       {b.Faktisk}€
                     </p>
                     <p className="text-[8px] text-slate-500 uppercase">{Math.round((b.Faktisk / b.Budsjett) * 100)}% brukt</p>
                   </div>
                </div>
              ))}
            </div>
          </div>

          <div className="glass-panel p-6 border-l-4 border-l-rose-500 bg-rose-500/5">
            <div className="flex items-center gap-3">
              <AlertTriangle className="text-rose-500" />
              <div>
                <p className="text-[10px] uppercase font-black text-rose-500">{t.warnings}</p>
                <p className="text-xs text-white italic">
                  {budgetData.some(b => b.Faktisk > b.Budsjett) 
                    ? `...` 
                    : "..."}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
