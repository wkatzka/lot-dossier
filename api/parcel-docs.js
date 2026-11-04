// GET /api/parcel-docs?county=Weber&parcel=123456789
// County parcel record + OCR of the recorded subdivision plat (notes, setbacks, referenced entries, approval blocks).
const { parcelRecord } = require('../lib/weber');
const { ocrSheet, parsePlat } = require('../lib/plat');
const { cors, query, send } = require('../lib/respond');

module.exports = async (req, res) => {
  if (cors(req, res)) return;
  const q = query(req), t0 = Date.now();
  const county = (q.county || 'Weber').trim(), parcel = String(q.parcel || '').replace(/[^0-9]/g, '');
  const maxSheets = Math.min(3, Math.max(1, +q.sheets || 1));
  if (!parcel) return send(res, 400, { error: 'parcel is required' });
  if (county !== 'Weber') return send(res, 200, { county, parcel, supported: false, note: 'Recorded plats are only read for Weber County so far.' });
  try {
    const rec = await parcelRecord(parcel);
    const sheets = rec.plats.slice(0, maxSheets), plat = { setbacks: null, entries: [], approvals: [], associations: [], hazardReports: [], notes: [], wastewater: [] };
    const ocr = [];
    const deadline = t0 + (+q.budget || 280) * 1000;
    for (const s of sheets) {
      if (Date.now() > deadline - 30000) { ocr.push({ sheet: s.sheet, url: s.url, error: 'skipped: out of time' }); continue; }
      try {
        const raw = await ocrSheet(s.url, deadline - Date.now() - 5000);
        const p = parsePlat(raw);
        ocr.push({ sheet: s.sheet, url: s.url, chars: raw.length, timing: ocrSheet.last });
        if (!plat.setbacks && p.setbacks) plat.setbacks = { ...p.setbacks, sheet: s.sheet, url: s.url };
        ['entries', 'approvals', 'associations', 'hazardReports', 'notes', 'wastewater'].forEach(k => p[k].forEach(v => {
          const key = JSON.stringify(v.entry || v);
          if (!plat[k].some(x => JSON.stringify(x.entry || x) === key)) plat[k].push(typeof v === 'object' ? { ...v, sheet: s.sheet } : v);
        }));
      } catch (e) { ocr.push({ sheet: s.sheet, url: s.url, error: String(e.message || e) }); }
    }
    send(res, 200, { county, parcel, supported: true, parcelPage: rec.url, subdivision: rec.subdivision, references: rec.references,
      priorParcels: rec.priorParcels, plats: rec.plats, ocr, plat, ms: Date.now() - t0 }, 30 * 86400);
  } catch (e) {
    send(res, 502, { error: String(e.message || e), ms: Date.now() - t0 });
  }
};
