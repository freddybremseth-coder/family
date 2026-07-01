import React, { useEffect, useMemo, useState } from 'react';
import { PiggyBank, Plus, Trash2, Target, TrendingUp, ShoppingBag, CheckCircle2 } from 'lucide-react';
import { FinancialGoal } from '../types';
import { isSupabaseConfigured, supabase } from '../supabase';

interface Props { userId?: string; }

const formatNOK = (v: number) => new Intl.NumberFormat('nb-NO', { style: 'currency', currency: 'NOK', maximumFractionDigits: 0 }).format(Number(v || 0));

const CATEGORY_META = {
  Savings:    { label: 'Sparing',    icon: PiggyBank,  color: 'emerald' },
  Investment: { label: 'Investering', icon: TrendingUp, color: 'indigo' },
  Purchase:   { label: 'Kjøp',        icon: ShoppingBag, color: 'amber' },
} as const;

export const GoalsManager: React.FC<Props> = ({ userId }) => {
  const [goals, setGoals] = useState<FinancialGoal[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [targetAmount, setTargetAmount] = useState('');
  const [currentAmount, setCurrentAmount] = useState('');
  const [deadline, setDeadline] = useState('');
  const [category, setCategory] = useState<FinancialGoal['category']>('Savings');

  useEffect(() => {
    if (!userId) { setLoading(false); return; }
    (async () => {
      let loaded = false;
      try {
        if (isSupabaseConfigured()) {
          const { data, error } = await supabase.from('financial_goals').select('*').eq('user_id', userId).order('deadline', { ascending: true });
          if (!error && data) {
            setGoals(data.map((r: any) => ({ id: r.id, name: r.name, targetAmount: Number(r.target_amount), currentAmount: Number(r.current_amount), deadline: r.deadline ?? undefined, category: r.category })));
            loaded = true;
          } else if (error) {
            console.warn('[Goals] tabell ikke tilgjengelig (kjør migrasjon):', error.message);
          }
        }
      } catch (e) { console.warn('[Goals] fetch feil:', e); }
      if (!loaded) {
        try {
          const local = localStorage.getItem(`financial_goals_${userId}`);
          if (local) setGoals(JSON.parse(local));
        } catch {}
      }
      setLoading(false);
    })();
  }, [userId]);

  const persistGoals = async (next: FinancialGoal[]) => {
    setGoals(next);
    if (!userId) return;
    try { localStorage.setItem(`financial_goals_${userId}`, JSON.stringify(next)); } catch {}
    if (isSupabaseConfigured()) {
      try {
        await supabase.from('financial_goals').upsert(next.map(g => ({ id: g.id, user_id: userId, name: g.name, target_amount: g.targetAmount, current_amount: g.currentAmount, deadline: g.deadline ?? null, category: g.category })));
      } catch {}
    }
  };

  const addGoal = async () => {
    const target = Number(targetAmount || 0);
    const current = Number(currentAmount || 0);
    if (!name.trim() || target <= 0) { setError('Fyll inn navn og et positivt målbeløp.'); return; }
    setSaving(true);
    setError(null);
    try {
      const newGoal: FinancialGoal = {
        id: `goal-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        name: name.trim(),
        targetAmount: target,
        currentAmount: current,
        deadline: deadline || undefined,
        category,
      };
      await persistGoals([...goals, newGoal].sort((a, b) => (a.deadline || '9999').localeCompare(b.deadline || '9999')));
      setName(''); setTargetAmount(''); setCurrentAmount(''); setDeadline(''); setCategory('Savings');
    } finally { setSaving(false); }
  };

  const updateAmount = async (id: string, currentAmount: number) => {
    await persistGoals(goals.map(g => g.id === id ? { ...g, currentAmount } : g));
  };

  const removeGoal = async (id: string) => {
    if (!confirm('Slette dette sparemålet?')) return;
    if (userId && isSupabaseConfigured()) {
      try { await supabase.from('financial_goals').delete().eq('id', id); } catch {}
    }
    await persistGoals(goals.filter(g => g.id !== id));
  };

  const summary = useMemo(() => ({
    totalTarget: goals.reduce((s, g) => s + g.targetAmount, 0),
    totalCurrent: goals.reduce((s, g) => s + g.currentAmount, 0),
    completed: goals.filter(g => g.currentAmount >= g.targetAmount).length,
  }), [goals]);

  if (loading) return <div className="card p-6 text-center text-slate-500">Laster sparemål...</div>;

  return (
    <div className="space-y-6">
      <div className="card p-5">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700"><Target className="h-5 w-5" /></div>
          <div><h2 className="text-xl font-bold text-slate-900">Sparemål</h2><p className="text-sm text-slate-500">Sett tydelige mål for familien og se fremgang.</p></div>
        </div>

        {error && <div className="mb-3 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

        <div className="grid grid-cols-1 gap-3 md:grid-cols-6 mb-4">
          <input value={name} onChange={e => setName(e.target.value)} placeholder="Målnavn (f.eks. Buffer 6 mnd)" className="md:col-span-2" />
          <input type="number" value={targetAmount} onChange={e => setTargetAmount(e.target.value)} placeholder="Mål NOK" />
          <input type="number" value={currentAmount} onChange={e => setCurrentAmount(e.target.value)} placeholder="Nå NOK" />
          <input type="date" value={deadline} onChange={e => setDeadline(e.target.value)} />
          <select value={category} onChange={e => setCategory(e.target.value as FinancialGoal['category'])}>
            <option value="Savings">Sparing</option>
            <option value="Investment">Investering</option>
            <option value="Purchase">Kjøp</option>
          </select>
        </div>
        <button onClick={addGoal} disabled={saving} className="btn-primary w-full md:w-auto"><Plus className="h-4 w-4" /> Legg til mål</button>
      </div>

      {goals.length === 0 ? (
        <div className="card p-8 text-center">
          <PiggyBank className="mx-auto h-12 w-12 text-slate-300" />
          <p className="mt-3 font-bold text-slate-700">Ingen sparemål ennå</p>
          <p className="mt-1 text-sm text-slate-500">Sett første mål — f.eks. "Buffer 6 mnd" eller "Ferie Spania 2027"</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="card p-4"><p className="text-xs text-slate-500 uppercase font-black tracking-wide">Totalt mål</p><p className="mt-1 text-2xl font-black text-slate-900">{formatNOK(summary.totalTarget)}</p></div>
            <div className="card p-4"><p className="text-xs text-slate-500 uppercase font-black tracking-wide">Spart hittil</p><p className="mt-1 text-2xl font-black text-emerald-700">{formatNOK(summary.totalCurrent)}</p></div>
            <div className="card p-4"><p className="text-xs text-slate-500 uppercase font-black tracking-wide">Fullført</p><p className="mt-1 text-2xl font-black text-slate-900">{summary.completed} / {goals.length}</p></div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {goals.map(goal => {
              const pct = goal.targetAmount > 0 ? Math.min(100, Math.round((goal.currentAmount / goal.targetAmount) * 100)) : 0;
              const meta = CATEGORY_META[goal.category];
              const Icon = meta.icon;
              const done = goal.currentAmount >= goal.targetAmount;
              const daysLeft = goal.deadline ? Math.round((new Date(goal.deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : null;
              return (
                <div key={goal.id} className={`card p-5 ${done ? 'border-emerald-300 bg-emerald-50' : ''}`}>
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className={`flex h-9 w-9 items-center justify-center rounded-xl bg-${meta.color}-100 text-${meta.color}-700`}><Icon className="h-4 w-4" /></div>
                      <div>
                        <p className="font-black text-slate-900">{goal.name}</p>
                        <p className="text-xs text-slate-500">{meta.label}{goal.deadline ? ` · ${new Date(goal.deadline).toLocaleDateString('nb-NO', { day: 'numeric', month: 'short', year: 'numeric' })}` : ''}</p>
                      </div>
                    </div>
                    <button onClick={() => removeGoal(goal.id)} className="p-1 text-slate-400 hover:text-rose-600"><Trash2 className="h-4 w-4" /></button>
                  </div>

                  <div className="flex items-baseline justify-between">
                    <p className="text-xs text-slate-500">Fremdrift</p>
                    <p className="text-xs font-bold text-slate-700">{pct} %</p>
                  </div>
                  <div className="mt-1 h-3 overflow-hidden rounded-full bg-slate-100">
                    <div className={`h-full rounded-full ${done ? 'bg-emerald-500' : 'bg-slate-900'}`} style={{ width: `${pct}%` }} />
                  </div>

                  <div className="mt-3 flex items-baseline justify-between text-sm">
                    <span className="text-slate-600">Nå: <strong className="font-mono text-slate-900">{formatNOK(goal.currentAmount)}</strong></span>
                    <span className="text-slate-500">/ <strong className="font-mono">{formatNOK(goal.targetAmount)}</strong></span>
                  </div>

                  <div className="mt-3 flex items-center gap-2">
                    <input type="number" placeholder="Ny nåværende NOK" className="flex-1 text-xs" onKeyDown={(e) => { if (e.key === 'Enter') { const v = Number((e.target as HTMLInputElement).value); if (!Number.isNaN(v)) { updateAmount(goal.id, v); (e.target as HTMLInputElement).value = ''; } } }} />
                    {daysLeft !== null && <span className={`text-[10px] font-black uppercase ${daysLeft < 0 ? 'text-rose-600' : daysLeft <= 30 ? 'text-amber-600' : 'text-slate-500'}`}>{daysLeft < 0 ? `${Math.abs(daysLeft)} d over` : `${daysLeft} d`}</span>}
                  </div>
                  {done && <div className="mt-2 flex items-center gap-1 text-xs font-bold text-emerald-700"><CheckCircle2 className="h-3 w-3" /> Målet er nådd!</div>}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
};
