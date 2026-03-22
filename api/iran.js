const IRAN_FEEDS = [
  { url: 'https://en.irna.ir/rss', name: 'IRNA' },
  { url: 'https://www.tehrantimes.com/rss', name: 'Tehran Times' },
  { url: 'https://www.tasnimnews.com/en/rss/feed/0/8/0/top-stories', name: 'Tasnim' },
];

const KEYWORDS = /iran|hormuz|araghchi|khamenei|irgc|tehran|nuclear|strait|missile|sanction|ceasefire|war|trump/i;

function extractItems(xml, source) {
  const items = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let match;
  while ((match = itemRegex.exec(xml)) !== null) {
    const block = match[1];
    const get = (tag) => {
      const m = block.match(new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>|<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`));
      return m ? (m[1] || m[2] || '').replace(/<[^>]+>/g, '').trim() : '';
    };
    const linkMatch = block.match(/<link>\s*(https?:\/\/[^\s<]+)\s*<\/link>/);
    const title = get('title');
    if (!title) continue;
    items.push({
      title,
      description: get('description').slice(0, 250),
      link: linkMatch ? linkMatch[1].trim() : '',
      pubDate: get('pubDate') || '',
      source,
    });
  }
  return items;
}

async function fetchFeed({ url, name }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 4000); // 4s per feed
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SignalBot/1.0)' }
    });
    clearTimeout(timer);
    if (!res.ok) return [];
    const xml = await res.text();
    return extractItems(xml, name);
  } catch {
    clearTimeout(timer);
    return []; // silently skip failed feed
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=180'); // cache 3 min

  // Fetch all feeds in parallel, each with its own 4s timeout
  const results = await Promise.all(IRAN_FEEDS.map(fetchFeed));
  let posts = results.flat();

  // Filter relevant posts, fall back to all if too few
  const filtered = posts.filter(p => KEYWORDS.test(p.title + ' ' + p.description));
  if (filtered.length >= 3) posts = filtered;

  // Sort newest first
  posts.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));

  res.status(200).json(posts.slice(0, 20));
}
