/* Evidence, not legal interpretation: preserve every sheet and keep lot attribution uncertain. */
(function (root) {
  'use strict';
  var kinds = [
    ['Public utility', /\bP\.?\s*U\.?\s*E\.?\b|PUBLIC UTILITY/i],
    ['Drainage / flood', /DRAINAGE|FLOWAGE|FLOOD/i],
    ['Access / roadway', /ACCESS|INGRESS|EGRESS|RIGHT[- ]OF[- ]WAY|ROADWAY/i],
    ['Temporary turnaround', /TURN\s*AROUND|TURNAROUND/i],
    ['Water / irrigation', /IRRIGATION|DITCH|CANAL|WATER(?:LINE)?/i],
    ['Sewer / pipeline', /SEWER|PIPELINE/i],
    ['Conservation / wetland', /CONSERVATION|WETLAND|OPEN SPACE/i],
    ['Trail / public use', /TRAIL|PEDESTRIAN|PUBLIC USE/i],
    ['Other recorded restriction', /MINERAL|AVIGATION|AVIATION|SOLAR|SCENIC|SLOPE|SUPPORT|ENCROACHMENT|NO[- ]BUILD|NON[- ]BUILDABLE/i]
  ];
  function extractMentions(raw) {
    var lines = String(raw || '').replace(/[’‘`´]/g, "'").split(/\n/).map(function (s) { return s.trim(); }).filter(Boolean);
    var out = [], seen = {};
    lines.forEach(function (line, i) {
      if (!/EASEMENT|\bP\.?\s*U\.?\s*E\.?\b|RIGHT[- ]OF[- ]WAY|NO[- ]BUILD|NON[- ]BUILDABLE|LIMITS OF DISTURBANCE/i.test(line)) return;
      var text = lines.slice(Math.max(0, i - 1), Math.min(lines.length, i + 3)).join(' ').replace(/\s+/g, ' ').slice(0, 700);
      var key = text.toUpperCase(); if (seen[key]) return; seen[key] = true;
      var matches = kinds.filter(function (k) { return k[1].test(text); }).map(function (k) { return k[0]; });
      var entries = [], re = /ENTRY\s*(?:#|NO\.?|NUMBER)?\s*(\d{6,9})/gi, m;
      while ((m = re.exec(text))) entries.push(m[1]);
      out.push({ categories: matches.length ? matches : ['Unclassified easement'], text: text, entries: entries });
    });
    return out;
  }
  function mergeSheets(rec, results) {
    var readings = [], evidence = [], sheets = [];
    results.forEach(function (r, i) {
      var original = rec.plats[i], source = { sheet: r && r.sheet || original.sheet, url: original.url };
      sheets.push(Object.assign({}, source, { processed: !!(r && !r.error && r.plat), error: r && r.error || null }));
      if (!r || r.error) return;
      if (r.lot) readings.push(Object.assign({}, r.lot, source));
      ((r.plat && r.plat.easementMentions) || []).forEach(function (x) {
        evidence.push(Object.assign({}, x, source, { scope: 'Sheet-wide; may concern other lots or the legend' }));
      });
      ((r.lot && r.lot.easementMentions) || []).forEach(function (x) {
        evidence.push(Object.assign({}, x, source, { scope: 'Near this lot label; boundary applicability unverified' }));
      });
    });
    // A label at a sheet edge is a warning, not proof of the lot's geometry. Prefer an interior label,
    // but keep every reading and its citations instead of losing the other sheets' evidence.
    readings.sort(function (a, b) {
      return Number(!!a.nearSheetEdge) - Number(!!b.nearSheetEdge) || (b.labelClearance || 0) - (a.labelClearance || 0);
    });
    var lot = readings.length ? Object.assign({}, readings[0]) : null;
    var conflicts = [];
    if (lot) {
      lot.fieldSources = {};
      ['acres', 'platAddress'].forEach(function (k) {
        var values = Array.from(new Set(readings.map(function (r) { return r[k]; }).filter(function (v) { return v != null; })));
        if (values.length > 1) conflicts.push({ field: k, values: values });
        lot[k] = values.length === 1 ? values[0] : null;
        lot.fieldSources[k] = readings.filter(function (r) { return r[k] != null; }).map(function (r) { return { sheet: r.sheet, url: r.url, value: r[k] }; });
      });
      lot.easements = Array.from(new Set([].concat.apply([], readings.map(function (r) { return r.easements || []; }))));
      lot.mentions = Array.from(new Set([].concat.apply([], readings.map(function (r) { return r.mentions || []; }))));
    }
    return { lot: lot, readings: readings, evidence: evidence, sheets: sheets, conflicts: conflicts,
      coverage: { processed: sheets.filter(function (s) { return s.processed; }).length, total: rec.plats.length, geometryVerified: false, titleSearchComplete: false } };
  }
  var api = { extractMentions: extractMentions, mergeSheets: mergeSheets };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.PlatEvidence = api;
})(typeof window !== 'undefined' ? window : globalThis);
