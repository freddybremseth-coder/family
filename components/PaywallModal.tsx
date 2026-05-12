import React, { useState } from 'react';
import { createCheckoutSession, PRICING } from '../services/stripeService';
import type { SubscriptionPlan, Language } from '../types';
import { translations } from '../translations';
import { Sparkles, CheckCircle, X, Loader2, Crown, Clock, BadgePercent } from 'lucide-react';

interface Props {
  userEmail: string;
  daysLeft: number;
  onClose?: () => void;
  lang?: Language;
}

export const PaywallModal: React.FC<Props> = ({ userEmail, daysLeft, onClose, lang = 'no' }) => {
  const [loading, setLoading] = useState(false);
  const [plan, setPlan] = useState<SubscriptionPlan>('annual');
  const t = translations[lang] || translations.no;
  const isExpired = daysLeft <= 0;

  const handleUpgrade = async () => {
    setLoading(true);
    await createCheckoutSession(userEmail, plan);
    setLoading(false);
  };

  const monthly = PRICING.monthly;
  const annual = PRICING.annual;

  return (
    <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 modal-overlay" onClick={!isExpired && onClose ? onClose : undefined} />

      <div className="relative bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl w-full sm:max-w-md max-h-[92vh] overflow-y-auto p-6 sm:p-8 animate-fade-in">
        <div
          className="absolute top-0 left-0 right-0 h-1.5 rounded-t-3xl"
          style={{ background: 'linear-gradient(90deg, #6366F1, #8B5CF6, #EC4899, #F97316)' }}
        />
        {!isExpired && onClose && (
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 rounded-lg text-slate-400 hover:bg-slate-100 transition-colors"
            aria-label={t.close}
          >
            <X className="w-5 h-5" />
          </button>
        )}

        <div className="text-center mb-5 mt-3">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-lg"
            style={{ background: 'linear-gradient(135deg, #6366F1 0%, #8B5CF6 50%, #EC4899 100%)' }}
          >
            <Crown className="w-7 h-7 text-white" />
          </div>

          {isExpired ? (
            <>
              <h2 className="text-xl sm:text-2xl font-bold text-slate-900">{t.trial_over}</h2>
              <p className="text-slate-500 mt-1.5 text-sm">{t.trial_over_sub}</p>
            </>
          ) : (
            <>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-100 text-amber-700 rounded-full text-xs font-semibold mb-2">
                <Clock className="w-3.5 h-3.5" />
                {t.trial_days_left.replace('{days}', String(daysLeft))}
              </div>
              <h2 className="text-xl sm:text-2xl font-bold text-slate-900">{t.upgrade_title}</h2>
              <p className="text-slate-500 mt-1.5 text-sm">{t.upgrade_sub}</p>
            </>
          )}
        </div>

        {/* Plan selector */}
        <div className="grid grid-cols-2 gap-2 mb-5">
          <button
            onClick={() => setPlan('monthly')}
            className={`relative p-3 rounded-2xl border-2 text-left transition-all ${
              plan === 'monthly'
                ? 'border-indigo-600 bg-indigo-50'
                : 'border-slate-200 hover:border-slate-300'
            }`}
          >
            <p className="text-xs font-semibold text-slate-500">{t.plan_monthly}</p>
            <p className="text-2xl font-extrabold text-slate-900 mt-0.5">
              {monthly.symbol}{monthly.amount}
            </p>
            <p className="text-xs text-slate-500">/ {t.per_month}</p>
          </button>

          <button
            onClick={() => setPlan('annual')}
            className={`relative p-3 rounded-2xl border-2 text-left transition-all ${
              plan === 'annual'
                ? 'border-indigo-600 bg-indigo-50'
                : 'border-slate-200 hover:border-slate-300'
            }`}
          >
            <span className="absolute -top-2 right-2 inline-flex items-center gap-0.5 px-2 py-0.5 bg-emerald-500 text-white text-[10px] font-bold rounded-full">
              <BadgePercent className="w-3 h-3" /> -{annual.discountPct}%
            </span>
            <p className="text-xs font-semibold text-slate-500">{t.plan_annual}</p>
            <p className="text-2xl font-extrabold text-slate-900 mt-0.5">
              {annual.symbol}{annual.monthlyEquivalent.toFixed(2).replace('.', ',')}
            </p>
            <p className="text-xs text-slate-500">/ {t.per_month}</p>
            <p className="text-[11px] text-emerald-600 font-semibold mt-0.5">
              {annual.symbol}{annual.amount.toFixed(2).replace('.', ',')} / {t.per_year}
            </p>
          </button>
        </div>

        {/* Features */}
        <ul className="space-y-2 mb-5">
          {[t.feat_calendar, t.feat_smart_cart, t.feat_finance, t.feat_receipts, t.feat_unlimited, t.feat_support].map((f) => (
            <li key={f} className="flex items-center gap-2 text-sm text-slate-700">
              <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />
              {f}
            </li>
          ))}
        </ul>

        <button
          onClick={handleUpgrade}
          disabled={loading}
          className="w-full py-3.5 text-white rounded-xl font-bold transition-all disabled:opacity-50 flex items-center justify-center gap-2 active:scale-[0.99] hover:-translate-y-0.5"
          style={{
            background: 'linear-gradient(135deg, #6366F1 0%, #8B5CF6 50%, #EC4899 100%)',
            boxShadow: '0 12px 30px rgba(99, 102, 241, 0.35)',
          }}
        >
          {loading ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> {t.connecting_stripe}</>
          ) : (
            <><Sparkles className="w-4 h-4" />
              {plan === 'annual'
                ? `${t.start_annual} — ${annual.symbol}${annual.amount.toFixed(2).replace('.', ',')}/${t.year_short}`
                : `${t.start_monthly} — ${monthly.symbol}${monthly.amount}/${t.month_short}`}
            </>
          )}
        </button>

        <p className="text-center text-xs text-slate-400 mt-3">{t.secure_stripe}</p>
      </div>
    </div>
  );
};
