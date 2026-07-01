import React, { useEffect, useState } from 'react';
import { PiggyBank, TrendingDown, Store, ChevronRight } from 'lucide-react';
import { computeSavingsPotential, SavingsSummary } from '../services/savingsPotentialService';

interface Props { userId?: string; }

const formatEUR = (v: number, cur: string) => new Intl.NumberFormat('nb-NO', { style: 'currency', currency: cur || 'EUR', maximumFractionDigits: 2 }).format(v);

export const SavingsWidget: React.FC<Props> = ({ userId }) => {
  const [data, setData] = useState<SavingsSummary | null>(null);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (!userId) return;
    computeSavingsPotential(userId).then(setData).catch(() => setData(null));
  }, [userId]);

  if (!data || data.items.length === 0) return null;

  return (
    <div className="card p-5 border-l-4 border-l-emerald-500">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0 flex-1">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700 shrink-0"><PiggyBank className="h-5 w-5" /></div>
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-slate-900">Sparepotensial pr måned</h2>
            <p className="text-xs text-slate-500">Ved å alltid velge billigste butikk du har handlet i</p>
            <div className="mt-3 flex items-baseline gap-3">
              <span className="text-3xl font-black text-emerald-700">{formatEUR(data.totalMonthlySavings, data.currency)}</span>
              <span className="text-xs text-slate-500">{data.items.length} vare{data.items.length === 1 ? '' : 'r'} med prisspredning</span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Nåværende {formatEUR(data.totalMonthlyCurrent, data.currency)}/mnd → billigst {formatEUR(data.totalMonthlyCheapest, data.currency)}/mnd
            </p>
          </div>
        </div>
        <button onClick={() => setExpanded(!expanded)} className="rounded-xl p-1.5 hover:bg-slate-100 text-slate-500 text-sm">
          <ChevronRight className={`h-4 w-4 transition-transform ${expanded ? 'rotate-90' : ''}`} />
        </button>
      </div>

      {expanded && (
        <div className="mt-4 space-y-1.5">
          {data.items.slice(0, 10).map((item, i) => (
            <div key={i} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-2.5 text-sm">
              <div className="min-w-0 flex-1">
                <p className="font-bold text-slate-900 truncate">{item.name}</p>
                <p className="text-[11px] text-slate-500">
                  <Store className="inline h-2.5 w-2.5" /> {item.currentVendor}: {formatEUR(item.currentPrice, item.currency)}
                  {' → '}
                  <span className="text-emerald-700 font-bold">{item.cheapestVendor}: {formatEUR(item.cheapestPrice, item.currency)}</span>
                  {' · '}{item.monthlyBuys.toFixed(1)}×/mnd
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-sm font-black text-emerald-700 flex items-center gap-1"><TrendingDown className="h-3 w-3" /> {formatEUR(item.monthlySavings, item.currency)}</p>
                <p className="text-[10px] text-slate-500">/mnd</p>
              </div>
            </div>
          ))}
          {data.items.length > 10 && <p className="text-center text-xs text-slate-500">+ {data.items.length - 10} andre varer</p>}
        </div>
      )}
    </div>
  );
};
