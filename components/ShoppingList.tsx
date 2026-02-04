import React, { useState, useMemo, useRef, useEffect } from 'react';
import { CyberButton } from './CyberButton';
import { GROCERY_STORES } from '../constants';
import { GroceryItem, Currency } from '../types';
import { 
  ShoppingBasket, 
  Plus, 
  Trash2, 
  Wallet, 
  CalendarDays, 
  CheckCircle2, 
  Circle,
  X,
  RefreshCw,
  Scan,
  ChefHat,
  BrainCircuit,
  ListChecks,
  AlertTriangle,
  FlameKindling,
  Check,
  ChevronRight
} from 'lucide-react';
import { getSmartShoppingSuggestions, analyzeFridge, generateSmartMenu } from '../services/geminiService';

interface Props {
  cashBalance: number;
  groceryItems: GroceryItem[];
  setGroceryItems: React.Dispatch<React.SetStateAction<GroceryItem[]>>;
  weeklyMenu: any[];
  setWeeklyMenu: React.Dispatch<React.SetStateAction<any[]>>;
}

const formatCurrency = (amount: number, currency: Currency) => {
  const symbol = currency === 'NOK' ? 'kr' : '€';
  return `${symbol} ${amount.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
};

export const ShoppingList: React.FC<Props> = ({ 
  cashBalance, 
  groceryItems, 
  setGroceryItems, 
  weeklyMenu, 
  setWeeklyMenu 
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'list' | 'menu' | 'scan'>('list');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newItemName, setNewItemName] = useState('');
  const [userCravings, setUserCravings] = useState('');
  
  const [fridgeResults, setFridgeResults] = useState<{identifiedItems: string[], recipes: any[]} | null>(null);
  const [selectedRecipe, setSelectedRecipe] = useState<any | null>(null);
  
  const [suggestions, setSuggestions] = useState<{ name: string; reason: string; added?: boolean }[]>([]);

  const [isCameraActive, setIsCameraActive] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const loadSmartSuggestions = async () => {
    setLoading(true);
    try {
      const history = groceryItems.map(i => i.name);
      const data = await getSmartShoppingSuggestions(history);
      setSuggestions(data || []);
    } catch (e) {
      console.error("Failed to load smart suggestions", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSmartSuggestions();
  }, []);

  const addItem = (name: string, store?: string, isSuggestion: boolean = false, suggestionIndex?: number) => {
    if (!name) return;
    const newItem: GroceryItem = {
      id: Math.random().toString(36).substr(2, 9),
      name,
      quantity: 1,
      unit: 'stk',
      frequency: 'medium',
      store: (store || 'Mercadona') as any,
      isBought: false,
      isSuggestion
    };
    setGroceryItems(prev => [newItem, ...prev]);
    setNewItemName('');

    // Visuell feedback for forslag
    if (suggestionIndex !== undefined) {
      setSuggestions(prev => prev.map((s, i) => i === suggestionIndex ? { ...s, added: true } : s));
      setTimeout(() => {
        setSuggestions(prev => prev.map((s, i) => i === suggestionIndex ? { ...s, added: false } : s));
      }, 2000);
    }
  };

  useEffect(() => {
    let active = true;

    const startCamera = async () => {
      if (isCameraActive && activeSubTab === 'scan') {
        try {
          if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
          }

          const stream = await navigator.mediaDevices.getUserMedia({ 
            video: { facingMode: 'environment' } 
          });
          
          if (!active) {
            stream.getTracks().forEach(t => t.stop());
            return;
          }

          streamRef.current = stream;
          setTimeout(() => {
            if (videoRef.current && active) {
              videoRef.current.srcObject = stream;
            }
          }, 50);
        } catch (err) {
          console.error("Camera access error:", err);
          if (active) {
            setError("Kunne ikke få tilgang til kameraet. Vennligst sjekk tillatelser.");
            setIsCameraActive(false);
          }
        }
      }
    };

    startCamera();

    return () => {
      active = false;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
    };
  }, [isCameraActive, activeSubTab]);

  const captureAndAnalyze = async () => {
    if (videoRef.current && canvasRef.current) {
      const context = canvasRef.current.getContext('2d');
      if (context) {
        canvasRef.current.width = videoRef.current.videoWidth;
        canvasRef.current.height = videoRef.current.videoHeight;
        context.drawImage(videoRef.current, 0, 0);
        const dataUrl = canvasRef.current.toDataURL('image/jpeg');
        const base64 = dataUrl.split(',')[1];
        
        setIsCameraActive(false);
        setLoading(true);
        setError(null);
        try {
          const result = await analyzeFridge(base64);
          setFridgeResults(result);
        } catch (e) {
          setError("Kjøleskap-analyse feilet. Prøv et nytt bilde.");
        } finally {
          setLoading(false);
        }
      }
    }
  };

  const generateAIMenu = async () => {
    setLoading(true);
    setError(null);
    try {
      const inventory = fridgeResults?.identifiedItems || [];
      const smartMenu = await generateSmartMenu(inventory, userCravings);
      setWeeklyMenu(smartMenu);
    } catch (e) {
      setError("AI-menyen kunne ikke genereres. Prøv igjen.");
    } finally {
      setLoading(false);
    }
  };

  // Helper for å normalisere oppskriftsdata fra ulike AI-kilder
  const normalizedRecipe = useMemo(() => {
    if (!selectedRecipe) return null;
    
    // Hvis det er fra skap-scan (har ingredienser rett på rot)
    if (selectedRecipe.fullIngredients) {
      return {
        dish: selectedRecipe.dish || selectedRecipe.name,
        day: selectedRecipe.day || 'AI Forslag',
        ingredients: selectedRecipe.fullIngredients,
        instructions: selectedRecipe.instructions || []
      };
    }
    
    // Hvis det er fra ukeplan (har oppskrift i et 'recipe' objekt)
    if (selectedRecipe.recipe) {
      return {
        dish: selectedRecipe.dish,
        day: selectedRecipe.day,
        ingredients: selectedRecipe.recipe.fullIngredients,
        instructions: selectedRecipe.recipe.instructions
      };
    }

    return null;
  }, [selectedRecipe]);

  return (
    <div className="space-y-6">
      {/* OPPSKRIFT-MODAL */}
      {normalizedRecipe && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/90 backdrop-blur-md" onClick={() => setSelectedRecipe(null)} />
          <div className="glass-panel w-full max-w-2xl p-8 border-2 border-cyan-500 shadow-[0_0_50px_rgba(0,243,255,0.2)] animate-in zoom-in-95 overflow-y-auto max-h-[90vh] no-scrollbar">
             <div className="flex justify-between items-start mb-8">
                <div>
                   <h2 className="text-2xl font-black text-white uppercase tracking-tighter">{normalizedRecipe.dish}</h2>
                   <p className="text-[10px] text-cyan-400 uppercase tracking-[0.3em] font-mono mt-2">{normalizedRecipe.day} // AI OPPSKRIFT</p>
                </div>
                <button onClick={() => setSelectedRecipe(null)} className="p-2 border border-white/10 hover:border-cyan-500 text-slate-500 hover:text-cyan-400 transition-all">
                   <X className="w-6 h-6" />
                </button>
             </div>

             <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                <div>
                   <h3 className="text-xs font-black uppercase text-slate-400 mb-4 flex items-center gap-2 border-b border-white/10 pb-2">
                      <ListChecks className="w-4 h-4 text-cyan-400" /> Ingredienser
                   </h3>
                   <div className="space-y-2">
                      {normalizedRecipe.ingredients?.map((ing: any, i: number) => (
                        <div key={i} className="flex justify-between items-center group p-3 bg-white/5 border border-white/5 hover:border-cyan-500/30 transition-all">
                           <div>
                              <p className="text-xs font-bold text-white uppercase tracking-tight">{ing.name}</p>
                              <p className="text-[9px] text-slate-500 font-mono italic">{ing.amount}</p>
                           </div>
                           <button 
                             onClick={() => addItem(`${ing.name} (${ing.amount})`, 'Mercadona', true)}
                             className="p-2 bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 hover:bg-cyan-500 hover:text-black transition-all"
                           >
                              <Plus className="w-3 h-3" />
                           </button>
                        </div>
                      ))}
                      {(!normalizedRecipe.ingredients || normalizedRecipe.ingredients.length === 0) && (
                        <p className="text-[10px] text-slate-500 italic">Ingen ingredienser funnet.</p>
                      )}
                   </div>
                </div>

                <div>
                   <h3 className="text-xs font-black uppercase text-slate-400 mb-4 flex items-center gap-2 border-b border-white/10 pb-2">
                      <ChefHat className="w-4 h-4 text-magenta-400" /> Tilberedning
                   </h3>
                   <div className="space-y-4">
                      {normalizedRecipe.instructions?.map((step: string, i: number) => (
                        <div key={i} className="flex gap-4">
                           <span className="text-magenta-500 font-black font-mono text-sm">{i+1}.</span>
                           <p className="text-[11px] text-slate-300 leading-relaxed italic">{step}</p>
                        </div>
                      ))}
                      {(!normalizedRecipe.instructions || normalizedRecipe.instructions.length === 0) && (
                        <p className="text-[10px] text-slate-500 italic">Ingen fremgangsmåte funnet.</p>
                      )}
                   </div>
                </div>
             </div>

             <div className="mt-10 pt-6 border-t border-white/10 flex justify-end gap-4">
                <CyberButton onClick={() => {
                  normalizedRecipe.ingredients?.forEach((ing: any) => addItem(`${ing.name} (${ing.amount})`, 'Mercadona', true));
                  setSelectedRecipe(null);
                }} variant="primary">Legg alt i handleliste</CyberButton>
             </div>
          </div>
        </div>
      )}

      {/* TABS VELGER */}
      <div className="flex gap-4 border-b border-white/10 pb-4 overflow-x-auto no-scrollbar">
        {[
          { id: 'list', label: 'Handleliste', icon: <ShoppingBasket className="w-4 h-4" /> },
          { id: 'scan', label: 'Skap-Scan', icon: <Scan className="w-4 h-4" /> },
          { id: 'menu', label: 'Ukemeny Spania', icon: <CalendarDays className="w-4 h-4" /> },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveSubTab(tab.id as any)}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-bold uppercase tracking-widest transition-all shrink-0 ${
              activeSubTab === tab.id 
              ? 'text-magenta-400 border-b-2 border-magenta-400' 
              : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          {activeSubTab === 'list' && (
            <div className="glass-panel p-6 border-l-4 border-l-magenta-500 animate-in fade-in">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
                <h2 className="text-xl font-bold flex items-center gap-2 uppercase tracking-tighter">
                  <ShoppingBasket className="text-magenta-400" /> Aktive Varer
                </h2>
                <div className="flex items-center gap-3 bg-white/5 px-4 py-3 border border-white/10 w-full sm:w-auto">
                   <Wallet className="w-4 h-4 text-emerald-400" />
                   <div>
                     <p className="text-[8px] uppercase text-slate-500 font-bold tracking-widest">Kontanter</p>
                     <p className="text-sm font-bold font-mono text-emerald-400">{formatCurrency(cashBalance, 'NOK')}</p>
                   </div>
                </div>
              </div>
              
              <div className="flex flex-col md:flex-row gap-4 mb-8">
                <div className="flex-1 flex gap-2">
                   <input 
                    value={newItemName}
                    onChange={(e) => setNewItemName(e.target.value)}
                    placeholder="Legg til vare..."
                    className="flex-1 bg-black border border-white/10 px-4 py-2 text-white text-sm outline-none focus:border-magenta-500 transition-all"
                    onKeyDown={(e) => e.key === 'Enter' && addItem(newItemName)}
                  />
                  <CyberButton onClick={() => addItem(newItemName)} variant="secondary" className="px-4">
                    <Plus className="w-4 h-4" />
                  </CyberButton>
                </div>
              </div>

              <div className="space-y-3">
                {groceryItems.length === 0 ? (
                  <div className="py-20 text-center flex flex-col items-center opacity-20 border-2 border-dashed border-white/5">
                    <ShoppingBasket className="w-12 h-12 mb-4" />
                    <p className="uppercase tracking-[0.3em] text-[10px] font-black">Listen er tom</p>
                  </div>
                ) : (
                  groceryItems.map(item => (
                    <div 
                      key={item.id} 
                      className={`flex items-center justify-between p-4 border transition-all group ${
                        item.isBought ? 'bg-black/50 border-white/5 opacity-50' : 
                        item.isSuggestion ? 'bg-cyan-500/5 border-cyan-500/30 border-dashed' :
                        'bg-white/5 border-white/10 hover:border-magenta-500/50'
                      }`}
                    >
                      <div className="flex items-center gap-4">
                        <button onClick={() => !item.isBought && setGroceryItems(groceryItems.map(i => i.id === item.id ? {...i, isBought: true} : i))} className={`${item.isBought ? 'text-emerald-500' : 'text-magenta-400'} transition-colors`}>
                          {item.isBought ? <CheckCircle2 className="w-5 h-5" /> : <Circle className="w-5 h-5" />}
                        </button>
                        <h4 className={`text-sm font-bold uppercase tracking-tight ${item.isBought ? 'line-through text-slate-600' : 'text-white'}`}>{item.name}</h4>
                      </div>
                      <button onClick={() => setGroceryItems(groceryItems.filter(i => i.id !== item.id))} className="text-slate-700 hover:text-rose-500 transition-colors opacity-0 group-hover:opacity-100 p-1">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {activeSubTab === 'scan' && (
            <div className="glass-panel p-6 border-l-4 border-l-cyan-500 animate-in slide-in-from-left-4 min-h-[500px]">
              <h2 className="text-xl font-bold flex items-center gap-2 uppercase tracking-tighter mb-6">
                <Scan className="text-cyan-400" /> Kjøleskap-Skanning
              </h2>
              
              {!isCameraActive && !fridgeResults && !loading && (
                <div className="flex flex-col items-center justify-center py-20 border-2 border-dashed border-white/10">
                  <Scan className="w-16 h-16 text-cyan-500/20 mb-6" />
                  <p className="text-slate-500 text-xs uppercase tracking-widest mb-8 text-center max-w-xs">Skann innsiden av kjøleskapet for å få smarte forslag basert på hva du allerede har.</p>
                  <CyberButton onClick={() => setIsCameraActive(true)}>Start Skanning</CyberButton>
                </div>
              )}

              {isCameraActive && (
                <div className="relative aspect-video bg-black border border-cyan-500/30 overflow-hidden mb-6">
                  <video 
                    ref={videoRef} 
                    autoPlay 
                    playsInline 
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 pointer-events-none border-[30px] border-black/40">
                    <div className="w-full h-0.5 bg-cyan-400 shadow-[0_0_15px_#00f3ff] animate-scan opacity-70"></div>
                  </div>
                  <div className="absolute bottom-6 left-0 right-0 flex justify-center gap-4">
                    <CyberButton onClick={() => setIsCameraActive(false)} variant="ghost">Avbryt</CyberButton>
                    <CyberButton onClick={captureAndAnalyze} variant="primary">Ta Bilde</CyberButton>
                  </div>
                </div>
              )}

              {loading && (
                <div className="flex flex-col items-center justify-center py-20">
                  <RefreshCw className="w-12 h-12 text-cyan-400 animate-spin mb-6" />
                  <p className="text-cyan-400 uppercase tracking-[0.3em] text-xs font-black animate-pulse">Analyserer innholdet...</p>
                </div>
              )}

              {error && (
                <div className="p-4 bg-rose-500/10 border border-rose-500/30 mb-6 flex items-center gap-3">
                  <AlertTriangle className="text-rose-500 w-5 h-5" />
                  <p className="text-xs text-rose-500 font-bold uppercase">{error}</p>
                </div>
              )}

              {fridgeResults && !loading && (
                <div className="space-y-8 animate-in fade-in">
                  <div className="p-4 bg-cyan-500/5 border border-cyan-500/20">
                    <h3 className="text-xs font-black uppercase text-cyan-400 mb-3 tracking-widest">Identifiserte varer:</h3>
                    <div className="flex flex-wrap gap-2">
                      {fridgeResults.identifiedItems.map((item, i) => (
                        <span key={i} className="px-2 py-1 bg-black border border-white/10 text-[10px] text-white uppercase font-bold">{item}</span>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {fridgeResults.recipes.map((recipe, i) => (
                      <div key={i} className="glass-panel p-5 border border-white/10 hover:border-cyan-500/50 transition-all group">
                        <h4 className="font-black text-white uppercase text-sm mb-2">{recipe.name}</h4>
                        <p className="text-[10px] text-slate-400 italic mb-4 line-clamp-2">{recipe.description}</p>
                        <div className="flex justify-between items-end">
                          <span className="text-[8px] text-magenta-400 uppercase font-bold">Mangler {recipe.missingIngredients.length} varer</span>
                          <button 
                            onClick={() => setSelectedRecipe(recipe)}
                            className="text-[9px] font-black uppercase text-cyan-400 group-hover:underline"
                          >
                            Se Oppskrift
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                  <CyberButton onClick={() => setFridgeResults(null)} variant="ghost" className="w-full">Skann på nytt</CyberButton>
                </div>
              )}
              <canvas ref={canvasRef} className="hidden" />
            </div>
          )}

          {activeSubTab === 'menu' && (
            <div className="glass-panel p-6 border-l-4 border-l-cyan-500 min-h-[500px] animate-in slide-in-from-right-4">
              <div className="flex flex-col space-y-6 mb-8">
                <div className="flex justify-between items-center">
                   <h2 className="text-xl font-bold flex items-center gap-2 uppercase tracking-tighter">
                      <CalendarDays className="text-cyan-400" /> Ukemeny Spania
                   </h2>
                </div>

                <div className="p-4 bg-black/40 border border-white/10 space-y-4">
                   <div className="flex items-center gap-2 mb-2">
                      <FlameKindling className="text-magenta-500 w-4 h-4" />
                      <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Cravings & Preferanser</label>
                   </div>
                   <textarea 
                     value={userCravings}
                     onChange={(e) => setUserCravings(e.target.value)}
                     placeholder="F.eks: Mye sjømat, tapas på fredag, barnevennlig..."
                     className="w-full bg-black border border-white/5 p-3 text-xs text-white outline-none focus:border-cyan-500 transition-all h-20 resize-none"
                   />
                   <CyberButton onClick={generateAIMenu} disabled={loading} variant="primary" className="w-full py-4">
                    {loading ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : <BrainCircuit className="w-4 h-4 mr-2" />}
                    {loading ? 'Planlegger uken...' : 'Generer Ukemeny'}
                   </CyberButton>
                </div>
              </div>

              {error && (
                <div className="p-4 bg-rose-500/10 border border-rose-500/30 flex items-center gap-3 mb-6">
                   <AlertTriangle className="text-rose-500 w-5 h-5" />
                   <p className="text-xs text-rose-500 uppercase font-black">{error}</p>
                </div>
              )}

              <div className="space-y-4">
                {weeklyMenu.map((day, i) => (
                  <div key={i} className="p-4 bg-white/5 border border-white/10 flex justify-between items-center group cursor-pointer hover:bg-white/[0.07]" onClick={() => setSelectedRecipe(day)}>
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 border border-cyan-500/30 flex flex-col items-center justify-center text-[8px] font-black uppercase">
                        <span className="text-cyan-400">{day.day.slice(0,3)}</span>
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-white uppercase">{day.dish}</h4>
                        <p className="text-[9px] text-slate-500 font-mono italic">{day.reason}</p>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-700 group-hover:text-cyan-400 transition-all" />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="space-y-6">
           {/* Smart Suggestions */}
           <div className="glass-panel p-6 border-l-4 border-l-emerald-500 bg-emerald-500/5">
              <div className="flex justify-between items-center mb-6">
                 <h3 className="text-xs font-black uppercase text-emerald-400 flex items-center gap-2">
                    <BrainCircuit className="w-4 h-4" /> AI Forslag
                 </h3>
                 <button onClick={loadSmartSuggestions} disabled={loading} className="text-emerald-500/50 hover:text-emerald-400 transition-all">
                    <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
                 </button>
              </div>
              <div className="space-y-4">
                 {loading && <p className="text-[10px] text-slate-500 uppercase animate-pulse">Analyserer historikk...</p>}
                 {!loading && suggestions.map((s, idx) => (
                    <div key={idx} className={`p-3 bg-black border transition-all group ${s.added ? 'border-emerald-500' : 'border-white/5 hover:border-emerald-500/30'}`}>
                       <div className="flex justify-between items-start mb-1">
                          <p className={`text-[11px] font-black uppercase transition-colors ${s.added ? 'text-emerald-400' : 'text-white'}`}>{s.name}</p>
                          <button 
                            onClick={() => addItem(s.name, 'Mercadona', true, idx)} 
                            className={`transition-all ${s.added ? 'text-emerald-400' : 'text-emerald-500 opacity-0 group-hover:opacity-100'}`}
                          >
                            {s.added ? <Check className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
                          </button>
                       </div>
                       <p className="text-[8px] text-slate-500 leading-tight uppercase font-mono">{s.added ? 'Lagt til i listen!' : s.reason}</p>
                    </div>
                 ))}
                 {!loading && suggestions.length === 0 && <p className="text-[9px] text-slate-600 uppercase italic">Ingen forslag akkurat nå.</p>}
              </div>
           </div>
        </div>
      </div>
    </div>
  );
};