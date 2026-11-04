// GET /api/plat-sheet?url=<recorded plat sheet>&lot=4
// OCR one recorded plat sheet: notes, setbacks, referenced entries, approval blocks, and what's drawn around the lot.
// One sheet per call so the app can read every sheet of a plat in parallel.
const { ocrSheet, parsePlat, parseLot } = require('../lib/plat');
const { cors, query, send } = require('../lib/respond');

// Only fetch recorded plat images from county servers we support (never arbitrary URLs).
const ALLOWED = [/^https:\/\/(www\.)?webercountyutah\.gov\/mounts\/ded_plats\/[\w/.-]+\.tif$/i];

module.exports = async (req, res) => {
  if (cors(req, res)) return;
  const q = query(req), t0 = Date.now(), url = String(q.url || '');
  if (!ALLOWED.some(re => re.test(url))) return send(res, 400, { error: 'url must be a recorded plat sheet on a supported county server' });
  try {
    const raw = await ocrSheet(url, 270000);
    const plat = parsePlat(raw), lot = q.lot ? parseLot(ocrSheet.words, q.lot) : null;
    const notesForLot = q.lot ? plat.notes.filter(n => new RegExp('\\bLOTS?\\b[^.]{0,40}\\b' + q.lot + '\\b', 'i').test(n.text)) : [];
    send(res, 200, { url, sheet: url.split('/').pop().replace(/\.tif$/i, ''), chars: raw.length, timing: ocrSheet.last, plat, lot, notesForLot, ms: Date.now() - t0 }, 30 * 86400);
  } catch (e) {
    send(res, 502, { url, error: String(e.message || e), ms: Date.now() - t0 });
  }
};
