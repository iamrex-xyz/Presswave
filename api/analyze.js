// Vercel Serverless Function: Analyze a startup URL + description
// Returns enriched keywords and matched contacts from Supabase

const SUPABASE_URL = 'https://vfjsyyextdvrvtirdpbh.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_-Ko6Dknctb-MzN6ekceoWg_kUSJ6Hl5';

// Category → topic mapping for Supabase query
const CATEGORY_TOPICS = {
  'ai-ml': ['artificial intelligence', 'machine learning', 'AI', 'deep learning', 'GPT', 'LLM', 'automation', 'chatbot', 'neural network', 'computer vision', 'NLP'],
  'saas': ['SaaS', 'B2B', 'enterprise', 'cloud', 'software', 'subscription', 'business tools', 'workflow', 'CRM', 'project management'],
  'developer-tools': ['developer', 'API', 'open source', 'DevOps', 'coding', 'programming', 'infrastructure', 'SDK', 'CLI', 'GitHub'],
  'productivity': ['productivity', 'task management', 'collaboration', 'remote work', 'calendar', 'notes', 'automation', 'workflow', 'time tracking'],
  'marketing': ['marketing', 'SEO', 'content', 'social media', 'email marketing', 'analytics', 'growth', 'advertising', 'copywriting', 'brand'],
  'fintech': ['fintech', 'finance', 'payments', 'banking', 'crypto', 'blockchain', 'investing', 'trading', 'insurance', 'lending'],
  'health': ['health', 'wellness', 'fitness', 'medical', 'healthcare', 'mental health', 'telemedicine', 'wearable', 'nutrition'],
  'ecommerce': ['ecommerce', 'e-commerce', 'retail', 'shopping', 'marketplace', 'Shopify', 'DTC', 'inventory', 'supply chain'],
  'education': ['education', 'edtech', 'learning', 'courses', 'teaching', 'tutoring', 'students', 'university', 'training', 'certification'],
  'social': ['social', 'community', 'networking', 'messaging', 'social media', 'creator', 'influencer', 'engagement', 'forum'],
};

// Extract keywords from text
function extractKeywords(text) {
  if (!text) return [];
  const stopWords = new Set(['the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'shall', 'can', 'need', 'dare', 'ought', 'used', 'to', 'of', 'in', 'for', 'on', 'with', 'at', 'by', 'from', 'as', 'into', 'through', 'during', 'before', 'after', 'above', 'below', 'between', 'out', 'off', 'over', 'under', 'again', 'further', 'then', 'once', 'here', 'there', 'when', 'where', 'why', 'how', 'all', 'both', 'each', 'few', 'more', 'most', 'other', 'some', 'such', 'no', 'nor', 'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very', 'just', 'because', 'but', 'and', 'or', 'if', 'while', 'about', 'up', 'it', 'its', 'this', 'that', 'these', 'those', 'i', 'me', 'my', 'we', 'our', 'you', 'your', 'he', 'she', 'they', 'them', 'what', 'which', 'who', 'whom']);
  
  const words = text.toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2 && !stopWords.has(w));
  
  // Count frequency
  const freq = {};
  words.forEach(w => { freq[w] = (freq[w] || 0) + 1; });
  
  // Return top keywords by frequency
  return Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([word]) => word);
}

