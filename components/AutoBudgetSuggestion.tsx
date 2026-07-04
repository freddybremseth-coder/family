import React, { useEffect, useState } from 'react';
import { Sparkles, TrendingUp, TrendingDown, Minus, Loader2, Store, Pencil, Check, X, ArrowRightLeft } from 'lucide-react';
import { Transaction } from '../types';
import { suggestBudget, CategoryBudgetSuggestion } from '../services/spendingBudgetService';
import { FAMILY_CATEGORIES, rememberTransactionCategory } from '../services/categoryService';

interface Props {
  userId?: string;
  transactions: Transaction[];
  setTransactions?: React.Dispatch<React.SetStateAction<Transaction[]>>;
}

const formatEUR = (v: number) => new Intl.NumberFormat('nb-NO', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(v);

const VAR_META = {
  low:    { label: 'Stabilt',    icon: Minus,        color: 'emerald' },
  medium: { label: 'Middels',    icon: TrendingUp,   color: 'amber' },
  high:   { label: 'Svingninger', icon: TrendingDown, color: 'rose' },
} as const;

const NOTES_KEY = 'familyhub_budget_category_notes';
const DEFAULT_NOTES: Record<string, string> = {
  Diverse: 'Daniel Gallardo Lope er utgifter for Dona Anna — bearbeiding av olivenlunden.',
  Lønn: 'Maria Safrina Bialon = husleie for leilighet i Benidorm (ikke lønn).',
  Mondeo: 'Daniel Gallardo Lope er utgifter for Dona Anna — bearbeiding av olivenlunden.',
};

function loadNotes(): Record<string, string> {
  try {
    const raw = localStorage.getItem(NOTES_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  // Første gang: sett inn defaults
  try { localStorage.setItem(NOTES_KEY, JSON.stringify(DEFAULT_NOTES)); } catch {}
  return { ...DEFAULT_NOTES };
}

const KNOWN_VENDOR_RULES: Array<{ match: RegExp; category: string; label: string }> = [
  { match: /daniel\s*gallardo/i, category: 'Dona Anna', label: 'Daniel Gallardo → Dona Anna' },
  { match: /maria\s*safrina\s*bialon/i, category: 'Husleie', label: 'Maria Safrina Bialon → Husleie' },
  { match: /agrodisa/i, category: 'Dona Anna', label: 'AGRODISA → Dona Anna' },
];

export const AutoBudgetSuggestion: React.FC<Props> = ({ userId, transactions, setTransactions }) => {
  const [suggestions, setSuggestions] = useState<CategoryBudgetSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [notes, setNotes] = useState<Record<string, string>>(loadNotes);
  const [editingCat, setEditingCat] = useState<string | null>(null);
  const [draftNote, setDraftNote] = useState('');
  const [reclassifyingVendor, setReclassifyingVendor] = useState<string | null>(null);
  const [applyingRules, setApplyingRules] = useState(false);

  const saveNote = (cat: string, text: string) => {
    const next = { ...notes };
    const trimmed = text.trim();
    if (trimmed) next[cat] = trimmed;
    else delete next[cat];
    setNotes(next);
    try { localStorage.setItem(NOTES_KEY, JSON.stringify(next)); } catch {}
    setEditingCat(null);
  };

  const reclassifyVendor = (vendorSubstring: string, newCategory: string) => {
    if (!setTransactions) return;
    const needle = vendorSubstring.toLowerCase();
    let count = 0;
    setTransactions((prev) => prev.map((t) => {
      const hay = (t.description || '').toLowerCase();
      if (hay.includes(needle)) {
        count++;
        return { ...t, category: newCategory };
      }
      return t;
    }));
    rememberTransactionCategory({ description: vendorSubstring, vendor: vendorSubstring, category: newCategory });
    setReclassifyingVendor(null);
    if (count > 0) setTimeout(() => alert(`${count} transaksjoner reklassifisert til "${newCategory}"`), 100);
  };

  const applyKnownRules = () => {
    if (!setTransactions) return;
    setApplyingRules(true);
    let total = 0;
    setTransactions((prev) => prev.map((t) => {
      const desc = (t.description || '');
      for (const rule of KNOWN_VENDOR_RULES) {
        if (rule.match.test(desc)) {
          if (t.category !== rule.category) {
            total++;
            return { ...t, category: rule.category };
          }
        }
      }
      return t;
    }));
    KNOWN_VENDOR_RULES.forEach((r) => rememberTransactionCategory({ description: r.match.source, vendor: r.match.source, category: r.category }));
    setTimeout(() => { setApplyingRules(false); alert(`${total} transaksjoner reklassifisert etter forhåndsdefinerte regler.`); }, 100);
  };

  useEffect(() => {
    if (!userId || transactions.length === 0) return;
    setLoading(true);
    suggestBudget(userId, transactions).then(setSuggestions).finally(() => setLoading(false));
  }, [userId, transactions.length]);

  if (loading) return <div className="card p-5 text-center text-slate-500 text-sm">Beregner budsjett-forslag...</div>;
  if (suggestions.length === 0) return null;

  const totalSuggested = suggestions.reduce((s, c) => s + c.suggestedBudget, 0);
  const totalAverage = suggestions.reduce((s, c) => s + c.averageMonthlyEUR, 0);

  return (
    <div className="card p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-indigo-100 text-indigo-700"><Sparkles className="h-5 w-5" /></div>
          <div>
            <h2 className="text-lg font-bold text-slate-900">Foreslått månedsbudsjett</h2>
            <p className="text-xs text-slate-500">Basert på faktiske utgifter siste 6 måneder</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-[10px] uppercase text-slate-500 font-black tracking-wide">Total</p>
          <p className="text-xl font-black text-slate-900">{formatEUR(totalSuggested)}<span className="text-xs text-slate-500 font-normal">/mnd</span></p>
          <p className="text-[10px] text-slate-500">Snitt: {formatEUR(totalAverage)}</p>
        </div>
      </div>

      {setTransactions && (
        <div className="mb-4 rounded-xl border border-indigo-200 bg-indigo-50 p-3 flex flex-col md:flex-row md:items-center md:justify-between gap-2">
          <div className="text-xs text-indigo-900">
            <p className="font-bold flex items-center gap-1.5"><ArrowRightLeft className="h-3.5 w-3.5" /> Reklassifiser kjente feil-kategoriserte leverandører</p>
            <p className="mt-0.5 text-[11px] text-indigo-700 italic">{KNOWN_VENDOR_RULES.map(r => r.label).join(' · ')}</p>
          </div>
          <button
            type="button"
            onClick={applyKnownRules}
            disabled={applyingRules}
            className="rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 text-xs font-black uppercase tracking-wide disabled:opacity-50"
          >
            {applyingRules ? 'Reklassifiserer…' : 'Kjør reglene nå'}
          </button>
        </div>
      )}

      <div className="space-y-2">
        {suggestions.slice(0, 8).map(s => {
          const meta = VAR_META[s.variability];
          const Icon = meta.icon;
          const overSpent = s.averageMonthlyEUR > s.suggestedBudget * 1.1;
          return (
            <div key={s.category} className={`rounded-2xl border p-3 ${overSpent ? 'border-rose-200 bg-rose-50/40' : 'border-slate-200 bg-white'}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-bold text-slate-900">{s.category}</p>
                    <span className={`inline-flex items-center gap-1 rounded-full bg-${meta.color}-100 text-${meta.color}-800 px-2 py-0.5 text-[10px] font-bold uppercase`}>
                      <Icon className="h-2.5 w-2.5" /> {meta.label}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 mt-1">
                    Snitt: <strong>{formatEUR(s.averageMonthlyEUR)}</strong>
                    {' · '}Median: {formatEUR(s.medianMonthlyEUR)}
                    {' · '}{s.monthsUsed} mnd data
                  </p>
                  {s.topVendors.length > 0 && (
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {s.topVendors.map(v => {
                        const key = `${s.category}::${v.vendor}`;
                        return (
                          <span key={v.vendor} className="relative inline-flex items-center gap-1 rounded-full bg-slate-100 text-slate-700 px-2 py-0.5 text-[10px] font-medium">
                            <Store className="h-2.5 w-2.5" /> {v.vendor.slice(0, 20)}: {formatEUR(v.total)}
                            {setTransactions && (
                              <button
                                type="button"
                                onClick={() => setReclassifyingVendor(reclassifyingVendor === key ? null : key)}
                                className="ml-1 text-slate-400 hover:text-indigo-600"
                                title="Reklassifiser denne leverandøren"
                              >
                                <ArrowRightLeft className="h-2.5 w-2.5" />
                              </button>
                            )}
                            {reclassifyingVendor === key && (
                              <div className="absolute z-20 top-full left-0 mt-1 w-56 rounded-xl border border-slate-200 bg-white shadow-lg p-2">
                                <p className="text-[10px] text-slate-500 uppercase font-bold px-1 mb-1">Flytt til kategori:</p>
                                <div className="max-h-48 overflow-y-auto space-y-0.5">
                                  {FAMILY_CATEGORIES.filter(c => c !== s.category).map(cat => (
                                    <button
                                      key={cat}
                                      type="button"
                                      onClick={() => reclassifyVendor(v.vendor, cat)}
                                      className="w-full text-left rounded px-2 py-1 text-[11px] text-slate-700 hover:bg-indigo-50 hover:text-indigo-700"
                                    >
                                      {cat}
                                    </button>
                                  ))}
                                </div>
                                <button type="button" onClick={() => setReclassifyingVendor(null)} className="w-full mt-1 rounded px-2 py-1 text-[10px] text-slate-500 hover:bg-slate-100">Avbryt</button>
                              </div>
                            )}
                          </span>
                        );
                      })}
                    </div>
                  )}
                </div>
                <div className="text-right shrink-0">
                  <p className="text-[10px] uppercase text-slate-500 font-black tracking-wide">Foreslått</p>
                  <p className="text-lg font-black text-slate-900">{formatEUR(s.suggestedBudget)}</p>
                  {overSpent && <p className="text-[10px] text-rose-700 font-bold mt-0.5">Overtrukket snitt</p>}
                </div>
              </div>
              <div className="mt-2 border-t border-slate-100 pt-2">
                {editingCat === s.category ? (
                  <div className="flex items-start gap-2">
                    <textarea
                      value={draftNote}
                      onChange={(e) => setDraftNote(e.target.value)}
                      rows={2}
                      placeholder="Forklar hvorfor disse leverandørene ligger under denne kategorien…"
                      className="flex-1 rounded-lg border border-slate-300 bg-white p-2 text-xs text-slate-700 outline-none focus:border-indigo-400"
                    />
                    <div className="flex flex-col gap-1">
                      <button type="button" onClick={() => saveNote(s.category, draftNote)} className="rounded-md bg-emerald-600 hover:bg-emerald-700 text-white p-1.5" title="Lagre"><Check className="h-3 w-3" /></button>
                      <button type="button" onClick={() => setEditingCat(null)} className="rounded-md bg-slate-200 hover:bg-slate-300 text-slate-700 p-1.5" title="Avbryt"><X className="h-3 w-3" /></button>
                    </div>
                  </div>
                ) : notes[s.category] ? (
                  <div className="flex items-start gap-2 group/note">
                    <p className="flex-1 text-[11px] italic text-slate-600 leading-snug">📝 {notes[s.category]}</p>
                    <button type="button" onClick={() => { setEditingCat(s.category); setDraftNote(notes[s.category] || ''); }} className="opacity-0 group-hover/note:opacity-100 transition text-slate-400 hover:text-indigo-600" title="Rediger note"><Pencil className="h-3 w-3" /></button>
                  </div>
                ) : (
                  <button type="button" onClick={() => { setEditingCat(s.category); setDraftNote(''); }} className="text-[10px] text-slate-400 hover:text-indigo-600 flex items-center gap-1"><Pencil className="h-2.5 w-2.5" /> Legg til note</button>
                )}
              </div>
            </div>
          );
        })}
      </div>
      <p className="mt-3 text-xs text-slate-500">💡 Foreslått = median × 1.1, rundet opp til nærmeste 5€. Median er brukt fordi det er robust mot enkelt-utgifter.</p>
    </div>
  );
};
