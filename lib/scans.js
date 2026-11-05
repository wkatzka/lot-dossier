// Scanned exhibits inside public-meeting packets (will-serve and feasibility letters are usually pasted in as images,
// so the packet's text layer has only the exhibit header). Find those pages, pull the page image with pdf.js, OCR it.
const sharp = require('sharp');
const { createWorker } = require('tesseract.js');
const { buffer } = require('./http');

// Split a packet into its staff reports ("Staff Report to the ... Planning Commission"), each with its request line.
function staffReports(pages) {
  const starts = [];
  pages.forEach((p, i) => { if (/Staff\s*Report\s*to\s*the/i.test(p)) starts.push(i); });
  return starts.map((s, k) => {
    const head = pages.slice(s, s + 2).join(' ');
    const m = /(?:Application\s*Request|Agenda\s*Item)\s*:\s*([\s\S]{0,260})/i.exec(head);
    return { start: s, end: k + 1 < starts.length ? starts[k + 1] : Math.min(pages.length, s + 40), request: m ? m[1].replace(/\s+/g, ' ').trim() : '' };
  });
}

// How well a staff report's request names this subdivision and phase. pdf.js splits words ("r equest"), so compare
// with spaces removed. A townhome or other-phase report for the same development scores below the lot's own phase.
function matchScore(request, name) {
  const R = request.toLowerCase().replace(/[^a-z0-9]/g, ''), N = name.toLowerCase();
  const words = N.replace(/\b(phase|ph|plat|subdivision|subd|pud|amended|no|unit)\b/g, ' ').split(/[^a-z0-9]+/).filter(w => w.length > 2 && !/^\d+$/.test(w));
  if (!words.length || !R.includes(words[0])) return 0;
  let sc = 2 + words.slice(1).filter(w => R.includes(w)).length;
  const ph = /\b(?:phase|ph\.?)\s*(\d+)/i.exec(N), rp = /(?:phase|ph)(\d+)/.exec(R);
  if (ph && rp) sc += ph[1] === rp[1] ? 3 : -3;
  ['townhome', 'condo', 'commercial', 'cluster'].forEach(t => { if (R.includes(t) && !N.includes(t)) sc -= 6; });
  return sc;
}
function pickReports(reports, name) {
  const scored = reports.map(r => Object.assign({ score: matchScore(r.request, name) }, r)).filter(r => r.score >= 2);
  const top = Math.max.apply(0, scored.map(r => r.score));
  return scored.filter(r => r.score === top);
}

// Pages of a "Will-Serve / Feasibility Letters" exhibit that carry no real text (the letters are pasted-in scans).
function scannedExhibits(pages, from, to) {
  const out = [];
  const bare = p => p.replace(/Page\s*\d+\s*of\s*\d+/gi, '').replace(/Exhibit\s*[A-Z]\b[^\n]*/gi, '').replace(/\s+/g, '');
  for (let k = from; k < to; k++) {
    if (!/Exhibit\s*[A-Z]\s*[-–—:]?\s*[^\n]{0,20}(Will[\s-]*Serve|Feasibility)/i.test(pages[k] || '')) continue;
    const run = [];
    for (let j = k; j < Math.min(to, k + 10); j++) {
      if (j > k && /Exhibit\s*[A-Z]\b/i.test(pages[j]) && !/Will[\s-]*Serve|Feasibility/i.test(pages[j])) break;
      if (bare(pages[j]).length < 80) run.push(j + 1); else if (j > k) break;
    }
    if (run.length) out.push({ pages: run, label: 'Will-serve / feasibility letters' });
  }
  return out;
}

let pdfjs = null;
function pdfLib() {
  if (!pdfjs) {
    pdfjs = require('pdfjs-dist/legacy/build/pdf.js');
    pdfjs.GlobalWorkerOptions.workerSrc = require.resolve('pdfjs-dist/legacy/build/pdf.worker.js');
  }
  return pdfjs;
}

let workerP = null;
function worker() { return workerP || (workerP = createWorker('eng', 1, { cachePath: '/tmp/tessdata', logger: () => {} })); }

