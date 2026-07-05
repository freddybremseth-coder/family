// Stripe checkout session-creator for FamilyHub abonnement.
// Klient POST-er { planId: 'family'|'business'|'advisor' } med JWT.
// Returnerer { url } for redirect til Stripe Checkout.
//
// Kreves env-vars i Supabase:
//   STRIPE_SECRET_KEY (sk_live_… eller sk_test_…)
//   STRIPE_PRICE_ID_FAMILY (price_…)
//   STRIPE_PRICE_ID_BUSINESS
//   STRIPE_PRICE_ID_ADVISOR
//   PUBLIC_APP_URL (f.eks. https://family.chatgenius.pro) — for redirect etter payment

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.7';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function requiredEnv(name: string) {
  const v = Deno.env.get(name);
  if (!v) throw new Error(`${name} is required`);
  return v;
}

const PRICE_IDS: Record<string, string | undefined> = {
  family: Deno.env.get('STRIPE_PRICE_ID_FAMILY'),
  business: Deno.env.get('STRIPE_PRICE_ID_BUSINESS'),
  advisor: Deno.env.get('STRIPE_PRICE_ID_ADVISOR'),
};

async function stripeApi(path: string, params: URLSearchParams) {
  const key = requiredEnv('STRIPE_SECRET_KEY');
  const res = await fetch(`https://api.stripe.com/v1/${path}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${key}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  });
  if (!res.ok) throw new Error(`Stripe ${res.status}: ${await res.text()}`);
  return await res.json();
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return new Response(JSON.stringify({ error: 'POST only' }), { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  try {
    const supabaseUrl = requiredEnv('SUPABASE_URL');
    const anonKey = requiredEnv('SUPABASE_ANON_KEY');
    const authHeader = req.headers.get('Authorization') || '';

    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: userData, error: userError } = await userClient.auth.getUser();
    if (userError || !userData.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const user = userData.user;

    const body = await req.json().catch(() => ({}));
    const planId = String(body.planId || '').toLowerCase();
    const priceId = PRICE_IDS[planId];
    if (!priceId) {
      return new Response(JSON.stringify({ error: `Ukjent plan: ${planId}` }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const appUrl = requiredEnv('PUBLIC_APP_URL').replace(/\/$/, '');

    // Opprett Stripe Checkout Session
    const params = new URLSearchParams();
    params.set('mode', 'subscription');
    params.set('customer_email', user.email || '');
    params.set('client_reference_id', user.id);
    params.set('line_items[0][price]', priceId);
    params.set('line_items[0][quantity]', '1');
    params.set('success_url', `${appUrl}/?checkout=success&plan=${planId}`);
    params.set('cancel_url', `${appUrl}/?checkout=cancel`);
    params.set('metadata[user_id]', user.id);
    params.set('metadata[plan]', planId);
    params.set('subscription_data[metadata][user_id]', user.id);
    params.set('subscription_data[metadata][plan]', planId);
    params.set('allow_promotion_codes', 'true');

    const session = await stripeApi('checkout/sessions', params);

    return new Response(JSON.stringify({ url: session.url, id: session.id }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err?.message || 'Unknown error' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
