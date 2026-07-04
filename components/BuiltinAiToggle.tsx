import React, { useEffect, useState } from 'react';
import { Sparkles, Zap, AlertCircle } from 'lucide-react';
import { isBuiltinAiEnabled, setBuiltinAiEnabled } from '../services/aiProxyService';
import { supabase, isSupabaseConfigured } from '../supabase';

export const BuiltinAiToggle: React.FC = () => {
  const [enabled, setEnabled] = useState(isBuiltinAiEnabled());
  const [usage, setUsage] = useState<{ used: number; limit: number; plan: string } | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!enabled || !isSupabaseConfigured()) return;
    setLoading(true);
    (async () => {
      try {
        const { data: userData } = await supabase.auth.getUser();
        if (!userData.user) return;
        const today = new Date().toISOString().slice(0, 10);
        const { count } = await supabase
          .from('ai_usage_log')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', userData.user.id)
          .gte('created_at', `${today}T00:00:00Z`);
        const { data: profile } = await supabase
          .from('user_profiles')
          .select('subscription_status')
          .eq('id', userData.user.id)
          .maybeSingle();
        const plan = profile?.subscription_status || 'free';
        const limits: Record<string, number> = { free: 5, trial: 50, family: 100, business: 1000, advisor: 5000, lifetime: 10000 };
        setUsage({ used: count ?? 0, limit: limits[plan] ?? 5, plan });
      } catch (e) {
        console.warn('[BuiltinAiToggle] usage-fetch feilet', e);
      } finally {
        setLoading(false);
      }
    })();
  }, [enabled]);

  const toggle = () => {
    const next = !enabled;
    setEnabled(next);
    setBuiltinAiEnabled(next);
  };

  return (
    <div className="rounded-2xl border-2 border-indigo-200 bg-gradient-to-br from-indigo-50 to-purple-50 p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-indigo-600" />
            <p className="font-black text-indigo-900">Bruk innebygd AI (SaaS)</p>
            <span className="rounded-full bg-indigo-600 text-white px-2 py-0.5 text-[10px] font-bold uppercase">Beta</span>
          </div>
          <p className="mt-1 text-sm text-indigo-800">
            FamilyHub bruker egne AI-nøkler for deg — du slipper å håndtere Gemini/Claude/OpenAI-nøkler selv. Kvote inkludert i din plan.
          </p>
          {enabled && usage && (
            <div className="mt-3 flex items-center gap-3">
              <div className="flex-1 rounded-full bg-white border border-indigo-200 h-2 overflow-hidden">
                <div className="h-full bg-indigo-500 transition-all" style={{ width: `${Math.min(100, (usage.used / usage.limit) * 100)}%` }} />
              </div>
              <span className="text-xs font-bold text-indigo-900 font-mono whitespace-nowrap">
                {usage.used} / {usage.limit} <span className="text-indigo-600 font-normal">i dag</span>
              </span>
            </div>
          )}
          {enabled && usage && usage.used >= usage.limit && (
            <div className="mt-2 flex items-center gap-1.5 text-xs text-rose-700">
              <AlertCircle className="h-3.5 w-3.5" /> Kvote nådd — oppgrader planen for høyere grense (plan: <strong>{usage.plan}</strong>)
            </div>
          )}
          {enabled && loading && <p className="mt-2 text-xs text-indigo-600 italic">Laster bruksstatistikk …</p>}
        </div>
        <button
          type="button"
          onClick={toggle}
          className={`relative inline-flex h-7 w-14 items-center rounded-full transition-colors ${enabled ? 'bg-indigo-600' : 'bg-slate-300'}`}
          aria-label="Toggle innebygd AI"
        >
          <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${enabled ? 'translate-x-8' : 'translate-x-1'}`} />
        </button>
      </div>
      {!enabled && (
        <p className="mt-2 text-[11px] text-indigo-700 italic">
          <Zap className="inline h-3 w-3" /> Skru på for å slippe å legge inn egne nøkler over. Du kan alltid gå tilbake til bring-your-own-key ved å skru av.
        </p>
      )}
    </div>
  );
};
