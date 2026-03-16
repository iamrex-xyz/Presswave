// Presswave CSV Download — serves journalist CSV for paid customers
// GET /api/download?token=<csv_token>

const SUPABASE_URL = 'https://vfjsyyextdvrvtirdpbh.supabase.co';

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

function escapeCsv(val) {
  if (val == null) return '';
  const s = String(val);
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'GET only' });

  const token = req.query.token;
  if (!token || token.length < 20) {
    return res.status(400).json({ error: 'Invalid or missing token' });
  }

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_JWT;

  // 1. Look up order by token
  const orderRes = await fetch(
    `${SUPABASE_URL}/rest/v1/presswave_orders?csv_token=eq.${encodeURIComponent(token)}&limit=1`,
    { headers: { 'apikey': serviceKey, 'Authorization': `Bearer ${serviceKey}` } }
  );
  
  if (!orderRes.ok) return res.status(500).json({ error: 'Database error' });
  const orders = await orderRes.json();
  
  if (!orders.length) {
    return res.status(404).json({ error: 'Download link not found or expired' });
  }

  const order = orders[0];
  const category = order.product_category || 'other';
  const description = order.product_description || '';

  // 2. Build topic list from category + description
  const catTopics = CATEGORY_TOPICS[category] || CATEGORY_TOPICS['other'];
  const descWords = description.toLowerCase().split(/\W+/).filter(w => w.length > 3);
  const allTopics = [...new Set([...catTopics, ...descWords])].slice(0, 15);

  // 3. Query journalists — topic-matched first, then supplement
  let contacts = [];
  
  // Try topic-matched query
  const topicStr = allTopics.join(',');
  const matchUrl = `${SUPABASE_URL}/rest/v1/media_contacts?type=eq.journalist&topics=ov.{${encodeURIComponent(topicStr)}}&select=name,outlet,role,email,twitter,linkedin,website,topics,audience_size,country,description&order=audience_size.desc.nullslast&limit=500`;
  
  const matchRes = await fetch(matchUrl, {
    headers: { 'apikey': serviceKey, 'Authorization': `Bearer ${serviceKey}` }
  });
  
  if (matchRes.ok) contacts = await matchRes.json();
  
  // Supplement if <100 matched
  if (contacts.length < 100) {
    const suppUrl = `${SUPABASE_URL}/rest/v1/media_contacts?type=eq.journalist&select=name,outlet,role,email,twitter,linkedin,website,topics,audience_size,country,description&order=audience_size.desc.nullslast&limit=${500 - contacts.length}`;
    const suppRes = await fetch(suppUrl, {
      headers: { 'apikey': serviceKey, 'Authorization': `Bearer ${serviceKey}` }
    });
    if (suppRes.ok) {
      const extra = await suppRes.json();
      const seen = new Set(contacts.map(c => c.name + (c.outlet || '')));
      for (const c of extra) {
        if (!seen.has(c.name + (c.outlet || ''))) contacts.push(c);
      }
    }
  }

  // 4. Generate CSV
  const headers = ['Name', 'Outlet', 'Role', 'Email', 'Twitter', 'LinkedIn', 'Website', 'Topics', 'Audience Size', 'Country', 'Description'];
  const rows = contacts.map(c => [
    escapeCsv(c.name),
    escapeCsv(c.outlet),
    escapeCsv(c.role),
    escapeCsv(c.email),
    escapeCsv(c.twitter),
    escapeCsv(c.linkedin),
    escapeCsv(c.website),
    escapeCsv(Array.isArray(c.topics) ? c.topics.join('; ') : c.topics),
    escapeCsv(c.audience_size),
    escapeCsv(c.country),
    escapeCsv(c.description),
  ].join(','));

  const csv = [headers.join(','), ...rows].join('\n');
  const productSlug = (order.product_name || 'presswave').toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 30);

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="presswave-journalists-${productSlug}.csv"`);
  return res.status(200).send(csv);
}
