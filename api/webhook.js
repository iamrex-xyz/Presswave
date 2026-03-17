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

  const subject = `🚀 Your Presswave ${pkg === 'growth' ? 'Growth' : 'Launch'} package is live — here's everything you need`;
  
  const html = `
<div style="font-family: Inter, -apple-system, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px; color: #1f2937;">
  <div style="text-align: center; margin-bottom: 40px;">
    <h1 style="font-size: 32px; font-weight: 700; margin: 0; letter-spacing: -0.5px;">Presswave</h1>
    <p style="color: #6b7280; margin-top: 4px; font-size: 14px;">From launch to coverage. Automatically.</p>
  </div>
  
  <p style="font-size: 18px; line-height: 1.6;">Hi ${name || 'there'} 👋</p>
  
  <p style="font-size: 16px; line-height: 1.7;">You just made a smart move. Most founders launch into silence — you won't. Your <strong>${pkg === 'growth' ? 'Growth' : 'Launch'}</strong> package for <strong>${productName}</strong> is now active, and we're already working on getting you noticed.</p>

  <p style="font-size: 16px; line-height: 1.7;">Here's what's happening right now:</p>
  
  <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 28px 0;">

  <h2 style="font-size: 20px; margin-top: 0;">📋 Your Presswave package</h2>
  
  <div style="background: #f0fdf4; border-left: 4px solid #22c55e; padding: 20px; margin: 20px 0; border-radius: 0 8px 8px 0;">
    <p style="margin: 0 0 8px 0; font-weight: 700; font-size: 16px;">✅ 1. Your journalist contacts are ready</p>
    <p style="margin: 0 0 12px 0; color: #374151; font-size: 15px; line-height: 1.6;">We've matched your product against our database of 13,000+ media contacts and compiled a personalized CSV with the journalists most relevant to your space — including their name, outlet, beat, and contact details.</p>
    <p style="margin: 0;"><a href="${csvUrl}" style="display: inline-block; background: #111827; color: white; padding: 12px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 15px;">📥 Download your journalist CSV</a></p>
  </div>
  
  <div style="background: #eff6ff; border-left: 4px solid #3b82f6; padding: 20px; margin: 20px 0; border-radius: 0 8px 8px 0;">
    <p style="margin: 0 0 8px 0; font-weight: 700; font-size: 16px;">⏳ 2. Directory submissions — in progress</p>
    <p style="margin: 0; color: #374151; font-size: 15px; line-height: 1.6;">Our team is now manually submitting your product to <strong>300+ startup directories</strong> — from Product Hunt and BetaList to niche-specific listings in your category. You'll receive a tracking sheet once the first batch is live so you can see exactly where you've been listed.</p>
  </div>

  <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 28px 0;">

  <h2 style="font-size: 20px;">💡 Tips to maximize your coverage</h2>
  
  <div style="margin: 16px 0;">
    <p style="font-size: 15px; line-height: 1.7; margin: 0 0 16px 0;"><strong>🎯 Personalize your outreach.</strong> Don't blast the same email to every journalist. Open the CSV, pick 10-15 who cover your exact niche, and write a short, personal email to each. Mention a recent article they wrote. Journalists ignore templates — they respond to people who did their homework.</p>
    
    <p style="font-size: 15px; line-height: 1.7; margin: 0 0 16px 0;"><strong>⏰ Timing matters.</strong> The best days to pitch are Tuesday through Thursday, early morning (8-10 AM in the journalist's timezone). Avoid Mondays (inbox overload) and Fridays (weekend mode).</p>
    
    <p style="font-size: 15px; line-height: 1.7; margin: 0 0 16px 0;"><strong>📝 Keep it short.</strong> Your pitch email should be 3-5 sentences max. Lead with what makes your product different, not what it does. "We reduced X by 80%" beats "We built a platform that..." every time.</p>
    
    <p style="font-size: 15px; line-height: 1.7; margin: 0 0 16px 0;"><strong>🔄 Follow up once.</strong> If you don't hear back in 5-7 days, send exactly one follow-up. Keep it to 2 sentences. After that, move on — there are hundreds more contacts in your CSV.</p>
    
    <p style="font-size: 15px; line-height: 1.7; margin: 0;"><strong>📊 Track everything.</strong> Note which journalists open, reply, or publish. This data is gold for your next campaign — you'll know exactly who covers products like yours.</p>
  </div>

  <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 28px 0;">

  <h2 style="font-size: 20px;">🗓 What to expect</h2>
  
  <table style="width: 100%; font-size: 14px; border-collapse: collapse; margin: 16px 0;">
    <tr style="border-bottom: 1px solid #e5e7eb;">
      <td style="padding: 10px 0; font-weight: 600; width: 40%;">Today</td>
      <td style="padding: 10px 0; color: #374151;">CSV delivered ✅ — start your outreach</td>
    </tr>
    <tr style="border-bottom: 1px solid #e5e7eb;">
      <td style="padding: 10px 0; font-weight: 600;">Days 1-3</td>
      <td style="padding: 10px 0; color: #374151;">First directory submissions go live</td>
    </tr>
    <tr style="border-bottom: 1px solid #e5e7eb;">
      <td style="padding: 10px 0; font-weight: 600;">Day 7</td>
      <td style="padding: 10px 0; color: #374151;">Full tracking sheet with all submission statuses</td>
    </tr>
    <tr>
      <td style="padding: 10px 0; font-weight: 600;">Days 7-14</td>
      <td style="padding: 10px 0; color: #374151;">Directory listings start appearing in search results 📈</td>
    </tr>
  </table>

  <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 28px 0;">

  <div style="background: #fefce8; border: 1px solid #fde68a; padding: 20px; border-radius: 8px; margin: 20px 0;">
    <p style="margin: 0; font-size: 15px; line-height: 1.6;"><strong>Need help with your pitch?</strong> Just reply to this email with your product URL and a one-liner, and we'll give you feedback on your angle. Seriously — we want you to get covered.</p>
  </div>

  <p style="font-size: 16px; line-height: 1.7; margin-top: 24px;">Let's get you the coverage you deserve. 🚀</p>
  
  <p style="font-size: 16px; line-height: 1.6; font-weight: 600;">— The Presswave Team</p>
  
  <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 32px 0 16px 0;">
  <p style="font-size: 12px; color: #9ca3af; text-align: center;">Presswave · <a href="https://presswave.xyz" style="color: #6b7280;">presswave.xyz</a> · From launch to coverage.</p>
  <p style="font-size: 12px; color: #9ca3af; text-align: center;">Follow us on <a href="https://x.com/iamrex_xyz" style="color: #6b7280;">X @iamrex_xyz</a> for founder tips and PR insights.</p>
</div>`;

  const text = `Hi ${name || 'there'} 👋

You just made a smart move. Most founders launch into silence — you won't. Your ${pkg === 'growth' ? 'Growth' : 'Launch'} package for ${productName} is now active.

━━━━━━━━━━━━━━━━━━━━

📋 YOUR PRESSWAVE PACKAGE

✅ 1. Your journalist contacts are ready
We matched your product against 13,000+ media contacts. Download your personalized CSV:
${csvUrl}

⏳ 2. Directory submissions — in progress
Our team is submitting your product to 300+ startup directories. You'll get a tracking sheet once the first batch is live.

━━━━━━━━━━━━━━━━━━━━

💡 TIPS TO MAXIMIZE YOUR COVERAGE

🎯 Personalize your outreach — Pick 10-15 journalists from the CSV who cover your exact niche. Mention a recent article they wrote. Journalists ignore templates.

⏰ Timing matters — Pitch Tuesday-Thursday, 8-10 AM in their timezone. Avoid Mondays and Fridays.

📝 Keep it short — 3-5 sentences max. Lead with what makes you different, not what you do. "We reduced X by 80%" beats "We built a platform that..."

🔄 Follow up once — No reply in 5-7 days? Send one 2-sentence follow-up. Then move on.

📊 Track everything — Note who opens, replies, or publishes. Gold for your next campaign.

━━━━━━━━━━━━━━━━━━━━

🗓 WHAT TO EXPECT

Today → CSV delivered ✅ Start your outreach
Days 1-3 → First directory submissions go live
Day 7 → Full tracking sheet with all statuses
Days 7-14 → Listings appear in search results 📈

━━━━━━━━━━━━━━━━━━━━

Need help with your pitch? Reply to this email with your URL and one-liner — we'll give you feedback on your angle.

Let's get you covered. 🚀

— The Presswave Team
presswave.xyz | @iamrex_xyz on X`;

  const inboxId = encodeURIComponent(fromAddr);
  const r = await fetch(`https://api.agentmail.to/v0/inboxes/${inboxId}/messages/send`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      to: email,
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
