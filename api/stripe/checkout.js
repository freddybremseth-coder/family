// Vercel Serverless Function: POST /api/stripe/checkout
// Creates a Stripe Checkout session for FamilieHub Pro
// Plans:
//   - monthly: 6 EUR/month  (env: STRIPE_PRICE_ID_MONTHLY)
//   - annual:  57.60 EUR/year = 6 * 12 * 0.8 (20% off) (env: STRIPE_PRICE_ID_ANNUAL)

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const resolvePriceId = (plan) => {
  if (plan === 'annual') {
    return process.env.STRIPE_PRICE_ID_ANNUAL || process.env.STRIPE_PRICE_ID;
  }
  return process.env.STRIPE_PRICE_ID_MONTHLY || process.env.STRIPE_PRICE_ID;
};

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email, plan } = req.body || {};
  const selectedPlan = plan === 'annual' ? 'annual' : 'monthly';
  const priceId = resolvePriceId(selectedPlan);

  if (!priceId) {
    return res.status(500).json({
      error: `Missing Stripe price ID for plan "${selectedPlan}". Set STRIPE_PRICE_ID_${selectedPlan.toUpperCase()} in env.`,
    });
  }

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      customer_email: email,
      allow_promotion_codes: true,
      line_items: [{ price: priceId, quantity: 1 }],
      subscription_data: {
        metadata: { plan: selectedPlan, app: 'familiehub' },
      },
      metadata: { plan: selectedPlan, email: email || '' },
      success_url: `${process.env.NEXT_PUBLIC_APP_URL || req.headers.origin}/?payment=success&plan=${selectedPlan}`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL || req.headers.origin}/?payment=cancelled`,
    });

    res.status(200).json({ url: session.url });
  } catch (err) {
    console.error('Stripe checkout error:', err);
    res.status(500).json({ error: err.message });
  }
};
