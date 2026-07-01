import React, { useEffect, useMemo, useState } from 'react';
import { Droplet, MapPin, Plus, Trash2, Package, TrendingUp } from 'lucide-react';
import { InventoryItem } from '../types';
import { isSupabaseConfigured, supabase } from '../supabase';

interface Props { userId?: string; }

const formatNOK = (v: number) => new Intl.NumberFormat('nb-NO', { style: 'currency', currency: 'NOK', maximumFractionDigits: 0 }).format(Number(v || 0));
const formatEUR = (v: number) => new Intl.NumberFormat('nb-NO', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(Number(v || 0));
const EUR_TO_NOK = 11.55;

const LOCATION_META = {
  Spain:   { label: 'Spania',  color: 'amber',   flag: '🇪🇸' },
  Norway:  { label: 'Norge',   color: 'red',     flag: '🇳🇴' },
  Transit: { label: 'Transitt',color: 'slate',   flag: '🚚' },
} as const;

const UNIT_META = {
  Liters:  { label: 'Liter',   short: 'L' },
  Bottles: { label: 'Flasker', short: 'stk' },
  Pallets: { label: 'Paller',  short: 'pll' },
} as const;

interface OliveInvItem extends InventoryItem {
  pricePerUnitEUR?: number;   // Salgspris pr enhet i EUR (Spania)
  batchLabel?: string;
  harvestYear?: number;
}

export const OliveOilInventory: React.FC<Props> = ({ userId }) => {
  const [items, setItems] = useState<OliveInvItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [productName, setProductName] = useState('Olivenolje Extra Virgin');
  const [quantity, setQuantity] = useState('');
  const [unit, setUnit] = useState<InventoryItem['unit']>('Liters');
  const [location, setLocation] = useState<InventoryItem['location']>('Spain');
  const [pricePerUnitEUR, setPricePerUnitEUR] = useState('');
  const [batchLabel, setBatchLabel] = useState('');
  const [harvestYear, setHarvestYear] = useState<string>(String(new Date().getFullYear()));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) { setLoading(false); return; }
    (async () => {
      let loaded = false;
      try {
        if (isSupabaseConfigured()) {
          const { data, error } = await supabase.from('olive_inventory').select('*').eq('user_id', userId).order('last_updated', { ascending: false });
          if (!error && data) {
            setItems(data.map((r: any) => ({
              id: r.id, productName: r.product_name, quantity: Number(r.quantity),
              unit: r.unit, location: r.location, lastUpdated: r.last_updated,
              pricePerUnitEUR: r.price_per_unit_eur ? Number(r.price_per_unit_eur) : undefined,
              batchLabel: r.batch_label ?? undefined,
              harvestYear: r.harvest_year ? Number(r.harvest_year) : undefined,
            })));
            loaded = true;
          }
        }
      } catch (e) { console.warn('[Olive] fetch feil:', e); }
      if (!loaded) {
        try {
          const local = localStorage.getItem(`olive_inventory_${userId}`);
          if (local) setItems(JSON.parse(local));
        } catch {}
      }
      setLoading(false);
    })();
  }, [userId]);

  const persist = async (next: OliveInvItem[]) => {
    setItems(next);
    if (!userId) return;
    try { localStorage.setItem(`olive_inventory_${userId}`, JSON.stringify(next)); } catch {}
    if (isSupabaseConfigured()) {
      try {
        await supabase.from('olive_inventory').upsert(next.map(i => ({
          id: i.id, user_id: userId, product_name: i.productName, quantity: i.quantity,
          unit: i.unit, location: i.location, last_updated: i.lastUpdated,
          price_per_unit_eur: i.pricePerUnitEUR ?? null,
          batch_label: i.batchLabel ?? null,
          harvest_year: i.harvestYear ?? null,
        })));
      } catch {}
    }
  };

  const add = async () => {
    const q = Number(quantity || 0);
    if (!productName.trim() || q <= 0) { setError('Fyll inn produktnavn og positiv mengde.'); return; }
    setError(null);
    const newItem: OliveInvItem = {
      id: `olive-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      productName: productName.trim(),
      quantity: q,
      unit,
      location,
      lastUpdated: new Date().toISOString(),
      pricePerUnitEUR: pricePerUnitEUR ? Number(pricePerUnitEUR) : undefined,
      batchLabel: batchLabel.trim() || undefined,
      harvestYear: harvestYear ? Number(harvestYear) : undefined,
    };
    await persist([newItem, ...items]);
    setQuantity(''); setPricePerUnitEUR(''); setBatchLabel('');
  };

  const remove = async (id: string) => {
    if (!confirm('Slette denne inventar-linjen?')) return;
    if (userId && isSupabaseConfigured()) { try { await supabase.from('olive_inventory').delete().eq('id', id); } catch {} }
    await persist(items.filter(i => i.id !== id));
  };

  const summary = useMemo(() => {
    const byLocation: Record<string, { qty: number; unit: string; valueEUR: number }> = {};
    let totalValueEUR = 0;
    let totalLiters = 0;
    for (const i of items) {
      const key = i.location;
      if (!byLocation[key]) byLocation[key] = { qty: 0, unit: i.unit, valueEUR: 0 };
      byLocation[key].qty += i.quantity;
      const val = (i.pricePerUnitEUR || 0) * i.quantity;
      byLocation[key].valueEUR += val;
      totalValueEUR += val;
      if (i.unit === 'Liters') totalLiters += i.quantity;
    }
    return { byLocation, totalValueEUR, totalLiters };
  }, [items]);

  if (loading) return <div className="card p-6 text-center text-slate-500">Laster inventar...</div>;

  return (
    <div className="space-y-6">
      <div className="card p-5">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-100 text-amber-700"><Droplet className="h-5 w-5" /></div>
          <div><h2 className="text-xl font-bold text-slate-900">Olivenolje-inventar — Dona Anna</h2><p className="text-sm text-slate-500">Batch, lokasjon og salgsverdi. NOK-verdi bruker kurs 11,55 EUR→NOK.</p></div>
        </div>

        {error && <div className="mb-3 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

        <div className="grid grid-cols-1 gap-3 md:grid-cols-7">
          <input value={productName} onChange={e => setProductName(e.target.value)} placeholder="Produkt" className="md:col-span-2" />
          <input type="number" step="0.01" value={quantity} onChange={e => setQuantity(e.target.value)} placeholder="Mengde" />
          <select value={unit} onChange={e => setUnit(e.target.value as InventoryItem['unit'])}>
            <option value="Liters">Liter</option>
            <option value="Bottles">Flasker</option>
            <option value="Pallets">Paller</option>
          </select>
          <select value={location} onChange={e => setLocation(e.target.value as InventoryItem['location'])}>
            <option value="Spain">🇪🇸 Spania</option>
            <option value="Norway">🇳🇴 Norge</option>
            <option value="Transit">🚚 Transitt</option>
          </select>
          <input type="number" step="0.01" value={pricePerUnitEUR} onChange={e => setPricePerUnitEUR(e.target.value)} placeholder="Pris €/enhet" />
          <button onClick={add} className="btn-primary"><Plus className="h-4 w-4" /> Legg til</button>
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3 mt-3">
          <input value={batchLabel} onChange={e => setBatchLabel(e.target.value)} placeholder="Batch/lot (valgfritt)" />
          <input type="number" value={harvestYear} onChange={e => setHarvestYear(e.target.value)} placeholder="Årgang" />
        </div>
      </div>

      {items.length > 0 && (
        <>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            <div className="card p-4">
              <p className="text-xs text-slate-500 uppercase font-black tracking-wide">Total mengde (liter)</p>
              <p className="mt-1 text-2xl font-black text-slate-900">{summary.totalLiters.toLocaleString('nb-NO')} L</p>
            </div>
            <div className="card p-4">
              <p className="text-xs text-slate-500 uppercase font-black tracking-wide">Salgsverdi (EUR)</p>
              <p className="mt-1 text-2xl font-black text-slate-900">{formatEUR(summary.totalValueEUR)}</p>
            </div>
            <div className="card p-4">
              <p className="text-xs text-slate-500 uppercase font-black tracking-wide">Salgsverdi (NOK)</p>
              <p className="mt-1 text-2xl font-black text-emerald-700">{formatNOK(summary.totalValueEUR * EUR_TO_NOK)}</p>
            </div>
            <div className="card p-4">
              <p className="text-xs text-slate-500 uppercase font-black tracking-wide">Batcher</p>
              <p className="mt-1 text-2xl font-black text-slate-900">{items.length}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            {Object.entries(summary.byLocation).map(([loc, agg]) => {
              const meta = LOCATION_META[loc as keyof typeof LOCATION_META];
              return (
                <div key={loc} className={`card p-4 border-l-4 border-l-${meta.color}-400`}>
                  <div className="flex items-center gap-2 mb-2">
                    <MapPin className="h-4 w-4" />
                    <p className="text-xs uppercase font-black tracking-wide">{meta.flag} {meta.label}</p>
                  </div>
                  <p className="text-xl font-black text-slate-900">{agg.qty.toLocaleString('nb-NO')} <span className="text-sm font-normal text-slate-500">{UNIT_META[agg.unit as keyof typeof UNIT_META]?.short}</span></p>
                  <p className="text-xs text-slate-500 mt-1">Verdi: {formatEUR(agg.valueEUR)} · {formatNOK(agg.valueEUR * EUR_TO_NOK)}</p>
                </div>
              );
            })}
          </div>

          <div className="card overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3 text-left">Produkt</th>
                  <th className="px-4 py-3 text-left">Batch</th>
                  <th className="px-4 py-3 text-right">Mengde</th>
                  <th className="px-4 py-3 text-left">Lokasjon</th>
                  <th className="px-4 py-3 text-right">Pris €/enh</th>
                  <th className="px-4 py-3 text-right">Verdi €</th>
                  <th className="px-4 py-3 text-right">Verdi NOK</th>
                  <th className="px-4 py-3 text-left">Oppdatert</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map(i => {
                  const locMeta = LOCATION_META[i.location as keyof typeof LOCATION_META];
                  const unitMeta = UNIT_META[i.unit as keyof typeof UNIT_META];
                  const val = (i.pricePerUnitEUR || 0) * i.quantity;
                  return (
                    <tr key={i.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <p className="font-bold">{i.productName}</p>
                        {i.harvestYear && <p className="text-[10px] text-slate-500">Årgang {i.harvestYear}</p>}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-600">{i.batchLabel || '—'}</td>
                      <td className="px-4 py-3 text-right font-mono font-bold">{i.quantity.toLocaleString('nb-NO')} <span className="text-xs text-slate-500">{unitMeta.short}</span></td>
                      <td className="px-4 py-3"><span className={`inline-flex items-center gap-1 rounded-full bg-${locMeta.color}-100 text-${locMeta.color}-800 px-2 py-0.5 text-xs font-bold`}>{locMeta.flag} {locMeta.label}</span></td>
                      <td className="px-4 py-3 text-right font-mono">{i.pricePerUnitEUR ? formatEUR(i.pricePerUnitEUR) : '—'}</td>
                      <td className="px-4 py-3 text-right font-mono">{formatEUR(val)}</td>
                      <td className="px-4 py-3 text-right font-mono font-bold text-emerald-700">{formatNOK(val * EUR_TO_NOK)}</td>
                      <td className="px-4 py-3 text-xs text-slate-500">{new Date(i.lastUpdated).toLocaleDateString('nb-NO')}</td>
                      <td className="px-4 py-3 text-right"><button onClick={() => remove(i.id)} className="text-slate-400 hover:text-rose-600"><Trash2 className="h-4 w-4" /></button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {items.length === 0 && (
        <div className="card p-8 text-center">
          <Package className="mx-auto h-12 w-12 text-slate-300" />
          <p className="mt-3 font-bold text-slate-700">Ingen inventar registrert ennå</p>
          <p className="mt-1 text-sm text-slate-500">Legg til første batch fra Dona Anna over.</p>
        </div>
      )}
    </div>
  );
};
