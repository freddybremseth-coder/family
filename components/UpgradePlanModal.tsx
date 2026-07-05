import React, { useEffect, useState } from 'react';
import { X, Check, Sparkles, Zap, Building2, Users, Loader2 } from 'lucide-react';
import { PLANS, Plan, PlanId } from '../services/subscriptionPlans';
import { startPlanCheckout } from '../services/stripeService';
import { translations } from '../translations';
import { Language } from '../types';

interface Props {
  open: boolean;
  currentPlan?: string;
  triggerReason?: string; // f.eks. 'AI-kvote nådd'
  lang?: Language;
  onClose: () => void;
}

const planIcon = (id: PlanId) => {
  switch (id) {
    case 'free': return <Users className="h-5 w-5" />;
    case 'family': return <Sparkles className="h-5 w-5" />;
    case 'business': return <Building2 className="h-5 w-5" />;
    case 'advisor': return <Zap className="h-5 w-5" />;
  }
};

export const UpgradePlanModal: React.FC<Props> = ({ open, currentPlan, triggerReason, lang = 'no', onClose }) => {
  const t = translations[lang] || translations['no'];
  const [processing, setProcessing] = useState<PlanId | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) { setProcessing(null); setError(null); }
  }, [open]);

  if (!open) return null;

  const handleSelect = async (plan: Plan) => {
    if (plan.id === (currentPlan as PlanId)) return;
    setProcessing(plan.id);
    setError(null);
    try {
      await startPlanCheckout(plan.id);
    } catch (err: any) {
      setError(err?.message || 'Kunne ikke starte checkout');
      setProcessing(null);
    }
  };

  return (
    <div className="fixed inset-0 z-[210] flex items-center justify-center bg-slate-900/70 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="relative w-full max-w-5xl my-8 rounded-3xl bg-white shadow-2xl">
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
              {t.upgrade_title || 'Velg planen som passer familien'}
            </h2>
            <p className="mt-2 text-slate-600 max-w-2xl mx-auto">
              {t.upgrade_subtitle || 'Oppgrader for høyere AI-kvote, flere brukere og pro-funksjoner.'}
            </p>
          </div>

          {error && (
            <div className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800 text-center">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {PLANS.map(plan => {
              const isCurrent = plan.id === currentPlan;
              const isProcessing = processing === plan.id;
              return (
                <div
                  key={plan.id}
                  className={`relative rounded-2xl border-2 p-5 flex flex-col ${
                    plan.recommended ? 'border-indigo-500 shadow-xl bg-gradient-to-br from-indigo-50 to-white' : 'border-slate-200 bg-white'
                  } ${isCurrent ? 'ring-2 ring-emerald-500' : ''}`}
                >
                  {plan.recommended && (
                    <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-indigo-600 text-white px-3 py-1 text-[10px] font-black uppercase tracking-widest">
                      {t.upgrade_recommended || 'Anbefalt'}
                    </span>
                  )}
                  {isCurrent && (
                    <span className="absolute -top-3 right-4 rounded-full bg-emerald-600 text-white px-3 py-1 text-[10px] font-black uppercase tracking-widest">
                      {t.upgrade_current_plan || 'Din plan'}
                    </span>
                  )}

                  <div className="flex items-center gap-2 text-slate-700">
                    {planIcon(plan.id)}
                    <h3 className="text-lg font-black">{plan.name}</h3>
                  </div>

                  <div className="mt-3">
                    <span className="text-4xl font-black text-slate-900">{plan.priceMonthly}</span>
                    <span className="text-slate-500 font-bold"> {t.upgrade_per_month || 'kr/mnd'}</span>
                  </div>

                  <ul className="mt-5 space-y-2 flex-1">
                    {plan.highlights.map(h => (
                      <li key={h} className="flex items-start gap-2 text-sm text-slate-700">
                        <Check className="h-4 w-4 text-emerald-600 mt-0.5 shrink-0" />
                        <span>{h}</span>
                      </li>
                    ))}
                  </ul>

                  <button
                    type="button"
                    onClick={() => handleSelect(plan)}
                    disabled={isCurrent || isProcessing}
                    className={`mt-5 w-full rounded-xl px-4 py-2.5 text-sm font-black uppercase tracking-wide transition ${
                      isCurrent
                        ? 'bg-emerald-100 text-emerald-800 cursor-default'
                        : plan.recommended
                        ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                        : 'border border-slate-300 text-slate-700 hover:bg-slate-50'
                    } disabled:opacity-70`}
                  >
                    {isProcessing ? (
                      <span className="inline-flex items-center gap-1.5"><Loader2 className="h-4 w-4 animate-spin" /> {t.upgrade_opening_stripe || 'Åpner Stripe…'}</span>
                    ) : isCurrent ? (t.upgrade_current_plan_short || 'Din nåværende plan') : plan.cta}
                  </button>
                </div>
              );
            })}
          </div>

          <p className="mt-6 text-center text-xs text-slate-500">
            {t.upgrade_footer || 'Sikker betaling via Stripe. Ingen bindingstid. Kan sies opp når som helst fra Innstillinger.'}
          </p>
        </div>
      </div>
    </div>
  );
};
