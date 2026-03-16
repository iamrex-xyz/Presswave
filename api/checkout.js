// Presswave Checkout API — Creates Stripe Checkout Session with product metadata
// POST { package: "launch"|"growth", email, name, productName, productUrl, productDescription, category }

import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const PRICES = {
  launch: process.env.STRIPE_PRICE_LAUNCH,
  growth: process.env.STRIPE_PRICE_GROWTH,
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { package: pkg, email, name, productName, productUrl, productDescription, category } = req.body || {};

    if (!pkg || !PRICES[pkg]) return res.status(400).json({ error: 'Invalid package. Use "launch" or "growth".' });
    if (!email) return res.status(400).json({ error: 'Email required' });
    if (!productName) return res.status(400).json({ error: 'Product name required' });

    const mode = pkg === 'growth' ? 'subscription' : 'payment';

    const session = await stripe.checkout.sessions.create({
      mode,
      payment_method_types: ['card'],
      customer_email: email,
      line_items: [{ price: PRICES[pkg], quantity: 1 }],
      metadata: {
        package: pkg,
        customer_name: (name || '').slice(0, 500),
        product_name: (productName || '').slice(0, 500),
        product_url: (productUrl || '').slice(0, 500),
        product_description: (productDescription || '').slice(0, 500),
        product_category: (category || '').slice(0, 500),
      },
      success_url: 'https://presswave.xyz/success?session_id={CHECKOUT_SESSION_ID}',
      cancel_url: 'https://presswave.xyz/?cancelled=true',
    });

    return res.status(200).json({ url: session.url, sessionId: session.id });
  } catch (e) {
    console.error('Checkout error:', e);
    return res.status(500).json({ error: 'Failed to create checkout session', detail: e.message });
  }
}
