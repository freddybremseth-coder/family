// Stripe webhook — oppdaterer user_profiles.subscription_status ved subscription-events.
//
// Kreves env-vars:
//   STRIPE_SECRET_KEY (sk_… — for å hente subscription-detaljer)
//   STRIPE_WEBHOOK_SECRET (whsec_… — for signatur-verifisering)
//
// Konfigurer Stripe webhook til å peke på:
//   https://<project-ref>.supabase.co/functions/v1/stripe-webhook
// Events å lytte til:
//   checkout.session.completed
//   customer.subscription.updated
//   customer.subscription.deleted

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.7';

function requiredEnv(name: string) {
  const v = Deno.env.get(name);
  if (!v) throw new Error(`${name} is required`);
  return v;
}

async function verifySignature(payload: string, signature: string, secret: string): Promise<boolean> {
  // Stripe format: t=<timestamp>,v1=<hash>
  const parts = signature.split(',');
  const t = parts.find(p => p.startsWith('t='))?.slice(2);
  const v1 = parts.find(p => p.startsWith('v1='))?.slice(3);
  if (!t || !v1) return false;

  const signedPayload = `${t}.${payload}`;
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(signedPayload));
  const computed = Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('');
  return computed === v1;
}

serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  try {
    const signature = req.headers.get('stripe-signature') || '';
    const webhookSecret = requiredEnv('STRIPE_WEBHOOK_SECRET');
    const payload = await req.text();

    if (!(await verifySignature(payload, signature, webhookSecret))) {
      return new Response(JSON.stringify({ error: 'Invalid signature' }), { status: 401 });
    }

    const event = JSON.parse(payload);
    const supabaseUrl = requiredEnv('SUPABASE_URL');
    const serviceRole = requiredEnv('SUPABASE_SERVICE_ROLE_KEY');
    const admin = createClient(supabaseUrl, serviceRole);

    const setStatus = async (userId: string, status: string, extras: Record<string, any> = {}) => {
      const { error } = await admin
        .from('user_profiles')
        .update({ subscription_status: status, ...extras, updated_at: new Date().toISOString() })
        .eq('id', userId);
      if (error) console.error('[stripe-webhook] user_profiles update failed', error);
    };

    const addCredits = async (userId: string, credits: number, packId: string, session: any) => {
      // Legg til credits i ai_credit_balance (upsert)
      const { data: existing } = await admin
        .from('ai_credit_balance')
        .select('credits')
        .eq('user_id', userId)
        .maybeSingle();
      const newBalance = (existing?.credits ?? 0) + credits;
      await admin.from('ai_credit_balance').upsert({
        user_id: userId, credits: newBalance, updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' });
      await admin.from('ai_credit_purchases').insert({
        user_id: userId, pack_id: packId, credits,
        price_paid_cents: session.amount_total || 0,
        currency: (session.currency || 'eur').toUpperCase(),
        stripe_session_id: session.id,
        stripe_payment_intent: session.payment_intent,
      });
    };

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        const userId = session.metadata?.user_id || session.client_reference_id;
        const product = session.metadata?.product || session.metadata?.plan; // legacy
        if (!userId || !product) break;

        if (product === 'basic' || product === 'business' || product === 'advisor') {
          await setStatus(userId, product, {
            stripe_customer_id: session.customer,
            stripe_subscription_id: session.subscription,
          });
        } else if (product.startsWith('ai_pack_')) {
          // Engangskjøp av AI-pakke
          const credits = Number(session.metadata?.credits || 0);
          if (credits > 0) await addCredits(userId, credits, product, session);
        }
        break;
      }
      case 'customer.subscription.updated': {
        const sub = event.data.object;
        const userId = sub.metadata?.user_id;
        if (!userId) break;
        const product = sub.metadata?.product || sub.metadata?.plan;
        if (product === 'basic' || product === 'business' || product === 'advisor') {
          const newStatus = sub.cancel_at_period_end ? `${product}_cancelled` : sub.status === 'active' ? product : sub.status;
          await setStatus(userId, newStatus);
        }
        break;
      }
      case 'customer.subscription.deleted': {
        const sub = event.data.object;
        const userId = sub.metadata?.user_id;
        if (userId) await setStatus(userId, 'free');
        break;
      }
      default:
        break;
    }

    return new Response(JSON.stringify({ received: true }), { headers: { 'Content-Type': 'application/json' } });
  } catch (err: any) {
    console.error('[stripe-webhook]', err);
    return new Response(JSON.stringify({ error: err?.message || 'Unknown error' }), { status: 500 });
  }
});
