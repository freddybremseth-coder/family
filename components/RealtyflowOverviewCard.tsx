import React, { useEffect, useMemo, useState } from 'react';
import { BriefcaseBusiness, RefreshCw, TrendingUp } from 'lucide-react';
import { fetchRealtyflowCommissions, RealtyflowSummary } from '../services/realtyflowService';

function formatMoney(amount: number) {
  return new Intl.NumberFormat('nb-NO', { style: 'currency', currency: 'NOK', maximumFractionDigits: 0 }).format(Number.isFinite(amount) ? amount : 0);
}

export const RealtyflowOverviewCard: React.FC = () => {
  const [summary, setSummary] = useState<RealtyflowSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const next = await fetchRealtyflowCommissions();
      setSummary(next);
    } catch (err: any) {
      setError(err?.message || 'Kunne ikke hente RealtyFlow-tall.');
      setSummary(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const visibleBrands = useMemo(() => (summary?.brands || []).filter((brand) => Math.abs(brand.totalNok || 0) > 0 || brand.count > 0), [summary]);
  const total = summary?.totalNok || 0;

  if (!loading && !error && (!summary || (visibleBrands.length === 0 && total === 0))) return null;

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
      <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-bold text-slate-700">
            <BriefcaseBusiness className="h-3.5 w-3.5" /> RealtyFlow
          </div>
          <h2 className="text-xl font-bold text-slate-900">Salg av hus og kommisjoner</h2>
          <p className="mt-1 text-sm text-slate-500">Eksterne tall fra RealtyFlow vises her i Oversikt.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-right">
            <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Totalt</p>
            <p className="text-2xl font-extrabold text-slate-900">{loading ? 'Henter…' : formatMoney(total)}</p>
          </div>
          <button onClick={load} disabled={loading} className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-50" title="Oppdater RealtyFlow-tall">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {error ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">{error}</div>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          {visibleBrands.map((brand) => (
            <div key={brand.key} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="mb-2 flex items-center justify-between gap-3">
                <p className="font-bold text-slate-900">{brand.brand}</p>
                <TrendingUp className="h-4 w-4 text-slate-500" />
              </div>
              <p className="text-2xl font-extrabold text-slate-900">{formatMoney(brand.totalNok)}</p>
              <p className="mt-1 text-xs text-slate-500">{brand.count} rad{brand.count === 1 ? '' : 'er'} · EUR/NOK {summary?.fxRate?.toFixed(4) || '–'}</p>
            </div>
          ))}
          {visibleBrands.length === 0 && loading && (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500 md:col-span-3">Henter RealtyFlow-tall…</div>
          )}
        </div>
      )}
    </section>
  );
};
