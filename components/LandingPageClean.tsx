import React, { useState } from 'react';
import { supabase, isSupabaseConfigured, SUPABASE_REFS, SUPABASE_STATUS } from '../supabase';
import { translations } from '../translations';
import { Language } from '../types';
import { ArrowRight, CalendarDays, CheckCircle2, CreditCard, FileText, Heart, Home, Loader2, LockKeyhole, ScanLine, ShieldCheck, ShoppingCart, X } from 'lucide-react';

interface LoginResult {
  ok?: boolean;
  error?: string;
}

interface Props {
  onLogin: (credentials: { email: string; password?: string }) => Promise<LoginResult | void> | LoginResult | void;
  lang: Language;
  setLang: (l: Language) => void;
}

const LANG_LABELS: Record<Language, string> = {
  no: 'Norsk', en: 'English', es: 'Español', ru: 'Русский', fr: 'Français', de: 'Deutsch'
};

function familySupabaseMissingMessage() {
  return [
    'FamilyHub Supabase er ikke konfigurert for innlogging/opprettelse av familie.',
    `Family URL konfigurert: ${SUPABASE_STATUS.familyUrlConfigured ? 'ja' : 'nei'}`,
    `Family key konfigurert: ${SUPABASE_STATUS.familyKeyConfigured ? 'ja' : 'nei'}`,
    `Family URL i build: ${SUPABASE_REFS.family || 'mangler'}`,
    `Family key-navn: ${SUPABASE_STATUS.familyResolvedKeyName || 'mangler'}`,
    'Legg inn VITE_SUPABASE_URL og VITE_SUPABASE_ANON_KEY i Vercel, eller VITE_FAMILY_SUPABASE_URL og VITE_FAMILY_SUPABASE_ANON_KEY. Redeploy etterpå.',
  ].join('\n');
}

function AppDemo() {
  return (
    <div className="mx-auto max-w-[460px] rounded-[2rem] border border-slate-200 bg-white p-3 shadow-2xl shadow-slate-200/70">
      <div className="rounded-[1.5rem] bg-slate-50 p-4">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2"><div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-slate-900 text-white"><Heart className="h-4 w-4" /></div><div><p className="text-sm font-black text-slate-900">FamilieHub</p><p className="text-xs text-slate-500">Bremseth</p></div></div>
          <div className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">Live</div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-semibold text-slate-500">I dag</p>
          <h3 className="mt-1 text-xl font-black text-slate-900">2 aktiviteter · 1 dokument</h3>
          <div className="mt-4 space-y-3">
            <div className="flex items-center gap-3 rounded-2xl bg-slate-50 p-3"><CalendarDays className="h-5 w-5 text-slate-600" /><div><p className="text-sm font-bold text-slate-900">15:30 Fotballtrening</p><p className="text-xs text-slate-500">Gjelder: Jonas</p></div></div>
            <div className="flex items-center gap-3 rounded-2xl bg-slate-50 p-3"><FileText className="h-5 w-5 text-slate-600" /><div><p className="text-sm font-bold text-slate-900">Bilforsikring</p><p className="text-xs text-slate-500">Utløper om 42 dager</p></div></div>
            <div className="flex items-center gap-3 rounded-2xl bg-slate-50 p-3"><CreditCard className="h-5 w-5 text-slate-600" /><div><p className="text-sm font-bold text-slate-900">Nettoformue</p><p className="text-xs text-slate-500">Eiendeler, lån og kontoer samlet</p></div></div>
          </div>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-3"><p className="text-xs text-slate-500">Kalender</p><p className="text-lg font-black text-slate-900">8</p></div>
          <div className="rounded-2xl border border-slate-200 bg-white p-3"><p className="text-xs text-slate-500">Dokumenter</p><p className="text-lg font-black text-slate-900">24</p></div>
          <div className="rounded-2xl border border-slate-200 bg-white p-3"><p className="text-xs text-slate-500">Oppgaver</p><p className="text-lg font-black text-slate-900">5</p></div>
        </div>
      </div>
    </div>
  );
}

