// Weber County parcel record: recorded references, prior parcels and dedication plat scans.
const { text, decode } = require('./http');

const BASE = 'https://webercountyutah.gov/parcelsearch/';

async function parcelRecord(parcelId) {
  const id = String(parcelId).replace(/[^0-9]/g, '');
  const url = BASE + 'ownership-info.php?id=' + id;
  const html = await text(url);
  return { url, ...parseOwnership(html) };
}

function parseOwnership(html) {
  // Dedication plats: links to /mounts/ded_plats/Book_x/NNN-NNN.tif, labeled with the subdivision name.
  const plats = [];
  const platRe = /href="(https?:\/\/[^"]*\/mounts\/ded_plats\/[^"]+\.tif)"[^>]*>([^<]+)<\/a>/gi;
  let m;
  while ((m = platRe.exec(html))) if (!plats.some(p => p.url === m[1])) plats.push({ url: m[1], sheet: decode(m[2]) });
  const subdivCell = /<td>([^<]+)<br><a href="[^"]*ded_plats/i.exec(html);

  // "Current References" panel: Entry # / Book / Page / Recorded Date rows, then Kind of Instrument.
  const refs = [];
  const panel = (/Current References([\s\S]*?)Prior Parcel Numbers/i.exec(html) || [])[1] || '';
  const rows = panel.split(/<div class='row'>/i).map(r => decode(r)).filter(Boolean);
  for (let i = 0; i < rows.length; i++) {
    const r = /^(\d{5,9})\s*(\d+)?\s*(\d+)?\s*([A-Z][a-z]+ \d{1,2}, \d{4})?/.exec(rows[i]);
    if (r) {
      const kind = rows.slice(i + 1, i + 3).find(x => x && !/Kind of Instrument/i.test(x) && !/^\d{5,9}/.test(x)) || null;
      refs.push({ entry: r[1], book: r[2] || null, page: r[3] || null, date: r[4] || null, kind: kind ? kind.slice(0, 40) : null, label: KINDS[(kind || '').trim()] || null });
    }
  }
  const prior = Array.from(new Set((/Prior Parcel Numbers([\s\S]*?)<\/div>\s*<\/div>/i.exec(html) || ['', ''])[1].match(/\d{9}/g) || []));
  return { subdivision: subdivCell ? decode(subdivCell[1]) : null, plats, references: refs, priorParcels: prior };
}

const KINDS = { 'SP WD': 'Special warranty deed', 'WD': 'Warranty deed', 'QCD': 'Quitclaim deed', 'DECL': 'Declaration', 'ESMT': 'Easement',
  'AGMT': 'Agreement', 'AMND': 'Amendment', 'PLAT': 'Plat', 'TD': 'Trust deed', 'NOT': 'Notice', 'COV': 'Covenants' };

module.exports = { parcelRecord, parseOwnership };
