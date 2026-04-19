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
