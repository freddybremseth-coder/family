import React, { useState } from 'react';
import { createCheckoutSession } from '../services/stripeService';
import { Sparkles, CheckCircle, X, Loader2, Crown, Clock } from 'lucide-react';

interface Props {
  userEmail: string;
  daysLeft: number; // negative = expired
  onClose?: () => void; // bare tilgjengelig i trial-modus
}

export const PaywallModal: React.FC<Props> = ({ userEmail, daysLeft, onClose }) => {
  const [loading, setLoading] = useState(false);
  const isExpired = daysLeft <= 0;

  const handleUpgrade = async () => {
    setLoading(true);
    await createCheckoutSession('', userEmail); // priceId hentes fra Vercel env
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/70 backdrop-blur-sm" />

      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-8 animate-fade-in">
        {/* Lukk-knapp kun i trial */}
        {!isExpired && onClose && (
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 rounded-lg text-slate-400 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        )}

        {/* Header */}
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-indigo-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Crown className="w-8 h-8 text-indigo-600" />
          </div>

          {isExpired ? (
            <>
              <h2 className="text-2xl font-bold text-slate-900">Prøveperioden er over</h2>
              <p className="text-slate-500 mt-2 text-sm">
                Oppgrader for å fortsette å bruke FamilieHub — familiens digitale hjem.
              </p>
            </>
          ) : (
            <>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-amber-100 text-amber-700 rounded-full text-sm font-semibold mb-3">
                <Clock className="w-4 h-4" />
                {daysLeft} dag{daysLeft !== 1 ? 'er' : ''} igjen av prøveperioden
              </div>
              <h2 className="text-2xl font-bold text-slate-900">Oppgrader til FamilieHub Pro</h2>
              <p className="text-slate-500 mt-2 text-sm">Fortsett uten avbrudd etter prøveperioden.</p>
            </>
          )}
        </div>

        {/* Pris */}
        <div className="bg-indigo-600 rounded-xl p-5 text-center mb-6">
          <p className="text-indigo-200 text-sm font-medium">FamilieHub Pro</p>
          <div className="flex items-end justify-center gap-1 mt-1">
            <span className="text-4xl font-extrabold text-white">20</span>
            <span className="text-white text-lg font-semibold mb-1">kr/mnd</span>
          </div>
          <p className="text-indigo-300 text-xs mt-1">Avslutt når som helst</p>
        </div>

        {/* Features */}
        <ul className="space-y-2.5 mb-6">
          {[
            'Felles familiekalender og oppgaver',
            'Smart handleliste med AI-ukeplan',
            'Full familieøkonomi og budsjett',
            'Kvitteringsskanning med AI',
            'Ubegrenset familiemedlemmer',
            'Prioritert support',
          ].map(f => (
            <li key={f} className="flex items-center gap-2.5 text-sm text-slate-700">
              <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />
              {f}
            </li>
          ))}
        </ul>

        {/* CTA */}
        <button
          onClick={handleUpgrade}
          disabled={loading}
          className="w-full py-3.5 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-indigo-200"
        >
          {loading ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> Kobler til Stripe...</>
          ) : (
            <><Sparkles className="w-4 h-4" /> Start abonnement — 20 kr/mnd</>
          )}
        </button>

        <p className="text-center text-xs text-slate-400 mt-3">
          Sikker betaling via Stripe · Ingen bindingstid
        </p>
      </div>
    </div>
  );
};
