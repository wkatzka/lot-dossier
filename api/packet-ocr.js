// GET /api/packet-ocr?url=<meeting packet PDF>&pages=92-98
// OCR scanned exhibit pages of a public-meeting packet (will-serve letters) and pull out the water-service facts.
const scans = require('../lib/scans');
const { cors, query, send } = require('../lib/respond');

// Public-notice attachments and county commission uploads only (never arbitrary URLs).
const ALLOWED = [/^https:\/\/www\.utah\.gov\/pmn\/files\/\d+\.pdf$/i, /^https:\/\/(www\.)?webercountyutah\.gov\/(commission|planning)\/[^?#]+\.pdf$/i];

function parsePages(s) {
  const out = [];
  String(s || '').split(',').forEach(part => {
    const m = /^(\d+)(?:-(\d+))?$/.exec(part.trim());
    if (m) for (let i = +m[1]; i <= +(m[2] || m[1]) && out.length < 12; i++) out.push(i);
  });
  return out;
}

module.exports = async (req, res) => {
  if (cors(req, res)) return;
  const q = query(req), t0 = Date.now(), url = String(q.url || ''), pages = parsePages(q.pages);
  if (!ALLOWED.some(re => re.test(url))) return send(res, 400, { error: 'url must be a public-notice or county meeting PDF' });
  if (!pages.length) return send(res, 400, { error: 'pages is required, e.g. 92-98' });
  try {
    const text = await scans.ocrPages(url, pages, { deadline: t0 + 250000 });
    send(res, 200, { url, pages: text, water: scans.waterFacts(text), ms: Date.now() - t0 }, 30 * 86400);
  } catch (e) {
    send(res, 502, { url, error: String(e.message || e), ms: Date.now() - t0 });
  }
};
