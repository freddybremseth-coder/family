import React, { useEffect, useState } from 'react';
import { X, Check, Sparkles, Zap, Loader2, Package } from 'lucide-react';
import { SUBSCRIPTIONS, AI_PACKS, Subscription, AiPack } from '../services/subscriptionPlans';
import { startProductCheckout } from '../services/stripeService';
import { translations } from '../translations';
import { Language } from '../types';

interface Props {
  open: boolean;
  currentPlan?: string;    // 'free' | 'basic' | 'trial' | 'lifetime' etc.
  triggerReason?: string;  // f.eks. 'AI-kvote nådd'
  lang?: Language;
  onClose: () => void;
}

export const UpgradePlanModal: React.FC<Props> = ({ open, currentPlan, triggerReason, lang = 'no', onClose }) => {
  const t = translations[lang] || translations['no'];
  const [processing, setProcessing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) { setProcessing(null); setError(null); }
  }, [open]);

  if (!open) return null;

  const isSubscribed = currentPlan === 'basic' || currentPlan === 'lifetime' || currentPlan === 'basic_cancelled';

  const handleSelect = async (productId: string) => {
    setProcessing(productId);
    setError(null);
    try {
      await startProductCheckout(productId);
    } catch (err: any) {
      setError(err?.message || 'Kunne ikke starte checkout');
      setProcessing(null);
    }
  };

  return (
    <div className="fixed inset-0 z-[210] flex items-center justify-center bg-slate-900/70 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="relative w-full max-w-3xl my-8 rounded-3xl bg-white shadow-2xl">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          aria-label={t.upgrade_close || 'Lukk'}
        >
          <X className="h-5 w-5" />
        </button>

        <div className="p-8">
          <div className="text-center mb-8">
            {triggerReason && (
              <div className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 text-amber-800 px-3 py-1 text-xs font-bold uppercase tracking-wider mb-3">
                ⚡ {triggerReason}
              </div>
            )}
            <h2 className="text-3xl md:text-4xl font-black text-slate-900">
              {isSubscribed ? 'Kjøp ekstra AI-kall' : (t.upgrade_title || 'Oppgrader til Basic')}
            </h2>
            <p className="mt-2 text-slate-600 max-w-2xl mx-auto">
              {isSubscribed
                ? 'Din månedskvote er brukt opp. Kjøp en tilleggspakke — gjelder til den er brukt.'
                : 'Full app-tilgang for 4 €/mnd. Inkludert AI-kvote. Kan sies opp når som helst.'}
            </p>
          </div>

          {error && (
            <div className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800 text-center">
              {error}
            </div>
          )}

          {/* Basic-abonnement — vises hvis ikke allerede abonnent */}
          {!isSubscribed && (
            <div className="mb-6">
              {SUBSCRIPTIONS.filter(s => s.id === 'basic').map((sub: Subscription) => (
                <div key={sub.id} className="relative rounded-2xl border-2 border-indigo-500 bg-gradient-to-br from-indigo-50 to-white p-6 shadow-xl">
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-indigo-600 text-white px-3 py-1 text-[10px] font-black uppercase tracking-widest">
                    {t.upgrade_recommended || 'Anbefalt'}
                  </span>
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 text-slate-700">
                        <Sparkles className="h-5 w-5 text-indigo-600" />
                        <h3 className="text-2xl font-black">{sub.name}</h3>
                      </div>
                      <div className="mt-2">
                        <span className="text-4xl font-black text-slate-900">{sub.priceMonthly} €</span>
                        <span className="text-slate-500 font-bold">/mnd</span>
                      </div>
                      <ul className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5">
                        {sub.highlights.map(h => (
                          <li key={h} className="flex items-start gap-2 text-sm text-slate-700">
                            <Check className="h-4 w-4 text-emerald-600 mt-0.5 shrink-0" />
                            <span>{h}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleSelect('basic')}
                      disabled={processing !== null}
                      className="rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-70 px-6 py-3 text-sm font-black uppercase tracking-wide text-white whitespace-nowrap"
                    >
                      {processing === 'basic' ? (
                        <span className="inline-flex items-center gap-1.5"><Loader2 className="h-4 w-4 animate-spin" /> {t.upgrade_opening_stripe || 'Åpner Stripe…'}</span>
                      ) : sub.cta}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* AI-tilleggspakker */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <Package className="h-5 w-5 text-slate-600" />
              <h3 className="text-lg font-black text-slate-900">
                {isSubscribed ? 'AI-tilleggspakker' : 'Trenger mer AI? Kjøp en pakke i tillegg'}
              </h3>
              <span className="text-xs text-slate-500">(engangs, ikke abonnement)</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {AI_PACKS.map((pack: AiPack) => (
                <div key={pack.id} className={`relative rounded-xl border-2 p-4 flex flex-col ${pack.bestValue ? 'border-emerald-500 bg-emerald-50/40' : 'border-slate-200 bg-white'}`}>
                  {pack.bestValue && (
                    <span className="absolute -top-2 left-1/2 -translate-x-1/2 rounded-full bg-emerald-600 text-white px-2 py-0.5 text-[9px] font-black uppercase tracking-widest">
                      Beste verdi
                    </span>
                  )}
                  <p className="text-xs uppercase font-bold text-slate-500 tracking-widest">{pack.name}</p>
                  <p className="mt-2">
                    <span className="text-3xl font-black text-slate-900">{pack.price} €</span>
                  </p>
                  <p className="mt-1 text-sm text-slate-700 font-semibold">{pack.credits} AI-kall</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">({(pack.pricePerCall * 100).toFixed(1)} øre/kall)</p>
                  <button
                    type="button"
                    onClick={() => handleSelect(pack.id)}
                    disabled={processing !== null || !isSubscribed}
                    className={`mt-3 w-full rounded-xl px-3 py-2 text-xs font-black uppercase tracking-wide transition ${
                      pack.bestValue ? 'bg-emerald-600 text-white hover:bg-emerald-700' : 'border border-slate-300 text-slate-700 hover:bg-slate-50'
                    } disabled:opacity-40 disabled:cursor-not-allowed`}
                  >
                    {processing === pack.id ? (
                      <span className="inline-flex items-center gap-1.5"><Loader2 className="h-3 w-3 animate-spin" /> Stripe…</span>
                    ) : 'Kjøp pakke'}
                  </button>
                </div>
              ))}
            </div>
            {!isSubscribed && (
              <p className="mt-3 text-xs text-slate-500 italic">
                💡 AI-pakker krever aktivt Basic-abonnement. Abonner først, så kan du legge til flere kall etter behov.
              </p>
            )}
          </div>

          <p className="mt-6 text-center text-xs text-slate-500">
            {t.upgrade_footer || 'Sikker betaling via Stripe. Ingen bindingstid. Kan sies opp når som helst fra Innstillinger.'}
          </p>
        </div>
      </div>
    </div>
  );
};
