// Recorded plat scans: OCR and pull out what a builder needs from the notes and approval blocks.
const sharp = require('sharp');
const { createWorker } = require('tesseract.js');
const { buffer } = require('./http');

// Small worker pool: concurrent requests in one instance each get their own OCR worker instead of queueing.
const pool = [];
let workerP = null; // kept for the start-up timeout reset below
async function newWorker() {
  const w = await createWorker('eng', 1, { cachePath: '/tmp/tessdata', logger: () => {} });
  await w.setParameters({ tessedit_pageseg_mode: '11' }); // sparse text: plats are labels and note blocks, not paragraphs
  return w;
}
async function worker() {
  const free = pool.find(p => !p.busy);
  if (free) { free.busy = true; return free; }
  const entry = { busy: true, w: null };
  pool.push(entry);
  try { entry.w = await newWorker(); } catch (e) { pool.splice(pool.indexOf(entry), 1); throw e; }
  return entry;
}

async function ocrSheet(url, budgetMs = 120000) {
  const t0 = Date.now(), timing = {};
  const tif = await buffer(url, { timeout: 60000, maxBytes: 40e6 }); timing.download = Date.now() - t0;
  // Plats are ~10800 px bi-level scans; 5400 px keeps note text legible.
  const png = await sharp(tif, { limitInputPixels: false }).resize({ width: +process.env.PLAT_OCR_WIDTH || 5400 }).greyscale().png().toBuffer(); timing.decode = Date.now() - t0 - timing.download;
  const entry = await Promise.race([worker(), new Promise((_, rej) => setTimeout(() => rej(new Error('OCR engine did not start in 60 s')), 60000))]);
  timing.worker = Date.now() - t0 - timing.download - timing.decode;
  const job = entry.w.recognize(png, {}, { text: true, blocks: true }).finally(() => { entry.busy = false; });
  const timeout = new Promise((_, rej) => setTimeout(() => rej(new Error('OCR did not finish in time')), Math.max(5000, budgetMs - (Date.now() - t0))));
  const { data } = await Promise.race([job, timeout]);
  timing.ocr = Date.now() - t0 - timing.download - timing.decode - timing.worker;
  ocrSheet.last = timing;
  const words = [];
  (data.blocks || []).forEach(b => b.paragraphs.forEach(p => p.lines.forEach(l => l.words.forEach(x =>
    words.push({ t: x.text, x: x.bbox.x0, y: x.bbox.y0 })))));
  ocrSheet.words = words;
  return data.text || '';
}

// Read what's drawn around one lot's label: acreage, platted address, easements, envelopes.
// Each word is assigned to its nearest "LOT n" label, so neighbouring lots' labels don't bleed in.
function parseLot(words, lotNo) {
  if (!words || !lotNo) return null;
  const labels = [];
  words.forEach((w, i) => { const n = words[i + 1]; if (/^LOT$/i.test(w.t) && n && /^\d{1,3}$/.test(n.t)) labels.push({ n: n.t, x: w.x, y: w.y }); });
  const mine = labels.filter(l => l.n === String(lotNo));
  if (!mine.length) return null;
  const R = 650, d2 = (a, b) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2;
  let best = null;
  mine.forEach(lab => {
    const near = words.filter(w => Math.abs(w.x - lab.x) < R && Math.abs(w.y - lab.y) < R * 0.6)
      .filter(w => { const own = labels.reduce((m, l) => (d2(w, l) < d2(w, m) ? l : m), labels[0]); return own.n === String(lotNo); });
    const rows = {};
    near.forEach(w => { (rows[Math.round(w.y / 28)] = rows[Math.round(w.y / 28)] || []).push(w); });
    const text = Object.keys(rows).sort((a, b) => a - b).map(k => rows[k].sort((a, b) => a.x - b.x).map(w => w.t).join(' ')).join('\n');
    const U = clean(text).toUpperCase(), flat = U.replace(/\s+/g, ' ');
    const acres = /(?:CONT\.?\s*)?(\d{1,3}\.\d{2,3})\s*(?:\n|\s)*ACRES/.exec(U), sqft = /([\d,]{4,8})\s*(?:SQ\.?\s*FT|S\.F\.)/.exec(flat);
    const addr = /(\d{3,5})\s*(EAST|WEST|E|W)\b[^\d]{0,8}(\d{3,5})\s*(NORTH|SOUTH|N|S)\b/.exec(flat);
    const ease = Array.from(new Set((flat.match(/\d{1,3}'?\s*(?:WIDE\s*)?(?:P\.?\s*U\.?\s*E\.?|PUBLIC UTILITY EASEMENT|(?:STORM|DRAINAGE|ACCESS|IRRIGATION|SEWER|WATER|TRAIL)\s*(?:\w+\s*)?EASEMENT)/g) || []).map(e => e.replace(/\s+/g, ' ').replace(/'\s*/, "' ").replace(/P\.?\s*U\.?\s*E\.?/, 'public utility easement')).filter(e => !/^0/.test(e))));
    const flags = ['BUILDING ENVELOPE', 'BUILDABLE AREA', 'NO BUILD', 'NON-BUILDABLE', 'LIMITS OF DISTURBANCE', 'FAULT', 'SETBACK', 'WETLAND', 'FLOOD'].filter(k => flat.includes(k));
    const r = { lot: String(lotNo), acres: acres ? +acres[1] : null, sqft: sqft ? +sqft[1].replace(/,/g, '') : null,
      platAddress: addr ? addr[1] + ' ' + (addr[2][0] === 'E' ? 'East' : 'West') + ' ' + addr[3] + ' ' + (addr[4][0] === 'N' ? 'North' : 'South') : null,
      easements: ease, mentions: flags, text: text.slice(0, 600) };
    const score = (r.acres ? 2 : 0) + (r.platAddress ? 2 : 0) + r.easements.length + r.mentions.length;
    if (!best || score > best.score) best = { ...r, score };
  });
  if (best) delete best.score;
  return best;
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

module.exports = { ocrSheet, parsePlat, parseLot, clean };
