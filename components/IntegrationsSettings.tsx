import React from 'react';
import { CheckCircle2, Database, KeyRound, PlugZap, ShieldAlert } from 'lucide-react';
import { SUPABASE_REFS, SUPABASE_STATUS } from '../supabase';

function StatusPill({ ok }: { ok: boolean }) {
  return <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${ok ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-amber-200 bg-amber-50 text-amber-700'}`}>{ok ? 'Koblet' : 'Mangler'}</span>;
}

function IntegrationCard({ title, text, url, urlOk, keyOk, keyName, keyLength }: { title: string; text: string; url?: string; urlOk: boolean; keyOk: boolean; keyName?: string; keyLength?: number }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div className="flex gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-600"><Database className="h-5 w-5" /></div>
          <div>
            <h3 className="font-bold text-slate-900">{title}</h3>
            <p className="mt-1 text-sm text-slate-500">{text}</p>
          </div>
        </div>
        <StatusPill ok={urlOk && keyOk} />
      </div>
      <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2">
        <div className="rounded-2xl bg-slate-50 p-4"><p className="text-xs font-semibold uppercase tracking-wide text-slate-400">URL</p><p className="mt-1 break-all text-sm font-medium text-slate-700">{url || 'Ikke satt'}</p></div>
        <div className="rounded-2xl bg-slate-50 p-4"><p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Key</p><p className="mt-1 text-sm font-medium text-slate-700">{keyOk ? `Funnet${keyName ? ` via ${keyName}` : ''}` : 'Mangler i build'}</p>{typeof keyLength === 'number' && <p className="mt-1 text-xs text-slate-500">Lengde: {keyLength}</p>}</div>
      </div>
    </div>
  );
}

export const IntegrationsSettings: React.FC = () => {
  const allOk = SUPABASE_STATUS.familyKeyConfigured && SUPABASE_STATUS.realtyflowKeyConfigured && SUPABASE_STATUS.donaAnnaKeyConfigured;
  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-900 text-white"><PlugZap className="h-5 w-5" /></div>
          <div>
            <h2 className="text-xl font-bold text-slate-900">Integrasjoner</h2>
            <p className="mt-1 text-sm text-slate-500">Teknisk status for Supabase, RealtyFlow og Dona Anna. Denne siden er ment for admin/support, ikke vanlig familiebruk.</p>
          </div>
        </div>
      </section>

      <div className={`rounded-2xl border p-4 ${allOk ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50'}`}>
        <div className="flex items-start gap-3">
          {allOk ? <CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-700" /> : <ShieldAlert className="mt-0.5 h-5 w-5 text-amber-700" />}
          <div><p className={`font-bold ${allOk ? 'text-emerald-900' : 'text-amber-900'}`}>{allOk ? 'Alle hovedintegrasjoner er konfigurert' : 'Én eller flere integrasjoner mangler key i build'}</p><p className={`mt-1 text-sm ${allOk ? 'text-emerald-700' : 'text-amber-700'}`}>Vite-miljøvariabler må være satt før build/redeploy.</p></div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <IntegrationCard title="FamilyHub" text="Egne familie-data, innlogging og app-state." url={SUPABASE_REFS.family} urlOk={SUPABASE_STATUS.familyUrlConfigured} keyOk={SUPABASE_STATUS.familyKeyConfigured} />
        <IntegrationCard title="RealtyFlow" text="Soleada, ZenEcoHomes og eiendomsprovisjoner." url={SUPABASE_REFS.realtyflow} urlOk={SUPABASE_STATUS.realtyflowUrlConfigured} keyOk={SUPABASE_STATUS.realtyflowKeyConfigured} keyName={SUPABASE_STATUS.realtyflowResolvedKeyName} keyLength={SUPABASE_STATUS.realtyflowKeyLength} />
        <IntegrationCard title="Dona Anna / Olivia" text="Gårdsdrift, olje, inntekter og kostnader." url={SUPABASE_REFS.donaAnna} urlOk={SUPABASE_STATUS.donaAnnaUrlConfigured} keyOk={SUPABASE_STATUS.donaAnnaKeyConfigured} keyName={SUPABASE_STATUS.donaAnnaResolvedKeyName} keyLength={SUPABASE_STATUS.donaAnnaKeyLength} />
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-start gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-100 text-slate-600"><KeyRound className="h-5 w-5" /></div><div><h3 className="font-bold text-slate-900">Godkjente variabelnavn</h3><p className="mt-1 text-sm text-slate-500">Disse navnene kan brukes i Vercel. Selve nøklene vises aldri i appen.</p><div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2"><div className="rounded-2xl bg-slate-50 p-4"><p className="mb-2 text-sm font-bold text-slate-800">RealtyFlow</p>{SUPABASE_STATUS.realtyflowAcceptedKeyNames.map((name) => <p key={name} className="font-mono text-xs text-slate-500">{name}</p>)}</div><div className="rounded-2xl bg-slate-50 p-4"><p className="mb-2 text-sm font-bold text-slate-800">Dona Anna / Olivia</p>{SUPABASE_STATUS.donaAnnaAcceptedKeyNames.map((name) => <p key={name} className="font-mono text-xs text-slate-500">{name}</p>)}</div></div></div></div>
      </section>
    </div>
  );
};
