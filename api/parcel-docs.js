// GET /api/parcel-docs?county=Weber&parcel=123456789
// County parcel record + OCR of the recorded subdivision plat (notes, setbacks, referenced entries, approval blocks).
const { parcelRecord } = require('../lib/weber');
const { ocrSheet, parsePlat } = require('../lib/plat');
const { cors, query, send } = require('../lib/respond');
const { pool } = require('../lib/http');

module.exports = async (req, res) => {
  if (cors(req, res)) return;
  const q = query(req), t0 = Date.now();
  const county = (q.county || 'Weber').trim(), parcel = String(q.parcel || '').replace(/[^0-9]/g, '');
  // sheets=0: record only (the app then OCRs every sheet in parallel via /api/plat-sheet).
  const maxSheets = q.sheets === '0' ? 0 : Math.min(3, Math.max(1, +q.sheets || 1));
  if (!parcel) return send(res, 400, { error: 'parcel is required' });
  if (county !== 'Weber') return send(res, 200, { county, parcel, supported: false, note: 'Recorded plats are only read for Weber County so far.' });
  try {
    const rec = await parcelRecord(parcel);
    const ownerRecord=rec.ownerRecord?{...rec.ownerRecord,parcel,source:rec.url,retrievedAt:new Date().toISOString()}:null;
    if(q.record==='1')return send(res,200,{county,parcel,supported:true,ownerRecord},86400);
    // Prior-parcel metadata can reveal instruments and older plats that predate the current subdivision.
    // This is one generation of discovery, never a complete title search or a lot-number match across plats.
    const parentIds = (rec.priorParcels || []).slice(0, 8);
    const parents = await pool(parentIds, 3, async id => {
      const p = await parcelRecord(id);
      return { parcel: id, url: p.url, references: p.references, plats: p.plats, priorParcels: p.priorParcels };
    });
    const history = { depth: 1, total: (rec.priorParcels || []).length,
      processed: parents.filter(p => !p.error).length, records: parents.map((p, i) => ({ parcel: parentIds[i], ...p })) };
    const sheets = rec.plats.slice(0, maxSheets), plat = { setbacks: null, entries: [], approvals: [], associations: [], hazardReports: [], notes: [], wastewater: [] };
    const ocr = [];
    const deadline = t0 + (+q.budget || 280) * 1000;
    for (const s of sheets) {
      if (Date.now() > deadline - 30000) { ocr.push({ sheet: s.sheet, url: s.url, error: 'skipped: out of time' }); continue; }
      try {
        const scan = await ocrSheet(s.url, deadline - Date.now() - 5000), raw = scan.text;
        const p = parsePlat(raw);
        ocr.push({ sheet: s.sheet, url: s.url, chars: raw.length, timing: scan.timing });
        if (!plat.setbacks && p.setbacks) plat.setbacks = { ...p.setbacks, sheet: s.sheet, url: s.url };
        ['entries', 'approvals', 'associations', 'hazardReports', 'notes', 'wastewater'].forEach(k => p[k].forEach(v => {
          const key = JSON.stringify(v.entry || v);
          if (!plat[k].some(x => JSON.stringify(x.entry || x) === key)) plat[k].push(typeof v === 'object' ? { ...v, sheet: s.sheet } : v);
        }));
      } catch (e) { ocr.push({ sheet: s.sheet, url: s.url, error: String(e.message || e) }); }
    }
    send(res, 200, { county, parcel, supported: true, ownerRecord, parcelPage: rec.url, subdivision: rec.subdivision, references: rec.references,
      priorParcels: rec.priorParcels, history, legal: rec.legal, lot: rec.lot, plats: rec.plats, ocr, plat, ms: Date.now() - t0 }, 30 * 86400);
  } catch (e) {
    send(res, 502, { error: String(e.message || e), ms: Date.now() - t0 });
  }
};
