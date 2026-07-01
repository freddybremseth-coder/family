import React, { useEffect, useMemo, useState } from 'react';
import { UserConfig, Currency, Language } from '../types';
import { translations } from '../translations';
import { AlertCircle, CheckCircle2, Copy, Database, Home, Globe, MapPin, Key, Save, ShieldCheck, Sparkles, Settings2, PlugZap, Trash2, Lock, Eye, EyeOff, Mail, Loader2 } from 'lucide-react';
import { IntegrationsSettings } from './IntegrationsSettings';
import { HouseholdMembersPanel } from './HouseholdMembersPanel';
import { exportUserData, downloadAsJson } from '../services/gdprExportService';
import { Download, CalendarClock } from 'lucide-react';
import { PRODUCT_MODE, PRODUCT_COPY } from '../config/productMode';
import { MARKETPLACE_MODULES, PLAN_DEFINITIONS } from '../services/adminService';
import { supabase, isSupabaseConfigured } from '../supabase';

interface Props {
  userConfig: UserConfig;
  setUserConfig: React.Dispatch<React.SetStateAction<UserConfig>>;
  onApiUpdate: () => void;
  userId?: string;
}

type SettingsTab = 'profile' | 'security' | 'ai' | 'integrations' | 'saas';

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

export const SettingsManager: React.FC<Props> = ({ userConfig, setUserConfig, onApiUpdate, userId }) => {
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
    { id: 'security' as const, label: 'Sikkerhet og passord', icon: <Lock className="h-4 w-4" /> },
    { id: 'ai' as const, label: 'AI', icon: <Sparkles className="h-4 w-4" /> },
    { id: 'integrations' as const, label: 'Integrasjoner', icon: <PlugZap className="h-4 w-4" /> },
    { id: 'saas' as const, label: 'SaaS-oppsett', icon: <Database className="h-4 w-4" /> },
  ], []);

  // -- Konto + passordendring --
  const [accountEmail, setAccountEmail] = useState<string>('');
  const [createdAt, setCreatedAt] = useState<string>('');
  const [lastSignIn, setLastSignIn] = useState<string>('');
  const [provider, setProvider] = useState<string>('');
  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    supabase.auth.getUser().then(({ data }) => {
      const u = data?.user;
      if (!u) return;
      setAccountEmail(u.email || '');
      setCreatedAt(u.created_at || '');
      setLastSignIn(u.last_sign_in_at || '');
      setProvider((u.app_metadata as any)?.provider || (u.identities?.[0]?.provider) || 'email');
    });
  }, []);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [pwLoading, setPwLoading] = useState(false);
  const [pwStatus, setPwStatus] = useState<{ kind: 'success' | 'error' | 'info' | null; message: string }>({ kind: null, message: '' });

  const passwordStrength = useMemo(() => {
    const pw = newPassword;
    let score = 0;
    if (pw.length >= 8) score += 1;
    if (pw.length >= 12) score += 1;
    if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score += 1;
    if (/\d/.test(pw)) score += 1;
    if (/[^A-Za-z0-9]/.test(pw)) score += 1;
    return Math.min(score, 4);
  }, [newPassword]);
  const strengthLabel = ['Svakt', 'Svakt', 'Greit', 'Bra', 'Sterkt'][passwordStrength];
  const strengthColor = ['bg-rose-500', 'bg-rose-500', 'bg-amber-500', 'bg-lime-500', 'bg-emerald-500'][passwordStrength];

  const handlePasswordChange = async () => {
    setPwStatus({ kind: null, message: '' });
    if (!isSupabaseConfigured()) { setPwStatus({ kind: 'error', message: 'Supabase er ikke konfigurert. Kan ikke endre passord i demo-modus.' }); return; }
    if (newPassword.length < 6) { setPwStatus({ kind: 'error', message: 'Nytt passord må være minst 6 tegn.' }); return; }
    if (newPassword !== confirmPassword) { setPwStatus({ kind: 'error', message: 'De to nye passordene er ikke like.' }); return; }
    if (!accountEmail) { setPwStatus({ kind: 'error', message: 'Fant ikke e-postadresse for kontoen.' }); return; }
    setPwLoading(true);
    try {
      if (currentPassword) {
        const { error: reAuthError } = await supabase.auth.signInWithPassword({ email: accountEmail, password: currentPassword });
        if (reAuthError) { setPwStatus({ kind: 'error', message: 'Nåværende passord stemmer ikke. Sjekk og prøv igjen.' }); setPwLoading(false); return; }
      }
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) setPwStatus({ kind: 'error', message: error.message || 'Klarte ikke å oppdatere passordet.' });
      else { setPwStatus({ kind: 'success', message: 'Passordet er oppdatert. Neste innlogging bruker det nye passordet.' }); setCurrentPassword(''); setNewPassword(''); setConfirmPassword(''); }
    } catch (err: any) { setPwStatus({ kind: 'error', message: err?.message || 'Uventet feil ved passordendring.' }); }
    finally { setPwLoading(false); }
  };

  const handleResetEmail = async () => {
    setPwStatus({ kind: null, message: '' });
    if (!isSupabaseConfigured() || !accountEmail) { setPwStatus({ kind: 'error', message: 'Mangler e-post eller Supabase-konfigurasjon.' }); return; }
    setPwLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(accountEmail, { redirectTo: `${window.location.origin}/?recover=1` });
    setPwLoading(false);
    if (error) setPwStatus({ kind: 'error', message: error.message });
    else setPwStatus({ kind: 'info', message: `Tilbakestillingslenke sendt til ${accountEmail}. Sjekk innboksen.` });
  };

  const formatDate = (iso: string) => {
    if (!iso) return '—';
    try { return new Date(iso).toLocaleString('nb-NO', { dateStyle: 'medium', timeStyle: 'short' }); } catch { return iso; }
  };

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

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
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

      {activeTab === 'profile' && (
        <div className="space-y-6">
          <HouseholdMembersPanel userId={userId} familyName={userConfig.familyName} currentUserEmail={accountEmail} />

          {/* GDPR-eksport + iCal */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <div className="mb-4 flex items-start gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-100 text-slate-700"><Download className="h-5 w-5" /></div>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-slate-900">Eksport og portabilitet</h3>
                <p className="text-sm text-slate-500">Last ned all din data (GDPR) eller kalenderen som iCal.</p>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <button
                type="button"
                onClick={async () => {
                  if (!userId) { alert('Ikke innlogget'); return; }
                  const data = await exportUserData(userId);
                  downloadAsJson(`familyhub-eksport-${new Date().toISOString().slice(0, 10)}.json`, data);
                }}
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-bold text-slate-800 hover:bg-slate-50"
              >
                <Download className="h-4 w-4" /> Last ned alle mine data (JSON)
              </button>
              <a
                href="#"
                onClick={async (e) => {
                  e.preventDefault();
                  if (!userId) { alert('Ikke innlogget'); return; }
                  const { generateIcal, downloadIcal } = await import('../services/icalService');
                  const { supabase: sb } = await import('../supabase');
                  const [{ data: events }, { data: tasks }, { data: holidays }] = await Promise.all([
                    sb.from('calendar_events').select('*').eq('user_id', userId),
                    sb.from('tasks').select('*').eq('user_id', userId),
                    sb.from('family_holidays').select('*').limit(500),
                  ]);
                  const ical = generateIcal({
                    familyName: userConfig.familyName || 'Familien',
                    events: (events || []) as any,
                    tasks: (tasks || []) as any,
                    localEvents: (holidays || []).map((h: any) => ({ date: h.holiday_date, title: h.local_name || h.name, description: h.name, type: h.type })) as any,
                  });
                  downloadIcal(`familyhub-kalender-${new Date().toISOString().slice(0, 10)}.ics`, ical);
                }}
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-bold text-slate-800 hover:bg-slate-50"
              >
                <CalendarClock className="h-4 w-4" /> Last ned kalender (iCal .ics)
              </a>
            </div>
            <p className="mt-3 text-xs text-slate-500">iCal-filen kan importeres eller abonneres på i Apple Kalender, Google Kalender og Outlook.</p>
          </div>
        </div>
      )}

      {activeTab === 'security' && (
        <div className="space-y-6">
          <Card className="p-5 md:p-6">
            <div className="mb-5">
              <h2 className="text-xl font-bold text-slate-900">Konto</h2>
              <p className="mt-1 text-sm text-slate-500">Informasjon om innlogget bruker. E-post brukes til innlogging og passord-tilbakestilling.</p>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500 flex items-center gap-1.5"><Mail className="h-3.5 w-3.5" /> E-post</p>
                <p className="mt-1 text-base font-semibold text-slate-900 break-all">{accountEmail || '—'}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Innloggingsmetode</p>
                <p className="mt-1 text-base font-semibold text-slate-900 capitalize">{provider}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Opprettet</p>
                <p className="mt-1 text-base font-semibold text-slate-900">{formatDate(createdAt)}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Sist innlogget</p>
                <p className="mt-1 text-base font-semibold text-slate-900">{formatDate(lastSignIn)}</p>
              </div>
            </div>
          </Card>

          <Card className="p-5 md:p-6">
            <div className="mb-5">
              <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2"><Lock className="h-5 w-5 text-indigo-500" /> Endre passord</h2>
              <p className="mt-1 text-sm text-slate-500">Sett et nytt passord direkte. Av sikkerhetshensyn anbefales å oppgi nåværende passord for å bekrefte identiteten.</p>
            </div>

            <div className="space-y-4 max-w-xl">
              <div>
                <FieldLabel>Nåværende passord (anbefalt)</FieldLabel>
                <div className="relative mt-2">
                  <Lock className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                  <input type={showCurrent ? 'text' : 'password'} value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} placeholder="••••••••" autoComplete="current-password" className="pl-12 pr-12" />
                  <button type="button" onClick={() => setShowCurrent(s => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-slate-400 hover:bg-slate-100">
                    {showCurrent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div>
                <FieldLabel>Nytt passord</FieldLabel>
                <div className="relative mt-2">
                  <Key className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                  <input type={showNew ? 'text' : 'password'} value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="Minst 6 tegn" autoComplete="new-password" className="pl-12 pr-12" />
                  <button type="button" onClick={() => setShowNew(s => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-slate-400 hover:bg-slate-100">
                    {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {newPassword && (
                  <div className="mt-2 flex items-center gap-2">
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                      <div className={`h-full transition-all ${strengthColor}`} style={{ width: `${(passwordStrength / 4) * 100}%` }} />
                    </div>
                    <span className="text-[11px] font-bold text-slate-600 w-14 text-right">{strengthLabel}</span>
                  </div>
                )}
              </div>

              <div>
                <FieldLabel>Bekreft nytt passord</FieldLabel>
                <div className="relative mt-2">
                  <Key className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                  <input type={showNew ? 'text' : 'password'} value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="Skriv passordet på nytt" autoComplete="new-password" className="pl-12" />
                </div>
                {confirmPassword && newPassword !== confirmPassword && (
                  <p className="mt-1 text-xs text-rose-600">Passordene er ikke like.</p>
                )}
              </div>

              {pwStatus.kind && (
                <div className={`rounded-2xl border p-3 text-sm flex items-start gap-2 ${
                  pwStatus.kind === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' :
                  pwStatus.kind === 'info' ? 'border-sky-200 bg-sky-50 text-sky-800' :
                  'border-rose-200 bg-rose-50 text-rose-800'
                }`}>
                  {pwStatus.kind === 'success' ? <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" /> : <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />}
                  <p>{pwStatus.message}</p>
                </div>
              )}

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <button onClick={handlePasswordChange} disabled={pwLoading || !newPassword || !confirmPassword} className="btn-primary justify-center">
                  {pwLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                  Oppdater passord
                </button>
                <button onClick={handleResetEmail} disabled={pwLoading} className="btn-secondary justify-center">
                  <Mail className="h-4 w-4" /> Send reset-lenke på e-post
                </button>
              </div>

              <p className="text-xs text-slate-500">
                Husker du ikke nåværende passord? Bruk «Send reset-lenke» — du får e-post med lenke til å sette nytt passord.
              </p>
            </div>
          </Card>
        </div>
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
