
import React, { useState } from 'react';
import { supabase } from '../supabase';
import { CyberButton } from './CyberButton';
import { translations } from '../translations';
import { Language } from '../types';
import {
  Calendar,
  ShoppingCart,
  TrendingUp,
  Users,
  CheckCircle,
  Heart,
  Globe,
  ArrowRight,
  Loader2,
  X,
  ChefHat,
  PiggyBank,
  Bell,
  Sparkles,
  Star,
} from 'lucide-react';

interface Props {
  onLogin: (credentials: { email: string; password?: string }) => void;
  lang: Language;
  setLang: (l: Language) => void;
}

const LANG_LABELS: Record<Language, string> = {
  no: '🇳🇴 Norsk',
  en: '🇬🇧 English',
  es: '🇪🇸 Español',
  ru: '🇷🇺 Русский',
  fr: '🇫🇷 Français',
  de: '🇩🇪 Deutsch',
};

const FEATURES = [
  {
    icon: <Calendar className="w-6 h-6" />,
    color: 'bg-indigo-100 text-indigo-600',
    title: 'Felles familiekalender',
    desc: 'Hold hele familien oppdatert med delte kalenderoppføringer, påminnelser og oppgaver.',
  },
  {
    icon: <ShoppingCart className="w-6 h-6" />,
    color: 'bg-amber-100 text-amber-600',
    title: 'Smart handleliste',
    desc: 'Del handlelisten i sanntid. AI foreslår varer basert på historikk og ukeplan.',
  },
  {
    icon: <TrendingUp className="w-6 h-6" />,
    color: 'bg-emerald-100 text-emerald-600',
    title: 'Familieøkonomi',
    desc: 'Full oversikt over inntekter, utgifter og sparegoal. Budsjett for hele familien.',
  },
  {
    icon: <ChefHat className="w-6 h-6" />,
    color: 'bg-rose-100 text-rose-600',
    title: 'AI-ukeplan',
    desc: 'Få AI-generert ukemeny basert på hva du har i kjøleskapet og familiens preferanser.',
  },
  {
    icon: <PiggyBank className="w-6 h-6" />,
    color: 'bg-purple-100 text-purple-600',
    title: 'Sparemål',
    desc: 'Sett opp felles sparemål – ferie, ny bil, bolig – og følg fremgangen together.',
  },
  {
    icon: <Bell className="w-6 h-6" />,
    color: 'bg-cyan-100 text-cyan-600',
    title: 'Kvitteringsskanning',
    desc: 'Skann kvitteringer med kameraet. AI henter ut beløp og kategoriserer automatisk.',
  },
];

const TESTIMONIALS = [
  {
    text: '"FamilieHub har revolusjonert hverdagen vår. Nå er alle i familien på samme lag!"',
    name: 'Maria L.',
    role: 'Mor til 3 barn',
  },
  {
    text: '"Endelig én app som samler alt – kalender, økonomi og handleliste. Absolutt uunnværlig."',
    name: 'Thomas B.',
    role: 'Far og gründer',
  },
  {
    text: '"AI-ukemenyplanleggeren alene er verdt alt. Sparer tid og penger hver uke!"',
    name: 'Siri A.',
    role: 'Travl forelder',
  },
];

