// Vercel Serverless Function: /api/portal-status
let memoryState = { locked: false, updatedAt: new Date().toISOString() };

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Admin-Key');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method === 'POST') {
    try {
      const data = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
      const isLocked = Boolean(data.locked);
      memoryState = { locked: isLocked, updatedAt: new Date().toISOString() };
      return res.status(200).json({ success: true, ...memoryState });
    } catch (e) {
      return res.status(400).json({ success: false, message: 'Invalid JSON' });
    }
  }

  // GET: Query status
  return res.status(200).json({ success: true, ...memoryState });
}
