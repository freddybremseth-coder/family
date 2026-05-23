
import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { CyberButton } from './CyberButton';
import { GroceryItem, Language, SmartSuggestion, PurchaseHistoryEntry } from '../types';
import {
  ShoppingCart, Plus, Trash2, CheckCircle2, Circle, X, RefreshCw, Scan, ChefHat,
  BrainCircuit, ListChecks, AlertTriangle, Check, ChevronRight, CalendarDays,
  Sparkles, Zap, History, Cake, Save, Pencil,
} from 'lucide-react';
import { analyzeFridge, generateSmartMenu, isAiAvailable } from '../services/geminiService';
import {
  buildSuggestions, recordPurchase, hydrateHistoryFromSupabase, loadHistory, getFrequentItems,
} from '../services/smartCartService';
import {
  GroceryList, loadGroceryLists, ensureDefaultList, createGroceryList, renameGroceryList,
  deleteGroceryList, loadGroceryItems, addGroceryItem, toggleGroceryItem, deleteGroceryItem,
  clearBoughtItems,
} from '../services/groceryListService';
import { isSupabaseConfigured } from '../supabase';
import { translations } from '../translations';

interface Props {
  cashBalance: number;
  groceryItems: GroceryItem[];
  setGroceryItems: React.Dispatch<React.SetStateAction<GroceryItem[]>>;
  weeklyMenu: any[];
  setWeeklyMenu: React.Dispatch<React.SetStateAction<any[]>>;
  lang?: Language;
  userId?: string;
}

type TabId = 'list' | 'scan' | 'menu';

