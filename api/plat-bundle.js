// Download every plat sheet linked from a county parcel record, with no sheet-edge cropping.
const { parcelRecord } = require('../lib/weber');
const { bundlePlats } = require('../lib/plat-bundle');
const { cors, query, send } = require('../lib/respond');
module.exports = async (req, res) => {
  if (cors(req, res)) return;
  const q = query(req), parcel = String(q.parcel || '').replace(/[^0-9]/g, '');
  if (q.county !== 'Weber' || !/^\d{9}$/.test(parcel)) return send(res, 400, { error: 'A Weber County parcel ID is required.' });
  try {
    const rec = await parcelRecord(parcel), pdf = await bundlePlats(rec.plats);
    if (pdf.length > 4e6) return send(res, 422, { error: 'The complete full-resolution plat exceeds the download service size limit. Use the individual original sheet links in the dossier. No sheets were omitted.' });
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="recorded-plat-${parcel}.pdf"`);
    res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=86400');
    res.end(pdf);
  } catch (e) { return send(res, 502, { error: 'Complete plat download failed. Use the original sheet links. ' + String(e.message || e) }); }
};
