import React, { useState } from 'react';
import { ChefHat, Loader2, Plus, RefreshCw, Sparkles, X } from 'lucide-react';
import { generateSmartMenu } from '../services/geminiService';
import { suggestFromHistory } from '../services/shoppingHistoryService';

interface Props {
  userId?: string;
  onAddIngredient?: (name: string) => void;
}

interface MenuDay {
  day: string;
  dish: string;
  reason: string;
  recipe?: {
    fullIngredients?: Array<{ name: string; amount?: string }>;
    instructions?: string[];
  };
}

export const WeeklyMenuFromHistory: React.FC<Props> = ({ userId, onAddIngredient }) => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [menu, setMenu] = useState<MenuDay[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [cravings, setCravings] = useState('spansk-inspirert, familievennlig, ikke for tunge middager');

  const generate = async () => {
    if (!userId) return;
    setLoading(true);
    setError(null);
    try {
      // Hent topp-varer fra handelshistorikk som inventarpekere
      const history = await suggestFromHistory(userId, { limit: 40, daysBack: 90 });
      const inventoryList = history.slice(0, 30).map(h => h.displayName);
      if (inventoryList.length < 3) {
        setError('For lite handelshistorikk. Skann flere kvitteringer først (minst 3-5 kvitteringer med varelinjer).');
        return;
      }
      const result = await generateSmartMenu(inventoryList, cravings);
      if (Array.isArray(result)) setMenu(result);
      else setError('AI klarte ikke å generere meny. Prøv igjen eller sjekk AI-nøkkelen i Innstillinger.');
    } catch (e: any) {
      setError(e?.message?.includes('API') ? 'AI-nøkkel mangler i Innstillinger → AI.' : (e?.message || 'Menygenerering feilet.'));
    } finally { setLoading(false); }
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-2xl border border-purple-200 bg-purple-50 px-4 py-2.5 text-sm font-bold text-purple-700 hover:bg-purple-100"
      >
        <ChefHat className="h-4 w-4" /> Ukemeny fra historikk
      </button>

      {open && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <div className="relative w-full max-w-3xl max-h-[90vh] rounded-3xl bg-white shadow-2xl flex flex-col">
            <div className="flex items-center justify-between p-5 border-b border-slate-200">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-purple-100 text-purple-700"><ChefHat className="h-5 w-5" /></div>
                <div>
                  <h2 className="text-xl font-bold text-slate-900">Ukemeny fra handelshistorikk</h2>
                  <p className="text-sm text-slate-500">AI foreslår 7 dager basert på hva familien pleier å kjøpe</p>
                </div>
              </div>
              <button onClick={() => setOpen(false)} className="rounded-xl p-1.5 hover:bg-slate-100"><X className="h-5 w-5" /></button>
            </div>

            <div className="p-4 border-b border-slate-100 space-y-2">
              <label className="text-xs font-semibold text-slate-600">Preferanser (valgfritt)</label>
              <input value={cravings} onChange={e => setCravings(e.target.value)} placeholder="F.eks. spansk, vegetarisk, ikke fisk" className="w-full text-sm" />
              <button onClick={generate} disabled={loading} className="btn-primary w-full justify-center">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                {menu.length > 0 ? 'Generer på nytt' : 'Lag ukemeny'}
              </button>
              {error && <p className="text-xs text-rose-700">{error}</p>}
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              {menu.length === 0 ? (
                <p className="text-center text-slate-500 py-10 text-sm">Klikk "Lag ukemeny" for å generere basert på handelshistorikken.</p>
              ) : (
                <div className="space-y-3">
                  {menu.map((day, idx) => (
                    <div key={idx} className="rounded-2xl border border-slate-200 bg-white p-4">
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div>
                          <p className="text-[10px] uppercase tracking-wide text-slate-500 font-black">{day.day}</p>
                          <h3 className="font-black text-slate-900 text-lg">{day.dish}</h3>
                          {day.reason && <p className="text-xs text-slate-600 mt-0.5">{day.reason}</p>}
                        </div>
                      </div>
                      {day.recipe?.fullIngredients && day.recipe.fullIngredients.length > 0 && (
                        <div className="mt-3">
                          <p className="text-[10px] uppercase text-slate-500 font-black tracking-wide mb-1.5">Ingredienser</p>
                          <div className="flex flex-wrap gap-1.5">
                            {day.recipe.fullIngredients.map((ing, i) => (
                              <button
                                key={i}
                                onClick={() => onAddIngredient?.(ing.name)}
                                className="inline-flex items-center gap-1 rounded-full bg-slate-100 hover:bg-purple-100 text-slate-700 hover:text-purple-800 px-2 py-1 text-xs font-medium transition-colors"
                                title="Legg til handleliste"
                              >
                                <Plus className="h-3 w-3" />
                                {ing.name}{ing.amount ? ` (${ing.amount})` : ''}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                      {day.recipe?.instructions && day.recipe.instructions.length > 0 && (
                        <details className="mt-3">
                          <summary className="text-xs font-semibold text-purple-700 cursor-pointer">Vis oppskrift</summary>
                          <ol className="mt-2 space-y-1 text-xs text-slate-700 list-decimal list-inside">
                            {day.recipe.instructions.map((step, i) => <li key={i}>{step}</li>)}
                          </ol>
                        </details>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {menu.length > 0 && (
              <div className="border-t border-slate-200 p-3 text-xs text-slate-500 text-center">
                💡 Klikk en ingrediens for å legge direkte i handlelista
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
};