export const ShoppingList: React.FC<Props> = ({
  groceryItems, setGroceryItems, weeklyMenu, setWeeklyMenu, lang = 'no', userId,
}) => {
  const t = translations[lang] || translations.no;
  const [activeTab, setActiveTab] = useState<TabId>('list');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newItemName, setNewItemName] = useState('');
  const [userCravings, setUserCravings] = useState('');
  const [fridgeResults, setFridgeResults] = useState<{ identifiedItems: string[]; recipes: any[] } | null>(null);
  const [selectedRecipe, setSelectedRecipe] = useState<any | null>(null);
  const [history, setHistory] = useState<PurchaseHistoryEntry[]>(() => loadHistory());
  const [suggestions, setSuggestions] = useState<SmartSuggestion[]>([]);
  const [isCameraActive, setIsCameraActive] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // --- Liste-state (multiple navngitte handlelister) ---
  const persistenceEnabled = !!userId && isSupabaseConfigured();
  const [lists, setLists] = useState<GroceryList[]>([]);
  const [activeListId, setActiveListId] = useState<string | null>(null);
  const [listLoading, setListLoading] = useState(false);
  const [showNewListForm, setShowNewListForm] = useState(false);
  const [newListName, setNewListName] = useState('');
  const [newListDate, setNewListDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [newListOccasion, setNewListOccasion] = useState('');
  const [showRenameForm, setShowRenameForm] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const [renameDate, setRenameDate] = useState<string>('');

  const activeList = useMemo(() => lists.find((l) => l.id === activeListId) || null, [lists, activeListId]);

  // Last lister + aktiver default / nyeste
  useEffect(() => {
    if (!persistenceEnabled || !userId) return;
    let cancelled = false;
    (async () => {
      setListLoading(true);
      const existing = await loadGroceryLists(userId);
      if (cancelled) return;
      if (existing.length === 0) {
        const created = await ensureDefaultList(userId);
        if (cancelled) return;
        if (created) {
          setLists([created]);
          setActiveListId(created.id);
        }
      } else {
        setLists(existing);
        if (!activeListId) setActiveListId(existing[0].id);
      }
      setListLoading(false);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, persistenceEnabled]);

  // Last items hver gang aktiv liste endres
  useEffect(() => {
    if (!persistenceEnabled || !activeListId) return;
    let cancelled = false;
    setListLoading(true);
    loadGroceryItems(activeListId).then((items) => {
      if (cancelled) return;
      setGroceryItems(items.map((it) => ({
        id: it.id,
        name: it.name,
        quantity: it.quantity,
        unit: it.unit,
        store: it.store || 'Andre',
        isBought: it.isBought,
        frequency: 'medium',
      } as GroceryItem)));
      setListLoading(false);
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeListId, persistenceEnabled]);

  const boughtCount = groceryItems.filter((i) => i.isBought).length;
  const totalCount = groceryItems.length;

  // Hydrate history from Supabase if signed in
  useEffect(() => {
    if (!userId) return;
    hydrateHistoryFromSupabase(userId).then(setHistory).catch(() => {});
  }, [userId]);

  // Recompute suggestions when history or list changes
  useEffect(() => {
    setSuggestions(
      buildSuggestions({
        history,
        currentItems: groceryItems.filter((i) => !i.isBought).map((i) => i.name),
        limit: 8,
        language: lang,
      })
    );
  }, [history, groceryItems, lang]);

  const frequentItems = useMemo(() => getFrequentItems(history, 12), [history]);

  const addItem = useCallback(
    async (name: string, isSuggestion = false) => {
      const clean = name.trim();
      if (!clean) return;
      const exists = groceryItems.some(
        (i) => !i.isBought && i.name.toLowerCase() === clean.toLowerCase()
      );
      if (exists) return;

      // Persist til Supabase hvis vi har aktiv liste, ellers in-memory.
      if (persistenceEnabled && activeListId && userId) {
        const created = await addGroceryItem(activeListId, userId, { name: clean });
        if (created) {
          setGroceryItems((prev) => [
            { id: created.id, name: created.name, quantity: created.quantity, unit: created.unit, store: created.store || 'Andre', isBought: false, isSuggestion, frequency: 'medium' } as GroceryItem,
            ...prev,
          ]);
          setNewItemName('');
          return;
        }
      }
      setGroceryItems((prev) => [
        {
          id: Math.random().toString(36).slice(2, 11),
          name: clean,
          quantity: 1,
          unit: 'stk',
          frequency: 'medium',
          store: 'Andre',
          isBought: false,
          isSuggestion,
        },
        ...prev,
      ]);
      setNewItemName('');
    },
    [groceryItems, setGroceryItems, persistenceEnabled, activeListId, userId]
  );

  const toggleItem = useCallback(
    async (id: string) => {
      const item = groceryItems.find((i) => i.id === id);
      if (!item) return;
      const willBeBought = !item.isBought;
      setGroceryItems((prev) => prev.map((i) => (i.id === id ? { ...i, isBought: willBeBought } : i)));
      if (persistenceEnabled) {
        toggleGroceryItem(id, willBeBought).catch(() => {});
      }
      if (willBeBought) {
        const entry = await recordPurchase(item.name, {
          quantity: item.quantity,
          unit: item.unit,
          store: item.store,
          userId,
        });
        setHistory((prev) => [entry, ...prev]);
      }
    },
    [groceryItems, setGroceryItems, userId, persistenceEnabled]
  );

  const removeItem = (id: string) => {
    setGroceryItems((prev) => prev.filter((i) => i.id !== id));
    if (persistenceEnabled) deleteGroceryItem(id).catch(() => {});
  };

  const clearBought = () => {
    setGroceryItems((prev) => prev.filter((i) => !i.isBought));
    if (persistenceEnabled && activeListId) clearBoughtItems(activeListId).catch(() => {});
  };

  // --- Liste-handlinger ---
  const handleCreateList = async () => {
    if (!userId || !persistenceEnabled) return;
    const name = newListName.trim() || 'Ny handleliste';
    const created = await createGroceryList(userId, {
      name,
      listDate: newListDate || null,
      occasion: newListOccasion.trim() || null,
    });
    if (created) {
      setLists((prev) => [created, ...prev]);
      setActiveListId(created.id);
      setGroceryItems([]);
      setShowNewListForm(false);
      setNewListName('');
      setNewListOccasion('');
      setNewListDate(new Date().toISOString().slice(0, 10));
    }
  };

  const startRename = () => {
    if (!activeList) return;
    setRenameValue(activeList.name);
    setRenameDate(activeList.listDate || '');
    setShowRenameForm(true);
  };

  const handleRename = async () => {
    if (!activeListId) return;
    const name = renameValue.trim();
    if (!name) return;
    await renameGroceryList(activeListId, { name, listDate: renameDate || null });
    setLists((prev) => prev.map((l) => (l.id === activeListId ? { ...l, name, listDate: renameDate || null } : l)));
    setShowRenameForm(false);
  };

  const handleDeleteList = async () => {
    if (!activeListId || !activeList) return;
    if (activeList.isDefault) return; // Ikke slett default-lista
    if (!confirm(`Slette lista «${activeList.name}»? Alle varer i lista fjernes.`)) return;
    await deleteGroceryList(activeListId);
    const remaining = lists.filter((l) => l.id !== activeListId);
    setLists(remaining);
    const next = remaining.find((l) => l.isDefault) || remaining[0];
    setActiveListId(next ? next.id : null);
    if (!next) setGroceryItems([]);
  };

  const formatListDate = (iso?: string | null) => {
    if (!iso) return '';
    try { return new Date(iso).toLocaleDateString('nb-NO', { day: 'numeric', month: 'short', year: 'numeric' }); } catch { return iso; }
  };

  // Camera lifecycle
  useEffect(() => {
    let active = true;
    const startCamera = async () => {
      if (isCameraActive && activeTab === 'scan') {
        try {
          if (streamRef.current) streamRef.current.getTracks().forEach((tr) => tr.stop());
          const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
          if (!active) {
            stream.getTracks().forEach((tr) => tr.stop());
            return;
          }
          streamRef.current = stream;
          setTimeout(() => {
            if (videoRef.current && active) videoRef.current.srcObject = stream;
          }, 50);
        } catch {
          if (active) {
            setError('Could not open camera. Check permissions.');
            setIsCameraActive(false);
          }
        }
      }
    };
    startCamera();
    return () => {
      active = false;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((tr) => tr.stop());
        streamRef.current = null;
      }
    };
  }, [isCameraActive, activeTab]);

  const captureAndAnalyze = async () => {
    if (!videoRef.current || !canvasRef.current) return;
    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;
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
      setError('Fridge analysis failed. Try a new picture.');
    } finally {
      setLoading(false);
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
      setError('Could not generate menu. Try again.');
    } finally {
      setLoading(false);
    }
  };

  const normalizedRecipe = useMemo(() => {
    if (!selectedRecipe) return null;
    if (selectedRecipe.fullIngredients) {
      return {
        dish: selectedRecipe.dish || selectedRecipe.name,
        day: selectedRecipe.day || 'AI',
        ingredients: selectedRecipe.fullIngredients,
        instructions: selectedRecipe.instructions || [],
      };
    }
    if (selectedRecipe.recipe) {
      return {
        dish: selectedRecipe.dish,
        day: selectedRecipe.day,
        ingredients: selectedRecipe.recipe.fullIngredients,
        instructions: selectedRecipe.recipe.instructions,
      };
    }
    return null;
  }, [selectedRecipe]);

  const TABS: { id: TabId; label: string; icon: React.ReactNode }[] = [
    { id: 'list', label: t.shopping_list, icon: <ShoppingCart className="w-4 h-4" /> },
    { id: 'scan', label: t.fridge_scan, icon: <Scan className="w-4 h-4" /> },
    { id: 'menu', label: t.weekly_menu, icon: <CalendarDays className="w-4 h-4" /> },
  ];

  return (
    <div className="space-y-5 animate-fade-in pb-24 md:pb-0">
      {/* RECIPE MODAL */}
      {normalizedRecipe && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="absolute inset-0 modal-overlay" onClick={() => setSelectedRecipe(null)} />
          <div className="relative modal-card w-full sm:max-w-2xl max-h-[92vh] overflow-y-auto p-6 sm:p-8 rounded-t-3xl sm:rounded-3xl">
            <div className="flex justify-between items-start mb-5">
              <div>
                <h2 className="text-xl sm:text-2xl font-bold text-slate-900">{normalizedRecipe.dish}</h2>
                <p className="text-xs text-slate-400 mt-1">{normalizedRecipe.day} · AI</p>
              </div>
              <button onClick={() => setSelectedRecipe(null)} className="p-2 rounded-lg hover:bg-slate-100 text-slate-400">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="text-sm font-semibold text-slate-600 mb-2 flex items-center gap-2">
                  <ListChecks className="w-4 h-4 text-indigo-500" /> {t.add_item}
                </h3>
                <div className="space-y-2">
                  {normalizedRecipe.ingredients?.map((ing: any, i: number) => (
                    <div key={i} className="flex justify-between items-center p-3 bg-slate-50 rounded-xl">
                      <div>
                        <p className="text-sm font-medium text-slate-800">{ing.name}</p>
                        <p className="text-xs text-slate-400">{ing.amount}</p>
                      </div>
                      <button
                        onClick={() => addItem(`${ing.name} (${ing.amount})`, true)}
                        className="p-2 bg-indigo-100 text-indigo-600 rounded-lg hover:bg-indigo-600 hover:text-white"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-slate-600 mb-2 flex items-center gap-2">
                  <ChefHat className="w-4 h-4 text-indigo-500" />
                </h3>
                <div className="space-y-3">
                  {normalizedRecipe.instructions?.map((step: string, i: number) => (
                    <div key={i} className="flex gap-3">
                      <span className="w-6 h-6 bg-indigo-100 text-indigo-600 rounded-full text-xs font-bold flex items-center justify-center shrink-0">
                        {i + 1}
                      </span>
                      <p className="text-sm text-slate-600 leading-relaxed">{step}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-6 pt-5 border-t border-slate-100 flex justify-end gap-3">
              <CyberButton onClick={() => setSelectedRecipe(null)} variant="secondary">{t.close}</CyberButton>
              <CyberButton
                onClick={() => {
                  normalizedRecipe.ingredients?.forEach((ing: any) => addItem(`${ing.name} (${ing.amount})`, true));
                  setSelectedRecipe(null);
                }}
                variant="primary"
              >
                <Plus className="w-4 h-4" /> {t.add_all}
              </CyberButton>
            </div>
          </div>
        </div>
      )}

      {/* TABS */}
      <div className="tab-bar">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`tab-item flex-1 sm:flex-initial justify-center sm:justify-start ${activeTab === tab.id ? 'active' : ''}`}
          >
            {tab.icon}
            <span className="hidden sm:inline">{tab.label}</span>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2">
          {/* SHOPPING LIST TAB */}
          {activeTab === 'list' && (
            <div className="card p-5 sm:p-6 animate-fade-in space-y-4">
              {/* LIST PICKER – flere navngitte handlelister */}
              {persistenceEnabled && (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500 flex items-center gap-1.5">
                      <ListChecks className="h-3.5 w-3.5" /> Velg liste
                    </p>
                    <button
                      onClick={() => setShowNewListForm((v) => !v)}
                      className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
                    >
                      <Plus className="h-3.5 w-3.5" /> Ny liste
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {lists.map((l) => {
                      const isActive = l.id === activeListId;
                      return (
                        <button
                          key={l.id}
                          onClick={() => setActiveListId(l.id)}
                          className={`px-3 py-2 rounded-xl text-xs font-semibold border transition flex items-center gap-1.5 ${
                            isActive
                              ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                              : 'bg-white text-slate-700 border-slate-200 hover:border-indigo-300'
                          }`}
                        >
                          {l.occasion ? <Cake className="h-3.5 w-3.5" /> : <ShoppingCart className="h-3.5 w-3.5" />}
                          <span className="truncate max-w-[180px]">{l.name}</span>
                          {l.listDate && (
                            <span className={`text-[10px] ${isActive ? 'text-indigo-100' : 'text-slate-400'}`}>
                              · {formatListDate(l.listDate)}
                            </span>
                          )}
                        </button>
                      );
                    })}
                    {lists.length === 0 && !listLoading && (
                      <p className="text-xs text-slate-500">Ingen lister enda. Klikk «Ny liste» for å komme i gang.</p>
                    )}
                  </div>

                  {showNewListForm && (
                    <div className="mt-3 rounded-xl bg-white border border-indigo-100 p-3 space-y-2 animate-fade-in">
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <input
                          value={newListName}
                          onChange={(e) => setNewListName(e.target.value)}
                          placeholder="F.eks. Victoria bursdag"
                          className="input-field text-sm"
                        />
                        <input
                          type="date"
                          value={newListDate}
                          onChange={(e) => setNewListDate(e.target.value)}
                          className="input-field text-sm"
                        />
                        <input
                          value={newListOccasion}
                          onChange={(e) => setNewListOccasion(e.target.value)}
                          placeholder="Anledning (valgfri)"
                          className="input-field text-sm"
                        />
                      </div>
                      <div className="flex justify-end gap-2">
                        <button onClick={() => setShowNewListForm(false)} className="text-xs px-3 py-1.5 rounded-lg text-slate-600 hover:bg-slate-100">Avbryt</button>
                        <button onClick={handleCreateList} className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 flex items-center gap-1">
                          <Save className="h-3.5 w-3.5" /> Lagre liste
                        </button>
                      </div>
                    </div>
                  )}

                  {showRenameForm && activeList && (
                    <div className="mt-3 rounded-xl bg-white border border-amber-200 p-3 space-y-2 animate-fade-in">
                      <p className="text-[11px] font-bold uppercase tracking-wide text-amber-700">Omdøp lista</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <input value={renameValue} onChange={(e) => setRenameValue(e.target.value)} className="input-field text-sm" />
                        <input type="date" value={renameDate} onChange={(e) => setRenameDate(e.target.value)} className="input-field text-sm" />
                      </div>
                      <div className="flex justify-end gap-2">
                        <button onClick={() => setShowRenameForm(false)} className="text-xs px-3 py-1.5 rounded-lg text-slate-600 hover:bg-slate-100">Avbryt</button>
                        <button onClick={handleRename} className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-amber-500 text-white hover:bg-amber-600">Lagre endringer</button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="flex items-center justify-between">
                <div>
                  <h2 className="section-title">
                    <ShoppingCart className="w-5 h-5 text-indigo-500" /> {activeList?.name || t.shopping_list}
                  </h2>
                  <div className="flex items-center gap-2 mt-1 text-xs text-slate-400">
                    {activeList?.listDate && (
                      <span className="inline-flex items-center gap-1"><CalendarDays className="h-3 w-3" /> {formatListDate(activeList.listDate)}</span>
                    )}
                    {totalCount > 0 && (
                      <span>{t.bought_progress.replace('{bought}', String(boughtCount)).replace('{total}', String(totalCount))}</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {persistenceEnabled && activeList && (
                    <>
                      <button onClick={startRename} title="Omdøp" className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100">
                        <Pencil className="h-4 w-4" />
                      </button>
                      {!activeList.isDefault && (
                        <button onClick={handleDeleteList} title="Slett liste" className="p-1.5 rounded-lg text-slate-500 hover:bg-rose-50 hover:text-rose-600">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </>
                  )}
                  {boughtCount > 0 && (
                    <button onClick={clearBought} className="text-xs font-semibold text-red-500 hover:text-red-700">
                      {t.clear_bought}
                    </button>
                  )}
                </div>
              </div>

              {totalCount > 0 && (
                <div className="progress-bar mb-5">
                  <div className="progress-fill" style={{ width: `${(boughtCount / totalCount) * 100}%`, background: '#10B981' }} />
                </div>
              )}

              {/* Add row — sticky on mobile for one-handed use */}
              <div className="flex gap-2 mb-4 sticky top-2 z-10">
                <input
                  ref={inputRef}
                  value={newItemName}
                  onChange={(e) => setNewItemName(e.target.value)}
                  placeholder={t.add_item_placeholder}
                  className="input-field flex-1 text-base"
                  inputMode="text"
                  enterKeyHint="done"
                  onKeyDown={(e) => e.key === 'Enter' && addItem(newItemName)}
                />
                <button
                  onClick={() => addItem(newItemName)}
                  className="px-5 text-white rounded-xl font-semibold active:scale-95 transition-transform flex items-center gap-1.5"
                  style={{
                    background: 'linear-gradient(135deg, #6366F1 0%, #8B5CF6 50%, #EC4899 100%)',
                    boxShadow: '0 8px 20px rgba(99, 102, 241, 0.30)',
                  }}
                  aria-label={t.add_item}
                >
                  <Plus className="w-5 h-5" />
                </button>
              </div>

              {/* Frequent items quick-add */}
              {frequentItems.length > 0 && (
                <div className="mb-4">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1.5">
                    <History className="w-3 h-3" /> {t.common_items}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {frequentItems.slice(0, 8).map((name) => {
                      const inList = groceryItems.some(
                        (i) => !i.isBought && i.name.toLowerCase() === name.toLowerCase()
                      );
                      return (
                        <button
                          key={name}
                          disabled={inList}
                          onClick={() => addItem(name)}
                          className={`chip text-xs transition-all ${
                            inList
                              ? 'opacity-40 cursor-not-allowed'
                              : 'hover:bg-indigo-600 hover:text-white cursor-pointer'
                          }`}
                        >
                          + {name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Items */}
              {groceryItems.length === 0 ? (
                <div className="empty-state py-10">
                  <ShoppingCart className="w-10 h-10 text-slate-300 mb-2" />
                  <p className="font-medium text-slate-400">{t.list_empty}</p>
                  <p className="text-sm text-slate-300 mt-1">{t.list_empty_sub}</p>
                </div>
              ) : (
                <ul className="space-y-2">
                  {groceryItems.map((item) => (
                    <li
                      key={item.id}
                      className={`flex items-center justify-between p-4 rounded-2xl border transition-all group ${
                        item.isBought
                          ? 'bg-slate-50 border-slate-100 opacity-60'
                          : item.isSuggestion
                          ? 'bg-indigo-50 border-indigo-100'
                          : 'bg-white border-slate-200 active:bg-slate-50'
                      }`}
                    >
                      <button
                        onClick={() => toggleItem(item.id)}
                        className={`flex items-center gap-3 flex-1 text-left ${item.isBought ? 'text-emerald-500' : 'text-slate-300'}`}
                        aria-label={t.mark_bought}
                      >
                        {item.isBought ? <CheckCircle2 className="w-6 h-6 shrink-0" /> : <Circle className="w-6 h-6 shrink-0" />}
                        <div className="min-w-0">
                          <p className={`text-sm font-medium truncate ${item.isBought ? 'line-through text-slate-400' : 'text-slate-800'}`}>
                            {item.name}
                          </p>
                          {item.isSuggestion && !item.isBought && (
                            <span className="text-[11px] text-indigo-500 font-medium">{t.smart_suggestions}</span>
                          )}
                        </div>
                      </button>
                      <button
                        onClick={() => removeItem(item.id)}
                        className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg ml-2 shrink-0"
                        aria-label={t.delete}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {/* FRIDGE SCAN TAB */}
          {activeTab === 'scan' && (
            <div className="card p-5 sm:p-6 animate-fade-in">
              <h2 className="section-title mb-5">
                <Scan className="w-5 h-5 text-indigo-500" /> {t.fridge_scan}
              </h2>

              {!isAiAvailable() && (
                <div className="p-3 bg-amber-50 border border-amber-100 rounded-xl text-xs text-amber-700 mb-4">
                  AI not configured — add Gemini key in Settings.
                </div>
              )}

              {!isCameraActive && !fridgeResults && !loading && (
                <div className="empty-state border-2 border-dashed border-slate-200 rounded-2xl py-12">
                  <Scan className="w-12 h-12 text-slate-300 mb-3" />
                  <p className="font-medium text-slate-500 mb-1">{t.fridge_scan}</p>
                  <CyberButton onClick={() => setIsCameraActive(true)}>
                    <Scan className="w-4 h-4" /> {t.add_item}
                  </CyberButton>
                </div>
              )}

              {isCameraActive && (
                <div className="relative aspect-square sm:aspect-video bg-black rounded-xl overflow-hidden">
                  <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
                  <div className="absolute inset-0 flex items-end justify-center p-4 gap-3">
                    <CyberButton onClick={() => setIsCameraActive(false)} variant="secondary">{t.cancel}</CyberButton>
                    <CyberButton onClick={captureAndAnalyze}><Sparkles className="w-4 h-4" /></CyberButton>
                  </div>
                </div>
              )}

              {loading && (
                <div className="empty-state py-12">
                  <RefreshCw className="w-10 h-10 text-indigo-400 animate-spin mb-3" />
                  <p className="text-slate-500 font-medium">{t.loading}</p>
                </div>
              )}

              {error && (
                <div className="p-4 bg-red-50 border border-red-100 rounded-xl flex items-center gap-3 mb-4">
                  <AlertTriangle className="w-5 h-5 text-red-500 shrink-0" />
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              )}

              {fridgeResults && !loading && (
                <div className="space-y-5 animate-fade-in">
                  <div className="p-4 bg-indigo-50 border border-indigo-100 rounded-xl">
                    <p className="text-xs font-semibold text-indigo-700 mb-2">Identified:</p>
                    <div className="flex flex-wrap gap-1.5">
                      {fridgeResults.identifiedItems.map((it, i) => <span key={i} className="chip">{it}</span>)}
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {fridgeResults.recipes.map((recipe, i) => (
                      <div key={i} className="card p-4 cursor-pointer active:scale-[0.99]" onClick={() => setSelectedRecipe(recipe)}>
                        <h4 className="font-bold text-slate-800 mb-1">{recipe.name}</h4>
                        <p className="text-xs text-slate-400 mb-3 line-clamp-2">{recipe.description}</p>
                        <div className="flex justify-between items-center">
                          <span className="badge badge-warning">{recipe.missingIngredients?.length || 0}</span>
                          <ChevronRight className="w-4 h-4 text-indigo-600" />
                        </div>
                      </div>
                    ))}
                  </div>
                  <CyberButton onClick={() => setFridgeResults(null)} variant="secondary" className="w-full justify-center">
                    {t.refresh_suggestions}
                  </CyberButton>
                </div>
              )}

              <canvas ref={canvasRef} className="hidden" />
            </div>
          )}

          {/* WEEKLY MENU TAB */}
          {activeTab === 'menu' && (
            <div className="card p-5 sm:p-6 animate-fade-in">
              <h2 className="section-title mb-5">
                <CalendarDays className="w-5 h-5 text-indigo-500" /> {t.weekly_menu}
              </h2>

              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 mb-5 space-y-3">
                <textarea
                  value={userCravings}
                  onChange={(e) => setUserCravings(e.target.value)}
                  placeholder="Mye fisk, vegetar tirsdag, barnevennlig fredag…"
                  className="input-field h-20 resize-none"
                />
                <CyberButton onClick={generateAIMenu} disabled={loading} className="w-full justify-center">
                  {loading ? <><RefreshCw className="w-4 h-4 animate-spin" /> {t.loading}</> : <><BrainCircuit className="w-4 h-4" /> {t.weekly_menu}</>}
                </CyberButton>
              </div>

              <div className="space-y-2">
                {weeklyMenu.map((day, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-200 hover:border-indigo-200 active:scale-[0.99] transition-all cursor-pointer"
                    onClick={() => setSelectedRecipe(day)}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center">
                        <span className="text-xs font-bold text-indigo-700">{day.day?.slice(0, 3)}</span>
                      </div>
                      <div>
                        <p className="font-semibold text-slate-800">{day.dish}</p>
                        <p className="text-xs text-slate-400 mt-0.5">{day.reason}</p>
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-slate-300" />
                  </div>
                ))}
                {weeklyMenu.length === 0 && (
                  <div className="empty-state py-10">
                    <ChefHat className="w-10 h-10 text-slate-300 mb-2" />
                    <p className="text-slate-400">{t.no_data}</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* SMART SUGGESTIONS PANEL */}
        <aside>
          <div className="card p-5 sticky top-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="section-title text-base">
                <Zap className="w-4 h-4 text-amber-500" /> {t.smart_suggestions}
              </h3>
            </div>
            <p className="text-xs text-slate-400 mb-4 leading-relaxed">{t.suggestions_intro}</p>

            <div className="space-y-2">
              {suggestions.map((s, idx) => (
                <div
                  key={`${s.name}-${idx}`}
                  className={`p-3 rounded-xl border transition-all group ${
                    s.added ? 'bg-emerald-50 border-emerald-200' : 'bg-white border-slate-200 hover:border-indigo-200'
                  }`}
                >
                  <div className="flex justify-between items-start gap-2 mb-1">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-800 truncate">{s.name}</p>
                      <p className="text-xs text-slate-400 leading-snug mt-0.5">{s.reason}</p>
                    </div>
                    <button
                      onClick={() => addItem(s.name, true)}
                      className="p-2 bg-indigo-100 text-indigo-600 rounded-lg hover:bg-indigo-600 hover:text-white shrink-0"
                      aria-label={t.add_item}
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                  {s.confidence > 0 && (
                    <div className="mt-2 h-1 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${Math.round(s.confidence * 100)}%`,
                          background: s.confidence > 0.7 ? '#10B981' : s.confidence > 0.5 ? '#F59E0B' : '#94A3B8',
                        }}
                      />
                    </div>
                  )}
                </div>
              ))}

              {suggestions.length === 0 && (
                <div className="empty-state py-6">
                  <Sparkles className="w-8 h-8 text-slate-200 mb-2" />
                  <p className="text-sm text-slate-400">{t.suggestions_empty}</p>
                </div>
              )}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
};