const AppPreview = () => (
  <div className="bg-white rounded-2xl shadow-2xl overflow-hidden border border-slate-100">
    {/* App bar */}
    <div className="bg-indigo-600 px-5 py-3 flex items-center justify-between">
      <div className="flex items-center gap-2">
        <div className="w-7 h-7 bg-white/20 rounded-lg flex items-center justify-center">
          <Heart className="w-4 h-4 text-white" />
        </div>
        <span className="text-white font-bold text-sm">FamilieHub</span>
      </div>
      <div className="flex gap-1">
        <div className="w-2 h-2 rounded-full bg-white/40" />
        <div className="w-2 h-2 rounded-full bg-white/40" />
        <div className="w-2 h-2 rounded-full bg-white" />
      </div>
    </div>

    {/* Preview content */}
    <div className="p-5 space-y-4 bg-slate-50">
      {/* Greeting */}
      <div>
        <p className="text-xs text-slate-500 font-medium">Lørdag 26. februar</p>
        <h3 className="text-lg font-bold text-slate-800">God morgen, Familie Bremseth! 👋</h3>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white rounded-xl p-3 border border-slate-100 shadow-sm">
          <p className="text-xs text-slate-500">Hendelser i dag</p>
          <p className="text-xl font-bold text-indigo-600">3</p>
        </div>
        <div className="bg-white rounded-xl p-3 border border-slate-100 shadow-sm">
          <p className="text-xs text-slate-500">Handlevarer</p>
          <p className="text-xl font-bold text-amber-600">8</p>
        </div>
        <div className="bg-white rounded-xl p-3 border border-slate-100 shadow-sm">
          <p className="text-xs text-slate-500">Budsjett igjen</p>
          <p className="text-xl font-bold text-emerald-600">kr 4 200</p>
        </div>
        <div className="bg-white rounded-xl p-3 border border-slate-100 shadow-sm">
          <p className="text-xs text-slate-500">Oppgaver</p>
          <p className="text-xl font-bold text-purple-600">5</p>
        </div>
      </div>

      {/* Today's events */}
      <div className="bg-white rounded-xl p-3 border border-slate-100 shadow-sm">
        <p className="text-xs font-semibold text-slate-600 mb-2">Dagens hendelser</p>
        {[
          { time: '09:00', title: 'Legetime Jonas', color: 'bg-rose-500' },
          { time: '14:30', title: 'Fotballtrening', color: 'bg-indigo-500' },
          { time: '18:00', title: 'Middag: Laks i ovn', color: 'bg-amber-500' },
        ].map((e, i) => (
          <div key={i} className="flex items-center gap-2 py-1.5 border-b border-slate-50 last:border-0">
            <div className={`w-1.5 h-1.5 rounded-full ${e.color}`} />
            <span className="text-xs text-slate-400 w-10 shrink-0">{e.time}</span>
            <span className="text-xs font-medium text-slate-700">{e.title}</span>
          </div>
        ))}
      </div>
    </div>
  </div>
);

