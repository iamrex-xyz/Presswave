// Presswave Analyze API — Vercel Serverless Function
// Analyzes startup URL + description, returns matched contacts from Supabase
// DO NOT change SUPABASE_ANON_KEY — it starts with sb_publishable_, NOT a JWT

const SUPABASE_URL = 'https://vfjsyyextdvrvtirdpbh.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_-Ko6Dknctb-MzN6ekceoWg_kUSJ6Hl5';

const CATEGORY_TOPICS = {
  'ai-ml': ['artificial intelligence', 'machine learning', 'AI', 'deep learning', 'GPT', 'LLM', 'automation', 'chatbot', 'NLP', 'computer vision', 'data science'],
  'saas': ['SaaS', 'B2B', 'enterprise', 'cloud', 'software', 'subscription', 'business tools', 'workflow', 'CRM', 'project management', 'productivity'],
  'developer-tools': ['developer', 'API', 'open source', 'DevOps', 'coding', 'programming', 'infrastructure', 'SDK', 'CLI', 'GitHub', 'software engineering'],
  'productivity': ['productivity', 'task management', 'collaboration', 'remote work', 'calendar', 'notes', 'automation', 'workflow', 'time tracking', 'project management'],
  'marketing': ['marketing', 'SEO', 'content', 'social media', 'email marketing', 'analytics', 'growth', 'advertising', 'copywriting', 'brand', 'digital marketing'],
  'fintech': ['fintech', 'finance', 'payments', 'banking', 'crypto', 'blockchain', 'investing', 'trading', 'insurance', 'lending', 'financial technology'],
  'health': ['health', 'wellness', 'fitness', 'medical', 'healthcare', 'mental health', 'telemedicine', 'wearable', 'nutrition', 'biotech'],
  'ecommerce': ['ecommerce', 'e-commerce', 'retail', 'shopping', 'marketplace', 'Shopify', 'DTC', 'inventory', 'supply chain', 'dropshipping'],
  'education': ['education', 'edtech', 'learning', 'courses', 'teaching', 'tutoring', 'students', 'university', 'training', 'certification'],
  'social': ['social', 'community', 'networking', 'messaging', 'social media', 'creator', 'influencer', 'engagement', 'forum', 'content creation'],
  'other': ['startup', 'technology', 'innovation', 'business', 'product'],
};

// Extract meaningful keywords from text
function extractKeywords(text) {
  if (!text) return [];
  const stopWords = new Set([
    'the','a','an','is','are','was','were','be','been','being','have','has','had',
    'do','does','did','will','would','could','should','may','might','shall','can',
    'need','to','of','in','for','on','with','at','by','from','as','into','through',
    'during','before','after','above','below','between','out','off','over','under',
    'again','further','then','once','here','there','when','where','why','how','all',
    'both','each','few','more','most','other','some','such','no','nor','not','only',
    'own','same','so','than','too','very','just','because','but','and','or','if',
    'while','about','up','it','its','this','that','these','those','i','me','my',
    'we','our','you','your','he','she','they','them','what','which','who','whom',
    'also','like','new','way','get','use','using','used','help','helps','make',
    'makes','one','two','best','top','free','first','find','take','give','know',
    'want','see','look','come','think','back','now','well','also','even','way',
    'many','work','works','working','built','build','building','turn','turns',
    'every','into','app','tool','platform','product','service','solution','system',
  ]);
  
  const words = text.toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2 && !stopWords.has(w));
  
  const freq = {};
  words.forEach(w => { freq[w] = (freq[w] || 0) + 1; });
  
  return Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(([word]) => word);
}

