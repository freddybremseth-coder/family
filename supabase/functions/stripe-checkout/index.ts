// Stripe checkout session-creator for FamilyHub.
// Klient POST-er { productId: 'basic' | 'ai_pack_small' | ...} med JWT.
// Returnerer { url } for redirect til Stripe Checkout.
//
// Kreves env-vars i Supabase:
//   STRIPE_SECRET_KEY (sk_live_… eller sk_test_…)
//   STRIPE_PRICE_ID_BASIC          (recurring, 4 EUR/mnd)
//   STRIPE_PRICE_ID_AI_PACK_SMALL  (one-time, 2 EUR, 50 kall)
//   STRIPE_PRICE_ID_AI_PACK_MEDIUM (one-time, 6 EUR, 200 kall)
//   STRIPE_PRICE_ID_AI_PACK_LARGE  (one-time, 12 EUR, 500 kall)
//   PUBLIC_APP_URL (f.eks. https://family.chatgenius.pro)

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

// Type: subscription (recurring) eller payment (engangs)
const PRODUCTS: Record<string, { priceEnv: string; mode: 'subscription' | 'payment'; credits?: number }> = {
  basic:           { priceEnv: 'STRIPE_PRICE_ID_BASIC',          mode: 'subscription' },
  business:        { priceEnv: 'STRIPE_PRICE_ID_BUSINESS',       mode: 'subscription' },
  advisor:         { priceEnv: 'STRIPE_PRICE_ID_ADVISOR',        mode: 'subscription' },
  ai_pack_small:   { priceEnv: 'STRIPE_PRICE_ID_AI_PACK_SMALL',  mode: 'payment', credits: 50 },
  ai_pack_medium:  { priceEnv: 'STRIPE_PRICE_ID_AI_PACK_MEDIUM', mode: 'payment', credits: 200 },
  ai_pack_large:   { priceEnv: 'STRIPE_PRICE_ID_AI_PACK_LARGE',  mode: 'payment', credits: 500 },
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
    // Støtt både gammelt {planId} og nytt {productId}
    const productId = String(body.productId || body.planId || '').toLowerCase();
    const product = PRODUCTS[productId];
    if (!product) {
      return new Response(JSON.stringify({ error: `Ukjent produkt: ${productId}` }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const priceId = Deno.env.get(product.priceEnv);
    if (!priceId) {
      return new Response(JSON.stringify({ error: `${product.priceEnv} er ikke satt i env-vars` }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const appUrl = requiredEnv('PUBLIC_APP_URL').replace(/\/$/, '');

    // Opprett Stripe Checkout Session (subscription eller payment)
    const params = new URLSearchParams();
    params.set('mode', product.mode);
    params.set('customer_email', user.email || '');
    params.set('client_reference_id', user.id);
    params.set('line_items[0][price]', priceId);
    params.set('line_items[0][quantity]', '1');
    params.set('success_url', `${appUrl}/?checkout=success&product=${productId}`);
    params.set('cancel_url', `${appUrl}/?checkout=cancel`);
    params.set('metadata[user_id]', user.id);
    params.set('metadata[product]', productId);
    if (product.credits) params.set('metadata[credits]', String(product.credits));
    if (product.mode === 'subscription') {
      params.set('subscription_data[metadata][user_id]', user.id);
      params.set('subscription_data[metadata][product]', productId);
    }
    params.set('allow_promotion_codes', 'true');

    const session = await stripeApi('checkout/sessions', params);

    return new Response(JSON.stringify({ url: session.url, id: session.id }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err?.message || 'Unknown error' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
