import React, { useMemo, useState } from 'react';
import { UserConfig, Currency, Language } from '../types';
import { translations } from '../translations';
import { Home, Globe, MapPin, Key, Save, ShieldCheck, Sparkles, Settings2, PlugZap } from 'lucide-react';
import { IntegrationsSettings } from './IntegrationsSettings';
import { PRODUCT_MODE, PRODUCT_COPY } from '../config/productMode';

interface Props {
  userConfig: UserConfig;
  setUserConfig: React.Dispatch<React.SetStateAction<UserConfig>>;
  onApiUpdate: () => void;
}

type SettingsTab = 'profile' | 'ai' | 'integrations';

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

export const SettingsManager: React.FC<Props> = ({ userConfig, setUserConfig, onApiUpdate }) => {
  const [apiKey, setApiKey] = useState(localStorage.getItem('user_gemini_api_key') || '');
  const [saved, setSaved] = useState(false);
  const [activeTab, setActiveTab] = useState<SettingsTab>('profile');
  const t = translations[userConfig.language];

  const tabs = useMemo(() => [
    { id: 'profile' as const, label: 'Familie og app', icon: <Settings2 className="h-4 w-4" /> },
    { id: 'ai' as const, label: 'AI', icon: <Sparkles className="h-4 w-4" /> },
    { id: 'integrations' as const, label: 'Integrasjoner', icon: <PlugZap className="h-4 w-4" /> },
  ], []);

  const handleSave = () => {
    if (apiKey) localStorage.setItem('user_gemini_api_key', apiKey);
    else localStorage.removeItem('user_gemini_api_key');
    onApiUpdate();
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

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

      <section className="grid grid-cols-1 gap-3 md:grid-cols-3">
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
            <h2 className="text-xl font-bold text-slate-900">Familie og app</h2>
            <p className="mt-1 text-sm text-slate-500">Grunninnstillinger for familien og visning i appen.</p>
          </div>
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <label className="block space-y-2">
              <FieldLabel>{t.family_name}</FieldLabel>
              <div className="relative">
                <Home className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                <input value={userConfig.familyName} onChange={e => setUserConfig({ ...userConfig, familyName: e.target.value.toUpperCase() })} className="pl-12" placeholder="F.eks. BREMSETH" />
              </div>
            </label>
            <label className="block space-y-2">
              <FieldLabel>{t.language}</FieldLabel>
              <div className="relative">
                <Globe className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                <select value={userConfig.language} onChange={e => setUserConfig({ ...userConfig, language: e.target.value as Language })} className="pl-12">
                  <option value="no">Norsk</option>
                  <option value="en">English</option>
                  <option value="ru">Русский</option>
                  <option value="es">Español</option>
                  <option value="fr">Français</option>
                  <option value="de">Deutsch</option>
                </select>
              </div>
            </label>
            <label className="block space-y-2">
              <FieldLabel>{t.location}</FieldLabel>
              <div className="relative">
                <MapPin className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                <input value={userConfig.location} onChange={e => setUserConfig({ ...userConfig, location: e.target.value })} className="pl-12" placeholder="By / land" />
              </div>
            </label>
            <label className="block space-y-2">
              <FieldLabel>{t.currency_preference}</FieldLabel>
              <select value={userConfig.preferredCurrency} onChange={e => setUserConfig({ ...userConfig, preferredCurrency: e.target.value as Currency })}>
                <option value="NOK">NOK (kr)</option>
                <option value="EUR">EUR (€)</option>
              </select>
            </label>
          </div>
        </Card>
      )}

      {activeTab === 'ai' && (
        <Card className="p-5 md:p-6">
          <div className="mb-6">
            <h2 className="text-xl font-bold text-slate-900">AI</h2>
            <p className="mt-1 text-sm text-slate-500">Koble til egen AI-nøkkel for kvitteringsskanning, ukemeny og innsikt. Nøkkelen lagres kun i nettleseren.</p>
          </div>
          <div className="space-y-5">
            <label className="block space-y-2">
              <FieldLabel>Gemini API key</FieldLabel>
              <div className="relative">
                <Key className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                <input type="password" value={apiKey} onChange={e => setApiKey(e.target.value)} className="pl-12" placeholder="Lim inn nøkkel her" />
              </div>
            </label>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="font-bold text-slate-900">Slik brukes AI</p>
              <p className="mt-1 text-sm text-slate-500">AI bør være en hjelper, ikke hovedgrensesnittet: skanne kvitteringer, forklare økonomi enkelt, foreslå ukemeny og finne uvanlige utgifter.</p>
            </div>
          </div>
        </Card>
      )}

      {activeTab === 'integrations' && <IntegrationsSettings />}
    </div>
  );
};
