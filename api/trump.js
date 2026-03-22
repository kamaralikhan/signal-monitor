export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=300'); // cache 5 min on Vercel edge

  try {
    const response = await fetch('https://www.trumpstruth.org/feed', {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SignalBot/1.0)' }
    });
    if (!response.ok) throw new Error('Feed returned ' + response.status);
    const xml = await response.text();
    res.setHeader('Content-Type', 'application/xml');
    res.status(200).send(xml);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
