// Vercel Serverless Function: POST /api/stripe/webhook
// Mottar Stripe-webhooks og oppdaterer Supabase subscription-status

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Vercel: slå av body-parsing så vi får raw body for Stripe-signatursjekk
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
    console.error('Webhook signatur feil:', err.message);
    return res.status(400).json({ error: `Webhook Error: ${err.message}` });
  }

  const session = event.data.object;

  switch (event.type) {
    case 'checkout.session.completed': {
      const customerId = session.customer;
      const subscriptionId = session.subscription;
      const customerEmail = session.customer_email || session.customer_details?.email;

      // Finn bruker via e-post i Supabase auth
      const { data: users } = await supabase.auth.admin.listUsers();
      const user = users?.users?.find(u => u.email === customerEmail);

      if (user) {
        await supabase.from('user_profiles').upsert({
          id: user.id,
          subscription_status: 'active',
          stripe_customer_id: customerId,
          stripe_subscription_id: subscriptionId,
          subscription_expires_at: null,
        });
      }
      break;
    }

    case 'customer.subscription.deleted':
    case 'customer.subscription.paused': {
      const customerId = session.customer;
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
      const customerId = session.customer;
      await supabase
        .from('user_profiles')
        .update({ subscription_status: 'expired' })
        .eq('stripe_customer_id', customerId);
      break;
    }
  }

  res.status(200).json({ received: true });
};
