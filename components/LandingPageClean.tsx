import React, { useEffect, useState } from 'react';
import { supabase, isSupabaseConfigured, SUPABASE_REFS, SUPABASE_STATUS } from '../supabase';
import { translations } from '../translations';
import { Language } from '../types';
import { ArrowRight, CalendarDays, CheckCircle2, Clock, CreditCard, Database, FileText, Heart, Home, Loader2, LockKeyhole, LogIn, ScanLine, ShieldCheck, ShoppingCart, Sparkles, X, Zap } from 'lucide-react';

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

function slugifyFamily(value: string) {
  return String(value || 'familie')
    .trim()
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/æ/g, 'ae')
    .replace(/ø/g, 'o')
    .replace(/å/g, 'a')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'familie';
}

function AppDemo() {
  return (
    <div className="mx-auto max-w-[460px] rounded-[2rem] border border-slate-200 bg-white p-3 shadow-2xl shadow-slate-200/70">
      <div className="rounded-[1.5rem] bg-slate-50 p-4">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2"><div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-slate-900 text-white"><Heart className="h-4 w-4" /></div><div><p className="text-sm font-black text-slate-900">FamilieHub</p><p className="text-xs text-slate-500">Din familie</p></div></div>
          <div className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">Privat</div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-semibold text-slate-500">Eksempelvisning</p>
          <h3 className="mt-1 text-xl font-black text-slate-900">Ingen ekte kundedata</h3>
          <div className="mt-4 space-y-3">
            <div className="flex items-center gap-3 rounded-2xl bg-slate-50 p-3"><CalendarDays className="h-5 w-5 text-slate-600" /><div><p className="text-sm font-bold text-slate-900">15:30 Familieaktivitet</p><p className="text-xs text-slate-500">Eksempelperson</p></div></div>
            <div className="flex items-center gap-3 rounded-2xl bg-slate-50 p-3"><FileText className="h-5 w-5 text-slate-600" /><div><p className="text-sm font-bold text-slate-900">Forsikringsdokument</p><p className="text-xs text-slate-500">Demo eller tom start</p></div></div>
            <div className="flex items-center gap-3 rounded-2xl bg-slate-50 p-3"><CreditCard className="h-5 w-5 text-slate-600" /><div><p className="text-sm font-bold text-slate-900">Egen økonomi</p><p className="text-xs text-slate-500">Per familie/household</p></div></div>
          </div>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-3"><p className="text-xs text-slate-500">Kalender</p><p className="text-lg font-black text-slate-900">✓</p></div>
          <div className="rounded-2xl border border-slate-200 bg-white p-3"><p className="text-xs text-slate-500">Dokumenter</p><p className="text-lg font-black text-slate-900">✓</p></div>
          <div className="rounded-2xl border border-slate-200 bg-white p-3"><p className="text-xs text-slate-500">Moduler</p><p className="text-lg font-black text-slate-900">+</p></div>
        </div>
      </div>
    </div>
  );
}

type AuthMode = 'login' | 'signup' | 'trial' | 'forgot';
type SignupPlan = 'basic' | 'advanced' | 'trial' | 'paid';

const TRIAL_HOURS = 24;
const SUBSCRIPTION_PRICE_EUR = 4;

