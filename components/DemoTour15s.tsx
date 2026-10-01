import React, { useEffect, useMemo, useState } from 'react';
import { CalendarDays, CheckCircle2, FileText, Heart, Play, Receipt, RefreshCcw, ShoppingCart, Wallet } from 'lucide-react';

const DURATION_MS = 15000;
const STEP_MS = DURATION_MS / 4;

const demoEvents = [
  { time: '08:00', title: 'Skole og levering', who: 'Alex' },
  { time: '16:30', title: 'Fotballtrening', who: 'Mia' },
  { time: '19:00', title: 'Felles middag', who: 'Familien' },
];

function DemoBadge() {
  return <span className="inline-flex items-center rounded-full bg-amber-100 px-3 py-1 text-xs font-black uppercase tracking-wider text-amber-800">Demo-data</span>;
}

export const DemoTour15s: React.FC = () => {
  const [startedAt, setStartedAt] = useState(() => Date.now());
  const [elapsed, setElapsed] = useState(0);
  const [playing, setPlaying] = useState(true);

  useEffect(() => {
    if (!playing) return;
    const timer = window.setInterval(() => {
      const next = Date.now() - startedAt;
      if (next >= DURATION_MS) {
        setElapsed(DURATION_MS);
        setPlaying(false);
      } else {
        setElapsed(next);
      }
    }, 80);
    return () => window.clearInterval(timer);
  }, [playing, startedAt]);

  const step = Math.min(3, Math.floor(elapsed / STEP_MS));
  const progress = Math.min(100, (elapsed / DURATION_MS) * 100);
  const secondsLeft = Math.max(0, Math.ceil((DURATION_MS - elapsed) / 1000));

  const restart = () => {
    setStartedAt(Date.now());
    setElapsed(0);
    setPlaying(true);
  };

  const title = useMemo(() => [
    'Hele familien på ett dashboard',
    'Kalender og ansvar samlet',
    'Økonomi uten å vise ekte tall',
    'Dokumenter, kvitteringer og handleliste',
  ][step], [step]);

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <header className="mx-auto flex max-w-7xl items-center justify-between px-5 py-5">
        <a href="/" className="flex items-center gap-3 text-white no-underline">
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-slate-950"><Heart className="h-5 w-5" /></span>
          <div><p className="font-black leading-none">FamilieHub</p><p className="mt-1 text-xs text-slate-400">15 sek produktdemo</p></div>
        </a>
        <div className="flex items-center gap-3"><DemoBadge /><a href="/" className="text-sm font-bold text-slate-300 hover:text-white">Tilbake</a></div>
      </header>

      <main className="mx-auto max-w-7xl px-5 pb-12">
        <section className="grid min-h-[78vh] items-center gap-8 lg:grid-cols-[0.8fr_1.2fr]">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.2em] text-indigo-300">Automatisk demo · {secondsLeft}s igjen</p>
            <h1 className="mt-4 max-w-xl text-4xl font-black tracking-tight md:text-6xl">{title}</h1>
            <p className="mt-5 max-w-xl text-lg leading-8 text-slate-300">
              Denne visningen kobler aldri til en kundes database. Alle personer, beløp og hendelser er syntetiske demo-data laget kun for presentasjon.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <button onClick={restart} className="inline-flex items-center gap-2 rounded-2xl bg-white px-5 py-3 font-black text-slate-950"><RefreshCcw className="h-4 w-4" /> Start på nytt</button>
              {!playing && <button onClick={restart} className="inline-flex items-center gap-2 rounded-2xl border border-slate-700 px-5 py-3 font-black"><Play className="h-4 w-4" /> Spill 15 sek</button>}
            </div>
            <div className="mt-8 h-2 overflow-hidden rounded-full bg-slate-800"><div className="h-full rounded-full bg-white transition-[width] duration-100" style={{ width: `${progress}%` }} /></div>
            <div className="mt-4 grid grid-cols-4 gap-2 text-center text-xs font-bold text-slate-500">
              {['Oversikt','Kalender','Økonomi','Hverdag'].map((label, i) => <span key={label} className={i === step ? 'text-white' : ''}>{label}</span>)}
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-3xl overflow-hidden rounded-[2rem] border border-slate-800 bg-slate-100 p-3 shadow-2xl shadow-indigo-950/40">
            <div className="rounded-[1.5rem] bg-white p-5 text-slate-900 md:p-7">
              <div className="flex items-center justify-between border-b border-slate-200 pb-4">
                <div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-900 text-white"><Heart className="h-5 w-5" /></span><div><p className="font-black">FamilieHub</p><p className="text-xs text-slate-500">Familien Nord · DEMO</p></div></div>
                <DemoBadge />
              </div>

              {step === 0 && <div className="mt-6">
                <div className="grid gap-3 md:grid-cols-4">
                  {[['Neste aktivitet','16:30','Kalender'],['Åpne oppgaver','6','Oppgaver'],['Handleliste','11','Varer'],['Dokumenter','24','Arkiv']].map(([a,b,c]) => <div key={a} className="rounded-2xl border border-slate-200 p-4"><p className="text-xs font-semibold text-slate-500">{a}</p><p className="mt-1 text-2xl font-black">{b}</p><p className="text-xs text-slate-400">{c}</p></div>)}
                </div>
                <div className="mt-4 rounded-2xl bg-slate-50 p-5"><p className="text-sm font-black">I dag</p><div className="mt-3 grid gap-3 md:grid-cols-3">{demoEvents.map(e => <div key={e.time} className="rounded-xl bg-white p-3 shadow-sm"><p className="text-xs font-bold text-indigo-600">{e.time}</p><p className="mt-1 font-bold">{e.title}</p><p className="text-xs text-slate-500">{e.who}</p></div>)}</div></div>
              </div>}

              {step === 1 && <div className="mt-6">
                <div className="mb-4 flex items-center gap-2"><CalendarDays className="h-5 w-5 text-indigo-600" /><h2 className="text-xl font-black">Familiekalender</h2></div>
                <div className="space-y-3">{demoEvents.map((e,i) => <div key={e.time} className="flex items-center gap-4 rounded-2xl border border-slate-200 p-4"><div className="w-16 text-center"><p className="font-black">{e.time}</p></div><div className="flex-1"><p className="font-black">{e.title}</p><p className="text-sm text-slate-500">Ansvarlig: {e.who}</p></div><CheckCircle2 className={i === 0 ? 'text-emerald-500' : 'text-slate-300'} /></div>)}</div>
              </div>}

              {step === 2 && <div className="mt-6">
                <div className="mb-4 flex items-center gap-2"><Wallet className="h-5 w-5 text-indigo-600" /><h2 className="text-xl font-black">Økonomi · demo</h2></div>
                <div className="grid gap-3 md:grid-cols-3">
                  <div className="rounded-2xl border border-slate-200 p-4"><p className="text-xs text-slate-500">Nettoformue</p><p className="mt-1 text-2xl font-black">1 240 000 kr</p><p className="text-xs text-amber-600">syntetisk demo-beløp</p></div>
                  <div className="rounded-2xl border border-slate-200 p-4"><p className="text-xs text-slate-500">Månedsbudsjett</p><p className="mt-1 text-2xl font-black">52 000 kr</p><p className="text-xs text-amber-600">syntetisk demo-beløp</p></div>
                  <div className="rounded-2xl border border-slate-200 p-4"><p className="text-xs text-slate-500">Sparemål</p><p className="mt-1 text-2xl font-black">68 %</p><p className="text-xs text-amber-600">syntetisk demo-verdi</p></div>
                </div>
                <div className="mt-4 rounded-2xl bg-slate-50 p-5"><p className="font-black">Fordeling denne måneden</p><div className="mt-4 flex h-4 overflow-hidden rounded-full bg-slate-200"><span className="w-[44%] bg-slate-900" /><span className="w-[31%] bg-slate-500" /><span className="w-[25%] bg-slate-300" /></div><div className="mt-3 flex flex-wrap gap-4 text-xs text-slate-500"><span>44 % faste kostnader</span><span>31 % hverdag</span><span>25 % sparing</span></div></div>
              </div>}

              {step === 3 && <div className="mt-6">
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="rounded-2xl border border-slate-200 p-5"><FileText className="h-6 w-6 text-indigo-600" /><p className="mt-3 font-black">Dokumenter</p><p className="mt-1 text-sm text-slate-500">Forsikring, garanti og pass samlet og søkbart.</p></div>
                  <div className="rounded-2xl border border-slate-200 p-5"><Receipt className="h-6 w-6 text-indigo-600" /><p className="mt-3 font-black">Kvitteringer</p><p className="mt-1 text-sm text-slate-500">Skann og organiser kjøp uten manuell sortering.</p></div>
                  <div className="rounded-2xl border border-slate-200 p-5"><ShoppingCart className="h-6 w-6 text-indigo-600" /><p className="mt-3 font-black">Handleliste</p><p className="mt-1 text-sm text-slate-500">Delte lister og forslag basert på historikk.</p></div>
                </div>
                <div className="mt-4 rounded-2xl bg-emerald-50 p-5 text-emerald-950"><p className="font-black">15 sekunder senere</p><p className="mt-1 text-sm">Kalender, økonomi, dokumenter og hverdagsoppgaver ligger i samme arbeidsflate — uten at demoen bruker noen ekte kundedata.</p></div>
              </div>}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
};
