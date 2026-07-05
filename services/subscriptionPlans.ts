/**
 * FamilyHub prismodell — Basic-abonnement + AI-tilleggspakker (metered).
 *
 * Basic (4 EUR/mnd) er full app-tilgang. Inkluderer en månedlig AI-kvote
 * som resettes 1. i hver måned. Går du tom, kjøper du en engangs AI-pakke
 * for å fortsette.
 *
 * Stripe-price-ID-er må settes i env-vars:
 *   STRIPE_PRICE_ID_BASIC (recurring, 4 EUR/mnd)
 *   STRIPE_PRICE_ID_AI_PACK_SMALL  (one-time, 2 EUR, 50 kall)
 *   STRIPE_PRICE_ID_AI_PACK_MEDIUM (one-time, 6 EUR, 200 kall)
 *   STRIPE_PRICE_ID_AI_PACK_LARGE  (one-time, 12 EUR, 500 kall)
 */

export type SubscriptionId = 'free' | 'basic';
export type AiPackId = 'ai_pack_small' | 'ai_pack_medium' | 'ai_pack_large';

export interface Subscription {
  id: SubscriptionId;
  name: string;
  priceMonthly: number;
  currency: 'EUR';
  aiCallsPerMonth: number; // Månedlig kvote inkludert i planen
  highlights: string[];
  cta: string;
  recommended?: boolean;
}

export interface AiPack {
  id: AiPackId;
  name: string;
  price: number;
  currency: 'EUR';
  credits: number;      // Ekstra AI-kall
  pricePerCall: number; // For display (best-value markering)
  bestValue?: boolean;
}

// ═══════════════════════════════════════════════════════════
// Basic-abonnement — én pris, full app-tilgang
// ═══════════════════════════════════════════════════════════
export const SUBSCRIPTIONS: Subscription[] = [
  {
    id: 'free',
    name: 'Free',
    priceMonthly: 0,
    currency: 'EUR',
    aiCallsPerMonth: 20,
    highlights: ['Prøv appen', 'Begrenset til 20 AI-kall/mnd', 'Ingen bank-import', 'Ingen kvitteringsscan'],
    cta: 'Kom i gang',
  },
  {
    id: 'basic',
    name: 'Basic',
    priceMonthly: 4,
    currency: 'EUR',
    aiCallsPerMonth: 200,
    highlights: [
      'Full app-tilgang',
      '200 AI-kall/mnd inkludert',
      'Kvitteringsscan + bank-import',
      'Mondeo/Frank-lån-tracker',
      'Kalender og oppgaver',
      'PDF-eksport',
      'Delt husholdning (opp til 4 brukere)',
    ],
    cta: 'Start Basic — 4 €/mnd',
    recommended: true,
  },
];

// ═══════════════════════════════════════════════════════════
// AI-tilleggspakker — engangskjøp når månedskvoten er brukt
// ═══════════════════════════════════════════════════════════
export const AI_PACKS: AiPack[] = [
  { id: 'ai_pack_small',  name: 'Liten',  price: 2,  currency: 'EUR', credits: 50,  pricePerCall: 0.04 },
  { id: 'ai_pack_medium', name: 'Middels', price: 6, currency: 'EUR', credits: 200, pricePerCall: 0.03, bestValue: true },
  { id: 'ai_pack_large',  name: 'Stor',   price: 12, currency: 'EUR', credits: 500, pricePerCall: 0.024 },
];

export function subscriptionById(id: string): Subscription | undefined {
  return SUBSCRIPTIONS.find(s => s.id === id);
}

export function aiPackById(id: string): AiPack | undefined {
  return AI_PACKS.find(p => p.id === id);
}

// Månedlig AI-kvote per plan (brukes av edge function ai-proxy)
export const MONTHLY_AI_QUOTA: Record<string, number> = {
  free: 20,
  trial: 100,     // 24-timers trial får mer for demo
  basic: 200,
  lifetime: 999999, // Admin har uendelig
};
