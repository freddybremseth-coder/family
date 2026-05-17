import React, { useMemo, useState } from 'react';
import { UserConfig, Currency, Language } from '../types';
import { translations } from '../translations';
import { CheckCircle2, Copy, Database, Home, Globe, MapPin, Key, Save, ShieldCheck, Sparkles, Settings2, PlugZap, Trash2 } from 'lucide-react';
import { IntegrationsSettings } from './IntegrationsSettings';
import { PRODUCT_MODE, PRODUCT_COPY } from '../config/productMode';
import { MARKETPLACE_MODULES, PLAN_DEFINITIONS } from '../services/adminService';

interface Props {
  userConfig: UserConfig;
  setUserConfig: React.Dispatch<React.SetStateAction<UserConfig>>;
  onApiUpdate: () => void;
}

type SettingsTab = 'profile' | 'ai' | 'integrations' | 'saas';

type AiKeyName = 'user_gemini_api_key' | 'user_openai_api_key' | 'user_claude_api_key';

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-2xl border border-slate-200 bg-white shadow-sm ${className}`}>{children}</div>;
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <span className="text-sm font-medium text-slate-700">{children}</span>;
}

function SaveButton({ saved, onClick }: { saved: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} className="btn-primary w-full md:w-auto">
      {saved ? <ShieldCheck className="h-4 w-4" /> : <Save className="h-4 w-4" />}
      {saved ? 'Lagret' : 'Lagre innstillinger'}
    </button>
  );
}

function maskedStatus(value: string) {
  if (!value) return 'Ikke lagt inn';
  if (value.length <= 8) return 'Lagt inn';
  return `Lagt inn · ${value.slice(0, 4)}…${value.slice(-4)}`;
}

function copyText(text: string) {
  navigator.clipboard?.writeText(text).catch(() => {});
}

export const SettingsManager: React.FC<Props> = ({ userConfig, setUserConfig, onApiUpdate }) => {
  const [aiKeys, setAiKeys] = useState<Record<AiKeyName, string>>({
    user_gemini_api_key: localStorage.getItem('user_gemini_api_key') || '',
    user_openai_api_key: localStorage.getItem('user_openai_api_key') || '',
    user_claude_api_key: localStorage.getItem('user_claude_api_key') || '',
  });
  const [saved, setSaved] = useState(false);
  const [activeTab, setActiveTab] = useState<SettingsTab>('profile');
  const t = translations[userConfig.language];

  const tabs = useMemo(() => [
    { id: 'profile' as const, label: 'Familie og app', icon: <Settings2 className="h-4 w-4" /> },
    { id: 'ai' as const, label: 'AI', icon: <Sparkles className="h-4 w-4" /> },
    { id: 'integrations' as const, label: 'Integrasjoner', icon: <PlugZap className="h-4 w-4" /> },
    { id: 'saas' as const, label: 'SaaS-oppsett', icon: <Database className="h-4 w-4" /> },
  ], []);

  const handleSave = () => {
    Object.entries(aiKeys).forEach(([key, value]) => {
      const cleaned = String(value || '').trim();
      if (cleaned) localStorage.setItem(key, cleaned);
      else localStorage.removeItem(key);
    });
    onApiUpdate();
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const clearAiKey = (key: AiKeyName) => {
    setAiKeys(prev => ({ ...prev, [key]: '' }));
    localStorage.removeItem(key);
    onApiUpdate();
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const updateAiKey = (key: AiKeyName, value: string) => setAiKeys(prev => ({ ...prev, [key]: value }));

  const envTemplate = `VITE_SUPABASE_URL=https://<kundens-prosjekt>.supabase.co\nVITE_SUPABASE_ANON_KEY=<kundens-anon-key>\nVITE_APP_MODE=saas\nVITE_ADMIN_EMAILS=<kundens-admin-epost>\n\n# Valgfritt per installasjon\nVITE_REALTYFLOW_SUPABASE_URL=\nVITE_REALTYFLOW_SUPABASE_ANON_KEY=`;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <section className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-slate-900 text-white"><Settings2 className="h-5 w-5" /></div>
            <span className="inline-flex rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">{PRODUCT_MODE === 'saas' ? 'SaaS' : 'Privat'} modus</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 md:text-5xl">Innstillinger</h1>
          <p className="mt-3 max-w-3xl text-base text-slate-600 md:text-lg">{PRODUCT_COPY[PRODUCT_MODE].tagline}</p>
        </div>
        <SaveButton saved={saved} onClick={handleSave} />
      </section>

      <section className="grid grid-cols-1 gap-3 md:grid-cols-4">
        {tabs.map((tab) => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`rounded-2xl border p-4 text-left transition ${activeTab === tab.id ? 'border-slate-900 bg-white shadow-sm ring-2 ring-slate-200' : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'}`}>
            <div className="flex items-center gap-3">
              <div className={`flex h-10 w-10 items-center justify-center rounded-2xl ${activeTab === tab.id ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700'}`}>{tab.icon}</div>
              <p className="font-bold text-slate-900">{tab.label}</p>
            </div>
          </button>
        ))}
      </section>

      {activeTab === 'profile' && (
        <Card className="p-5 md:p-6">
          <div className="mb-6">
            <h2 className="text-xl font-bold text-slate-900">Familie, adresse og app</h2>
            <p className="mt-1 text-sm text-slate-500">Grunninnstillinger for household/familie, lokasjon, adresse og visning i appen.</p>
          </div>
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <label className="block space-y-2">
              <FieldLabel>{t.family_name || 'Familienavn'}</FieldLabel>
              <div className="relative">
                <Home className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                <input value={userConfig.familyName} onChange={e => setUserConfig({ ...userConfig, familyName: e.target.value.toUpperCase() })} className="pl-12" placeholder="F.eks. BREMSETH" />
              </div>
              <p className="text-xs text-slate-500">Familienavn brukes som visningsnavn. Systemet lager egen family_id/household-id ved registrering.</p>
            </label>
            <label className="block space-y-2">
              <FieldLabel>{t.location || 'Lokasjon'}</FieldLabel>
              <div className="relative">
                <MapPin className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                <input value={userConfig.location} onChange={e => setUserConfig({ ...userConfig, location: e.target.value })} className="pl-12" placeholder="By / land, f.eks. Alicante, Spania" />
              </div>
            </label>
            <label className="block space-y-2 md:col-span-2">
              <FieldLabel>Adresse</FieldLabel>
              <div className="relative">
                <MapPin className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                <input value={userConfig.address || ''} onChange={e => setUserConfig({ ...userConfig, address: e.target.value })} className="pl-12" placeholder="Gateadresse, postnummer, sted og land" />
              </div>
              <p className="text-xs text-slate-500">Brukes som familiens household-informasjon i dokumentarkiv og senere for avtaler, forsikring, bolig og bank.</p>
            </label>
            <label className="block space-y-2">
              <FieldLabel>{t.language || 'Språk'}</FieldLabel>
              <div className="relative">
                <Globe className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                <select value={userConfig.language} onChange={e => setUserConfig({ ...userConfig, language: e.target.value as Language })} className="pl-12">
                  <option value="no">Norsk</option><option value="en">English</option><option value="ru">Русский</option><option value="es">Español</option><option value="fr">Français</option><option value="de">Deutsch</option>
                </select>
              </div>
            </label>
            <label className="block space-y-2">
              <FieldLabel>{t.currency_preference || 'Valuta'}</FieldLabel>
              <select value={userConfig.preferredCurrency} onChange={e => setUserConfig({ ...userConfig, preferredCurrency: e.target.value as Currency })}>
                <option value="NOK">NOK (kr)</option><option value="EUR">EUR (€)</option>
              </select>
            </label>
          </div>
        </Card>
      )}

      {activeTab === 'ai' && (
        <Card className="p-5 md:p-6">
          <div className="mb-6"><h2 className="text-xl font-bold text-slate-900">AI-nøkler</h2><p className="mt-1 text-sm text-slate-500">Hver bruker/familie må bruke egne nøkler. Kvitteringsscan og kontoutskrift bruker fallback: Gemini → OpenAI → Claude.</p></div>
          <div className="space-y-5">
            {[
              { key: 'user_gemini_api_key' as AiKeyName, label: 'Gemini API key', placeholder: 'AIza…', help: 'Brukes først for kvittering, kontoutskrift, dokumenter, kalender og AI-innsikt.' },
              { key: 'user_openai_api_key' as AiKeyName, label: 'OpenAI API key', placeholder: 'sk-…', help: 'Fallback for kvitteringsscan og kontoutskrift dersom Gemini feiler.' },
              { key: 'user_claude_api_key' as AiKeyName, label: 'Claude / Anthropic API key', placeholder: 'sk-ant-…', help: 'Siste fallback for kvitteringsscan og kontoutskrift.' },
            ].map((field) => (
              <div key={field.key} className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="mb-3 flex flex-col gap-2 md:flex-row md:items-center md:justify-between"><div><FieldLabel>{field.label}</FieldLabel><p className="mt-1 text-xs text-slate-500">{field.help}</p></div><span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-bold text-slate-600">{maskedStatus(aiKeys[field.key])}</span></div>
                <div className="flex flex-col gap-3 md:flex-row"><div className="relative flex-1"><Key className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" /><input type="password" value={aiKeys[field.key]} onChange={e => updateAiKey(field.key, e.target.value)} className="pl-12" placeholder={field.placeholder} autoComplete="off" /></div><button type="button" onClick={() => clearAiKey(field.key)} className="btn-secondary justify-center text-red-600 hover:bg-red-50"><Trash2 className="h-4 w-4" /> Fjern</button></div>
              </div>
            ))}
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4"><p className="font-bold text-amber-900">SaaS-notat</p><p className="mt-1 text-sm text-amber-800">Nye SaaS-brukere skal ikke bruke Freddy sine AI-nøkler. De må legge inn egne nøkler, eller du må tilby en betalt managed AI-pakke med kryptert lagring per household.</p></div>
          </div>
        </Card>
      )}

      {activeTab === 'integrations' && <IntegrationsSettings />}

      {activeTab === 'saas' && (
        <div className="space-y-6">
          <Card className="p-5 md:p-6">
            <div className="mb-5 flex items-start gap-3"><Database className="mt-1 h-5 w-5 text-slate-600" /><div><h2 className="text-xl font-bold text-slate-900">SaaS-oppsett for ny kunde</h2><p className="mt-1 text-sm text-slate-500">Kunden skal bruke egen Supabase og egne AI-nøkler. Dette hindrer at dine RealtyFlow/FamilyHub-data blandes med kundedata.</p></div></div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {[
                ['1. Opprett Supabase-prosjekt', 'Kunden oppretter eget Supabase-prosjekt, kjører FamilyHub-migrasjoner og aktiverer Auth.'],
                ['2. Sett miljøvariabler', 'Legg kundens Supabase URL og anon key i Vercel/hosting. Ikke bruk Freddy sine nøkler.'],
                ['3. Opprett familie', 'Første innlogging lager familienavn, family_id og valg om tom start eller ufarlig random demo-data.'],
                ['4. Legg inn AI-nøkler', 'Kunden legger inn egne Gemini/OpenAI/Claude-nøkler under AI.'],
                ['5. Kjøp moduler', 'Basic kan utvides med moduler som bank, kvittering, dokumentlager, kalender pro og business.'],
                ['6. Kontroller RLS', 'Alle tabeller må filtreres på user_id, household_id eller family_id slik at ingen ser andres data.'],
              ].map(([title, text]) => <div key={title} className="rounded-2xl border border-slate-200 bg-slate-50 p-4"><p className="font-black text-slate-900">{title}</p><p className="mt-2 text-sm leading-6 text-slate-600">{text}</p></div>)}
            </div>
          </Card>

          <Card className="p-5 md:p-6">
            <div className="mb-3 flex items-center justify-between gap-3"><h3 className="text-lg font-black text-slate-900">Vercel/Supabase env-mal</h3><button onClick={() => copyText(envTemplate)} className="btn-secondary text-sm"><Copy className="h-4 w-4" /> Kopier</button></div>
            <pre className="overflow-x-auto rounded-2xl bg-slate-950 p-4 text-xs text-slate-100"><code>{envTemplate}</code></pre>
          </Card>

          <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            {PLAN_DEFINITIONS.map((plan) => <Card key={plan.id} className="p-5"><h3 className="font-black text-slate-900">{plan.label}</h3><p className="mt-2 text-sm leading-6 text-slate-600">{plan.description}</p><p className="mt-4 text-xs font-bold uppercase tracking-wide text-slate-500">{plan.modules.length} moduler</p></Card>)}
          </section>

          <Card className="p-5 md:p-6">
            <h3 className="text-lg font-black text-slate-900">Moduler som bør finnes i en kalender-/familieapp</h3>
            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
              {[
                ['Gjentakelser og regler', 'Ukentlig, annenhver uke, månedlig, skolefri, ferier og egendefinerte regler.'],
                ['Påminnelser', 'Push/e-post/SMS, flere varsler per hendelse og ansvarlig person.'],
                ['Delt ansvar', 'Hvem kjører, hvem henter, hvem betaler, hvem må bekrefte.'],
                ['Familie-/skolekalender', 'Skolerute, helligdager, lokale fiestaer og import fra Google/Apple/Outlook.'],
                ['Avtaler og dokumenter', 'Koble hendelser til forsikring, kontrakt, legepapir, garanti eller kvittering.'],
                ['Ressurser', 'Bil, bolig, rom, utstyr, kjæledyr, nøkler og lånte ting.'],
                ['Likviditet fra kalender', 'Regninger, lønn, provisjon og forventede utgifter vist fremover.'],
                ['AI-forslag', 'Foreslå kategori, oppgave, varsling, dokument og hvem hendelsen gjelder.'],
                ['Modulbutikk', 'Kjøp Kalender Pro, dokumentlager, kvittering/AI, bank/eiendeler og business.'],
              ].map(([title, text]) => <div key={title} className="rounded-2xl border border-slate-200 bg-slate-50 p-4"><p className="font-black text-slate-900"><CheckCircle2 className="mr-2 inline h-4 w-4 text-emerald-600" />{title}</p><p className="mt-2 text-sm leading-6 text-slate-600">{text}</p></div>)}
            </div>
          </Card>

          <Card className="p-5 md:p-6">
            <h3 className="text-lg font-black text-slate-900">Modulbutikk</h3>
            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
              {MARKETPLACE_MODULES.map((module) => <div key={module.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4"><p className="font-black text-slate-900">{module.label}</p><p className="mt-2 text-sm leading-6 text-slate-600">{module.description}</p></div>)}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};
