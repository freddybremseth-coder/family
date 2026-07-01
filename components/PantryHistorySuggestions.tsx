import React, { useEffect, useState } from 'react';
import { AlertTriangle, Clock, History, Plus, Sparkles, X, Store, TrendingDown, Leaf } from 'lucide-react';
import { suggestFromHistory, ProductSuggestion } from '../services/shoppingHistoryService';
import { searchByName, ProductInfo, scoreColor } from '../services/openFoodFactsService';

interface Props {
  userId?: string;
  onAddItem: (name: string) => void;
}

const REASON_META = {
  overdue:   { label: 'Overtid',      icon: AlertTriangle, color: 'rose' },
  'due-soon': { label: 'Snart tomt',   icon: Clock,         color: 'amber' },
  frequent:  { label: 'Fast innkjøp', icon: History,       color: 'indigo' },
  recent:    { label: 'Nylig kjøpt',  icon: Sparkles,      color: 'slate' },
} as const;

const formatPrice = (v: number, cur: string) =>
  new Intl.NumberFormat('nb-NO', { style: 'currency', currency: cur || 'EUR', maximumFractionDigits: 2 }).format(v);

export const PantryHistorySuggestions: React.FC<Props> = ({ userId, onAddItem }) => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<ProductSuggestion[]>([]);
  const [added, setAdded] = useState<Set<string>>(new Set());
  const [nutriCache, setNutriCache] = useState<Record<string, ProductInfo | null>>({});
  const [nutriLoading, setNutriLoading] = useState<Set<string>>(new Set());

  const lookupNutri = async (key: string, name: string) => {
    if (nutriCache[key] !== undefined) return;
    setNutriLoading(prev => new Set(prev).add(key));
    try {
      const results = await searchByName(name, 1);
      setNutriCache(prev => ({ ...prev, [key]: results[0] || null }));
    } finally {
      setNutriLoading(prev => { const n = new Set(prev); n.delete(key); return n; });
    }
  };

  const load = async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const result = await suggestFromHistory(userId, { limit: 40, daysBack: 120 });
      setSuggestions(result);
    } finally { setLoading(false); }
  };

  useEffect(() => { if (open && userId) load(); /* eslint-disable-next-line */ }, [open, userId]);

  const handleAdd = (s: ProductSuggestion) => {
    onAddItem(s.displayName);
    setAdded(new Set([...added, s.normalizedName]));
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-2xl border border-indigo-200 bg-indigo-50 px-4 py-2.5 text-sm font-bold text-indigo-700 hover:bg-indigo-100"
      >
        <Sparkles className="h-4 w-4" /> Foreslå fra handleshistorikk
      </button>

      {open && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <div className="relative w-full max-w-3xl max-h-[85vh] rounded-3xl bg-white shadow-2xl flex flex-col">
            <div className="flex items-center justify-between p-5 border-b border-slate-200">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-indigo-100 text-indigo-700"><History className="h-5 w-5" /></div>
                <div>
                  <h2 className="text-xl font-bold text-slate-900">Foreslag fra handleshistorikk</h2>
                  <p className="text-sm text-slate-500">Basert på {suggestions.length} varer skannet fra kvitteringer (siste 4 mnd)</p>
                </div>
              </div>
              <button onClick={() => setOpen(false)} className="rounded-xl p-1.5 hover:bg-slate-100"><X className="h-5 w-5" /></button>
            </div>

            <div className="flex-1 overflow-y-auto p-5">
              {loading ? (
                <p className="p-8 text-center text-slate-500">Laster forslag...</p>
              ) : suggestions.length === 0 ? (
                <div className="p-10 text-center">
                  <History className="mx-auto h-12 w-12 text-slate-300" />
                  <p className="mt-3 font-bold text-slate-700">Ingen handelshistorikk ennå</p>
                  <p className="mt-1 text-sm text-slate-500">Skann noen kvitteringer i «Kvitteringer»-fanen, så begynner systemet å lære hva familien pleier å kjøpe.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                  {suggestions.map(s => {
                    const meta = REASON_META[s.suggestReason];
                    const Icon = meta.icon;
                    const isAdded = added.has(s.normalizedName);
                    const vendors = Object.entries(s.vendorPrices).sort((a, b) => a[1].price - b[1].price);
                    const cheapest = vendors[0];
                    const savings = vendors.length > 1 && cheapest && s.lastPrice > cheapest[1].price
                      ? s.lastPrice - cheapest[1].price : 0;
                    const nutri = nutriCache[s.normalizedName];
                    const loadingNutri = nutriLoading.has(s.normalizedName);
                    return (
                      <div key={s.normalizedName} className={`rounded-2xl border p-3 ${isAdded ? 'border-emerald-200 bg-emerald-50' : `border-${meta.color}-200 bg-${meta.color}-50/30`}`}>
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <div className={`flex h-7 w-7 items-center justify-center rounded-lg bg-${meta.color}-100 text-${meta.color}-700 shrink-0`}><Icon className="h-3.5 w-3.5" /></div>
                              <p className="font-bold text-slate-900 truncate">{s.displayName}</p>
                              {nutri?.imageSmallUrl && <img src={nutri.imageSmallUrl} alt="" className="h-6 w-6 rounded object-cover ml-auto" />}
                            </div>
                            <p className="mt-1 text-xs text-slate-600">
                              {s.timesBought}× · Sist for {s.daysSinceLastBuy}d siden
                              {s.averageDaysBetween && ` · pleier hver ${s.averageDaysBetween}d`}
                              {' · '}<span className="font-semibold">{formatPrice(s.lastPrice, s.currency)}</span>
                            </p>
                            <div className="mt-1.5 flex flex-wrap gap-1">
                              <span className={`inline-flex items-center gap-1 rounded-full bg-${meta.color}-100 text-${meta.color}-800 px-2 py-0.5 text-[10px] font-bold uppercase`}>
                                <Icon className="h-2.5 w-2.5" /> {meta.label}
                              </span>
                              {vendors.slice(0, 3).map(([vendor, info], i) => (
                                <span key={vendor} className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${i === 0 && vendors.length > 1 ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-700'}`}>
                                  <Store className="h-2.5 w-2.5" /> {vendor}: {formatPrice(info.price, s.currency)}
                                  {i === 0 && vendors.length > 1 && ' ✓'}
                                </span>
                              ))}
                              {nutri?.nutriScore && (
                                <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-black uppercase text-white" style={{ background: scoreColor(nutri.nutriScore) }}>
                                  <Leaf className="h-2.5 w-2.5" /> Nutri {nutri.nutriScore.toUpperCase()}
                                </span>
                              )}
                            </div>
                            {savings > 0 && (
                              <p className="mt-1 text-[10px] text-emerald-700 font-bold flex items-center gap-1">
                                <TrendingDown className="h-3 w-3" /> Spar {formatPrice(savings, s.currency)} ved å kjøpe i {cheapest[0]}
                              </p>
                            )}
                          </div>
                          <div className="flex flex-col gap-1 shrink-0">
                            <button
                              onClick={() => handleAdd(s)}
                              disabled={isAdded}
                              className={`rounded-xl p-2 ${isAdded ? 'bg-emerald-200 text-emerald-800 cursor-not-allowed' : 'bg-slate-900 text-white hover:bg-slate-700'}`}
                              title={isAdded ? 'Lagt til' : 'Legg til handleliste'}
                            >
                              <Plus className="h-4 w-4" />
                            </button>
                            {!nutri && !loadingNutri && (
                              <button
                                onClick={() => lookupNutri(s.normalizedName, s.displayName)}
                                className="rounded-xl p-2 bg-slate-100 text-slate-600 hover:bg-slate-200"
                                title="Vis matkvalitet (Nutri-Score)"
                              >
                                <Leaf className="h-3.5 w-3.5" />
                              </button>
                            )}
                            {loadingNutri && <div className="rounded-xl p-2 bg-slate-100"><div className="h-3.5 w-3.5 animate-spin border-2 border-slate-400 border-t-transparent rounded-full" /></div>}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="border-t border-slate-200 p-4 flex items-center justify-between text-xs text-slate-500">
              <span>Prissammenligning: <strong>Mercadona</strong> vs <strong>Carrefour</strong> vs <strong>Family Cash</strong> — basert på dine egne kvitteringer.</span>
              <button onClick={() => setOpen(false)} className="btn-secondary text-xs">Lukk</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
