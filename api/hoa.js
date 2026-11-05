// GET /api/hoa?q=<subdivision or association name>&county=Weber
// Looks the association up in the Utah HOA registry: registration status and its designated contact roles.
const hoa = require('../lib/hoa');
const { cors, query, send } = require('../lib/respond');

module.exports = async (req, res) => {
  if (cors(req, res)) return;
  const q = query(req), t0 = Date.now();
  const term = String(q.q || '').replace(/\b(phase|ph\.?|plat|unit|amended|subdivision|subd\.?|pud|no\.?)\b.*$/i, '').trim();
  if (term.length < 3) return send(res, 400, { error: 'q (subdivision or association name) is required' });
  try {
    const r = await hoa.find(term, String(q.county || '').trim() || null);
    send(res, 200, { query: term, ...r, ms: Date.now() - t0 }, r.matches.length ? 7 * 86400 : 86400);
  } catch (e) {
    send(res, 502, { error: String(e.message || e), ms: Date.now() - t0 });
  }
};
