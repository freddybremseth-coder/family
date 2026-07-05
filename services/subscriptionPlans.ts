/**
 * FamilyHub abonnement-planer.
 *
 * Prisene er indikative — Stripe-price-ID må settes i env-vars pr plan:
 *   STRIPE_PRICE_ID_FAMILY, STRIPE_PRICE_ID_BUSINESS, STRIPE_PRICE_ID_ADVISOR
 */

export type PlanId = 'free' | 'family' | 'business' | 'advisor';

export interface Plan {
  id: PlanId;
  name: string;
  priceMonthly: number;
  currency: 'NOK';
  aiCallsPerDay: number;
  users: number;
  highlights: string[];
  cta: string;
  recommended?: boolean;
}

export const PLANS: Plan[] = [
  {
    id: 'free',
    name: 'Free',
    priceMonthly: 0,
    currency: 'NOK',
    aiCallsPerDay: 5,
    users: 1,
    highlights: ['1 bruker', '5 AI-kall/dag', 'Manuelle transaksjoner', 'Grunnleggende budsjett'],
    cta: 'Kom i gang',
  },
  {
    id: 'family',
    name: 'Family',
    priceMonthly: 99,
    currency: 'NOK',
    aiCallsPerDay: 100,
    users: 4,
    highlights: ['4 brukere', '100 AI-kall/dag', 'Bank-import (CSV/PDF)', 'Kvitteringsscan', 'Delt husholdning'],
    cta: 'Oppgrader til Family',
    recommended: true,
  },
  {
    id: 'business',
    name: 'Business',
    priceMonthly: 299,
    currency: 'NOK',
    aiCallsPerDay: 1000,
    users: 10,
    highlights: ['10 brukere', '1 000 AI-kall/dag', 'Mondeo/Frank-lån-tracker', 'RealtyFlow-integrasjon', 'Kontrakt-avregning + KPI', 'PDF-eksport'],
    cta: 'Oppgrader til Business',
  },
  {
    id: 'advisor',
    name: 'Advisor',
    priceMonthly: 999,
    currency: 'NOK',
    aiCallsPerDay: 5000,
    users: 999,
    highlights: ['Multi-familie-tenant', '5 000 AI-kall/dag', 'White-label', 'Prioritert support', 'API-tilgang (kommer)'],
    cta: 'Kontakt oss',
  },
];

export function planById(id: string): Plan | undefined {
  return PLANS.find(p => p.id === id);
}
