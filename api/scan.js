// Presswave Press-Readiness Scanner API
// Scans a URL and returns a press-readiness score + matched media contacts
// DO NOT change SUPABASE_ANON_KEY — it starts with sb_publishable_, NOT a JWT

const SUPABASE_URL = 'https://vfjsyyextdvrvtirdpbh.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_-Ko6Dknctb-MzN6ekceoWg_kUSJ6Hl5';

// Fetch and analyze URL for press-readiness
async function analyzeUrl(url) {
  if (!url || !url.match(/^https?:\/\/[a-zA-Z0-9]/)) {
    return { error: 'Invalid URL', score: 0 };
  }
  
  try {
    // SSRF protection
    const urlObj = new URL(url);
    const host = urlObj.hostname;
    if (host === 'localhost' || host === '127.0.0.1' || host.startsWith('10.') ||
        host.startsWith('192.168.') || host.startsWith('172.') || host === '169.254.169.254' ||
        host.endsWith('.internal') || host.endsWith('.local')) {
      return { error: 'Invalid URL', score: 0 };
    }
    
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Presswave Scanner/1.0 (https://presswave.xyz)' },
      redirect: 'follow',
    });
    clearTimeout(timeout);
    
    if (!res.ok) return { error: 'Failed to fetch URL', score: 0 };
    
    const html = await res.text();
    const get = (pattern) => { const m = html.match(pattern); return m ? m[1].trim() : null; };
    const has = (pattern) => pattern.test(html);
    
    // Extract metadata
    const title = get(/<title[^>]*>([^<]+)<\/title>/i);
    const desc = get(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i)
              || get(/<meta[^>]*content=["']([^"']+)["'][^>]*name=["']description["']/i);
    const ogTitle = get(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i);
    const ogDesc = get(/<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']+)["']/i);
    const ogImage = get(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i);
    const twitterCard = get(/<meta[^>]*name=["']twitter:card["'][^>]*content=["']([^"']+)["']/i);
    
    // Social links
    const twitterLink = get(/href=["'](https?:\/\/(?:twitter\.com|x\.com)\/[^"']+)["']/i);
    const linkedinLink = get(/href=["'](https?:\/\/(?:www\.)?linkedin\.com\/[^"']+)["']/i);
    
    // Content signals
    const hasPricing = has(/pricing|plans|subscribe|buy now|get started|purchase/i);
    const hasPress = has(/press|media|news|journalists|pr\s|public relations/i);
    const hasBlog = has(/blog|articles|updates|news/i);
    const hasCaseStudies = has(/case stud|success stor|customer stor|testimonial/i);
    const hasFounder = has(/founder|team|about us|our story|who we are/i);
    
    // Mobile-friendly check (basic)
    const isMobileFriendly = has(/<meta[^>]*name=["']viewport["'][^>]*content=["'][^"']*width=device-width/i);
    
    // Scoring breakdown (0-100)
    const scores = {
      websiteQuality: 0,
      socialPresence: 0,
      launchReadiness: 0,
      contentSignals: 0,
    };
    
    // Website quality (max 35 points)
    if (title && title.length > 5) scores.websiteQuality += 8;
    if (desc && desc.length > 20) scores.websiteQuality += 8;
    if (ogTitle) scores.websiteQuality += 6;
    if (ogDesc) scores.websiteQuality += 6;
    if (ogImage) scores.websiteQuality += 4;
    if (isMobileFriendly) scores.websiteQuality += 3;
    
    // Social presence (max 20 points)
    if (twitterLink) scores.socialPresence += 10;
    if (linkedinLink) scores.socialPresence += 10;
    
    // Launch readiness (max 25 points)
    if (hasPricing) scores.launchReadiness += 10;
    if (hasPress) scores.launchReadiness += 10;
    if (title && desc) scores.launchReadiness += 5; // Clear value prop
    
    // Content signals (max 20 points)
    if (hasBlog) scores.contentSignals += 7;
    if (hasCaseStudies) scores.contentSignals += 7;
    if (hasFounder) scores.contentSignals += 6;
    
    const totalScore = Object.values(scores).reduce((a, b) => a + b, 0);
    
    return {
      score: Math.min(totalScore, 100),
      breakdown: scores,
      meta: {
        title: title || null,
        description: desc || null,
        ogImage: ogImage || null,
        hasSocial: !!(twitterLink || linkedinLink),
        hasPricing,
        hasPress,
        isMobileFriendly,
      },
      suggestions: generateSuggestions(scores, {
        title, desc, ogTitle, ogDesc, ogImage,
        twitterLink, linkedinLink,
        hasPricing, hasPress, hasBlog, hasCaseStudies, hasFounder,
        isMobileFriendly,
      }),
    };
  } catch (e) {
    console.error('URL analysis error:', e);
    return { error: 'Failed to analyze URL', score: 0, detail: e.message };
  }
}

function generateSuggestions(scores, checks) {
  const suggestions = [];
  
  if (scores.websiteQuality < 25) {
    if (!checks.title || checks.title.length < 10) suggestions.push('Add a clear, descriptive page title');
    if (!checks.desc || checks.desc.length < 30) suggestions.push('Add a meta description (100-160 characters)');
    if (!checks.ogTitle) suggestions.push('Add Open Graph meta tags for better social sharing');
    if (!checks.ogImage) suggestions.push('Add an og:image for social media previews');
    if (!checks.isMobileFriendly) suggestions.push('Add viewport meta tag for mobile optimization');
  }
  
  if (scores.socialPresence < 10) {
    if (!checks.twitterLink) suggestions.push('Link your Twitter/X profile');
    if (!checks.linkedinLink) suggestions.push('Link your LinkedIn profile');
  }
  
  if (scores.launchReadiness < 15) {
    if (!checks.hasPricing) suggestions.push('Add a pricing page or clear call-to-action');
    if (!checks.hasPress) suggestions.push('Create a press/media page for journalists');
  }
  
  if (scores.contentSignals < 10) {
    if (!checks.hasBlog) suggestions.push('Start a blog to build authority');
    if (!checks.hasCaseStudies) suggestions.push('Add customer testimonials or case studies');
    if (!checks.hasFounder) suggestions.push('Add an About or Founder story page');
  }
  
  return suggestions.slice(0, 5); // Top 5 suggestions
}

// Fetch matched media contacts (same logic as /api/analyze.js)
async function getMatchedContacts(url) {
  try {
    // Extract keywords from URL content
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Presswave/1.0' },
      redirect: 'follow',
    });
    clearTimeout(timeout);
    
    if (!res.ok) return [];
    
    const html = await res.text();
    const get = (pattern) => { const m = html.match(pattern); return m ? m[1].trim() : null; };
    
    const title = get(/<title[^>]*>([^<]+)<\/title>/i) || '';
    const desc = get(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i) || '';
    const combined = (title + ' ' + desc).toLowerCase();
    
    // Extract category based on keywords
    const categories = {
      'ai-ml': ['ai', 'artificial intelligence', 'machine learning', 'gpt', 'llm', 'automation'],
      'saas': ['saas', 'software', 'cloud', 'enterprise', 'subscription'],
      'productivity': ['productivity', 'task', 'calendar', 'notes', 'collaboration'],
      'developer-tools': ['developer', 'api', 'devops', 'github', 'coding'],
      'fintech': ['fintech', 'finance', 'payment', 'banking', 'crypto'],
    };
    
    let detectedTopics = [];
    for (const [cat, keywords] of Object.entries(categories)) {
      if (keywords.some(kw => combined.includes(kw))) {
        detectedTopics.push(...keywords.filter(kw => combined.includes(kw)));
      }
    }
    
    if (detectedTopics.length === 0) detectedTopics = ['startup', 'technology', 'innovation'];
    
    // Query Supabase for directories matching topics
    const topicStr = detectedTopics.slice(0, 5).join(',');
    const dbUrl = `${SUPABASE_URL}/rest/v1/media_contacts?type=eq.directory&topics=ov.{${encodeURIComponent(topicStr)}}&select=name,outlet,description,audience_size,website&order=audience_size.desc.nullslast&limit=12`;
    
    const dbRes = await fetch(dbUrl, {
      headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` }
    });
    
    if (dbRes.ok) {
      return await dbRes.json();
    }
    
    return [];
  } catch (e) {
    console.error('Contact matching error:', e);
    return [];
  }
}

// Save email capture to Supabase
async function saveEmailCapture(email, scanUrl, score) {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/presswave_emails`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify({
        email,
        scan_url: scanUrl,
        score,
        source: 'scanner',
        created_at: new Date().toISOString(),
      })
    });
    
    return res.ok;
  } catch (e) {
    console.error('Email save error:', e);
    return false;
  }
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
    const { url, email, action } = req.body || {};
    
    if (!url) return res.status(400).json({ error: 'URL required' });
    
    // Action: scan (initial) or unlock (after email capture)
    if (action === 'unlock' && email) {
      // Email provided — save to DB and return full matched contacts
      const analysis = await analyzeUrl(url);
      const contacts = await getMatchedContacts(url);
      
      await saveEmailCapture(email, url, analysis.score);
      
      return res.status(200).json({
        ...analysis,
        contacts: contacts.slice(0, 12), // Full list
        unlocked: true,
      });
    }
    
    // Default action: scan
    const analysis = await analyzeUrl(url);
    const contacts = await getMatchedContacts(url);
    
    return res.status(200).json({
      ...analysis,
      contacts: contacts.slice(0, 3).map(c => ({ // Teaser: 3 contacts, partially blurred
        name: c.name,
        description: c.description,
        audience_size: c.audience_size,
        blurred: true, // Frontend will blur these
      })),
      totalMatches: Math.min(contacts.length, 300),
      unlocked: false,
    });
  } catch (e) {
    console.error('Scan API error:', e);
    return res.status(500).json({ error: 'Scan failed', detail: e.message });
  }
}
