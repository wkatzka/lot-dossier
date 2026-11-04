// Pull builder-relevant facts out of public-meeting text: development standards, utility providers, CC&R recordings.
let pdfjs = null;
function pdfLib() {
  if (!pdfjs) {
    pdfjs = require('pdfjs-dist/legacy/build/pdf.js');
    // Point the in-process "fake worker" at an explicit path so Vercel's bundler includes it.
    pdfjs.GlobalWorkerOptions.workerSrc = require.resolve('pdfjs-dist/legacy/build/pdf.worker.js');
  }
  return pdfjs;
}

// Read page text in order. With a keyword, stop `gap` pages after its last mention (agenda packets are long, and the
// item we want is contiguous); always stop at the deadline so the function returns what it has.
async function pdfPages(buf, { maxPages = 400, keyword = null, gap = 30, deadline = Infinity } = {}) {
  const doc = await pdfLib().getDocument({ data: new Uint8Array(buf), isEvalSupported: false, disableFontFace: true, useSystemFonts: false, verbosity: 0 }).promise;
  const pages = [], re = keyword ? new RegExp(keyword, 'i') : null;
  let last = -1, truncated = false;
  for (let i = 1; i <= Math.min(doc.numPages, maxPages); i++) {
    if (Date.now() > deadline) { truncated = true; break; }
    const tc = await (await doc.getPage(i)).getTextContent();
    // Rebuild lines by baseline so tables like "Front Yard Setback:   20 Feet" stay on one line.
    const rows = [];
    tc.items.forEach(it => { const s = (it.str || '').trim(); if (!s) return; const y = Math.round(it.transform[5]);
      let r = rows.find(q => Math.abs(q.y - y) <= 2); if (!r) rows.push(r = { y, parts: [] }); r.parts.push({ x: it.transform[4], s }); });
    rows.sort((a, b) => b.y - a.y);
    const txt = rows.map(r => r.parts.sort((a, b) => a.x - b.x).map(p => p.s).join(' ')).join('\n');
    pages.push(txt);
    if (re && re.test(txt)) last = i;
    if (re && last > 0 && i - last > gap) break;
  }
  await doc.destroy();
  return { pages, numPages: doc.numPages, truncated };
}

function sentences(t) { return t.replace(/\s+/g, ' ').split(/(?<=[.;])\s+(?=[A-Z0-9])/); }

