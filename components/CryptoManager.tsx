import React, { useEffect, useMemo, useState } from 'react';
import { Bitcoin, Coins, Plus, RefreshCw, Trash2, TrendingUp, TrendingDown } from 'lucide-react';
import { CryptoAsset } from '../types';
import { isSupabaseConfigured, supabase } from '../supabase';
import { fetchCryptoPrices, SUPPORTED_SYMBOLS } from '../services/coinGeckoService';

interface Props { userId?: string; }

const formatNOK = (v: number) => new Intl.NumberFormat('nb-NO', { style: 'currency', currency: 'NOK', maximumFractionDigits: 0 }).format(Number(v || 0));
const formatEUR = (v: number) => new Intl.NumberFormat('nb-NO', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(Number(v || 0));

export const CryptoManager: React.FC<Props> = ({ userId }) => {
  const [assets, setAssets] = useState<CryptoAsset[]>([]);
  const [prices, setPrices] = useState<Record<string, { usd: number; eur: number; nok: number }>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [symbol, setSymbol] = useState('BTC');
  const [amount, setAmount] = useState('');
  const [averageBuyPrice, setAverageBuyPrice] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) { setLoading(false); return; }
    (async () => {
      let loaded = false;
      try {
        if (isSupabaseConfigured()) {
          const { data, error } = await supabase.from('crypto_assets').select('*').eq('user_id', userId);
          if (!error && data) {
            setAssets(data.map((r: any) => ({ id: r.id, symbol: r.symbol, amount: Number(r.amount), averageBuyPrice: Number(r.average_buy_price) })));
            loaded = true;
          } else if (error) {
            console.warn('[Crypto] tabell ikke tilgjengelig:', error.message);
          }
        }
      } catch (e) { console.warn('[Crypto] fetch feil:', e); }
      if (!loaded) {
        try {
          const local = localStorage.getItem(`crypto_assets_${userId}`);
          if (local) setAssets(JSON.parse(local));
        } catch {}
      }
      setLoading(false);
    })();
  }, [userId]);

  // Hent priser når assets endres
  const refreshPrices = async () => {
    if (assets.length === 0) return;
    setRefreshing(true);
    try {
      const p = await fetchCryptoPrices(assets.map(a => a.symbol));
      setPrices(p);
    } finally { setRefreshing(false); }
  };
  useEffect(() => { refreshPrices(); /* eslint-disable-next-line */ }, [assets.length]);

  const persistAssets = async (next: CryptoAsset[]) => {
    setAssets(next);
    if (!userId) return;
    try { localStorage.setItem(`crypto_assets_${userId}`, JSON.stringify(next)); } catch {}
    if (isSupabaseConfigured()) {
      try {
        await supabase.from('crypto_assets').upsert(next.map(a => ({ id: a.id, user_id: userId, symbol: a.symbol, amount: a.amount, average_buy_price: a.averageBuyPrice })));
      } catch {}
    }
  };

  const addAsset = async () => {
    const amt = Number(amount || 0);
    const avg = Number(averageBuyPrice || 0);
    if (!symbol || amt <= 0 || avg <= 0) { setError('Velg symbol og fyll inn beholdning + snittpris.'); return; }
    setError(null);
    const newAsset: CryptoAsset = {
      id: `crypto-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      symbol: symbol.toUpperCase(),
      amount: amt,
      averageBuyPrice: avg,
    };
    await persistAssets([...assets, newAsset]);
    setAmount(''); setAverageBuyPrice('');
  };

  const remove = async (id: string) => {
    if (!confirm('Slette denne posisjonen?')) return;
    if (userId && isSupabaseConfigured()) { try { await supabase.from('crypto_assets').delete().eq('id', id); } catch {} }
    await persistAssets(assets.filter(a => a.id !== id));
  };

  const summary = useMemo(() => {
    let costBasisNOK = 0;
    let currentValueNOK = 0;
    for (const a of assets) {
      const price = prices[a.symbol];
      const currentPriceNOK = price?.nok || 0;
      costBasisNOK += a.amount * a.averageBuyPrice; // Antar averageBuyPrice i NOK
      currentValueNOK += a.amount * currentPriceNOK;
    }
    const pnl = currentValueNOK - costBasisNOK;
    const pnlPct = costBasisNOK > 0 ? (pnl / costBasisNOK) * 100 : 0;
    return { costBasisNOK, currentValueNOK, pnl, pnlPct };
  }, [assets, prices]);

  if (loading) return <div className="card p-6 text-center text-slate-500">Laster crypto-portefølje...</div>;

  return (
    <div className="space-y-6">
      <div className="card p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-100 text-amber-700"><Bitcoin className="h-5 w-5" /></div>
            <div><h2 className="text-xl font-bold text-slate-900">Crypto-portefølje</h2><p className="text-sm text-slate-500">Live priser fra CoinGecko. Snittpris i NOK.</p></div>
          </div>
          <button onClick={refreshPrices} disabled={refreshing || assets.length === 0} className="btn-secondary"><RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} /> Oppdater priser</button>
        </div>

        {error && <div className="mb-3 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

        <div className="grid grid-cols-1 gap-3 md:grid-cols-5 mb-4">
          <select value={symbol} onChange={e => setSymbol(e.target.value)}>
            {SUPPORTED_SYMBOLS.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <input type="number" step="0.0001" value={amount} onChange={e => setAmount(e.target.value)} placeholder="Beholdning (f.eks. 0.5 BTC)" className="md:col-span-2" />
          <input type="number" value={averageBuyPrice} onChange={e => setAverageBuyPrice(e.target.value)} placeholder="Snittpris NOK/enhet" />
          <button onClick={addAsset} className="btn-primary"><Plus className="h-4 w-4" /> Legg til</button>
        </div>
      </div>

      {assets.length > 0 && (
        <>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            <div className="card p-4"><p className="text-xs text-slate-500 uppercase font-black tracking-wide">Kjøpsverdi</p><p className="mt-1 text-2xl font-black text-slate-900">{formatNOK(summary.costBasisNOK)}</p></div>
            <div className="card p-4"><p className="text-xs text-slate-500 uppercase font-black tracking-wide">Nåverdi</p><p className="mt-1 text-2xl font-black text-slate-900">{formatNOK(summary.currentValueNOK)}</p></div>
            <div className={`card p-4 ${summary.pnl >= 0 ? 'border-emerald-200' : 'border-rose-200'}`}>
              <p className="text-xs text-slate-500 uppercase font-black tracking-wide">Urealisert P/L</p>
              <p className={`mt-1 text-2xl font-black ${summary.pnl >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>{summary.pnl >= 0 ? '+' : ''}{formatNOK(summary.pnl)}</p>
            </div>
            <div className={`card p-4 ${summary.pnl >= 0 ? 'border-emerald-200' : 'border-rose-200'}`}>
              <p className="text-xs text-slate-500 uppercase font-black tracking-wide">%</p>
              <p className={`mt-1 text-2xl font-black ${summary.pnl >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                {summary.pnl >= 0 ? <TrendingUp className="inline h-5 w-5" /> : <TrendingDown className="inline h-5 w-5" />} {summary.pnlPct.toFixed(1)} %
              </p>
            </div>
          </div>

          <div className="card overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3 text-left">Symbol</th>
                  <th className="px-4 py-3 text-right">Beholdning</th>
                  <th className="px-4 py-3 text-right">Snittpris NOK</th>
                  <th className="px-4 py-3 text-right">Nåværende NOK</th>
                  <th className="px-4 py-3 text-right">Kjøpsverdi</th>
                  <th className="px-4 py-3 text-right">Nåverdi</th>
                  <th className="px-4 py-3 text-right">P/L</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {assets.map(a => {
                  const p = prices[a.symbol];
                  const currentPriceNOK = p?.nok || 0;
                  const currentPriceEUR = p?.eur || 0;
                  const costBasis = a.amount * a.averageBuyPrice;
                  const currentValue = a.amount * currentPriceNOK;
                  const pnl = currentValue - costBasis;
                  const pnlPct = costBasis > 0 ? (pnl / costBasis) * 100 : 0;
                  return (
                    <tr key={a.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-100 text-amber-700 text-xs font-black">{a.symbol.slice(0, 3)}</div>
                          <span className="font-bold">{a.symbol}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right font-mono">{a.amount.toLocaleString('nb-NO', { maximumFractionDigits: 8 })}</td>
                      <td className="px-4 py-3 text-right font-mono">{formatNOK(a.averageBuyPrice)}</td>
                      <td className="px-4 py-3 text-right font-mono">
                        <div>{formatNOK(currentPriceNOK)}</div>
                        <div className="text-[10px] text-slate-500">{formatEUR(currentPriceEUR)}</div>
                      </td>
                      <td className="px-4 py-3 text-right font-mono">{formatNOK(costBasis)}</td>
                      <td className="px-4 py-3 text-right font-mono font-bold">{formatNOK(currentValue)}</td>
                      <td className={`px-4 py-3 text-right font-mono font-bold ${pnl >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                        <div>{pnl >= 0 ? '+' : ''}{formatNOK(pnl)}</div>
                        <div className="text-[10px]">{pnl >= 0 ? '+' : ''}{pnlPct.toFixed(1)} %</div>
                      </td>
                      <td className="px-4 py-3 text-right"><button onClick={() => remove(a.id)} className="text-slate-400 hover:text-rose-600"><Trash2 className="h-4 w-4" /></button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {assets.length === 0 && (
        <div className="card p-8 text-center">
          <Coins className="mx-auto h-12 w-12 text-slate-300" />
          <p className="mt-3 font-bold text-slate-700">Ingen crypto-posisjoner ennå</p>
          <p className="mt-1 text-sm text-slate-500">Legg til første posisjon over — priser hentes live fra CoinGecko.</p>
        </div>
      )}
    </div>
  );
};
