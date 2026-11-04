// Recorded plat scans: OCR and pull out what a builder needs from the notes and approval blocks.
const sharp = require('sharp');
const { createWorker } = require('tesseract.js');
const { buffer } = require('./http');

let workerP = null;
function worker() {
  if (!workerP) {
    workerP = (async () => {
      const w = await createWorker('eng', 1, { cachePath: '/tmp/tessdata', logger: () => {} });
      await w.setParameters({ tessedit_pageseg_mode: '11' }); // sparse text: plats are labels and note blocks, not paragraphs
      return w;
    })();
  }
  return workerP;
}

async function ocrSheet(url, budgetMs = 120000) {
  const t0 = Date.now(), timing = {};
  const tif = await buffer(url, { timeout: 60000, maxBytes: 40e6 }); timing.download = Date.now() - t0;
  // Plats are ~10800 px bi-level scans; 5400 px keeps note text legible.
  const png = await sharp(tif, { limitInputPixels: false }).resize({ width: +process.env.PLAT_OCR_WIDTH || 5400 }).greyscale().png().toBuffer(); timing.decode = Date.now() - t0 - timing.download;
  const w = await worker(); timing.worker = Date.now() - t0 - timing.download - timing.decode;
  const job = w.recognize(png);
  const timeout = new Promise((_, rej) => setTimeout(() => rej(new Error('OCR did not finish in time')), Math.max(5000, budgetMs - (Date.now() - t0))));
  const { data } = await Promise.race([job, timeout]);
  timing.ocr = Date.now() - t0 - timing.download - timing.decode - timing.worker;
  ocrSheet.last = timing;
  return data.text || '';
}

