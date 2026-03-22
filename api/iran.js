const IRAN_FEEDS = [
  'https://www.tehrantimes.com/rss',
  'https://en.irna.ir/rss',
  'https://www.tasnimnews.com/en/rss/feed/0/8/0/top-stories',
  'https://ifpnews.com/feed',
];

const KEYWORDS = /iran|hormuz|araghchi|khamenei|irgc|tehran|nuclear|strait|missile|sanction|islamic republic|persian gulf|ceasefire|war|trump/i;

function extractItems(xml, source) {
  const items = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let match;
  while ((match = itemRegex.exec(xml)) !== null) {
    const block = match[1];
    const get = (tag) => {
      const m = block.match(new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>|<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`));
      return m ? (m[1] || m[2] || '').trim() : '';
    };
    const linkMatch = block.match(/<link>([\s\S]*?)<\/link>/) || block.match(/<link[^>]+href="([^"]+)"/);
    items.push({
      title: get('title').replace(/<[^>]+>/g, ''),
      description: get('description').replace(/<[^>]+>/g, '').slice(0, 300),
      link: linkMatch ? linkMatch[1].trim() : '',
      pubDate: get('pubDate') || get('dc:date') || '',
      source,
    });
  }
  return items;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=300');

  try {
    const results = await Promise.allSettled(
      IRAN_FEEDS.map(url =>
        fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SignalBot/1.0)' } })
          .then(r => r.ok ? r.text() : Promise.reject(new Error(r.status)))
          .then(xml => extractItems(xml, new URL(url).hostname.replace('www.', '').replace('en.', '')))
          .catch(() => [])
      )
    );

    let posts = results.flatMap(r => r.status === 'fulfilled' ? r.value : []);

    // Filter relevant posts, fall back to all if too few
    const filtered = posts.filter(p => KEYWORDS.test(p.title + ' ' + p.description));
    if (filtered.length >= 4) posts = filtered;

    // Sort by date
    posts.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));

    res.status(200).json(posts.slice(0, 20));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