export const LandingPageClean: React.FC<Props> = ({ onLogin, lang, setLang }) => {
  const [showAuth, setShowAuth] = useState(false);
  const [authMode, setAuthMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [familyName, setFamilyName] = useState('');
  const [familyLocation, setFamilyLocation] = useState('');
  const [demoMode, setDemoMode] = useState<'empty' | 'demo'>('empty');
  const [plan, setPlan] = useState<SignupPlan>('basic');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [showSubscriptionInfo, setShowSubscriptionInfo] = useState(false);
  translations[lang];

  // Les ?mode=... fra URL og åpne riktig flyt automatisk
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const mode = params.get('mode');
      if (mode === 'trial') { setAuthMode('trial'); setShowAuth(true); }
      else if (mode === 'login') { setAuthMode('login'); setShowAuth(true); }
      else if (mode === 'subscribe') { setShowSubscriptionInfo(true); }
      else if (mode === 'signup') { setAuthMode('signup'); setShowAuth(true); }
      if (mode) {
        // Rydd query-param fra URL
        const url = new URL(window.location.href);
        url.searchParams.delete('mode');
        window.history.replaceState({}, '', url.toString());
      }
    } catch {}
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    try {
      if (!isSupabaseConfigured()) {
        setMessage(familySupabaseMissingMessage());
        return;
      }
      if (authMode === 'signup' || authMode === 'trial') {
        const isTrial = authMode === 'trial';
        const cleanedFamilyName = familyName.trim() || (isTrial ? 'Test' : '');
        const familyId = `${slugifyFamily(cleanedFamilyName || 'test')}-${Date.now().toString(36)}`;
        const trialExpiresAt = isTrial ? new Date(Date.now() + TRIAL_HOURS * 60 * 60 * 1000).toISOString() : undefined;
        const { error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: {
              family_name: cleanedFamilyName,
              family_id: familyId,
              family_location: familyLocation.trim(),
              demo_data_mode: demoMode,
              plan: isTrial ? 'trial' : plan,
              subscription_status: isTrial ? 'trial' : 'trial',
              trial_expires_at: trialExpiresAt,
              is_trial: isTrial,
            },
            emailRedirectTo: `${window.location.origin}/`,
          },
        });
        if (error) { setMessage(error.message); return; }
        if (isTrial) {
          setMessage(`Test-konto opprettet — gjelder i ${TRIAL_HOURS} timer.\n\nSjekk e-posten din (${email}) for bekreftelseslenke. Etter bekreftelse kan du logge inn og bruke FamilieHub frem til ${new Date(Date.now() + TRIAL_HOURS * 60 * 60 * 1000).toLocaleString('nb-NO')}.\n\nFor å fortsette etter prøveperioden, oppgrader til abonnement (${SUBSCRIPTION_PRICE_EUR} €/mnd).`);
        } else {
          setMessage(`Sjekk e-posten din for bekreftelseslenke. Familie-ID: ${familyId}. Kontoen starter med ${demoMode === 'empty' ? 'tomt dashboard' : 'ufarlig random demo-data'}, aldri data fra andre brukere.`);
        }
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

  const openAuth = (mode: AuthMode) => { setAuthMode(mode); setShowAuth(true); setMessage(''); };
  const openSubscription = () => { setShowSubscriptionInfo(true); };

  return (
    <div className="min-h-screen bg-white text-slate-900">
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5">
          <div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-900 text-white"><Heart className="h-5 w-5" /></div><div><p className="font-black leading-none tracking-tight">FamilieHub</p><p className="mt-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Family OS</p></div></div>
          <div className="hidden items-center gap-8 text-sm font-semibold text-slate-600 md:flex"><a href="#features">Funksjoner</a><a href="#plans">Pakker</a><a href="#security">Sikkerhet</a></div>
          <div className="flex items-center gap-2"><select value={lang} onChange={e => setLang(e.target.value as Language)} className="hidden w-auto rounded-xl border-slate-200 text-sm md:block">{(Object.keys(LANG_LABELS) as Language[]).map(l => <option key={l} value={l}>{LANG_LABELS[l]}</option>)}</select><button onClick={() => openAuth('login')} className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-800 hover:bg-slate-50"><LogIn className="h-4 w-4" /> Logg inn</button><button onClick={() => openAuth('trial')} className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-bold text-white hover:bg-slate-700">Test gratis 24t</button></div>
        </div>
      </header>

      <main>
        <section className="mx-auto grid max-w-7xl grid-cols-1 items-center gap-12 px-5 py-16 md:py-24 lg:grid-cols-2">
          <div>
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-bold text-slate-700"><ShieldCheck className="h-4 w-4" /> Privat kontrollpanel per familie</div>
            <h1 className="max-w-3xl text-5xl font-black tracking-tight text-slate-950 md:text-7xl">Alt familien trenger. Samlet, trygt og modulært.</h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-600">FamilieHub samler kalender, oppgaver, økonomi, eiendeler, kvitteringer og viktige dokumenter. Hver familie får egen ID, egne data og egne integrasjoner.</p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row"><button onClick={() => openAuth('trial')} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-900 px-6 py-4 font-black text-white hover:bg-slate-700"><Clock className="h-5 w-5" /> Test gratis i 24 timer <ArrowRight className="h-5 w-5" /></button><button onClick={() => openAuth('login')} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-300 bg-white px-6 py-4 font-black text-slate-800 hover:bg-slate-50"><LogIn className="h-5 w-5" /> Logg inn</button></div>
            <div className="mt-6 grid max-w-xl grid-cols-1 gap-3 text-sm text-slate-600 sm:grid-cols-3"><div className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-600" /> Tom start eller demo</div><div className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-600" /> Privat household</div><div className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-600" /> Moduler kan kjøpes</div></div>
          </div>
          <div id="demo"><AppDemo /></div>
        </section>

        <section id="features" className="border-y border-slate-200 bg-slate-50 py-20">
          <div className="mx-auto max-w-7xl px-5"><div className="mb-10 max-w-2xl"><h2 className="text-3xl font-black tracking-tight md:text-4xl">Bygget for familier som vil ha ro og oversikt.</h2><p className="mt-3 text-slate-600">Ikke bare budsjett. Ikke bare kalender. En komplett familieplattform.</p></div><div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">{[
            ['Kalender', 'Klokkeslett, ansvarlig person, oppgaver, gjentakelser, påminnelser og filtrering per familiemedlem.', CalendarDays],
            ['Dokumenter', 'Last opp, scan og finn forsikringer, pass, kontrakter og garantier.', FileText],
            ['Eiendeler', 'Biler, bolig, tomt, bankkontoer, gjeld og nettoformue samlet.', Home],
            ['Handleliste', 'Delte lister, måltider og enklere planlegging av hverdagshandling.', ShoppingCart],
            ['Kvitteringer', 'Skann kvitteringer, importer kontoutskrift og bygg kategorilæring.', ScanLine],
            ['Egen backend', 'SaaS-kunder kan sette opp egen Supabase og egne AI-nøkler for full datakontroll.', Database],
          ].map(([title, text, Icon]: any) => <div key={title} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"><div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-700"><Icon className="h-6 w-6" /></div><h3 className="text-lg font-black">{title}</h3><p className="mt-2 text-sm leading-6 text-slate-600">{text}</p></div>)}</div></div>
        </section>

        <section id="plans" className="mx-auto max-w-7xl px-5 py-20">
          <div className="mb-10 max-w-2xl"><h2 className="text-3xl font-black tracking-tight md:text-4xl">Velg pakke</h2><p className="mt-3 text-slate-600">Test 24 timer helt gratis, eller start med abonnement og få full tilgang.</p></div>
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">

            {/* Test-bruker */}
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm flex flex-col">
              <div className="flex items-center gap-2 mb-3"><div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700"><Clock className="h-5 w-5" /></div><span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[11px] font-bold text-emerald-700">Gratis</span></div>
              <h3 className="text-xl font-black">Test 24 timer</h3>
              <p className="mt-2 text-sm text-slate-600 leading-6">Full tilgang til alle Basic-funksjoner i 24 timer. Ingen kortinfo kreves.</p>
              <ul className="mt-4 space-y-2 text-sm text-slate-700 flex-1">
                <li className="flex items-start gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-600 mt-0.5 shrink-0" /> Kalender, oppgaver, handleliste</li>
                <li className="flex items-start gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-600 mt-0.5 shrink-0" /> Familiemedlemmer, dokumenter</li>
                <li className="flex items-start gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-600 mt-0.5 shrink-0" /> Egen tom database</li>
                <li className="flex items-start gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-600 mt-0.5 shrink-0" /> Utløper automatisk etter 24t</li>
              </ul>
              <button onClick={() => openAuth('trial')} className="mt-6 inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-900 px-5 py-3 font-black text-white hover:bg-slate-700"><Clock className="h-4 w-4" /> Start test</button>
            </div>

            {/* Abonnement */}
            <div className="rounded-3xl border-2 border-slate-900 bg-slate-900 text-white p-6 shadow-lg flex flex-col relative">
              <div className="absolute -top-3 left-6 rounded-full bg-amber-400 px-3 py-1 text-[11px] font-black uppercase tracking-wide text-slate-900">Anbefalt</div>
              <div className="flex items-center gap-2 mb-3"><div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/10 text-white"><Zap className="h-5 w-5" /></div></div>
              <h3 className="text-xl font-black">Abonnement</h3>
              <div className="mt-3 flex items-baseline gap-1"><span className="text-4xl font-black">{SUBSCRIPTION_PRICE_EUR} €</span><span className="text-sm text-slate-300">/mnd</span></div>
              <p className="mt-2 text-sm text-slate-300 leading-6">Full tilgang til alle moduler. Ingen utløpsdato.</p>
              <ul className="mt-4 space-y-2 text-sm text-slate-100 flex-1">
                <li className="flex items-start gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-300 mt-0.5 shrink-0" /> Alt i Test pluss bank + eiendeler</li>
                <li className="flex items-start gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-300 mt-0.5 shrink-0" /> Kvitteringsscanning + AI-budsjett</li>
                <li className="flex items-start gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-300 mt-0.5 shrink-0" /> Kontoutskrift-import (PDF)</li>
                <li className="flex items-start gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-300 mt-0.5 shrink-0" /> Likviditet og regninger</li>
                <li className="flex items-start gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-300 mt-0.5 shrink-0" /> Si opp når som helst</li>
              </ul>
              <button onClick={openSubscription} className="mt-6 inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-5 py-3 font-black text-slate-900 hover:bg-slate-100"><CreditCard className="h-4 w-4" /> Bli abonnent</button>
            </div>

            {/* Allerede bruker */}
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm flex flex-col">
              <div className="flex items-center gap-2 mb-3"><div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-100 text-slate-700"><LogIn className="h-5 w-5" /></div></div>
              <h3 className="text-xl font-black">Allerede bruker?</h3>
              <p className="mt-2 text-sm text-slate-600 leading-6">Logg inn med eksisterende konto. Eller bli ny bruker uten test-periode.</p>
              <ul className="mt-4 space-y-2 text-sm text-slate-700 flex-1">
                <li className="flex items-start gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-600 mt-0.5 shrink-0" /> Logg inn med e-post og passord</li>
                <li className="flex items-start gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-600 mt-0.5 shrink-0" /> Opprett ny familie-konto</li>
                <li className="flex items-start gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-600 mt-0.5 shrink-0" /> Tilbakestill passord</li>
              </ul>
              <div className="mt-6 flex flex-col gap-2">
                <button onClick={() => openAuth('login')} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-300 bg-white px-5 py-3 font-black text-slate-900 hover:bg-slate-50"><LogIn className="h-4 w-4" /> Logg inn</button>
                <button onClick={() => openAuth('signup')} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-100 px-5 py-3 font-bold text-slate-700 hover:bg-slate-200">Opprett konto</button>
              </div>
            </div>

          </div>
          <p className="mt-6 text-xs text-slate-500">Stripe og PayPal-integrasjon kommer snart. Kontakt support hvis du vil bli tidlig abonnent.</p>
        </section>

        <section id="security" className="mx-auto max-w-7xl px-5 pb-20"><div className="rounded-[2rem] border border-slate-200 bg-white p-8 shadow-sm md:p-10"><div className="grid grid-cols-1 gap-8 md:grid-cols-2 md:items-center"><div><div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-900 text-white"><LockKeyhole className="h-6 w-6" /></div><h2 className="text-3xl font-black tracking-tight">Klar for SaaS, trygg for private familier.</h2><p className="mt-4 text-slate-600">Data skilles per household/family_id. Nye brukere skal aldri se dine eller andre kunders tall. SaaS-oppsett forklarer hvordan kunden setter opp egen Supabase og egne AI-nøkler.</p></div><div className="grid grid-cols-1 gap-3 text-sm"><div className="rounded-2xl bg-slate-50 p-4 font-semibold">Household / family tenant</div><div className="rounded-2xl bg-slate-50 p-4 font-semibold">Tom start eller ufarlig random demo-data</div><div className="rounded-2xl bg-slate-50 p-4 font-semibold">Egne AI-nøkler og Supabase-oppsett for SaaS-kunder</div></div></div></div></section>
      </main>

      {showAuth && <div className="fixed inset-0 z-50 flex items-center justify-center p-4"><div className="absolute inset-0 bg-slate-900/50" onClick={() => setShowAuth(false)} /><div className="relative max-h-[92vh] w-full max-w-md overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl"><button onClick={() => setShowAuth(false)} className="absolute right-4 top-4 rounded-xl p-2 hover:bg-slate-100"><X className="h-5 w-5" /></button><h2 className="text-2xl font-black">{authMode === 'login' ? 'Velkommen tilbake' : authMode === 'signup' ? 'Opprett familie' : authMode === 'trial' ? '24-timers test' : 'Tilbakestill passord'}</h2><p className="mt-1 text-sm text-slate-500">{authMode === 'trial' ? `Gratis tilgang i ${TRIAL_HOURS} timer — ingen kortinfo` : 'FamilieHub'}</p>{authMode === 'trial' && <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800"><div className="flex items-start gap-2"><Sparkles className="h-4 w-4 mt-0.5 shrink-0" /><div><p className="font-bold">Full tilgang i 24 timer</p><p className="mt-1 text-emerald-700">Du får tomt dashboard, kan teste alle Basic-funksjoner og bli oppgradert til abonnement når som helst.</p></div></div></div>}{message && <div className="mt-4 whitespace-pre-wrap rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">{message}</div>}<form onSubmit={handleSubmit} className="mt-6 space-y-4">{authMode === 'signup' && <><label className="block space-y-2"><span className="text-sm font-semibold">Familienavn</span><input value={familyName} onChange={e => setFamilyName(e.target.value)} required placeholder="F.eks. Bremseth" /></label><label className="block space-y-2"><span className="text-sm font-semibold">Lokasjon/adresse</span><input value={familyLocation} onChange={e => setFamilyLocation(e.target.value)} placeholder="By, land eller adresse" /></label><div className="rounded-2xl border border-slate-200 p-3"><p className="text-sm font-bold">Startdata</p><div className="mt-3 grid grid-cols-1 gap-2"><label className="flex items-start gap-2 rounded-xl border border-slate-200 p-3 text-sm"><input type="radio" checked={demoMode === 'empty'} onChange={() => setDemoMode('empty')} /> <span><b>Tom start</b><br /><span className="text-slate-500">Ingen demo-tall eller andre kundedata.</span></span></label><label className="flex items-start gap-2 rounded-xl border border-slate-200 p-3 text-sm"><input type="radio" checked={demoMode === 'demo'} onChange={() => setDemoMode('demo')} /> <span><b>Random demo</b><br /><span className="text-slate-500">Ufarlige eksempeldata som ikke kommer fra ekte brukere.</span></span></label></div></div><label className="block space-y-2"><span className="text-sm font-semibold">Plan</span><select value={plan} onChange={e => setPlan(e.target.value as SignupPlan)}><option value="basic">Basic</option><option value="advanced">Avansert</option></select></label></>}{authMode === 'trial' && <label className="block space-y-2"><span className="text-sm font-semibold">Familienavn (valgfritt)</span><input value={familyName} onChange={e => setFamilyName(e.target.value)} placeholder="F.eks. Bremseth" /></label>}<label className="block space-y-2"><span className="text-sm font-semibold">E-post</span><input value={email} onChange={e => setEmail(e.target.value)} type="email" required placeholder="navn@epost.no" /></label>{authMode !== 'forgot' && <label className="block space-y-2"><span className="text-sm font-semibold">Passord</span><input value={password} onChange={e => setPassword(e.target.value)} type="password" required placeholder="••••••••" /></label>}<button type="submit" disabled={loading} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-900 px-5 py-3 font-black text-white hover:bg-slate-700 disabled:opacity-60">{loading && <Loader2 className="h-4 w-4 animate-spin" />}{authMode === 'login' ? 'Logg inn' : authMode === 'signup' ? 'Opprett konto' : authMode === 'trial' ? `Start ${TRIAL_HOURS}-timers test` : 'Send lenke'}</button></form><div className="mt-5 flex justify-between text-sm font-semibold"><button onClick={() => { setAuthMode(authMode === 'login' ? 'forgot' : 'login'); setMessage(''); }} className="text-slate-500 hover:text-slate-900">{authMode === 'login' ? 'Glemt passord?' : 'Tilbake til login'}</button>{authMode === 'login' && <button onClick={() => { setAuthMode('trial'); setMessage(''); }} className="text-slate-900">Test 24t først?</button>}</div></div></div>}

      {/* Subscription info modal (placeholder før Stripe/PayPal) */}
      {showSubscriptionInfo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/50" onClick={() => setShowSubscriptionInfo(false)} />
          <div className="relative w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl">
            <button onClick={() => setShowSubscriptionInfo(false)} className="absolute right-4 top-4 rounded-xl p-2 hover:bg-slate-100"><X className="h-5 w-5" /></button>
            <div className="flex items-center gap-3 mb-4"><div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-100 text-amber-700"><CreditCard className="h-5 w-5" /></div><div><h2 className="text-2xl font-black">Abonnement {SUBSCRIPTION_PRICE_EUR} €/mnd</h2><p className="text-sm text-slate-500">Full tilgang til FamilieHub</p></div></div>
            <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              <p className="font-bold">Stripe og PayPal kommer snart</p>
              <p className="mt-1">Betalingsintegrasjon er under utvikling. Mens vi venter kan du:</p>
              <ul className="mt-3 space-y-1.5 list-disc list-inside">
                <li>Starte 24-timers gratis test nå</li>
                <li>Kontakte support for tidlig abonnent-tilgang</li>
                <li>Få varsel når Stripe er klar</li>
              </ul>
            </div>
            <div className="mt-5 flex flex-col gap-2">
              <button onClick={() => { setShowSubscriptionInfo(false); openAuth('trial'); }} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-900 px-5 py-3 font-black text-white hover:bg-slate-700"><Clock className="h-4 w-4" /> Start 24-timers test</button>
              <a href="mailto:freddy.bremseth@gmail.com?subject=Tidlig abonnent-tilgang FamilieHub" className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-300 bg-white px-5 py-3 font-bold text-slate-800 hover:bg-slate-50">Kontakt support</a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
