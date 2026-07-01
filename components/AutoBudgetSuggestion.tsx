import React, { useEffect, useState } from 'react';
import { Sparkles, TrendingUp, TrendingDown, Minus, Loader2, Store } from 'lucide-react';
import { Transaction } from '../types';
import { suggestBudget, CategoryBudgetSuggestion } from '../services/spendingBudgetService';

interface Props {
  userId?: string;
  transactions: Transaction[];
}

const formatEUR = (v: number) => new Intl.NumberFormat('nb-NO', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(v);

const VAR_META = {
  low:    { label: 'Stabilt',    icon: Minus,        color: 'emerald' },
  medium: { label: 'Middels',    icon: TrendingUp,   color: 'amber' },
  high:   { label: 'Svingninger', icon: TrendingDown, color: 'rose' },
} as const;

export const AutoBudgetSuggestion: React.FC<Props> = ({ userId, transactions }) => {
  const [suggestions, setSuggestions] = useState<CategoryBudgetSuggestion[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!userId || transactions.length === 0) return;
    setLoading(true);
    suggestBudget(userId, transactions).then(setSuggestions).finally(() => setLoading(false));
  }, [userId, transactions.length]);

  if (loading) return <div className="card p-5 text-center text-slate-500 text-sm">Beregner budsjett-forslag...</div>;
  if (suggestions.length === 0) return null;

  const totalSuggested = suggestions.reduce((s, c) => s + c.suggestedBudget, 0);
  const totalAverage = suggestions.reduce((s, c) => s + c.averageMonthlyEUR, 0);

  return (
    <div className="card p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-indigo-100 text-indigo-700"><Sparkles className="h-5 w-5" /></div>
          <div>
            <h2 className="text-lg font-bold text-slate-900">Foreslått månedsbudsjett</h2>
            <p className="text-xs text-slate-500">Basert på faktiske utgifter siste 6 måneder</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-[10px] uppercase text-slate-500 font-black tracking-wide">Total</p>
          <p className="text-xl font-black text-slate-900">{formatEUR(totalSuggested)}<span className="text-xs text-slate-500 font-normal">/mnd</span></p>
          <p className="text-[10px] text-slate-500">Snitt: {formatEUR(totalAverage)}</p>
        </div>
      </div>

      <div className="space-y-2">
        {suggestions.slice(0, 8).map(s => {
          const meta = VAR_META[s.variability];
          const Icon = meta.icon;
          const overSpent = s.averageMonthlyEUR > s.suggestedBudget * 1.1;
          return (
            <div key={s.category} className={`rounded-2xl border p-3 ${overSpent ? 'border-rose-200 bg-rose-50/40' : 'border-slate-200 bg-white'}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-bold text-slate-900">{s.category}</p>
                    <span className={`inline-flex items-center gap-1 rounded-full bg-${meta.color}-100 text-${meta.color}-800 px-2 py-0.5 text-[10px] font-bold uppercase`}>
                      <Icon className="h-2.5 w-2.5" /> {meta.label}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 mt-1">
                    Snitt: <strong>{formatEUR(s.averageMonthlyEUR)}</strong>
                    {' · '}Median: {formatEUR(s.medianMonthlyEUR)}
                    {' · '}{s.monthsUsed} mnd data
                  </p>
                  {s.topVendors.length > 0 && (
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {s.topVendors.map(v => (
                        <span key={v.vendor} className="inline-flex items-center gap-1 rounded-full bg-slate-100 text-slate-700 px-2 py-0.5 text-[10px] font-medium">
                          <Store className="h-2.5 w-2.5" /> {v.vendor.slice(0, 20)}: {formatEUR(v.total)}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="text-right shrink-0">
                  <p className="text-[10px] uppercase text-slate-500 font-black tracking-wide">Foreslått</p>
                  <p className="text-lg font-black text-slate-900">{formatEUR(s.suggestedBudget)}</p>
                  {overSpent && <p className="text-[10px] text-rose-700 font-bold mt-0.5">Overtrukket snitt</p>}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <p className="mt-3 text-xs text-slate-500">💡 Foreslått = median × 1.1, rundet opp til nærmeste 5€. Median er brukt fordi det er robust mot enkelt-utgifter.</p>
    </div>
  );
};
