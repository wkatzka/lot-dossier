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
    rec.plats.forEach(function (original, i) {
      var r = results[i];
      var source = { sheet: r && r.sheet || original.sheet, url: original.url };
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
  // Evidence gates deliberately ignore user checklist completion and attachment counts.
  // Current collectors produce discovery evidence only; no title/survey clearance is inferred.
  function assess(p) {
    p = p || {};
    var sheets = p.sheets || [], readings = p.readings || [], conflicts = p.conflicts || [];
    var processed = sheets.filter(function (s) { return s.processed && !s.error; }).length;
    var expected = Math.max(sheets.length, (p.coverage || {}).total || 0);
    var allLinked = expected > 0 && processed === expected;
    var source = p.recordSource || {}, missing = sheets.filter(function (s) { return !s.processed || s.error; });
    var refs = Array.from(new Set((p.references || []).map(function (x) { return String(x.entry || ''); })
      .concat([].concat.apply([], (p.evidence || []).map(function (x) { return (x.entries || []).map(String); }))).filter(Boolean)));
    var rows = [
      { id: 'identity', label: 'Correct property', status: source.legal && readings.length ? 'Partial evidence' : 'Missing evidence',
        evidence: (source.legal ? 'County legal description retrieved: ' + source.legal : 'County legal description not retrieved.') +
          (readings.length ? ' Lot labels were detected on ' + readings.length + ' sheet(s).' : 'No matching lot label was extracted.') +
          (conflicts.length ? ' Conflicting readings: ' + conflicts.map(function (x) { return x.field; }).join(', ') + '.' : ''),
        gap: 'Parcel, legal description and applicable recorded plat have not been reconciled. OCR label proximity is not a boundary match.',
        criterion: 'Documented agreement between the parcel, full legal description and recorded plat, with conflicting identifiers or dimensions resolved.' },
      { id: 'plats', label: 'Complete plat set', status: allLinked ? 'Linked sheets processed; scope unverified' : 'Incomplete',
        evidence: processed + ' of ' + expected + ' linked sheets processed by OCR.' + (missing.length ? ' Unread or failed: ' + missing.map(function (s) { return s.sheet; }).join(', ') + '.' : '') +
          (!expected ? ' No linked plat inventory is available.' : '') + (expected > sheets.length ? ' Some expected sheet records are missing.' : ''),
        gap: 'Applicable amendments and referenced sheets outside the retrieved inventory have not been reconciled; OCR processing does not establish legibility of every restriction.',
        criterion: 'All applicable plat sheets and amendments are accounted for and readable, with every cross-reference resolved. Finishing linked-sheet OCR alone does not complete this gate.' },
      { id: 'instruments', label: 'Recorded restrictions', status: 'Blocked: title evidence',
        evidence: refs.length ? 'Unresolved instrument references: ' + refs.map(function (x) { return 'Entry ' + x; }).join(', ') + '.' : 'No easement entry numbers extracted; this does not establish absence of restrictions.',
        gap: 'A dated public-record search and its underlying instruments, parent-parcel records, amendments and releases have not been reconciled. Public parcel references alone are not a complete restriction inventory. An uploaded title commitment is optional supplementary evidence.',
        criterion: 'Account for every discovered restriction and linked instrument within the dated public search scope; document applicability, amendments/releases, coverage limits and unresolved terms. If a title commitment is available, reconcile its exceptions too.' },
      { id: 'mapping', label: 'Physical location', status: 'Unresolved: survey reconciliation',
        evidence: 'No survey-confirmed easement geometry is available in this dossier.',
        gap: 'Candidate survey alignment and geometry checks are available, but verified boundary and restriction geometry are not established. Blanket or ambiguous easements cannot be silently omitted from a map.',
        criterion: 'A dated survey locates each plottable easement. Blanket, ambiguous or unplottable restrictions are individually identified, with their remaining siting implications stated.' },
      { id: 'design', label: 'Proposed construction', status: 'Not checked against easements',
        evidence: 'Any generated house diagram is a setback-only screen. Pool placement and driveway/utility clearance are not established.',
        gap: 'Mapped restrictions and a versioned layout covering the proposed improvements are missing from the easement review.',
        criterion: 'Compare the identified house, pool, deck, driveway and utility layout revision against the reconciled restrictions. Record intersections, approvals and unresolved conflicts; checked does not necessarily mean approved.' }
    ];
    return { stage: 'Partial evidence', assessedAt: p.assessedAt || null, rows: rows,
      linkedSheets: { complete: allLinked, processed: processed, total: expected }, references: refs,
      stages: ['Partial evidence', 'Documents reconciled', 'Mapped', 'Design checked'],
      refresh: 'Recheck when a new plat, amendment, release, title update, survey or design revision arrives, and before purchase or permit submission. An annual refresh alone is not a completeness test.',
      limit: 'No guarantee of absence of other easements. Later stages must identify the documents, effective dates, review dates and design revision they cover. Attachments and task completion are not evidence verification.' };
  }
  var api = { extractMentions: extractMentions, mergeSheets: mergeSheets, assess: assess };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.PlatEvidence = api;
})(typeof window !== 'undefined' ? window : globalThis);