export const LandingPageClean: React.FC<Props> = ({ onLogin, lang, setLang }) => {
  const [showAuth, setShowAuth] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'signup' | 'forgot'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [familyName, setFamilyName] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  translations[lang];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    try {
      if (!isSupabaseConfigured()) {
        setMessage(familySupabaseMissingMessage());
        return;
      }
      if (authMode === 'signup') {
        const { error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: { family_name: familyName },
            emailRedirectTo: `${window.location.origin}/`,
          },
        });
        setMessage(error ? error.message : 'Sjekk e-posten din for bekreftelseslenke. Etter bekreftelse kan du logge inn.');
      } else if (authMode === 'forgot') {
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${window.location.origin}/?recover=1` });
        setMessage(error ? error.message : `Hvis ${email} finnes i FamilyHub, sendes en tilbakestillingslenke.`);
      } else {
        const result = await onLogin({ email: email.trim(), password });
        if (result && result.ok === false) setMessage(result.error || 'Innlogging feilet.');
      }
    } catch (err: any) {
      setMessage(err?.message === 'Failed to fetch' ? `${familySupabaseMissingMessage()}\n\nTeknisk feil: Failed to fetch` : (err?.message || 'Ukjent feil ved innlogging/opprettelse.'));
    } finally {
      setLoading(false);
    }
  };

  const openAuth = (mode: 'login' | 'signup') => { setAuthMode(mode); setShowAuth(true); setMessage(''); };

  return (
    <div className="min-h-screen bg-white text-slate-900">
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5">
          <div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-900 text-white"><Heart className="h-5 w-5" /></div><div><p className="font-black leading-none tracking-tight">FamilieHub</p><p className="mt-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Family OS</p></div></div>
          <div className="hidden items-center gap-8 text-sm font-semibold text-slate-600 md:flex"><a href="#features">Funksjoner</a><a href="#demo">Demo</a><a href="#security">Sikkerhet</a></div>
          <div className="flex items-center gap-2"><select value={lang} onChange={e => setLang(e.target.value as Language)} className="hidden w-auto rounded-xl border-slate-200 text-sm md:block">{(Object.keys(LANG_LABELS) as Language[]).map(l => <option key={l} value={l}>{LANG_LABELS[l]}</option>)}</select><button onClick={() => openAuth('login')} className="rounded-xl px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-100">Logg inn</button><button onClick={() => openAuth('signup')} className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-bold text-white hover:bg-slate-700">Start gratis</button></div>
        </div>
      </header>

      <main>
        <section className="mx-auto grid max-w-7xl grid-cols-1 items-center gap-12 px-5 py-16 md:py-24 lg:grid-cols-2">
          <div>
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-bold text-slate-700"><ShieldCheck className="h-4 w-4" /> Privat kontrollpanel for familien</div>
            <h1 className="max-w-3xl text-5xl font-black tracking-tight text-slate-950 md:text-7xl">Alt familien trenger. Samlet, trygt og enkelt.</h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-600">FamilieHub samler kalender, oppgaver, økonomi, eiendeler, kvitteringer og viktige dokumenter i én moderne app for mobil, iPad og desktop.</p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row"><button onClick={() => openAuth('signup')} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-900 px-6 py-4 font-black text-white hover:bg-slate-700">Kom i gang <ArrowRight className="h-5 w-5" /></button><button onClick={() => openAuth('login')} className="inline-flex items-center justify-center rounded-2xl border border-slate-300 bg-white px-6 py-4 font-black text-slate-800 hover:bg-slate-50">Logg inn</button></div>
            <div className="mt-6 grid max-w-xl grid-cols-1 gap-3 text-sm text-slate-600 sm:grid-cols-3"><div className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-600" /> Gratis å teste</div><div className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-600" /> Privat bucket</div><div className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-600" /> Mobilklar</div></div>
          </div>
          <div id="demo"><AppDemo /></div>
        </section>

        <section id="features" className="border-y border-slate-200 bg-slate-50 py-20">
          <div className="mx-auto max-w-7xl px-5"><div className="mb-10 max-w-2xl"><h2 className="text-3xl font-black tracking-tight md:text-4xl">Bygget for familier som vil ha ro og oversikt.</h2><p className="mt-3 text-slate-600">Ikke bare budsjett. Ikke bare kalender. En komplett familieplattform.</p></div><div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">{[
            ['Kalender', 'Klokkeslett, ansvarlig person, oppgaver og filtrering per familiemedlem.', CalendarDays],
            ['Dokumenter', 'Last opp, scan og finn forsikringer, pass, kontrakter og garantier.', FileText],
            ['Eiendeler', 'Biler, bolig, tomt, bankkontoer, gjeld og nettoformue samlet.', Home],
            ['Handleliste', 'Delte lister og enklere planlegging av hverdagshandling.', ShoppingCart],
            ['Kvitteringer', 'Skann kvitteringer og hold orden på utgifter og dokumentasjon.', ScanLine],
            ['Sikkerhet', 'Household-basert tilgang, RLS og privat filopplasting.', LockKeyhole],
          ].map(([title, text, Icon]: any) => <div key={title} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"><div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-700"><Icon className="h-6 w-6" /></div><h3 className="text-lg font-black">{title}</h3><p className="mt-2 text-sm leading-6 text-slate-600">{text}</p></div>)}</div></div>
        </section>

        <section id="security" className="mx-auto max-w-7xl px-5 py-20"><div className="rounded-[2rem] border border-slate-200 bg-white p-8 shadow-sm md:p-10"><div className="grid grid-cols-1 gap-8 md:grid-cols-2 md:items-center"><div><div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-900 text-white"><LockKeyhole className="h-6 w-6" /></div><h2 className="text-3xl font-black tracking-tight">Klar for SaaS, trygg for private familier.</h2><p className="mt-4 text-slate-600">Data skilles per household, dokumenter lagres privat, og integrasjoner kan slås av eller på etter produktmodus.</p></div><div className="grid grid-cols-1 gap-3 text-sm"><div className="rounded-2xl bg-slate-50 p-4 font-semibold">Household / family tenant</div><div className="rounded-2xl bg-slate-50 p-4 font-semibold">Private dokumenter i Supabase Storage</div><div className="rounded-2xl bg-slate-50 p-4 font-semibold">Business-modul som valgfritt add-on</div></div></div></div></section>
      </main>

      {showAuth && <div className="fixed inset-0 z-50 flex items-center justify-center p-4"><div className="absolute inset-0 bg-slate-900/50" onClick={() => setShowAuth(false)} /><div className="relative w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl"><button onClick={() => setShowAuth(false)} className="absolute right-4 top-4 rounded-xl p-2 hover:bg-slate-100"><X className="h-5 w-5" /></button><h2 className="text-2xl font-black">{authMode === 'login' ? 'Velkommen tilbake' : authMode === 'signup' ? 'Opprett familie' : 'Tilbakestill passord'}</h2><p className="mt-1 text-sm text-slate-500">FamilieHub</p>{message && <div className="mt-4 whitespace-pre-wrap rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">{message}</div>}<form onSubmit={handleSubmit} className="mt-6 space-y-4">{authMode === 'signup' && <label className="block space-y-2"><span className="text-sm font-semibold">Familienavn</span><input value={familyName} onChange={e => setFamilyName(e.target.value)} required placeholder="F.eks. Bremseth" /></label>}<label className="block space-y-2"><span className="text-sm font-semibold">E-post</span><input value={email} onChange={e => setEmail(e.target.value)} type="email" required placeholder="navn@epost.no" /></label>{authMode !== 'forgot' && <label className="block space-y-2"><span className="text-sm font-semibold">Passord</span><input value={password} onChange={e => setPassword(e.target.value)} type="password" required placeholder="••••••••" /></label>}<button type="submit" disabled={loading} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-900 px-5 py-3 font-black text-white hover:bg-slate-700 disabled:opacity-60">{loading && <Loader2 className="h-4 w-4 animate-spin" />}{authMode === 'login' ? 'Logg inn' : authMode === 'signup' ? 'Opprett konto' : 'Send lenke'}</button></form><div className="mt-5 flex justify-between text-sm font-semibold"><button onClick={() => { setAuthMode(authMode === 'login' ? 'forgot' : 'login'); setMessage(''); }} className="text-slate-500 hover:text-slate-900">{authMode === 'login' ? 'Glemt passord?' : 'Tilbake til login'}</button>{authMode === 'login' && <button onClick={() => { setAuthMode('signup'); setMessage(''); }} className="text-slate-900">Ny bruker?</button>}</div></div></div>}
    </div>
  );
};