// Fetch and parse URL metadata
async function fetchUrlMeta(url) {
  if (!url || !url.match(/^https?:\/\/[a-zA-Z0-9]/)) return null;
  try {
    // Block internal/private IPs (SSRF protection)
    const urlObj = new URL(url);
    const host = urlObj.hostname;
    if (host === 'localhost' || host === '127.0.0.1' || host.startsWith('10.') ||
        host.startsWith('192.168.') || host.startsWith('172.') || host === '169.254.169.254' ||
        host.endsWith('.internal') || host.endsWith('.local')) return null;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Presswave/1.0 (https://presswave.xyz)' },
      redirect: 'follow',
    });
    clearTimeout(timeout);
    if (!res.ok) return null;
    
    const html = await res.text();
    const get = (pattern) => { const m = html.match(pattern); return m ? m[1].trim() : null; };
    
    const title = get(/<title[^>]*>([^<]+)<\/title>/i);
    const desc = get(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i)
              || get(/<meta[^>]*content=["']([^"']+)["'][^>]*name=["']description["']/i)
              || get(/<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']+)["']/i);
    const kwRaw = get(/<meta[^>]*name=["']keywords["'][^>]*content=["']([^"']+)["']/i);
    const h1 = get(/<h1[^>]*>([^<]+)<\/h1>/i);
    const ogTitle = get(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i);
    
    return {
      title: title || ogTitle || null,
      description: desc || null,
      keywords: kwRaw ? kwRaw.split(',').map(k => k.trim().toLowerCase()).filter(k => k.length > 1) : [],
      h1: h1 || null,
    };
  } catch (e) {
    return null;
  }
}

// Query Supabase for contacts matching topics
async function queryByTopics(topics, type, limit) {
  if (!topics.length) return [];
  // URL-encode the overlap filter: topics=ov.{topic1,topic2,...}
  const topicStr = topics.slice(0, 10).join(',');
  const url = `${SUPABASE_URL}/rest/v1/media_contacts?type=eq.${type}&topics=ov.{${encodeURIComponent(topicStr)}}&select=name,outlet,description,audience_size,website,topics&order=audience_size.desc.nullslast&limit=${limit}`;
  
  try {
    const res = await fetch(url, {
      headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` }
    });
    if (res.ok) {
      const data = await res.json();
      // Score by number of matching topics
      return data.map(c => {
        const cTopics = (c.topics || []).map(t => t.toLowerCase());
        const matchCount = topics.filter(t => cTopics.includes(t.toLowerCase())).length;
        return { ...c, relevanceScore: matchCount };
      }).sort((a, b) => (b.relevanceScore - a.relevanceScore) || ((b.audience_size || 0) - (a.audience_size || 0)));
    }
  } catch (e) {}
  return [];
}

// Fallback: top contacts by audience (no topic filter)
async function queryTop(type, limit) {
  const url = `${SUPABASE_URL}/rest/v1/media_contacts?type=eq.${type}&select=name,outlet,description,audience_size,website&order=audience_size.desc.nullslast&limit=${limit}`;
  try {
    const res = await fetch(url, {
      headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` }
    });
    if (res.ok) return await res.json();
  } catch (e) {}
  return [];
}

// Count total contacts of a type
async function countType(type) {
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/media_contacts?type=eq.${type}&select=id`,
      {
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          'Prefer': 'count=exact',
          'Range': '0-0'
        }
      }
    );
    const range = res.headers.get('content-range');
    if (range) return parseInt(range.split('/')[1]) || 0;
  } catch (e) {}
  return 0;
}

function dedup(primary, fallback, limit) {
  const seen = new Set(primary.map(c => c.name));
  const combined = [...primary];
  for (const c of fallback) {
    if (!seen.has(c.name)) {
      combined.push(c);
      seen.add(c.name);
    }
    if (combined.length >= limit) break;
  }
  return combined.slice(0, limit);
}

export default async function handler(req, res) {
  const origin = req.headers.origin || '';
  const allowed = ['https://presswave.xyz', 'https://www.presswave.xyz'];
  if (allowed.includes(origin)) res.setHeader('Access-Control-Allow-Origin', origin);
  else res.setHeader('Access-Control-Allow-Origin', 'https://presswave.xyz');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  
  try {
    const { description, url, name, category } = req.body || {};
    if (!description) return res.status(400).json({ error: 'Description required' });
    
    // 1. Extract keywords from user description
    const descKeywords = extractKeywords(description);
    
    // 2. Get category topics
    const catTopics = CATEGORY_TOPICS[category] || CATEGORY_TOPICS['other'];
    
    // 3. Fetch URL metadata (if provided)
    const urlMeta = await fetchUrlMeta(url);
    let urlKeywords = [];
    if (urlMeta) {
      const metaText = [urlMeta.title, urlMeta.description, urlMeta.h1].filter(Boolean).join(' ');
      urlKeywords = [...extractKeywords(metaText), ...urlMeta.keywords];
    }
    
    // 4. Combine all topics — category first (most reliable), then URL, then description
    const allTopics = [...new Set([...catTopics, ...urlKeywords, ...descKeywords])].slice(0, 20);
    
    // 5. Query matched directories + fallbacks + count (directory-only proposition)
    const PER_TYPE = 12;
    const [matchedDirs, fallDirs, countDirs] = await Promise.all([
      queryByTopics(allTopics, 'directory', PER_TYPE),
      queryTop('directory', PER_TYPE),
      countType('directory'),
    ]);
    
    // 6. Merge: matched first, backfill with fallback, dedup
    const dirs = dedup(matchedDirs, fallDirs, PER_TYPE);
    
    // 7. Cap displayed count at 300 (our actual submission capacity)
    // Show real count if under 300, cap at 300 if over
    const displayDirs = Math.min(countDirs, 300);
    
    // Estimated reach based on directory traffic
    const reach = Math.round(displayDirs * 15000 / 1e6);
    
    return res.status(200).json({
      keywords: allTopics,
      urlMeta,
      counts: {
        directories: displayDirs,
        reach: Math.max(reach, 4), // minimum 4M reach
      },
      contacts: {
        directories: dirs.map(c => ({ name: c.name, outlet: c.outlet, description: c.description, audience_size: c.audience_size, website: c.website, relevanceScore: c.relevanceScore })),
      }
    });
  } catch (e) {
    console.error('Analyze error:', e);
    return res.status(500).json({ error: 'Analysis failed', detail: e.message });
  }
}
