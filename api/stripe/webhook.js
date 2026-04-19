// Vercel Serverless Function: POST /api/stripe/webhook
// Receives Stripe webhooks and updates Supabase subscription state.

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Vercel: disable body parsing so we get raw body for Stripe signature check
export const config = { api: { bodyParser: false } };

const getRawBody = (req) =>
  new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const rawBody = await getRawBody(req);
  const sig = req.headers['stripe-signature'];

  let event;
  try {
    event = stripe.webhooks.constructEvent(
      rawBody,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error('Webhook signature error:', err.message);
    return res.status(400).json({ error: `Webhook Error: ${err.message}` });
  }

  const obj = event.data.object;

  switch (event.type) {
    case 'checkout.session.completed': {
      const customerId = obj.customer;
      const subscriptionId = obj.subscription;
      const customerEmail = obj.customer_email || obj.customer_details?.email;
      const plan = obj.metadata?.plan || 'monthly';

      const { data: users } = await supabase.auth.admin.listUsers();
      const user = users?.users?.find((u) => u.email === customerEmail);

      if (user) {
        await supabase.from('user_profiles').upsert({
          id: user.id,
          subscription_status: 'active',
          subscription_plan: plan,
          stripe_customer_id: customerId,
          stripe_subscription_id: subscriptionId,
          subscription_expires_at: null,
        });
      }
      break;
    }

    case 'customer.subscription.updated': {
      const customerId = obj.customer;
      const plan = obj.metadata?.plan;
      const status = obj.status === 'active' || obj.status === 'trialing' ? 'active' : 'expired';
      const update = { subscription_status: status };
      if (plan) update.subscription_plan = plan;
      if (obj.cancel_at) update.subscription_expires_at = new Date(obj.cancel_at * 1000).toISOString();
      await supabase
        .from('user_profiles')
        .update(update)
        .eq('stripe_customer_id', customerId);
      break;
    }

    case 'customer.subscription.deleted':
    case 'customer.subscription.paused': {
      const customerId = obj.customer;
      await supabase
        .from('user_profiles')
        .update({
          subscription_status: 'expired',
          subscription_expires_at: new Date().toISOString(),
        })
        .eq('stripe_customer_id', customerId);
      break;
    }

    case 'invoice.payment_failed': {
      const customerId = obj.customer;
      await supabase
        .from('user_profiles')
        .update({ subscription_status: 'expired' })
        .eq('stripe_customer_id', customerId);
      break;
    }
  }

  res.status(200).json({ received: true });
};
