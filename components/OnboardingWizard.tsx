import React, { useState } from 'react';
import { Sparkles, Users, MapPin, Coins, Zap, CheckCircle2, ArrowRight } from 'lucide-react';
import { UserConfig, Currency, Language } from '../types';
import { setBuiltinAiEnabled } from '../services/aiProxyService';

interface Props {
  currentConfig: UserConfig;
  onComplete: (nextConfig: UserConfig, useBuiltinAi: boolean) => void;
  onSkip: () => void;
}

type Step = 1 | 2 | 3;

const ONBOARDING_DONE_KEY = 'familyhub_onboarded_v1';

export function hasCompletedOnboarding(): boolean {
  try { return localStorage.getItem(ONBOARDING_DONE_KEY) === '1'; } catch { return false; }
}

export function markOnboardingComplete() {
  try { localStorage.setItem(ONBOARDING_DONE_KEY, '1'); } catch {}
}

export const OnboardingWizard: React.FC<Props> = ({ currentConfig, onComplete, onSkip }) => {
  const [step, setStep] = useState<Step>(1);
  const [familyName, setFamilyName] = useState(currentConfig.familyName || '');
  const [location, setLocation] = useState<'Norge' | 'Spania' | 'Annet'>(
    currentConfig.location?.includes('Spain') || currentConfig.location?.includes('Spania') ? 'Spania' :
    currentConfig.location?.includes('Norge') || currentConfig.location?.includes('Norway') ? 'Norge' : 'Annet',
  );
  const [currency, setCurrency] = useState<Currency>(currentConfig.preferredCurrency || 'NOK');
  const [language, setLanguage] = useState<Language>(currentConfig.language || 'no');
  const [useBuiltinAi, setUseBuiltinAi] = useState(true);

  const next = () => setStep(s => (s < 3 ? ((s + 1) as Step) : s));
  const prev = () => setStep(s => (s > 1 ? ((s - 1) as Step) : s));

  const finish = () => {
    if (useBuiltinAi) setBuiltinAiEnabled(true);
    markOnboardingComplete();
    onComplete({
      ...currentConfig,
      familyName: familyName.trim() || currentConfig.familyName,
      location,
      preferredCurrency: currency,
      language,
    }, useBuiltinAi);
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-2xl rounded-3xl bg-white shadow-2xl overflow-hidden">
        {/* Progress-bar */}
        <div className="h-1.5 bg-slate-100">
          <div className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all" style={{ width: `${(step / 3) * 100}%` }} />
        </div>

        <div className="p-8">
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-indigo-100 text-indigo-700">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-slate-500">Velkommen — steg {step} av 3</p>
              <h2 className="text-2xl font-black text-slate-900">
                {step === 1 && 'Fortell oss om familien'}
                {step === 2 && 'Hvor bor dere, hvilken valuta?'}
                {step === 3 && 'Vil du bruke innebygd AI?'}
              </h2>
            </div>
          </div>

          {step === 1 && (
            <div className="space-y-5">
              <div>
                <label className="text-sm font-bold text-slate-700 flex items-center gap-1.5"><Users className="h-4 w-4" /> Familienavn</label>
                <input
                  type="text"
                  value={familyName}
                  onChange={e => setFamilyName(e.target.value)}
                  placeholder="F.eks. Familien Bremseth"
                  className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none focus:border-indigo-400"
                  autoFocus
                />
                <p className="mt-1.5 text-xs text-slate-500">Vises i toppen av appen og på PDF-utskrifter.</p>
              </div>
              <div>
                <label className="text-sm font-bold text-slate-700">Foretrukket språk</label>
                <div className="mt-2 grid grid-cols-3 gap-2">
                  {[
                    { code: 'no' as Language, label: '🇳🇴 Norsk' },
                    { code: 'en' as Language, label: '🇬🇧 English' },
                    { code: 'es' as Language, label: '🇪🇸 Español' },
                  ].map(opt => (
                    <button
                      key={opt.code}
                      type="button"
                      onClick={() => setLanguage(opt.code)}
                      className={`rounded-xl border-2 px-4 py-3 text-sm font-bold transition ${language === opt.code ? 'border-indigo-500 bg-indigo-50 text-indigo-900' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'}`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-5">
              <div>
                <label className="text-sm font-bold text-slate-700 flex items-center gap-1.5"><MapPin className="h-4 w-4" /> Hvor er dere basert?</label>
                <div className="mt-2 grid grid-cols-3 gap-2">
                  {(['Norge', 'Spania', 'Annet'] as const).map(loc => (
                    <button
                      key={loc}
                      type="button"
                      onClick={() => { setLocation(loc); if (loc === 'Norge') setCurrency('NOK'); else if (loc === 'Spania') setCurrency('EUR'); }}
                      className={`rounded-xl border-2 px-4 py-3 text-sm font-bold transition ${location === loc ? 'border-indigo-500 bg-indigo-50 text-indigo-900' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'}`}
                    >
                      {loc === 'Norge' && '🇳🇴'} {loc === 'Spania' && '🇪🇸'} {loc === 'Annet' && '🌍'} {loc}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-sm font-bold text-slate-700 flex items-center gap-1.5"><Coins className="h-4 w-4" /> Hovedvaluta</label>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  {(['NOK', 'EUR'] as Currency[]).map(cur => (
                    <button
                      key={cur}
                      type="button"
                      onClick={() => setCurrency(cur)}
                      className={`rounded-xl border-2 px-4 py-3 text-sm font-bold transition ${currency === cur ? 'border-indigo-500 bg-indigo-50 text-indigo-900' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'}`}
                    >
                      {cur === 'NOK' ? '🇳🇴 Norske kroner (kr)' : '🇪🇺 Euro (€)'}
                    </button>
                  ))}
                </div>
                <p className="mt-1.5 text-xs text-slate-500">Beløp i annen valuta konverteres automatisk til din hovedvaluta.</p>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-5">
              <div className="rounded-2xl border-2 border-indigo-200 bg-gradient-to-br from-indigo-50 to-purple-50 p-5">
                <div className="flex items-start gap-3">
                  <Zap className="mt-0.5 h-5 w-5 text-indigo-600 shrink-0" />
                  <div className="flex-1">
                    <p className="font-black text-indigo-900">Innebygd AI (anbefalt)</p>
                    <p className="mt-1 text-sm text-indigo-800">
                      Kvitteringsscan, kjøleskap-scanning og bank-utskrifter fungerer ut av boksen. Ingen API-nøkler å håndtere. Kvote inkludert i planen.
                    </p>
                    <ul className="mt-3 space-y-1.5 text-sm text-indigo-800">
                      <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-600" /> Fungerer umiddelbart</li>
                      <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-600" /> Trial-plan: 50 AI-kall per dag</li>
                      <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-600" /> Skru av senere hvis du vil bruke egne nøkler</li>
                    </ul>
                    <div className="mt-4 flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => setUseBuiltinAi(!useBuiltinAi)}
                        className={`relative inline-flex h-7 w-14 items-center rounded-full transition-colors ${useBuiltinAi ? 'bg-indigo-600' : 'bg-slate-300'}`}
                      >
                        <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${useBuiltinAi ? 'translate-x-8' : 'translate-x-1'}`} />
                      </button>
                      <span className="text-sm font-bold text-indigo-900">
                        {useBuiltinAi ? 'Skru på (anbefalt)' : 'Skru av — jeg bruker egne API-nøkler'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                <p className="font-semibold">Neste steg etter oppsett:</p>
                <ol className="mt-2 space-y-1 list-decimal list-inside text-slate-600">
                  <li>Legg til familiemedlemmer under «Bosatte»</li>
                  <li>Koble til bankkontoer under «Bank»</li>
                  <li>Prøv å scanne en kvittering på Handleliste-fanen</li>
                </ol>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50 px-8 py-4">
          <button
            type="button"
            onClick={onSkip}
            className="text-sm font-semibold text-slate-500 hover:text-slate-700"
          >
            Hopp over
          </button>
          <div className="flex items-center gap-2">
            {step > 1 && (
              <button
                type="button"
                onClick={prev}
                className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50"
              >
                Tilbake
              </button>
            )}
            {step < 3 ? (
              <button
                type="button"
                onClick={next}
                disabled={step === 1 && !familyName.trim()}
                className="rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed px-5 py-2 text-sm font-bold text-white flex items-center gap-1.5"
              >
                Neste <ArrowRight className="h-4 w-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={finish}
                className="rounded-xl bg-emerald-600 hover:bg-emerald-700 px-6 py-2 text-sm font-black text-white flex items-center gap-1.5"
              >
                <CheckCircle2 className="h-4 w-4" /> Ferdig
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