// Fetch URL metadata
async function fetchUrlMeta(url) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Presswave/1.0 (https://presswave.xyz)' },
      redirect: 'follow',
    });
    clearTimeout(timeout);
    
    if (!res.ok) return null;
    
    const html = await res.text();
    
    // Extract meta tags
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    const descMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i) ||
                      html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*name=["']description["']/i);
    const kwMatch = html.match(/<meta[^>]*name=["']keywords["'][^>]*content=["']([^"']+)["']/i) ||
                    html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*name=["']keywords["']/i);
    const ogDescMatch = html.match(/<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']+)["']/i);
    const h1Match = html.match(/<h1[^>]*>([^<]+)<\/h1>/i);
    
    return {
      title: titleMatch ? titleMatch[1].trim() : null,
      description: descMatch ? descMatch[1].trim() : (ogDescMatch ? ogDescMatch[1].trim() : null),
      keywords: kwMatch ? kwMatch[1].split(',').map(k => k.trim().toLowerCase()) : [],
      h1: h1Match ? h1Match[1].trim() : null,
    };
  } catch (e) {
    return null;
  }
}

// Query Supabase for matching contacts
async function queryMatchedContacts(topics, type, limit) {
  // Use overlap query on topics array
  const topicFilter = topics.slice(0, 8).join(',');
  const url = `${SUPABASE_URL}/rest/v1/media_contacts?type=eq.${type}&select=name,outlet,description,audience_size,website,topics&topics=ov.{${topicFilter}}&order=audience_size.desc.nullslast&limit=${limit}`;
  
  try {
    const res = await fetch(url, {
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
      }
    });
    if (res.ok) return await res.json();
  } catch (e) {}
  return [];
}

// Fallback: get contacts without topic filter
async function queryFallbackContacts(type, limit) {
  const url = `${SUPABASE_URL}/rest/v1/media_contacts?type=eq.${type}&select=name,outlet,description,audience_size,website&order=audience_size.desc.nullslast&limit=${limit}`;
  try {
    const res = await fetch(url, {
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
      }
    });
    if (res.ok) return await res.json();
  } catch (e) {}
  return [];
}

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  
  const { description, url, name, category } = req.body || {};
  
  if (!description) return res.status(400).json({ error: 'Description required' });
  
  // 1. Extract keywords from description
  let allKeywords = extractKeywords(description);
  
  // 2. Add category-based topics
  const categoryTopics = CATEGORY_TOPICS[category] || [];
  
  // 3. Fetch URL metadata if provided
  let urlMeta = null;
  if (url && url.startsWith('http')) {
    urlMeta = await fetchUrlMeta(url);
    if (urlMeta) {
      // Extract keywords from URL metadata
      const metaText = [urlMeta.title, urlMeta.description, urlMeta.h1].filter(Boolean).join(' ');
      const metaKeywords = extractKeywords(metaText);
      allKeywords = [...new Set([...allKeywords, ...metaKeywords, ...urlMeta.keywords])];
    }
  }
  
  // 4. Combine all topics for matching
  const matchTopics = [...new Set([...categoryTopics, ...allKeywords])].slice(0, 15);
  
  // 5. Query matched contacts from DB
  const SHOW = 9; // visible + locked items
  
  const [matchedDirs, matchedJours, matchedPods, matchedNews] = await Promise.all([
    queryMatchedContacts(matchTopics, 'directory', SHOW),
    queryMatchedContacts(matchTopics, 'journalist', SHOW),
    queryMatchedContacts(matchTopics, 'podcast', SHOW),
    queryMatchedContacts(matchTopics, 'newsletter', SHOW),
  ]);
  
  // 6. If topic matching returned too few, backfill with fallback
  const [fallDirs, fallJours, fallPods, fallNews] = await Promise.all([
    matchedDirs.length < SHOW ? queryFallbackContacts('directory', SHOW - matchedDirs.length) : [],
    matchedJours.length < SHOW ? queryFallbackContacts('journalist', SHOW - matchedJours.length) : [],
    matchedPods.length < SHOW ? queryFallbackContacts('podcast', SHOW - matchedPods.length) : [],
    matchedNews.length < SHOW ? queryFallbackContacts('newsletter', SHOW - matchedNews.length) : [],
  ]);
  
  // Deduplicate by name
  function dedup(matched, fallback) {
    const names = new Set(matched.map(c => c.name));
    return [...matched, ...fallback.filter(c => !names.has(c.name))].slice(0, SHOW);
  }
  
  return res.status(200).json({
    keywords: matchTopics,
    urlMeta: urlMeta,
    contacts: {
      directories: dedup(matchedDirs, fallDirs),
      journalists: dedup(matchedJours, fallJours),
      podcasts: dedup(matchedPods, fallPods),
      newsletters: dedup(matchedNews, fallNews),
    }
  });
}
