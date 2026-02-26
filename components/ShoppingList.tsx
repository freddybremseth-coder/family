
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { CyberButton } from './CyberButton';
import { GROCERY_STORES } from '../constants';
import { GroceryItem } from '../types';
import {
  ShoppingCart,
  Plus,
  Trash2,
  CheckCircle2,
  Circle,
  X,
  RefreshCw,
  Scan,
  ChefHat,
  BrainCircuit,
  ListChecks,
  AlertTriangle,
  Check,
  ChevronRight,
  CalendarDays,
  Sparkles,
} from 'lucide-react';
import { getSmartShoppingSuggestions, analyzeFridge, generateSmartMenu } from '../services/geminiService';

interface Props {
  cashBalance: number;
  groceryItems: GroceryItem[];
  setGroceryItems: React.Dispatch<React.SetStateAction<GroceryItem[]>>;
  weeklyMenu: any[];
  setWeeklyMenu: React.Dispatch<React.SetStateAction<any[]>>;
}

export const ShoppingList: React.FC<Props> = ({
  cashBalance,
  groceryItems,
  setGroceryItems,
  weeklyMenu,
  setWeeklyMenu,
}) => {
  const [activeTab, setActiveTab] = useState<'list' | 'menu' | 'scan'>('list');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newItemName, setNewItemName] = useState('');
  const [userCravings, setUserCravings] = useState('');
  const [fridgeResults, setFridgeResults] = useState<{ identifiedItems: string[]; recipes: any[] } | null>(null);
  const [selectedRecipe, setSelectedRecipe] = useState<any | null>(null);
  const [suggestions, setSuggestions] = useState<{ name: string; reason: string; added?: boolean }[]>([]);
  const [isCameraActive, setIsCameraActive] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const boughtCount = groceryItems.filter(i => i.isBought).length;
  const totalCount = groceryItems.length;

  const loadSmartSuggestions = async () => {
    setLoading(true);
    try {
      const history = groceryItems.map(i => i.name);
      const data = await getSmartShoppingSuggestions(history);
      setSuggestions(data || []);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadSmartSuggestions(); }, []);

  const addItem = (name: string, isSuggestion = false, suggestionIndex?: number) => {
    if (!name.trim()) return;
    setGroceryItems(prev => [{
      id: Math.random().toString(36).substr(2, 9),
      name: name.trim(),
      quantity: 1,
      unit: 'stk',
      frequency: 'medium',
      store: 'Andre' as any,
      isBought: false,
      isSuggestion,
    }, ...prev]);
    setNewItemName('');

    if (suggestionIndex !== undefined) {
      setSuggestions(prev => prev.map((s, i) => i === suggestionIndex ? { ...s, added: true } : s));
      setTimeout(() => {
        setSuggestions(prev => prev.map((s, i) => i === suggestionIndex ? { ...s, added: false } : s));
      }, 2000);
    }
  };

  const toggleItem = (id: string) => {
    setGroceryItems(prev => prev.map(i => i.id === id ? { ...i, isBought: !i.isBought } : i));
  };

  const removeItem = (id: string) => {
    setGroceryItems(prev => prev.filter(i => i.id !== id));
  };

  const clearBought = () => {
    setGroceryItems(prev => prev.filter(i => !i.isBought));
  };

  // Camera
  useEffect(() => {
    let active = true;
    const startCamera = async () => {
      if (isCameraActive && activeTab === 'scan') {
        try {
          if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
          const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
          if (!active) { stream.getTracks().forEach(t => t.stop()); return; }
          streamRef.current = stream;
          setTimeout(() => { if (videoRef.current && active) videoRef.current.srcObject = stream; }, 50);
        } catch {
          if (active) { setError('Kunne ikke åpne kameraet. Sjekk tillatelser.'); setIsCameraActive(false); }
        }
      }
    };
    startCamera();
    return () => {
      active = false;
      if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null; }
    };
  }, [isCameraActive, activeTab]);

  const captureAndAnalyze = async () => {
    if (videoRef.current && canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d');
      if (ctx) {
        canvasRef.current.width = videoRef.current.videoWidth;
        canvasRef.current.height = videoRef.current.videoHeight;
        ctx.drawImage(videoRef.current, 0, 0);
        const base64 = canvasRef.current.toDataURL('image/jpeg').split(',')[1];
        setIsCameraActive(false);
        setLoading(true);
        setError(null);
        try {
          const result = await analyzeFridge(base64);
          setFridgeResults(result);
        } catch {
          setError('Kjøleskap-analyse feilet. Prøv et nytt bilde.');
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
      const menu = await generateSmartMenu(inventory, userCravings);
      setWeeklyMenu(menu);
    } catch {
      setError('AI-menyen kunne ikke genereres. Prøv igjen.');
    } finally {
      setLoading(false);
    }
  };

  const normalizedRecipe = useMemo(() => {
    if (!selectedRecipe) return null;
    if (selectedRecipe.fullIngredients) {
      return { dish: selectedRecipe.dish || selectedRecipe.name, day: selectedRecipe.day || 'AI Forslag', ingredients: selectedRecipe.fullIngredients, instructions: selectedRecipe.instructions || [] };
    }
    if (selectedRecipe.recipe) {
      return { dish: selectedRecipe.dish, day: selectedRecipe.day, ingredients: selectedRecipe.recipe.fullIngredients, instructions: selectedRecipe.recipe.instructions };
    }
    return null;
  }, [selectedRecipe]);

  const TABS = [
    { id: 'list',  label: 'Handleliste',     icon: <ShoppingCart className="w-4 h-4" /> },
    { id: 'scan',  label: 'Kjøleskap-skann', icon: <Scan className="w-4 h-4" /> },
    { id: 'menu',  label: 'Ukemeny',         icon: <CalendarDays className="w-4 h-4" /> },
  ];

  return (
    <div className="space-y-6 animate-fade-in">

      {/* RECIPE MODAL */}
      {normalizedRecipe && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 modal-overlay" onClick={() => setSelectedRecipe(null)} />
          <div className="relative modal-card w-full max-w-2xl overflow-y-auto max-h-[90vh] p-8">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h2 className="text-2xl font-bold text-slate-900">{normalizedRecipe.dish}</h2>
                <p className="text-sm text-slate-400 mt-1">{normalizedRecipe.day} · AI-oppskrift</p>
              </div>
              <button onClick={() => setSelectedRecipe(null)} className="p-2 rounded-lg hover:bg-slate-100 text-slate-400 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div>
                <h3 className="text-sm font-semibold text-slate-600 mb-3 flex items-center gap-2">
                  <ListChecks className="w-4 h-4 text-indigo-500" /> Ingredienser
                </h3>
                <div className="space-y-2">
                  {normalizedRecipe.ingredients?.map((ing: any, i: number) => (
                    <div key={i} className="flex justify-between items-center p-3 bg-slate-50 rounded-xl group">
                      <div>
                        <p className="text-sm font-medium text-slate-800">{ing.name}</p>
                        <p className="text-xs text-slate-400">{ing.amount}</p>
                      </div>
                      <button
                        onClick={() => addItem(`${ing.name} (${ing.amount})`, true)}
                        className="p-1.5 bg-indigo-100 text-indigo-600 rounded-lg hover:bg-indigo-600 hover:text-white transition-all"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-slate-600 mb-3 flex items-center gap-2">
                  <ChefHat className="w-4 h-4 text-indigo-500" /> Fremgangsmåte
                </h3>
                <div className="space-y-3">
                  {normalizedRecipe.instructions?.map((step: string, i: number) => (
                    <div key={i} className="flex gap-3">
                      <span className="w-5 h-5 bg-indigo-100 text-indigo-600 rounded-full text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">{i + 1}</span>
                      <p className="text-sm text-slate-600 leading-relaxed">{step}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-8 pt-6 border-t border-slate-100 flex justify-end gap-3">
              <CyberButton onClick={() => setSelectedRecipe(null)} variant="secondary">Lukk</CyberButton>
              <CyberButton onClick={() => {
                normalizedRecipe.ingredients?.forEach((ing: any) => addItem(`${ing.name} (${ing.amount})`, true));
                setSelectedRecipe(null);
              }} variant="primary">
                <Plus className="w-4 h-4" /> Legg alle i handleliste
              </CyberButton>
            </div>
          </div>
        </div>
      )}

      {/* TABS */}
      <div className="tab-bar">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`tab-item ${activeTab === tab.id ? 'active' : ''}`}
          >
            {tab.icon}
            <span className="hidden sm:inline">{tab.label}</span>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">

          {/* SHOPPING LIST TAB */}
          {activeTab === 'list' && (
            <div className="card p-6 animate-fade-in">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="section-title">
                    <ShoppingCart className="w-5 h-5 text-indigo-500" />
                    Handleliste
                  </h2>
                  {totalCount > 0 && (
                    <p className="text-xs text-slate-400 mt-1">{boughtCount} av {totalCount} kjøpt</p>
                  )}
                </div>
                {boughtCount > 0 && (
                  <button
                    onClick={clearBought}
                    className="text-xs font-semibold text-red-500 hover:text-red-700 transition-colors"
                  >
                    Fjern kjøpte
                  </button>
                )}
              </div>

              {/* Progress bar */}
              {totalCount > 0 && (
                <div className="progress-bar mb-6">
                  <div
                    className="progress-fill"
                    style={{ width: `${(boughtCount / totalCount) * 100}%`, background: '#10B981' }}
                  />
                </div>
              )}

              {/* Add item */}
              <div className="flex gap-2 mb-6">
                <input
                  value={newItemName}
                  onChange={e => setNewItemName(e.target.value)}
                  placeholder="Legg til vare..."
                  className="input-field flex-1"
                  onKeyDown={e => e.key === 'Enter' && addItem(newItemName)}
                />
                <CyberButton onClick={() => addItem(newItemName)} variant="primary">
                  <Plus className="w-4 h-4" />
                </CyberButton>
              </div>

              {/* Items */}
              {groceryItems.length === 0 ? (
                <div className="empty-state">
                  <ShoppingCart className="w-10 h-10 text-slate-300 mb-3" />
                  <p className="font-medium text-slate-400">Listen er tom</p>
                  <p className="text-sm text-slate-300 mt-1">Legg til varer ovenfor eller bruk AI-forslag</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {groceryItems.map(item => (
                    <div
                      key={item.id}
                      className={`flex items-center justify-between p-3.5 rounded-xl border transition-all group ${
                        item.isBought
                          ? 'bg-slate-50 border-slate-100 opacity-60'
                          : item.isSuggestion
                            ? 'bg-indigo-50 border-indigo-100'
                            : 'bg-white border-slate-200 hover:border-indigo-200 hover:shadow-sm'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => toggleItem(item.id)}
                          className={`transition-colors ${item.isBought ? 'text-emerald-500' : 'text-slate-300 hover:text-indigo-500'}`}
                        >
                          {item.isBought
                            ? <CheckCircle2 className="w-5 h-5" />
                            : <Circle className="w-5 h-5" />}
                        </button>
                        <div>
                          <p className={`text-sm font-medium ${item.isBought ? 'line-through text-slate-400' : 'text-slate-800'}`}>
                            {item.name}
                          </p>
                          {item.isSuggestion && !item.isBought && (
                            <span className="text-xs text-indigo-500 font-medium">AI-forslag</span>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() => removeItem(item.id)}
                        className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* FRIDGE SCAN TAB */}
          {activeTab === 'scan' && (
            <div className="card p-6 animate-fade-in">
              <h2 className="section-title mb-6">
                <Scan className="w-5 h-5 text-indigo-500" />
                Kjøleskap-skanning
              </h2>

              {!isCameraActive && !fridgeResults && !loading && (
                <div className="empty-state border-2 border-dashed border-slate-200 rounded-2xl py-16">
                  <Scan className="w-12 h-12 text-slate-300 mb-4" />
                  <p className="font-medium text-slate-500 mb-2">Skann kjøleskapet</p>
                  <p className="text-sm text-slate-400 max-w-xs text-center mb-6">
                    Ta et bilde av hva du har, og få smarte forslag og oppskrifter basert på innholdet.
                  </p>
                  <CyberButton onClick={() => setIsCameraActive(true)}>
                    <Scan className="w-4 h-4" /> Start skanning
                  </CyberButton>
                </div>
              )}

              {isCameraActive && (
                <div className="space-y-4">
                  <div className="relative aspect-video bg-black rounded-xl overflow-hidden">
                    <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
                    <div className="absolute inset-0 flex items-end justify-center p-4 gap-3">
                      <CyberButton onClick={() => setIsCameraActive(false)} variant="secondary">Avbryt</CyberButton>
                      <CyberButton onClick={captureAndAnalyze}>Ta bilde</CyberButton>
                    </div>
                  </div>
                </div>
              )}

              {loading && (
                <div className="empty-state py-16">
                  <RefreshCw className="w-10 h-10 text-indigo-400 animate-spin mb-4" />
                  <p className="text-slate-500 font-medium">Analyserer innholdet...</p>
                </div>
              )}

              {error && (
                <div className="p-4 bg-red-50 border border-red-100 rounded-xl flex items-center gap-3 mb-4">
                  <AlertTriangle className="w-5 h-5 text-red-500 shrink-0" />
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              )}

              {fridgeResults && !loading && (
                <div className="space-y-6 animate-fade-in">
                  <div className="p-4 bg-indigo-50 border border-indigo-100 rounded-xl">
                    <p className="text-xs font-semibold text-indigo-700 mb-2">Identifiserte varer:</p>
                    <div className="flex flex-wrap gap-2">
                      {fridgeResults.identifiedItems.map((item, i) => (
                        <span key={i} className="chip">{item}</span>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {fridgeResults.recipes.map((recipe, i) => (
                      <div key={i} className="card p-5 hover:shadow-md transition-shadow cursor-pointer" onClick={() => setSelectedRecipe(recipe)}>
                        <h4 className="font-bold text-slate-800 mb-1">{recipe.name}</h4>
                        <p className="text-xs text-slate-400 mb-4 line-clamp-2">{recipe.description}</p>
                        <div className="flex justify-between items-center">
                          <span className="badge badge-warning">Mangler {recipe.missingIngredients?.length || 0} varer</span>
                          <span className="text-sm font-semibold text-indigo-600 flex items-center gap-1">
                            Se oppskrift <ChevronRight className="w-4 h-4" />
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                  <CyberButton onClick={() => setFridgeResults(null)} variant="secondary" className="w-full justify-center">
                    Skann på nytt
                  </CyberButton>
                </div>
              )}

              <canvas ref={canvasRef} className="hidden" />
            </div>
          )}

          {/* WEEKLY MENU TAB */}
          {activeTab === 'menu' && (
            <div className="card p-6 animate-fade-in">
              <h2 className="section-title mb-6">
                <CalendarDays className="w-5 h-5 text-indigo-500" />
                Ukemeny
              </h2>

              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 mb-6 space-y-3">
                <label className="block text-sm font-semibold text-slate-700">Preferanser og ønsker</label>
                <textarea
                  value={userCravings}
                  onChange={e => setUserCravings(e.target.value)}
                  placeholder="F.eks: Mye fisk, vegetar på tirsdag, barnevennlig middag fredag..."
                  className="input-field h-20 resize-none"
                />
                <CyberButton onClick={generateAIMenu} disabled={loading} className="w-full justify-center">
                  {loading
                    ? <><RefreshCw className="w-4 h-4 animate-spin" /> Planlegger...</>
                    : <><BrainCircuit className="w-4 h-4" /> Generer ukemeny med AI</>}
                </CyberButton>
              </div>

              {error && (
                <div className="p-4 bg-red-50 border border-red-100 rounded-xl flex items-center gap-3 mb-4">
                  <AlertTriangle className="w-5 h-5 text-red-500" />
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              )}

              <div className="space-y-3">
                {weeklyMenu.map((day, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-200 hover:border-indigo-200 hover:shadow-sm transition-all cursor-pointer group"
                    onClick={() => setSelectedRecipe(day)}
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center">
                        <span className="text-xs font-bold text-indigo-700">{day.day?.slice(0, 3)}</span>
                      </div>
                      <div>
                        <p className="font-semibold text-slate-800">{day.dish}</p>
                        <p className="text-xs text-slate-400 mt-0.5">{day.reason}</p>
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-indigo-500 transition-colors" />
                  </div>
                ))}
                {weeklyMenu.length === 0 && (
                  <div className="empty-state py-12">
                    <ChefHat className="w-10 h-10 text-slate-300 mb-3" />
                    <p className="text-slate-400">Ingen ukemeny ennå — generer én ovenfor!</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* RIGHT SIDEBAR: AI Suggestions */}
        <div>
          <div className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="section-title text-base">
                <Sparkles className="w-4 h-4 text-amber-500" />
                AI-forslag
              </h3>
              <button
                onClick={loadSmartSuggestions}
                disabled={loading}
                className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>

            {loading && (
              <div className="text-xs text-slate-400 animate-pulse-soft py-4 text-center">
                Analyserer historikk...
              </div>
            )}

            <div className="space-y-2">
              {!loading && suggestions.map((s, idx) => (
                <div
                  key={idx}
                  className={`p-3 rounded-xl border transition-all group ${
                    s.added ? 'bg-emerald-50 border-emerald-200' : 'bg-white border-slate-200 hover:border-indigo-200'
                  }`}
                >
                  <div className="flex justify-between items-center mb-1">
                    <p className={`text-sm font-semibold ${s.added ? 'text-emerald-700' : 'text-slate-800'}`}>
                      {s.name}
                    </p>
                    <button
                      onClick={() => addItem(s.name, true, idx)}
                      className={`transition-all ${
                        s.added
                          ? 'text-emerald-500'
                          : 'text-slate-300 group-hover:text-indigo-500 opacity-0 group-hover:opacity-100'
                      }`}
                    >
                      {s.added ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                    </button>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    {s.added ? 'Lagt til i listen!' : s.reason}
                  </p>
                </div>
              ))}

              {!loading && suggestions.length === 0 && (
                <div className="empty-state py-8">
                  <Sparkles className="w-8 h-8 text-slate-200 mb-2" />
                  <p className="text-sm text-slate-400">Ingen forslag akkurat nå</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
