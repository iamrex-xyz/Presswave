// Presswave Stripe Webhook — handles checkout.session.completed
// 1. Stores order in Supabase
// 2. Generates CSV download token
// 3. Sends confirmation email via AgentMail

import crypto from 'crypto';

const SUPABASE_URL = 'https://vfjsyyextdvrvtirdpbh.supabase.co';
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;

// Stripe signature verification
function verifyStripeSignature(payload, sig, secret) {
  const elements = sig.split(',');
  const ts = elements.find(e => e.startsWith('t='))?.split('=')[1];
  const v1 = elements.find(e => e.startsWith('v1='))?.split('=')[1];
  if (!ts || !v1) return false;

  const signedPayload = `${ts}.${payload}`;
  const expected = crypto.createHmac('sha256', secret).update(signedPayload).digest('hex');
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(v1));
}

// Query matched journalists from Supabase
async function queryMatchedContacts(category, description, serviceKey) {
  const CATEGORY_TOPICS = {
    'ai-ml': ['artificial intelligence', 'machine learning', 'AI', 'deep learning', 'GPT', 'LLM', 'automation'],
    'saas': ['SaaS', 'B2B', 'enterprise', 'cloud', 'software', 'subscription', 'business tools'],
    'developer-tools': ['developer', 'API', 'open source', 'DevOps', 'coding', 'programming'],
    'productivity': ['productivity', 'task management', 'collaboration', 'remote work'],
    'marketing': ['marketing', 'SEO', 'content', 'social media', 'email marketing'],
    'fintech': ['fintech', 'finance', 'payments', 'banking', 'crypto', 'blockchain'],
    'health': ['health', 'wellness', 'fitness', 'medical', 'healthcare'],
    'ecommerce': ['ecommerce', 'retail', 'shopping', 'marketplace', 'Shopify'],
    'education': ['education', 'edtech', 'learning', 'courses'],
    'social': ['social', 'community', 'networking', 'messaging', 'creator'],
    'other': ['startup', 'technology', 'innovation', 'business'],
  };

  const topics = CATEGORY_TOPICS[category] || CATEGORY_TOPICS['other'];
  // Extract keywords from description
  const words = (description || '').toLowerCase().split(/\W+/).filter(w => w.length > 3);
  const allTopics = [...new Set([...topics, ...words])].slice(0, 15);

  // Query journalists with topic overlap
  const topicFilter = allTopics.map(t => `topics.cs.{${t}}`).join(',');
  const url = `${SUPABASE_URL}/rest/v1/media_contacts?type=eq.journalist&or=(${topicFilter})&select=name,outlet,role,email,twitter,linkedin,website,topics,audience_size,country,description&limit=500`;

  const r = await fetch(url, {
    headers: {
      'apikey': serviceKey,
      'Authorization': `Bearer ${serviceKey}`,
    }
  });
  
  if (!r.ok) {
    // Fallback: get all journalists
    const fallback = await fetch(`${SUPABASE_URL}/rest/v1/media_contacts?type=eq.journalist&select=name,outlet,role,email,twitter,linkedin,website,topics,audience_size,country,description&limit=500`, {
      headers: { 'apikey': serviceKey, 'Authorization': `Bearer ${serviceKey}` }
    });
    return fallback.ok ? await fallback.json() : [];
  }
  
  const matched = await r.json();
  
  if (matched.length < 50) {
    // Supplement with general journalists
    const supplement = await fetch(`${SUPABASE_URL}/rest/v1/media_contacts?type=eq.journalist&select=name,outlet,role,email,twitter,linkedin,website,topics,audience_size,country,description&limit=${500 - matched.length}&order=audience_size.desc.nullslast`, {
      headers: { 'apikey': serviceKey, 'Authorization': `Bearer ${serviceKey}` }
    });
    if (supplement.ok) {
      const extra = await supplement.json();
      const existingIds = new Set(matched.map(c => c.email || c.name));
      for (const c of extra) {
        if (!existingIds.has(c.email || c.name)) matched.push(c);
      }
    }
  }
  
  return matched;
}