// The largest image painted on the page, as a PNG upscaled for OCR. Scanned letters are often embedded at ~72 dpi.
async function pageImage(doc, n) {
  const lib = pdfLib(), page = await doc.getPage(n), ops = await page.getOperatorList();
  let best = null;
  for (let i = 0; i < ops.fnArray.length; i++) {
    if (ops.fnArray[i] !== lib.OPS.paintImageXObject) continue;
    const img = await new Promise(r => page.objs.get(ops.argsArray[i][0], r));
    if (img && img.data && (!best || img.width * img.height > best.width * best.height)) best = img;
  }
  if (!best || best.width * best.height < 200000) return null;
  let raw = best.data, ch = best.kind === 3 ? 4 : best.kind === 2 ? 3 : 1;
  if (best.kind === 1) { // 1 bit per pixel, packed rows
    const out = Buffer.alloc(best.width * best.height), rb = (best.width + 7) >> 3;
    for (let y = 0; y < best.height; y++) for (let x = 0; x < best.width; x++) out[y * best.width + x] = (raw[y * rb + (x >> 3)] >> (7 - (x & 7))) & 1 ? 255 : 0;
    raw = out;
  }
  return sharp(Buffer.from(raw), { raw: { width: best.width, height: best.height, channels: ch } })
    .resize({ width: Math.max(2200, best.width) }).greyscale().normalise().sharpen().png().toBuffer();
}

async function ocrPages(url, pageNums, { deadline = Date.now() + 240000 } = {}) {
  const buf = await buffer(url, { timeout: 90000, maxBytes: 150e6 });
  const doc = await pdfLib().getDocument({ data: new Uint8Array(buf), isEvalSupported: false, disableFontFace: true, verbosity: 0 }).promise;
  const w = await worker(), out = [];
  for (const n of pageNums.filter(n => n >= 1 && n <= doc.numPages).slice(0, 12)) {
    if (Date.now() > deadline) break;
    const png = await pageImage(doc, n);
    if (!png) { out.push({ page: n, text: '' }); continue; }
    const { data } = await w.recognize(png);
    out.push({ page: n, text: (data.text || '').replace(/[ \t]+\n/g, '\n') });
  }
  await doc.destroy();
  return out;
}

// What a buyer needs from a water will-serve letter, each with the page it came from.
function waterFacts(pages) {
  const facts = {};
  const find = (key, re, pick) => {
    if (facts[key]) return;
    for (const p of pages) {
      const t = p.text.replace(/\s+/g, ' '), m = re.exec(t);
      if (m) { facts[key] = { value: pick ? pick(m) : m[1].trim(), page: p.page }; return; }
    }
  };
  find('date', /\b((?:January|February|March|April|May|June|July|August|September|October|November|December) \d{1,2}, \d{4})\b/);
  find('supplier', /notice that (?:the )?([A-Z][\w.&' ]{3,60}?(?:Water Company|Water District|Water and Sewer(?: Improvement District)?|Improvement District|Water Users(?: Association)?|Irrigation Company))/);
  find('developer', /(?:to be built|developed) by ([A-Z][\w.,&' ]{3,60}?)\s*\(/);
  find('formerly', /previously known as ([A-Z][\w.&,' ]{3,60}?)\s*\(/);
  find('services', /capacity to provide ((?:culinary|secondary|culinary and secondary|culinary water and secondary)[^(.]{0,30}water)/i);
  find('shares', /(owns? Class [A-Z][^.]{10,260}?shares[^.]{0,200})\./i, m => m[1].replace(/^owns?/i, 'The developer owns').replace(/\s+/g, ' '));
  find('pws', /system number (\d{3,6})/i);
  find('waterRights', /water rights? for this project (?:are|is) secured under (.{5,200}?)\.(?=\s+[A-Z][a-z]|\s*$)/i);
  find('storage', /(\d+(?:\.\d+)?)\s*(?:million gallon|MG)\b[^.]{0,40}tank/i, m => m[1] + ' million gallon storage tank');
  find('fireFlow', /fire flow of ([\d,]+) gallons per minute \(?g?p?m?\)?\s*for (\d+) hours?/i, m => m[1] + ' gpm for ' + m[2] + ' hours');
  find('wells', /filled by (\w+) proposed wells?(?: \(([^)]{0,60})\))?/i, m => m[1] + ' proposed wells' + (m[2] ? ' (' + m[2] + ')' : ''));
  find('connections', /(\d{2,5}) equivalent residential connections/i, m => m[1] + ' equivalent residential connections');
  find('fees', /(hook-up costs?, connection fees?[^.(]{0,160}?)\s*(?:\(|\.|$)/i);
  return facts;
}

module.exports = { staffReports, pickReports, matchScore, scannedExhibits, ocrPages, waterFacts };