// OCR renders foot marks as " or ’; normalize before parsing.
function clean(t) {
  return t.replace(/[’‘`´]/g, "'").replace(/[“”]/g, '"').replace(/(\d)\s*"(?=[,.\s])/g, "$1'").replace(/[ \t]+/g, ' ');
}

function parsePlat(raw) {
  const t = clean(raw), U = t.toUpperCase(), lines = U.split('\n').map(s => s.trim()).filter(Boolean), flat = lines.join(' ');
  const out = { notes: [], setbacks: null, entries: [], approvals: [], associations: [], hazardReports: [], wastewater: [] };

  // Numbered notes block after "NOTES".
  const ni = lines.findIndex(l => /^NOTES:?$/.test(l));
  if (ni >= 0) {
    const block = lines.slice(ni + 1, ni + 40).join(' ');
    block.split(/\s(?=\d{1,2}\.\s+[A-Z])/).forEach(n => { const m = /^(\d{1,2})\.\s+(.+)/.exec(n.trim()); if (m && m[2].length > 15) out.notes.push({ n: +m[1], text: m[2].slice(0, 400) }); });
  }

  // Setbacks: "SETBACKS PER ... (ENTRY #3372687): FRONT 20', SIDE 10', SIDE FACING STREET ON CORNER 20', REAR 20'"
  const sb = /SETBACKS?([^.]{0,160}?)FRONT\s*(?:YARD\s*)?[:=]?\s*(\d{1,3})\s*'?[^.]{0,40}?SIDE\s*(?:YARD\s*)?[:=]?\s*(\d{1,3})\s*'?([^.]{0,80}?)REAR\s*(?:YARD\s*)?[:=]?\s*(\d{1,3})/.exec(flat);
  if (sb) {
    const corner = /(?:CORNER|STREET)[^\d]{0,30}(\d{1,3})/.exec(sb[4]);
    const via = /ENTRY\s*(?:#|NO\.?)\s*(\d{6,8})/.exec(sb[1]);
    out.setbacks = { front: +sb[2], side: +sb[3], streetSide: corner ? +corner[1] : null, rear: +sb[5],
      basis: /DEVELOPMENT AGREEMENT/.test(sb[1]) ? 'master development agreement' : (/PUD|PLANNED/.test(sb[1]) ? 'PUD approval' : 'plat note'),
      entry: via ? via[1] : null, text: sb[0].slice(0, 220) };
  }

  // Referenced recorded documents: "ENTRY #1234567" / "ENTRY NO. 1234567" with what precedes it.
  const er = /ENTRY\s*(?:#|NO\.?|NUMBER)\s*(\d{6,8})/g; let m;
  while ((m = er.exec(flat))) {
    const before = flat.slice(Math.max(0, m.index - 140), m.index);
    const label = /DECLARATION|COVENANTS|CC&RS?/.test(before) ? 'CC&Rs / declaration' : /DEVELOPMENT AGREEMENT/.test(before) ? 'Development agreement'
      : /EASEMENT/.test(before) ? 'Easement' : /AGREEMENT/.test(before) ? 'Agreement' : /PLAT/.test(before) ? 'Plat' : 'Recorded document';
    if (!out.entries.some(e => e.entry === m[1])) out.entries.push({ entry: m[1], label, context: before.slice(-90).trim() });
  }

  // Approval / certificate blocks naming utilities and agencies (keep just the agency name: 1-4 words before the type).
  const agencyRe = /((?:[A-Z][A-Z.'&-]+ ){1,4}(?:WATER AND SEWER(?: IMPROVEMENT DISTRICT)?|SEWER (?:IMPROVEMENT )?DISTRICT|WATER (?:IMPROVEMENT |CONSERVANCY )?DISTRICT|MUTUAL WATER(?: COMPANY)?|WATER (?:COMPANY|CORPORATION|WORKS)|HEALTH (?:DEPT\.?|DEPARTMENT)|FIRE DISTRICT))/g;
  const STOP = /^(APPROVED|BY|THE|AND|OF|FOR|TO|STANDARDS|IMPROVEMENT|PUBLIC|ENTS|DIRECTOR|COUNTY|ENGINEER|SURVEYOR|ATTORNEY|RECORDER|COMMISSION|PLANNING|SIGNED|DATE)$/;
  let am;
  while ((am = agencyRe.exec(flat))) {
    const ctxt = flat.slice(Math.max(0, am.index - 200), am.index + am[0].length + 200);
    if (!/APPROV|CERTIF|SATISFIED|SERVICE/.test(ctxt)) continue;
    const words = am[1].split(' '); while (words.length && STOP.test(words[0])) words.shift();
    const name = words.join(' ').trim();
    if (name.split(' ').length >= 2 && !out.approvals.some(x => x === name || x.endsWith(name) || name.endsWith(x))) out.approvals.push(name);
  }
  // Health department: does the plat certify on-site wastewater (septic)?
  if (/ON-?SITE\s+WASTEWATER|SEPTIC/.test(flat)) out.wastewater.push('Health department certificate references on-site wastewater disposal');

  const as = flat.match(/[A-Z][A-Z .'-]{3,60}?OWNERS'? ASSOCIATION(?:,? INC\.?)?/g) || [];
  as.forEach(a => { a = a.replace(/^(CONVEY TO|TO|AND|THE)\s+/, '').trim(); if (!out.associations.includes(a)) out.associations.push(a); });

  // Geologic report: "... PERFORMED BY <FIRM> ... DATED <DATE> TITLED "<TITLE>"" (OCR interleaves columns, so match the pieces).
  if (/GEOLOGIC (?:INVESTIGATION|HAZARDS?)/.test(flat)) {
    const by = /PERFORMED BY ([A-Z]+(?: [A-Z]+)? GEOLOGIC)/.exec(flat), dated = /DATED ([A-Z]+ \d{1,2},? \d{4})/.exec(flat), titled = /TITLED "([^"]{10,120})/.exec(flat);
    out.hazardReports.push({ firm: by ? by[1] : null, date: dated ? dated[1] : null, title: titled ? titled[1].split(/[|\[\]{}]|\s(?:[A-Z]{1,2}\s){2,}/)[0].replace(/\s+/g, ' ').trim() : null,
      publicReview: /AVAILABLE FOR PUBLIC REVIEW/.test(flat) });
  }
  return out;
}

module.exports = { ocrSheet, parsePlat, clean };
