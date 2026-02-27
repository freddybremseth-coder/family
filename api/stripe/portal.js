// Vercel Serverless Function: POST /api/stripe/portal
// Åpner Stripe Customer Portal for å administrere abonnement

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY // Bruk service role for server-side
);

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { userId } = req.body;

  try {
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('stripe_customer_id')
      .eq('id', userId)
      .single();

    if (!profile?.stripe_customer_id) {
      return res.status(400).json({ error: 'Ingen Stripe-kunde funnet' });
    }

    const portalSession = await stripe.billingPortal.sessions.create({
      customer: profile.stripe_customer_id,
      return_url: `${process.env.NEXT_PUBLIC_APP_URL || req.headers.origin}/`,
    });

    res.status(200).json({ url: portalSession.url });
  } catch (err) {
    console.error('Stripe portal error:', err);
    res.status(500).json({ error: err.message });
  }
};
