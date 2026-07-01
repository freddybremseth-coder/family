// Ingrediens-inventar: viser hva familien "har" basert på nylige kjøp,
// og hva som ligger i handleliste nå. Match ingredienser fra ukemeny
// mot dette for å se hva som mangler.

import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Package, Refrigerator, ShoppingBag, X } from 'lucide-react';
import { suggestFromHistory, ProductSuggestion } from '../services/shoppingHistoryService';
import { GroceryItem } from '../types';

interface Props {
  userId?: string;
  groceryItems: GroceryItem[];
  onAddItem?: (name: string) => void;
}

const CATEGORY_MAP: Record<string, string> = {
  Meieri: 'Meieri',
  Frukt: 'Frukt/grønt',
  Frugta: 'Frukt/grønt',
  Frukten: 'Frukt/grønt',
  Kolonial: 'Tørrvarer',
  Kjott: 'Kjøtt/fisk',
  Kjøtt: 'Kjøtt/fisk',
  Fisk: 'Kjøtt/fisk',
  Frys: 'Fryser',
  Bakeri: 'Bakeri',
  Drikke: 'Drikke',
};

function normalizeCategory(cat?: string): string {
  if (!cat) return 'Annet';
  const trimmed = cat.trim();
  return CATEGORY_MAP[trimmed] || trimmed;
}

export const PantryTracker: React.FC<Props> = ({ userId, groceryItems, onAddItem }) => {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<ProductSuggestion[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !userId) return;
    setLoading(true);
    suggestFromHistory(userId, { limit: 100, daysBack: 30 })
      .then(setItems).finally(() => setLoading(false));
  }, [open, userId]);

  const groups = useMemo(() => {
    // Grupper på kategori
    const map = new Map<string, { fresh: ProductSuggestion[]; overdue: ProductSuggestion[] }>();
    for (const item of items) {
      const cat = normalizeCategory(item.category);
      if (!map.has(cat)) map.set(cat, { fresh: [], overdue: [] });
      // Nylig kjøpt (<=14 d) = du har det sannsynligvis
      // Ellers = trolig tomt / snart tomt
      if (item.daysSinceLastBuy <= 14 && item.suggestReason !== 'overdue') {
        map.get(cat)!.fresh.push(item);
      } else if (item.suggestReason === 'overdue' || item.daysSinceLastBuy > 21) {
        map.get(cat)!.overdue.push(item);
      }
    }
    return Array.from(map.entries()).sort();
  }, [items]);

  const inList = useMemo(() => {
    const set = new Set(groceryItems.map(g => g.name.toLowerCase().trim()));
    return set;
  }, [groceryItems]);

  const totalFresh = groups.reduce((s, [, g]) => s + g.fresh.length, 0);
  const totalOverdue = groups.reduce((s, [, g]) => s + g.overdue.length, 0);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-2xl border border-cyan-200 bg-cyan-50 px-4 py-2.5 text-sm font-bold text-cyan-700 hover:bg-cyan-100"
      >
        <Refrigerator className="h-4 w-4" /> Kjøleskap & spiskammer
      </button>

      {open && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <div className="relative w-full max-w-4xl max-h-[90vh] rounded-3xl bg-white shadow-2xl flex flex-col">
            <div className="flex items-center justify-between p-5 border-b border-slate-200">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-cyan-100 text-cyan-700"><Refrigerator className="h-5 w-5" /></div>
                <div>
                  <h2 className="text-xl font-bold text-slate-900">Kjøleskap & spiskammer</h2>
                  <p className="text-sm text-slate-500">Estimert basert på hva familien har kjøpt siste 30 dager</p>
                </div>
              </div>
              <button onClick={() => setOpen(false)} className="rounded-xl p-1.5 hover:bg-slate-100"><X className="h-5 w-5" /></button>
            </div>

            <div className="grid grid-cols-3 gap-3 p-4 border-b border-slate-100">
              <div className="rounded-2xl bg-emerald-50 border border-emerald-200 p-3">
                <p className="text-[10px] uppercase font-black text-emerald-800">Sannsynligvis inne</p>
                <p className="mt-1 text-2xl font-black text-emerald-800">{totalFresh}</p>
              </div>
              <div className="rounded-2xl bg-rose-50 border border-rose-200 p-3">
                <p className="text-[10px] uppercase font-black text-rose-800">Trolig tomt</p>
                <p className="mt-1 text-2xl font-black text-rose-800">{totalOverdue}</p>
              </div>
              <div className="rounded-2xl bg-slate-50 border border-slate-200 p-3">
                <p className="text-[10px] uppercase font-black text-slate-700">På handleliste</p>
                <p className="mt-1 text-2xl font-black text-slate-900">{groceryItems.filter(g => !g.isBought).length}</p>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              {loading ? (
                <p className="text-center text-slate-500 py-8">Analyserer handelshistorikk...</p>
              ) : groups.length === 0 ? (
                <div className="text-center py-10">
                  <Package className="mx-auto h-12 w-12 text-slate-300" />
                  <p className="mt-3 font-bold text-slate-700">Ingen data</p>
                  <p className="mt-1 text-sm text-slate-500">Skann noen kvitteringer først.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {groups.map(([cat, group]) => (
                    <div key={cat}>
                      <h3 className="text-xs uppercase font-black text-slate-500 tracking-wider mb-2">{cat}</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {group.fresh.map(item => (
                          <div key={`f-${item.normalizedName}`} className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50/50 p-2">
                            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-semibold text-slate-900 truncate">{item.displayName}</p>
                              <p className="text-[10px] text-slate-500">for {item.daysSinceLastBuy} d siden · {item.lastVendor}</p>
                            </div>
                          </div>
                        ))}
                        {group.overdue.map(item => {
                          const alreadyInList = inList.has(item.displayName.toLowerCase());
                          return (
                            <div key={`o-${item.normalizedName}`} className={`flex items-center gap-2 rounded-xl border ${alreadyInList ? 'border-slate-200 bg-slate-50' : 'border-rose-200 bg-rose-50/50'} p-2`}>
                              <ShoppingBag className={`h-4 w-4 shrink-0 ${alreadyInList ? 'text-slate-500' : 'text-rose-600'}`} />
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-semibold text-slate-900 truncate">{item.displayName}</p>
                                <p className="text-[10px] text-slate-500">
                                  {alreadyInList ? '✓ på handleliste' : `Sist for ${item.daysSinceLastBuy} d siden — trolig tomt`}
                                </p>
                              </div>
                              {!alreadyInList && (
                                <button
                                  onClick={() => onAddItem?.(item.displayName)}
                                  className="shrink-0 rounded-lg bg-slate-900 text-white p-1.5 text-xs hover:bg-slate-700"
                                  title="Legg til handleliste"
                                >
                                  +
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};