// Send confirmation email via AgentMail
async function sendConfirmationEmail({ email, name, productName, csvUrl, package: pkg }) {
  const apiKey = process.env.AGENTMAIL_API_KEY;
  const fromAddr = process.env.AGENTMAIL_INBOX || 'presswave@agentmail.to';

  const subject = `🚀 Your Presswave ${pkg === 'growth' ? 'Growth' : 'Launch'} package is live!`;
  
  const html = `
<div style="font-family: Inter, -apple-system, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px;">
  <div style="text-align: center; margin-bottom: 32px;">
    <h1 style="font-size: 28px; font-weight: 700; margin: 0;">Presswave</h1>
    <p style="color: #6b7280; margin-top: 4px;">From launch to coverage. Automatically.</p>
  </div>
  
  <p style="font-size: 16px; line-height: 1.6;">Hi ${name || 'there'},</p>
  
  <p style="font-size: 16px; line-height: 1.6;">Thank you for choosing Presswave for <strong>${productName}</strong>! Your ${pkg === 'growth' ? 'Growth' : 'Launch'} package is now active.</p>
  
  <h2 style="font-size: 20px; margin-top: 32px;">📋 What happens next</h2>
  
  <div style="background: #f0fdf4; border-left: 4px solid #22c55e; padding: 16px; margin: 16px 0; border-radius: 0 8px 8px 0;">
    <p style="margin: 0 0 8px 0; font-weight: 600;">1. Your journalist contacts are ready</p>
    <p style="margin: 0; color: #374151;">Download your personalized CSV with matched journalists, their outlets, and contact details:</p>
    <p style="margin: 12px 0 0 0;"><a href="${csvUrl}" style="display: inline-block; background: #111827; color: white; padding: 10px 24px; border-radius: 8px; text-decoration: none; font-weight: 500;">📥 Download journalist CSV</a></p>
  </div>
  
  <div style="background: #eff6ff; border-left: 4px solid #3b82f6; padding: 16px; margin: 16px 0; border-radius: 0 8px 8px 0;">
    <p style="margin: 0 0 8px 0; font-weight: 600;">2. Directory submissions — in progress</p>
    <p style="margin: 0; color: #374151;">Our PR agents are now processing your submissions to 300+ startup directories. You'll receive a tracking link once the first batch of submissions is complete.</p>
  </div>
  
  <p style="font-size: 16px; line-height: 1.6; margin-top: 24px;">Questions? Just reply to this email — we read every message.</p>
  
  <p style="font-size: 16px; line-height: 1.6;">Let's get you covered. 🚀</p>
  
  <p style="font-size: 16px; line-height: 1.6; font-weight: 500;">— The Presswave Team</p>
  
  <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 32px 0 16px 0;">
  <p style="font-size: 12px; color: #9ca3af; text-align: center;">Presswave · presswave.xyz · From launch to coverage.</p>
</div>`;

  const text = `Hi ${name || 'there'},

Thank you for choosing Presswave for ${productName}! Your ${pkg === 'growth' ? 'Growth' : 'Launch'} package is now active.

WHAT HAPPENS NEXT:

1. Your journalist contacts are ready
Download your personalized CSV: ${csvUrl}

2. Directory submissions — in progress
Our PR agents are now processing your submissions to 300+ startup directories. You'll receive a tracking link once the first batch is complete.

Questions? Just reply to this email.

— The Presswave Team`;

  const r = await fetch('https://api.agentmail.to/v0/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      to: [{ address: email, name: name || undefined }],
      from: { address: fromAddr, name: 'Presswave' },
      subject,
      html,
      text,
    }),
  });

  const result = await r.json();
  if (!r.ok) console.error('AgentMail error:', result);
  return { ok: r.ok, result };
}

// Store order in Supabase
async function storeOrder(order, serviceKey) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/presswave_orders`, {
    method: 'POST',
    headers: {
      'apikey': serviceKey,
      'Authorization': `Bearer ${serviceKey}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation',
    },
    body: JSON.stringify(order),
  });
  return r.ok ? await r.json() : null;
}

async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  // Read raw body for signature verification
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const rawBody = Buffer.concat(chunks).toString('utf8');
  
  // Verify Stripe signature
  const sig = req.headers['stripe-signature'];
  if (!sig || !STRIPE_WEBHOOK_SECRET) {
    console.error('Missing signature or webhook secret');
    return res.status(400).json({ error: 'Missing signature' });
  }

  if (!verifyStripeSignature(rawBody, sig, STRIPE_WEBHOOK_SECRET)) {
    console.error('Invalid Stripe signature');
    return res.status(400).json({ error: 'Invalid signature' });
  }

  const event = JSON.parse(rawBody);

  if (event.type !== 'checkout.session.completed') {
    // Acknowledge other events silently
    return res.status(200).json({ received: true });
  }

  const session = event.data.object;
  const meta = session.metadata || {};
  const customerEmail = session.customer_email || session.customer_details?.email;

  if (!customerEmail) {
    console.error('No customer email in session:', session.id);
    return res.status(200).json({ received: true, warning: 'no email' });
  }

  try {
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_JWT;
    const csvToken = crypto.randomBytes(24).toString('hex');

    // 1. Store order
    await storeOrder({
      stripe_session_id: session.id,
      customer_email: customerEmail,
      customer_name: meta.customer_name || null,
      product_name: meta.product_name || null,
      product_url: meta.product_url || null,
      product_description: meta.product_description || null,
      product_category: meta.product_category || null,
      package: meta.package || 'launch',
      amount_cents: session.amount_total || null,
      currency: session.currency || 'usd',
      status: 'paid',
      csv_token: csvToken,
    }, serviceKey);

    // 2. Send confirmation email with CSV download link
    const csvUrl = `https://presswave.xyz/api/download?token=${csvToken}`;
    
    await sendConfirmationEmail({
      email: customerEmail,
      name: meta.customer_name,
      productName: meta.product_name || 'your product',
      csvUrl,
      package: meta.package || 'launch',
    });

    console.log(`Order processed: ${session.id} → ${customerEmail} (${meta.package})`);
    return res.status(200).json({ received: true, orderId: session.id });
  } catch (e) {
    console.error('Webhook processing error:', e);
    // Still return 200 to prevent Stripe retries for processing errors
    return res.status(200).json({ received: true, error: e.message });
  }
}

export default handler;
export const config = { api: { bodyParser: false } };
