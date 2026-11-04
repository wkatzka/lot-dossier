/* Plan reader: pulls key design facts out of a plan-set PDF in the browser (pdf.js), with the sheet each came from.
 * Heuristic by nature, so every value is shown to the user to confirm before it's used. */
(function (root) {
  'use strict';
  var PDFJS = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/';

  function loadPdfJs() {
    if (root.pdfjsLib) return Promise.resolve(root.pdfjsLib);
    return new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = PDFJS + 'pdf.min.js';
      s.onload = function () { root.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS + 'pdf.worker.min.js'; resolve(root.pdfjsLib); };
      s.onerror = function () { reject(new Error('Could not load the PDF reader (needs an internet connection).')); };
      document.head.appendChild(s);
    });
  }

  // Group a page's text items into lines (same baseline), left to right.
  function pageLines(items) {
    var rows = [];
    items.forEach(function (it) {
      var s = (it.str || '').trim();
      if (!s) return;
      var y = Math.round(it.transform[5]), x = it.transform[4];
      var row = rows.find(function (r) { return Math.abs(r.y - y) <= 2; });
      if (!row) { row = { y: y, parts: [] }; rows.push(row); }
      row.parts.push({ x: x, s: s });
    });
    rows.sort(function (a, b) { return b.y - a.y; });
    var lines = [];
    rows.forEach(function (r) {
      r.parts.sort(function (a, b) { return a.x - b.x; });
      lines.push(r.parts.map(function (p) { return p.s; }).join(' ').replace(/\s+/g, ' '));
    });
    return { lines: lines, labels: items.map(function (it) { return (it.str || '').trim().toUpperCase(); }).filter(Boolean) };
  }

  // The sheet number sits next to a "SHEET NUMBER"/"SHEET NO" label in the title block; drawings reference other sheets, so don't just take any ID.
  function sheetId(labels) {
    var isId = function (l) { return /^[A-Z]{1,2}-?\d{3}(\.\d)?$/.test(l); };
    for (var i = 0; i < labels.length; i++) {
      if (/^SHEET (NUMBER|NO\.?|#)$/.test(labels[i])) {
        for (var j = i + 1; j < Math.min(labels.length, i + 4); j++) if (isId(labels[j])) return labels[j];
        for (var k = i - 1; k >= Math.max(0, i - 3); k--) if (isId(labels[k])) return labels[k];
      }
    }
    return null;
  }

  var LEVEL = /^((FIRST|SECOND|THIRD|1ST|2ND|3RD|MAIN|UPPER|LOWER|BASEMENT|GROUND)\s+)(FLOOR|LEVEL)\s+PLAN$/;
  function levelKey(t) {
    var w = t.split(/\s+/)[0];
    return { FIRST: '1', '1ST': '1', MAIN: '1', GROUND: '1', SECOND: '2', '2ND': '2', UPPER: '2', THIRD: '3', '3RD': '3', LOWER: 'B', BASEMENT: 'B' }[w] || w;
  }
  function ftIn(m) { return +m[1] + (+(m[2] || 0)) / 12 + (m[3] ? (+m[3] / +m[4]) / 12 : 0); }

  async function read(file, onProgress) {
    var lib = await loadPdfJs();
    var buf = await file.arrayBuffer();
    var doc = await lib.getDocument({ data: buf, isEvalSupported: false }).promise;
    var pages = [];
    for (var i = 1; i <= doc.numPages; i++) {
      var page = await doc.getPage(i);
      var tc = await page.getTextContent();
      var pl = pageLines(tc.items);
      pages.push({ n: i, lines: pl.lines, labels: pl.labels, sheet: sheetId(pl.labels), text: pl.lines.join('\n').toUpperCase() });
      onProgress && onProgress(i, doc.numPages);
    }
    return extract(pages, file.name);
  }

  function extract(pages, filename) {
    var out = { filename: filename, pages: pages.length, fields: {}, src: {}, features: [], codes: [], textChars: 0 };
    pages.forEach(function (p) { out.textChars += p.text.length; });
    function where(p) { return p.sheet ? 'sheet ' + p.sheet : 'page ' + p.n; }
    function set(k, v, p, note) { if (out.fields[k] == null && v != null && !isNaN(v)) { out.fields[k] = v; out.src[k] = (note ? note + ', ' : '') + where(p); } }
    // Short items are labels/callouts; long ones are boilerplate code notes, which we ignore for features.
    function shortLines(p) { return p.lines.map(function (l) { return l.toUpperCase(); }).concat(p.labels).filter(function (l) { return l.length < 48; }); }

    pages.forEach(function (p) {
      var t = p.text, m;
      // Areas: "RESIDENCE = 4658 SF", "LIVING AREA: 3,200 SQ FT", "GARAGE = 1237 SF"
      var re = /(RESIDENCE|HOUSE|LIVING(?: AREA)?|MAIN FLOOR|FIRST FLOOR|1ST FLOOR|CONDITIONED|HEATED|FINISHED|DWELLING|HOME)[A-Z \/]*?\s*[=:]\s*([\d,]{3,6})\s*(?:SF|S\.F\.|SQ\.?\s?FT)/g;
      while ((m = re.exec(t))) { set('residence_sf', +m[2].replace(/,/g, ''), p); }
      if ((m = /GARAGE[A-Z \/]*?\s*[=:]\s*([\d,]{3,5})\s*(?:SF|S\.F\.|SQ\.?\s?FT)/.exec(t))) set('garage_sf', +m[1].replace(/,/g, ''), p);
      if ((m = /GROUND SNOW LOAD[^\n\d]{0,20}(\d{2,3})\s*PSF/.exec(t))) set('ground_snow_load_psf', +m[1], p);
      if ((m = /(?:BEARING (?:PRESSURE|CAPACITY)|SOIL BEARING)[^\n\d]{0,30}([\d,]{3,5})\s*PSF/.exec(t))) set('bearing_psf', +m[1].replace(/,/g, ''), p);
      if ((m = /SEISMIC DESIGN CATEGORY[\s=:"]*([A-F][0-2]?)\b/.exec(t))) { out.plan_sdc = m[1]; out.src.plan_sdc = where(p); }
      if ((m = /\bS\s?DS\s*=\s*([\d.]+)\s*G?/.exec(t))) { out.plan_sds = +m[1]; out.src.plan_sds = where(p); }
      if ((m = /(?:BASIC )?WIND SPEED[^\n\d]{0,10}(\d{2,3})\s*MPH/.exec(t))) { out.wind_mph = +m[1]; }
      if ((m = /CLIMATE ZONE\s*(\d[A-C]?)/.exec(t))) out.climate_zone = m[1];
      if ((m = /(?:BUILDING|MAX(?:IMUM)?|OVERALL)\s+HEIGHT[^\n\d]{0,12}(\d{2})\s*'/.exec(t))) set('height_ft', +m[1], p);
      var cre = /(20\d\d)\s+(?:UTAH\s+|INTERNATIONAL\s+)?(RESIDENTIAL|WILDLAND[- ]URBAN INTERFACE|ENERGY CONSERVATION|PLUMBING|MECHANICAL|FUEL GAS|ELECTRIC(?:AL)?|FIRE)\s+CODE/g;
      while ((m = cre.exec(t))) { var c = m[1] + ' ' + m[2].replace(/\b\w+/g, function (w) { return w[0] + w.slice(1).toLowerCase(); }) + ' Code'; if (out.codes.indexOf(c) < 0) out.codes.push(c); }
    });

    // Overall footprint: two largest dimension strings on the site plan sheet.
    // (The cover's sheet index also says "SITE PLAN", so pick the site-plan page with the most dimension strings.)
    var DIM = /(\d{1,3})'\s*-\s*(\d{1,2})(?:\s+(\d)\/(\d))?"/g;
    var dimsOf = function (p) { var d = []; p.labels.join(' | ').replace(DIM, function (s, a, b, c, e) { d.push(ftIn([s, a, b, c, e])); return s; }); return d; };
    var site = pages.filter(function (p) { return p.labels.some(function (l) { return /SITE PLAN$/.test(l); }); })
      .sort(function (a, b) { return dimsOf(b).length - dimsOf(a).length; })[0];
    if (site) {
      var dims = dimsOf(site).filter(function (d) { return d >= 20 && d <= 300; }).sort(function (a, b) { return b - a; });
      if (dims.length >= 2) { set('depth_ft', Math.round(dims[0] * 10) / 10, site, 'largest dimension'); set('width_ft', Math.round(dims[1] * 10) / 10, site, 'second-largest dimension'); }
    }

    // Floor plan sheets, by level (sections and elevations repeat titles; we take the max per level).
    var levels = {}, bedKeys = {}, genericBeds = {}, baths = {};
    pages.forEach(function (p) {
      var titles = p.labels.filter(function (l) { return LEVEL.test(l); });
      if (!titles.length) return;
      if (p.labels.some(function (l) { return /ELECTRICAL|FRAMING|FOUNDATION|ROOF/.test(l) && /PLAN$/.test(l); }) && !p.labels.some(function (l) { return /^(KITCHEN|GREAT|LIVING|DINING)/.test(l); })) return;
      var lv = levelKey(titles[0]);
      levels[lv] = true;
      var L = p.labels, gen = 0, bath = 0, m;
      for (var i = 0; i < L.length; i++) {
        var a = L[i], prev = L[i - 1] || '', nxt = L[i + 1] || '';
        if (/^(PRIMARY|MASTER|OWNER'?S)\s+(BED ?ROOM|SUITE)$/.test(a) || (/^(PRIMARY|MASTER|OWNER'?S)$/.test(prev) && /^BED ?ROOM$/.test(a))) bedKeys.PRIMARY = true;
        else if ((m = /^BED ?ROOM\s*#?\s*(\d+)$/.exec(a))) bedKeys['B' + m[1]] = true;
        else if (/^BED ?ROOM$/.test(a) && !/^(PRIMARY|MASTER|OWNER'?S)$/.test(prev)) gen++;
        else if (/^\(?BUNK ?ROOM\)?$/.test(a) && !/^BED ?ROOM\s*\d+$/.test(prev)) gen++;
        if (/^(PRIMARY |MASTER |GUEST |JACK ?& ?JILL )?(BATH|BATHROOM|ENSUITE)( \d+)?$/.test(a) && !/^(PRIMARY|MASTER)$/.test(prev)) bath += 1;
        else if (/^(BATH|BATHROOM)$/.test(a) && /^(PRIMARY|MASTER)$/.test(prev)) bath += 1;
        if (/^(POWDER|POWDER ROOM|HALF BATH)$/.test(a)) bath += 0.5;
      }
      genericBeds[lv] = Math.max(genericBeds[lv] || 0, gen);
      baths[lv] = Math.max(baths[lv] || 0, bath);
      out.src.floorplans = (out.src.floorplans ? out.src.floorplans + ', ' : '') + (p.sheet || 'page ' + p.n);
    });
    var lvls = Object.keys(levels);
    if (lvls.length) {
      var beds = Object.keys(bedKeys).length + Object.keys(genericBeds).reduce(function (s, k) { return s + genericBeds[k]; }, 0);
      var fp = (out.src.floorplans || '').split(', ').filter(function (v, i, a) { return a.indexOf(v) === i; }).slice(0, 3).join(', ');
      if (beds) { out.fields.bedrooms = beds; out.src.bedrooms = 'room labels, ' + fp; }
      var b = Object.keys(baths).reduce(function (s, k) { return s + baths[k]; }, 0);
      if (b) out.baths = b;
      var above = lvls.filter(function (k) { return k !== 'B'; }).length;
      if (above) { out.fields.stories = above; out.src.stories = 'floor plan sheets'; }
      if (levels.B) { out.fields.foundation = 'basement'; out.src.foundation = 'basement floor plan'; }
    }

    // Features from short labels/callouts only (notes paragraphs mention everything generically).
    var shorts = [];
    pages.forEach(function (p) { shortLines(p).forEach(function (l) { shorts.push({ l: l, p: p }); }); });
    function find(re) { var h = shorts.find(function (s) { return re.test(s.l); }); return h ? where(h.p) : null; }
    var f;
    if (!out.fields.foundation) {
      if ((f = find(/BASEMENT (FLOOR|LEVEL|SLAB|WALL)|^BASEMENT\b.*=|FINISHED BASEMENT/))) { out.fields.foundation = 'basement'; out.src.foundation = f; }
      else if ((f = find(/CRAWL ?SPACE/))) { out.fields.foundation = 'crawlspace'; out.src.foundation = f; }
      else if ((f = find(/SLAB ON GRADE|SLAB-ON-GRADE|CONCRETE SLAB/))) { out.fields.foundation = 'slab'; out.src.foundation = f; }
    }
    if ((f = find(/GAS (METER|LINE|APPLIANCE|FIREPLACE|RANGE|FURNACE|WATER HEATER)|GAS LINE SCHEMATIC|FUEL GAS/))) { out.fields.fuel = 'gas'; out.src.fuel = f; }
    else if ((f = find(/HEAT PUMP|ALL[- ]ELECTRIC/))) { out.fields.fuel = 'electric'; out.src.fuel = f; }
    if ((f = find(/CEDAR|WOOD SIDING|LAP SIDING|BOARD (AND|&) BATTEN|T&G SIDING|SHIPLAP/))) { out.fields.cladding = 'combustible'; out.src.cladding = f; }
    else if ((f = find(/FIBER CEMENT|HARDIE|STUCCO|METAL SIDING|STONE VENEER/))) { out.fields.cladding = 'noncombustible'; out.src.cladding = f; }

    var feat = function (label, re) { var w = find(re); if (w) out.features.push({ label: label, where: w }); };
    feat('Stone veneer', /STONE VENEER/);
    feat('Cedar / wood siding', /CEDAR|WOOD SIDING|LAP SIDING|BOARD (AND|&) BATTEN/);
    feat('Asphalt shingle roof', /ASPHALT SHINGLE/);
    feat('Metal roof', /METAL ROOF|STANDING SEAM/);
    feat('Wood-burning or gas fireplace', /FIREPLACE/);
    feat('Fire sprinklers', /FIRE SPRINKLER|NFPA 13D/);
    feat('Retaining walls', /RETAINING WALL/);
    feat('Walkout', /WALK-?OUT/);
    feat('Deck', /\bDECK\b/);
    feat('Septic system shown', /SEPTIC|DRAIN ?FIELD|LEACH/);
    feat('Private well shown', /\bWELL HEAD\b|PRIVATE WELL|WELL PUMP/);
    if (out.baths) out.features.push({ label: out.baths + ' bathrooms', where: 'room labels' });
    out.found = Object.keys(out.fields).length;
    return out;
  }

  root.PlanReader = { read: read, extract: extract };
})(typeof window !== 'undefined' ? window : globalThis);
