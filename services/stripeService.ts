/**
 * Stripe integration for FamilieHub
 * Calls Vercel serverless functions to create checkout / portal sessions.
 */

import type { SubscriptionPlan } from '../types';

export const PRICING = {
  monthly: { amount: 6, period: 'month', currency: 'EUR', symbol: '€' },
  annual: { amount: 57.6, period: 'year', currency: 'EUR', symbol: '€', monthlyEquivalent: 4.8, discountPct: 20 },
} as const;

export const createCheckoutSession = async (userEmail: string, plan: SubscriptionPlan = 'monthly') => {
  try {
    const response = await fetch('/api/stripe/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: userEmail, plan }),
    });

    const session = await response.json();

    if (session.url) {
      window.location.href = session.url;
      return;
    }
    throw new Error(session.error || 'Stripe response missing URL');
  } catch (err) {
    console.error('Stripe checkout error:', err);
    alert('Could not connect to Stripe. Check Vercel function logs.');
  }
};

export const openCustomerPortal = async (userId: string) => {
  try {
    const response = await fetch('/api/stripe/portal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    });
    const { url, error } = await response.json();
    if (url) {
      window.location.href = url;
      return;
    }
    throw new Error(error || 'No portal URL returned');
  } catch (err) {
    console.error('Stripe portal error:', err);
    alert('Could not open billing portal.');
  }
};

// ═══════════════════════════════════════════════════════════
// NY SaaS-flyt via Supabase edge function (stripe-checkout).
// Bruker Stripe Checkout Session med JWT-autentisering.
// ═══════════════════════════════════════════════════════════

import { supabase, isSupabaseConfigured } from '../supabase';
import type { PlanId } from './subscriptionPlans';

export async function startPlanCheckout(planId: PlanId): Promise<void> {
  if (planId === 'free') return;
  if (planId === 'advisor') {
    window.location.href = 'mailto:mail@extrade.es?subject=FamilyHub Advisor-plan';
    return;
  }
  if (!isSupabaseConfigured()) throw new Error('Supabase ikke konfigurert');

  const { data, error } = await supabase.functions.invoke('stripe-checkout', {
    method: 'POST',
    body: { planId },
  });
  if (error) throw new Error(error.message || 'Checkout feilet');
  if (!data?.url) throw new Error('Ingen checkout-URL mottatt fra Stripe');
  window.location.href = data.url;
}
