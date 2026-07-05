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

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        const userId = session.metadata?.user_id || session.client_reference_id;
        const plan = session.metadata?.plan;
        if (userId && plan) {
          await setStatus(userId, plan, {
            stripe_customer_id: session.customer,
            stripe_subscription_id: session.subscription,
          });
        }
        break;
      }
      case 'customer.subscription.updated': {
        const sub = event.data.object;
        const userId = sub.metadata?.user_id;
        const plan = sub.metadata?.plan;
        if (userId && plan) {
          const newStatus = sub.cancel_at_period_end ? `${plan}_cancelled` : sub.status === 'active' ? plan : sub.status;
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