export const LandingPage: React.FC<Props> = ({ onLogin, lang, setLang }) => {
  const [showAuth, setShowAuth] = useState(false);
  const [showLangPicker, setShowLangPicker] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'signup' | 'forgot'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [familyName, setFamilyName] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const t = translations[lang];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    if (authMode === 'signup') {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { family_name: familyName } },
      });
      if (error) setMessage(error.message);
      else setMessage('Sjekk e-posten din for bekreftelseslenke!');
    } else if (authMode === 'forgot') {
      const { error } = await supabase.auth.resetPasswordForEmail(email);
      if (error) setMessage(error.message);
      else setMessage('Tilbakestillingslenke sendt til ' + email);
    } else {
      await onLogin({ email, password });
    }
    setLoading(false);
  };

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return t.good_morning;
    if (h < 18) return t.good_afternoon;
    return t.good_evening;
  })();

  return (
    <div className="min-h-screen bg-white">
      {/* NAV */}
      <nav className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-slate-100">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center shadow-md">
              <Heart className="w-4.5 h-4.5 text-white w-4 h-4" />
            </div>
            <span className="font-bold text-lg text-slate-800">FamilieHub</span>
          </div>

          <div className="flex items-center gap-3">
            {/* Language picker */}
            <div className="relative">
              <button
                onClick={() => setShowLangPicker(!showLangPicker)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-slate-500 hover:bg-slate-100 transition-colors"
              >
                <Globe className="w-4 h-4" />
                <span className="hidden sm:inline">{LANG_LABELS[lang].split(' ')[1]}</span>
              </button>
              {showLangPicker && (
                <div className="absolute right-0 top-full mt-1 bg-white rounded-xl shadow-xl border border-slate-100 py-1 min-w-[160px] z-50">
                  {(Object.keys(LANG_LABELS) as Language[]).map(l => (
                    <button
                      key={l}
                      onClick={() => { setLang(l); setShowLangPicker(false); }}
                      className={`w-full text-left px-4 py-2 text-sm transition-colors ${lang === l ? 'bg-indigo-50 text-indigo-700 font-semibold' : 'text-slate-700 hover:bg-slate-50'}`}
                    >
                      {LANG_LABELS[l]}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <button
              onClick={() => { setAuthMode('login'); setShowAuth(true); }}
              className="text-sm font-semibold text-slate-700 hover:text-indigo-600 transition-colors px-2"
            >
              {t.login}
            </button>
            <button
              onClick={() => { setAuthMode('signup'); setShowAuth(true); }}
              className="btn-primary text-sm px-4 py-2 rounded-lg bg-indigo-600 text-white font-semibold hover:bg-indigo-700 transition-colors"
            >
              Kom i gang gratis
            </button>
          </div>
        </div>
      </nav>

      {/* HERO */}
      <section className="max-w-7xl mx-auto px-6 pt-16 pb-24 grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
        <div className="space-y-8">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-700 rounded-full text-sm font-semibold">
            <Sparkles className="w-4 h-4" />
            Norges beste familieapp — gratis å starte
          </div>

          <h1 className="text-5xl md:text-6xl font-extrabold text-slate-900 leading-tight">
            Alt familien
            <br />
            trenger, på
            <br />
            <span className="text-indigo-600">ett sted.</span>
          </h1>

          <p className="text-xl text-slate-500 leading-relaxed max-w-lg">
            Kalender, handleliste, familieøkonomi og AI-ukeplan. Alltid oppdatert, alltid synkronisert — for alle i familien.
          </p>

          <div className="flex flex-col sm:flex-row gap-4">
            <button
              onClick={() => { setAuthMode('signup'); setShowAuth(true); }}
              className="flex items-center justify-center gap-2 px-8 py-4 bg-indigo-600 text-white rounded-xl font-bold text-base shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition-all hover:-translate-y-0.5"
            >
              Start gratis i dag
              <ArrowRight className="w-5 h-5" />
            </button>
            <button
              onClick={() => { setAuthMode('login'); setShowAuth(true); }}
              className="flex items-center justify-center gap-2 px-8 py-4 bg-white text-slate-700 border border-slate-200 rounded-xl font-semibold text-base hover:bg-slate-50 transition-colors"
            >
              {t.login}
            </button>
          </div>

          <div className="flex items-center gap-6 pt-2">
            <div className="flex items-center gap-1.5">
              <CheckCircle className="w-4 h-4 text-emerald-500" />
              <span className="text-sm text-slate-500">Gratis å starte</span>
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircle className="w-4 h-4 text-emerald-500" />
              <span className="text-sm text-slate-500">Ingen kredittkort</span>
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircle className="w-4 h-4 text-emerald-500" />
              <span className="text-sm text-slate-500">GDPR-trygg</span>
            </div>
          </div>
        </div>

        <div className="relative">
          <div className="absolute -inset-4 bg-gradient-to-r from-indigo-100 to-purple-100 rounded-3xl blur-2xl opacity-60" />
          <div className="relative">
            <AppPreview />
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section className="bg-slate-50 py-24">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">
              Alt familien trenger — samlet
            </h2>
            <p className="text-lg text-slate-500 max-w-2xl mx-auto">
              Fra morgenrutiner til månedlig budsjett. FamilieHub hjelper dere å holde oversikten og spare tid.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES.map((f, i) => (
              <div key={i} className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
                <div className={`w-12 h-12 ${f.color} rounded-xl flex items-center justify-center mb-4`}>
                  {f.icon}
                </div>
                <h3 className="font-bold text-slate-800 text-lg mb-2">{f.title}</h3>
                <p className="text-slate-500 text-sm leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* TESTIMONIALS */}
      <section className="py-24">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-slate-900 mb-4">Familier elsker FamilieHub</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {TESTIMONIALS.map((t, i) => (
              <div key={i} className="bg-white rounded-2xl p-8 border border-slate-100 shadow-sm">
                <div className="flex gap-1 mb-4">
                  {[...Array(5)].map((_, j) => (
                    <Star key={j} className="w-4 h-4 text-amber-400 fill-amber-400" />
                  ))}
                </div>
                <p className="text-slate-600 italic leading-relaxed mb-6">{t.text}</p>
                <div>
                  <p className="font-semibold text-slate-800">{t.name}</p>
                  <p className="text-sm text-slate-400">{t.role}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PRICING */}
      <section className="bg-slate-50 py-24">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <h2 className="text-3xl font-bold text-slate-900 mb-4">Enkel, ærlig pris</h2>
          <p className="text-slate-500 mb-12">Start gratis. Oppgrader når du er klar.</p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white rounded-2xl p-8 border border-slate-200 text-left">
              <h3 className="font-bold text-slate-800 text-xl mb-2">Gratis</h3>
              <p className="text-4xl font-extrabold text-slate-900 mb-1">0 kr</p>
              <p className="text-sm text-slate-400 mb-6">For alltid</p>
              <ul className="space-y-3 text-sm text-slate-600">
                {['Felles kalender', 'Handleliste', 'Opptil 3 familiemedlemmer', 'Grunnleggende budsjett'].map(f => (
                  <li key={f} className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" /> {f}
                  </li>
                ))}
              </ul>
              <button
                onClick={() => { setAuthMode('signup'); setShowAuth(true); }}
                className="mt-8 w-full py-3 rounded-xl border border-slate-200 font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
              >
                Start gratis
              </button>
            </div>

            <div className="bg-indigo-600 rounded-2xl p-8 text-left relative overflow-hidden">
              <div className="absolute top-4 right-4 bg-amber-400 text-amber-900 text-xs font-bold px-3 py-1 rounded-full">
                Populær
              </div>
              <h3 className="font-bold text-white text-xl mb-2">Familie Pro</h3>
              <p className="text-4xl font-extrabold text-white mb-1">49 kr</p>
              <p className="text-sm text-indigo-200 mb-6">per måned (eller 449 kr/år)</p>
              <ul className="space-y-3 text-sm text-indigo-100">
                {['Alt i Gratis', 'Ubegrenset familiemedlemmer', 'AI-ukeplan', 'Kvitteringsskanning', 'Avansert budsjett', 'Prioritert support'].map(f => (
                  <li key={f} className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-indigo-300 shrink-0" /> {f}
                  </li>
                ))}
              </ul>
              <button
                onClick={() => { setAuthMode('signup'); setShowAuth(true); }}
                className="mt-8 w-full py-3 rounded-xl bg-white text-indigo-700 font-bold hover:bg-indigo-50 transition-colors"
              >
                Prøv gratis i 14 dager
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 bg-indigo-600">
        <div className="max-w-2xl mx-auto px-6 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-6">
            Klar til å forenkle familielivet?
          </h2>
          <p className="text-indigo-200 text-lg mb-8">
            Bli med tusenvis av norske familier som allerede bruker FamilieHub.
          </p>
          <button
            onClick={() => { setAuthMode('signup'); setShowAuth(true); }}
            className="px-10 py-4 bg-white text-indigo-700 rounded-xl font-bold text-base shadow-xl hover:shadow-2xl hover:-translate-y-0.5 transition-all"
          >
            Kom i gang nå — det er gratis
          </button>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="bg-slate-900 py-8">
        <div className="max-w-7xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-indigo-600 rounded-md flex items-center justify-center">
              <Heart className="w-3 h-3 text-white" />
            </div>
            <span className="text-slate-400 text-sm">FamilieHub © 2025</span>
          </div>
          <p className="text-slate-500 text-sm">Laget med kjærlighet for norske familier</p>
        </div>
      </footer>

      {/* AUTH MODAL */}
      {showAuth && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            onClick={() => setShowAuth(false)}
          />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-8 animate-fade-in">
            <button
              onClick={() => setShowAuth(false)}
              className="absolute top-4 right-4 p-2 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="mb-8">
              <div className="w-12 h-12 bg-indigo-100 rounded-xl flex items-center justify-center mb-4">
                <Heart className="w-6 h-6 text-indigo-600" />
              </div>
              <h2 className="text-2xl font-bold text-slate-900">
                {authMode === 'login' ? t.welcome_back : authMode === 'signup' ? t.create_account : t.forgot_password}
              </h2>
              <p className="text-slate-500 text-sm mt-1">FamilieHub</p>
            </div>

            {message && (
              <div className={`mb-4 p-3 rounded-lg text-sm font-medium ${message.includes('Sjekk') || message.includes('sendt') ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
                {message}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {authMode === 'signup' && (
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">Familienavn</label>
                  <input
                    value={familyName}
                    onChange={e => setFamilyName(e.target.value)}
                    required
                    className="input-field"
                    placeholder="F.eks. Bremseth"
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">{t.email}</label>
                <input
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  type="email"
                  required
                  className="input-field"
                  placeholder="navn@epost.no"
                />
              </div>

              {authMode !== 'forgot' && (
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">{t.password}</label>
                  <input
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    type="password"
                    required
                    className="input-field"
                    placeholder="••••••••"
                  />
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-2"
              >
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                {authMode === 'login' ? t.login : authMode === 'signup' ? t.signup : t.send_reset}
              </button>
            </form>

            <div className="mt-6 flex justify-between items-center text-sm">
              {authMode === 'login' ? (
                <>
                  <button
                    type="button"
                    onClick={() => setAuthMode('forgot')}
                    className="text-slate-500 hover:text-indigo-600 transition-colors"
                  >
                    {t.forgot_password}
                  </button>
                  <button
                    type="button"
                    onClick={() => setAuthMode('signup')}
                    className="text-indigo-600 font-semibold hover:text-indigo-700 transition-colors"
                  >
                    {t.new_user}
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => setAuthMode('login')}
                  className="text-indigo-600 font-semibold hover:text-indigo-700 transition-colors mx-auto"
                >
                  {t.back_to_login}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
