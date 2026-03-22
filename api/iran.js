const IRAN_FEEDS = [
  { url: 'https://en.mehrnews.com/rss', name: 'Mehr News' },
  { url: 'https://www.tehrantimes.com/rss', name: 'Tehran Times' },
  { url: 'https://www.aljazeera.com/xml/rss/all.xml', name: 'Al Jazeera' },
];

const KEYWORDS = /iran|hormuz|araghchi|khamenei|irgc|tehran|nuclear|strait|missile|sanction|ceasefire|war|persian gulf|islamic republic/i;

function extractItems(xml, source) {
  const items = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let match;
  while ((match = itemRegex.exec(xml)) !== null) {
    const block = match[1];
    const get = (tag) => {
      const m = block.match(
        new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>|<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`)
      );
      return m
        ? (m[1] || m[2] || '')
            .replace(/<[^>]+>/g, '')
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .trim()
        : '';
    };
    const linkMatch =
      block.match(/<link>\s*(https?:\/\/[^\s<]+)\s*<\/link>/) ||
      block.match(/<link[^>]+href="([^"]+)"/) ||
      block.match(/<guid[^>]*>(https?:\/\/[^\s<]+)<\/guid>/);
    const title = get('title');
    if (!title) continue;
    items.push({
      title,
      description: get('description').slice(0, 280),
      link: linkMatch ? linkMatch[1].trim() : '',
      pubDate: get('pubDate') || '',
      source,
    });
  }
  return items;
}

async function fetchFeed({ url, name }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36',
        'Accept': 'application/rss+xml, application/xml, text/xml, */*',
      },
    });
    clearTimeout(timer);
    if (!res.ok) {
      console.log(`${name} returned HTTP ${res.status}`);
      return [];
    }
    const xml = await res.text();
    const parsed = extractItems(xml, name);
    console.log(`${name}: ${parsed.length} items`);
    return parsed;
  } catch (e) {
    clearTimeout(timer);
    console.log(`${name} failed: ${e.message}`);
    return [];
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=180');

  const results = await Promise.all(IRAN_FEEDS.map(fetchFeed));
  let posts = results.flat();

  // Al Jazeera needs filtering — Mehr & Tehran Times are already Iran-focused
  const filtered = posts.filter(p =>
    p.source !== 'Al Jazeera' || KEYWORDS.test(p.title + ' ' + p.description)
  );

  const final = filtered.length > 0 ? filtered : posts;
  final.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));

  res.status(200).json(final.slice(0, 25));
}