// Utility providers: "culinary water service will be provided by X", "X will provide wastewater service", will-serve letters, septic.
function utilities(t, keyword) {
  const out = [];
  sentences(t).forEach(s => {
    if (s.length > 420) return;
    if (/(culinary|drinking) water|wastewater|sewer|septic|onsite wastewater|will-?serve|secondary water/i.test(s) && /provid|serv|approv|feasib|letter|connect/i.test(s)) {
      const kind = /septic|onsite wastewater/i.test(s) ? 'septic' : /wastewater|sewer/i.test(s) ? 'sewer' : /secondary/i.test(s) ? 'secondary water' : 'culinary water';
      const prov = /(?:provided by|from|by)\s+((?:[A-Z][A-Za-z.&'-]+\s){1,6}(?:Company|District|Association|Corporation|City|Works|Water|Sewer))/.exec(s)
        || /((?:[A-Z][A-Za-z.&'-]+\s){1,6}(?:Water and Sewer|Water Company|Mutual Water Company|Improvement District))/.exec(s);
      out.push({ kind, provider: prov ? prov[1].trim() : null, text: s.trim() });
    }
  });
  return out;
}

// Development standards tables (MPD/PUD/development agreement exhibits). Tables are often multi-column
// ("Front Yard Setback: 15 Feet 20 Feet" for Townhomes | Single-Family); read the header to pick the single-family column.
function standards(t) {
  const starts = [];
  const re = /(?:Single[- ]Family[^\n]{0,40})?(?:Minimum )?Site Development Standards/gi; let m;
  while ((m = re.exec(t))) starts.push({ i: m.index, sf: /^Single/i.test(m[0]) });
  let best = null;
  starts.forEach(({ i, sf }) => {
    const blk = t.slice(i, i + 3200);
    const head = blk.slice(0, 300);
    // Column order from the header; PDF text can split "Single-Family" around the other column's name, so use "Family".
    const other = head.search(/Townhome|Multi-?family|Attached|Cluster/i), fam = head.search(/Family/i);
    const sfFirst = !sf && other >= 0 && fam >= 0 ? fam < other : null;
    const col = sfFirst == null ? 0 : (sfFirst ? 0 : 1);
    const vals = (label, unit) => {
      const r = new RegExp('(?:' + label + ')[^\\n]{0,40}?((?:\\d[\\d,]*\\s*' + unit + '\\.?\\s*)+)', 'i').exec(blk);
      if (!r) return null;
      const nums = [...r[1].matchAll(new RegExp('(\\d[\\d,]*)\\s*' + unit, 'gi'))].map(x => +x[1].replace(/,/g, ''));
      return nums.length > 1 ? (nums[col] != null ? nums[col] : nums[nums.length - 1]) : nums[0];
    };
    const FT = '(?:feet|foot|ft|\')';
    const s = {
      section: sf ? 'single-family' : (sfFirst != null ? 'single-family column' : 'general'),
      minLotArea: (/(?:Minimum )?Lot Area:?\s*([^\n]{1,30}?)(?:\s{2,}|\n|Single|Regardless)/i.exec(blk) || [])[1] || null,
      minLotWidth: vals('L\\s?ot\\s?W\\s?idth:?', FT),
      front: vals('Front Yard Setback:?', FT),
      side: vals('Side Yard Setback:?(?! for)', FT),
      streetSide: vals('Side Facing Street:?|Corner Lot\'?s?[^\\n]{0,30}\\n?', FT),
      rear: vals('Rear Yard Setback:?', FT),
      heightMax: vals('Maximum:?', FT),
      coverageMax: vals('Lot Coverage:?', '(?:percent|%)'),
      minStories: /Minimum:?\s*One Story/i.test(blk) ? 1 : null,
      accessoryHeight: vals('Accessory building max(?:imum)?:?', FT)
    };
    const n = ['front', 'side', 'rear', 'heightMax', 'coverageMax', 'minLotWidth'].filter(k => s[k] != null).length;
    const rank = n + (s.section !== 'general' ? 10 : 0);
    if (n >= 3 && (!best || rank > best.rank)) best = { ...s, rank };
  });
  if (best) delete best.rank;
  return best;
}

function uses(t) {
  const out = {};
  [['adu', /Accessory dwelling unit\.?\s+([PNC])\s+([PNC])/i], ['shortTermRental', /Short-?term rental\.?\s+([PNC])\s+([PNC])/i]].forEach(([k, re]) => {
    const m = re.exec(t); if (m) out[k] = { townhome: m[1], singleFamily: m[2] };
  });
  return Object.keys(out).length ? out : null;
}

// CC&R / declaration recordings: "Declaration of Covenants, Conditions and Restrictions dated ..., recorded as Entry No. 1882728"
function ccrs(t) {
  const out = [];
  const re = /((?:Master |Amended and Restated |Supplemental )?Declaration of (?:Covenants|Protective Covenants)[^.]{0,200}?Entry\s*No\.?,?\s*([\d]{6,8})[^.]{0,260})/gi; let m;
  while ((m = re.exec(t.replace(/\s+/g, ' ')))) {
    const amends = [...m[1].matchAll(/Entry\s*No\.?,?\s*([\d]{6,8})/gi)].map(x => x[1]);
    const dated = /dated ([A-Z][a-z]+ \d{1,2}, \d{4})/.exec(m[1]);
    out.push({ title: (/^(.*?Restrictions)/i.exec(m[1]) || [m[1]])[0].slice(0, 120), dated: dated ? dated[1] : null, entries: Array.from(new Set(amends)), text: m[1].slice(0, 420) });
  }
  if (!out.length && /CC&Rs? (?:will|shall) be recorded/i.test(t)) out.push({ title: 'CC&Rs to be recorded with the final plat', entries: [], text: (/[^.]*CC&Rs? (?:will|shall) be recorded[^.]*\./i.exec(t.replace(/\s+/g, ' ')) || [''])[0] });
  return out;
}

module.exports = { pdfPages, utilities, standards, uses, ccrs };
