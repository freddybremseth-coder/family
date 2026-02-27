// Vercel Serverless Function: POST /api/stripe/checkout
// Oppretter en Stripe Checkout session for 20 NOK/mnd abonnement

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email } = req.body;

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      customer_email: email,
      line_items: [
        {
          price: process.env.STRIPE_PRICE_ID, // Sett i Vercel: 20 NOK/mnd pris-ID fra Stripe
          quantity: 1,
        },
      ],
      success_url: `${process.env.NEXT_PUBLIC_APP_URL || req.headers.origin}/?payment=success`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL || req.headers.origin}/?payment=cancelled`,
    });

    res.status(200).json({ url: session.url });
  } catch (err) {
    console.error('Stripe checkout error:', err);
    res.status(500).json({ error: err.message });
  }
};
