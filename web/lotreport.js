/* Lot dossier engine: runs entirely in the browser (or Node 18+).
 * A port of lotreport/*.py. Every data source below sends CORS headers, so no server is needed. */
(function (root) {
  'use strict';

  var UGRC = 'https://services1.arcgis.com/99lidPhWCzftIe9K/arcgis/rest/services';
  var BROADBAND = 'https://services.arcgis.com/pA2nEVnB6tquxgOW/arcgis/rest/services/all_record_hexes_dissolved/FeatureServer/0';
  var WEBER = 'https://maps.webercountyutah.gov/arcgis/rest/services';
  var UTAH_AGO = 'https://services.arcgis.com/ZzrwjTRez6FJiOq4/arcgis/rest/services';
  var SDA = 'https://sdmdataaccess.sc.egov.usda.gov/Tabular/post.rest';
  var FT_PER_M = 3.28084, M_PER_DEG = 111320;
  var COUNTIES = ['Weber', 'Morgan', 'Summit', 'Wasatch', 'Cache', 'Davis', 'Utah', 'Salt Lake', 'Box Elder', 'Washington',
    'Iron', 'Tooele', 'Rich', 'Juab', 'Sanpete', 'Uintah', 'Duchesne', 'Carbon', 'Emery', 'Grand', 'San Juan', 'Kane',
    'Garfield', 'Wayne', 'Sevier', 'Millard', 'Beaver', 'Piute', 'Daggett'];

  var CHECKLIST = [
    ['land', 'Land, zoning & jurisdiction'], ['minerals', 'Mineral interests & title'], ['water', 'Water rights & culinary water'], ['geo', 'Geologic & natural hazards'],
    ['septic', 'Septic / perc'], ['utilities', 'Power, gas & internet'], ['access', 'Access & fire protection'],
    ['easements', 'Easements & recorded restrictions'], ['ccr', 'CC&Rs & design review'], ['survey', 'Survey & topography'], ['permits', 'Building permits & code'], ['performance', 'Home performance & restrictions'], ['pool', 'Pool feasibility'], ['plan', 'Your plan vs. this lot']
  ];

  /* ------------------------------------------------------------ http */
  var mem = new Map();
  var store = (function () { try { var s = root.localStorage; s.setItem('lr:t', '1'); s.removeItem('lr:t'); return s; } catch (e) { return null; } })();
  var TTL = 7 * 24 * 3600 * 1000;
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function cacheGet(k) {
    if (mem.has(k)) return mem.get(k);
    if (!store) return undefined;
    try { var v = JSON.parse(store.getItem('lr:' + k)); if (v && Date.now() - v.t < TTL) { mem.set(k, v.d); return v.d; } } catch (e) {}
    return undefined;
  }
  function cachePut(k, d) {
    mem.set(k, d);
    if (!store) return;
    try { var s = JSON.stringify({ t: Date.now(), d: d }); if (s.length < 250000) store.setItem('lr:' + k, s); } catch (e) {}
  }
  function qs(o) { return Object.keys(o).map(function (k) { return encodeURIComponent(k) + '=' + encodeURIComponent(o[k]); }).join('&'); }

  async function fetchJSON(url, opt) {
    opt = opt || {};
    var full = opt.params ? url + '?' + qs(opt.params) : url;
    var body = opt.form ? qs(opt.form) : (opt.json ? JSON.stringify(opt.json) : null);
    var key = full + '|' + (body || '');
    var hit = cacheGet(key);
    if (hit !== undefined) return hit;
    var retries = opt.retries == null ? 4 : opt.retries, last;
    for (var i = 0; i < retries; i++) {
      var ctl = typeof AbortController !== 'undefined' ? new AbortController() : null;
      var timer = ctl ? setTimeout(function () { ctl.abort(); }, opt.timeout || 45000) : null;
      try {
        var init = { method: body ? 'POST' : 'GET', signal: ctl && ctl.signal };
        if (body) { init.body = body; init.headers = { 'Content-Type': opt.form ? 'application/x-www-form-urlencoded' : 'application/json' }; }
        var r = await fetch(full, init);
        if (r.status === 429 || r.status >= 500) throw Object.assign(new Error('HTTP ' + r.status), { retry: true });
        if (!r.ok) throw new Error('HTTP ' + r.status + ' from ' + url.split('/')[2]);
        var d = await r.json();
        if (d && d.error && d.error.code === 429) throw Object.assign(new Error('rate limited'), { retry: true });
        if (!(d && d.error)) cachePut(key, d);
        return d;
      } catch (e) {
        last = e;
        if (e.retry || e.name === 'AbortError' || e instanceof TypeError) { await sleep(1500 * Math.pow(2, i)); continue; }
        throw e;
      } finally { if (timer) clearTimeout(timer); }
    }
    throw last;
  }

  async function arcgisQuery(layer, o) {
    o = o || {};
    var f = { where: o.where || '1=1', outFields: o.outFields || '*', f: 'json', outSR: 4326,
      returnGeometry: o.returnGeometry ? 'true' : 'false' };
    if (o.geometry) {
      var g = Object.assign({}, o.geometry, { spatialReference: { wkid: 4326 } });
      f.geometry = JSON.stringify(g); f.inSR = 4326; f.spatialRel = 'esriSpatialRelIntersects';
      f.geometryType = o.geometry.rings ? 'esriGeometryPolygon' : 'esriGeometryPoint';
    }
    if (o.distance) { f.distance = o.distance; f.units = 'esriSRUnit_Meter'; }
    var d = await fetchJSON(layer.replace(/\/$/, '') + '/query', { form: f });
    if (d.error) throw new Error(layer.split('/services/')[1] + ': ' + d.error.message);
    return d.features || [];
  }

  /* ------------------------------------------------------------ geometry */
  function toLocal(lon, lat, lat0) { return [lon * M_PER_DEG * Math.cos(lat0 * Math.PI / 180), lat * M_PER_DEG]; }
  function inRing(x, y, ring) {
    var inside = false;
    for (var i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      var xi = ring[i][0], yi = ring[i][1], xj = ring[j][0], yj = ring[j][1];
      if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi + 1e-18) + xi) inside = !inside;
    }
    return inside;
  }
  function inRings(x, y, rings) { return rings.filter(function (r) { return inRing(x, y, r); }).length % 2 === 1; }
  function ringArea(ring, lat0) {
    var p = ring.map(function (q) { return toLocal(q[0], q[1], lat0); }), s = 0;
    for (var i = 0; i < p.length; i++) { var a = p[i], b = p[(i + p.length - 1) % p.length]; s += a[0] * b[1] - b[0] * a[1]; }
    return Math.abs(s) / 2;
  }
  function gridInside(rings, target) {
    var all = [].concat.apply([], rings), xs = all.map(function (p) { return p[0]; }), ys = all.map(function (p) { return p[1]; });
    var x0 = Math.min.apply(0, xs), x1 = Math.max.apply(0, xs), y0 = Math.min.apply(0, ys), y1 = Math.max.apply(0, ys), lat0 = (y0 + y1) / 2;
    var w = (x1 - x0) * M_PER_DEG * Math.cos(lat0 * Math.PI / 180), h = (y1 - y0) * M_PER_DEG;
    var step = Math.sqrt(Math.max(ringArea(rings[0], lat0), 1) / target);
    var nx = Math.max(2, Math.floor(w / step) + 1), ny = Math.max(2, Math.floor(h / step) + 1), pts = [];
    for (var i = 0; i < nx; i++) for (var j = 0; j < ny; j++) {
      var x = x0 + (x1 - x0) * (i + 0.5) / nx, y = y0 + (y1 - y0) * (j + 0.5) / ny;
      if (inRings(x, y, rings)) pts.push([x, y]);
    }
    return pts;
  }
  function dimsFt(rings) {
    var ring = rings[0], lat0 = ring.reduce(function (s, p) { return s + p[1]; }, 0) / ring.length;
    var pts = ring.map(function (p) { return toLocal(p[0], p[1], lat0); }), best = null;
    for (var i = 0; i < pts.length - 1; i++) {
      var dx = pts[i + 1][0] - pts[i][0], dy = pts[i + 1][1] - pts[i][1], L = Math.hypot(dx, dy);
      if (L < 1) continue;
      var ux = dx / L, uy = dy / L;
      var us = pts.map(function (p) { return p[0] * ux + p[1] * uy; }), vs = pts.map(function (p) { return -p[0] * uy + p[1] * ux; });
      var a = Math.max.apply(0, us) - Math.min.apply(0, us), b = Math.max.apply(0, vs) - Math.min.apply(0, vs);
      if (!best || a * b < best[0] * best[1]) best = [a, b];
    }
    best.sort(function (a, b) { return a - b; });
    return [best[0] * FT_PER_M, best[1] * FT_PER_M];
  }
  function distToLines(px, py, paths, lat0) {
    var P = toLocal(px, py, lat0), best = Infinity;
    paths.forEach(function (path) {
      var pts = path.map(function (p) { return toLocal(p[0], p[1], lat0); });
      for (var i = 0; i < pts.length - 1; i++) {
        var a = pts[i], b = pts[i + 1], dx = b[0] - a[0], dy = b[1] - a[1], L2 = dx * dx + dy * dy;
        var t = L2 === 0 ? 0 : Math.max(0, Math.min(1, ((P[0] - a[0]) * dx + (P[1] - a[1]) * dy) / L2));
        best = Math.min(best, Math.hypot(P[0] - a[0] - t * dx, P[1] - a[1] - t * dy));
      }
    });
    return best;
  }
  function distPts(px, py, qx, qy) { var l = (py + qy) / 2, a = toLocal(px, py, l), b = toLocal(qx, qy, l); return Math.hypot(a[0] - b[0], a[1] - b[1]); }
  function fitSlope(samples, lat0) {
    var pts = samples.map(function (s) { return [toLocal(s[0], s[1], lat0), s[2] / FT_PER_M]; }), n = pts.length;
    var mx = 0, my = 0, mz = 0; pts.forEach(function (p) { mx += p[0][0] / n; my += p[0][1] / n; mz += p[1] / n; });
    var sxx = 0, syy = 0, sxy = 0, sxz = 0, syz = 0;
    pts.forEach(function (p) { var x = p[0][0] - mx, y = p[0][1] - my, z = p[1] - mz; sxx += x * x; syy += y * y; sxy += x * y; sxz += x * z; syz += y * z; });
    var det = sxx * syy - sxy * sxy, a = (sxz * syy - syz * sxy) / det, b = (syz * sxx - sxz * sxy) / det;
    var aspect = ((Math.atan2(-a, -b) * 180 / Math.PI) + 360) % 360, local = 0;
    for (var i = 0; i < n; i++) for (var j = i + 1; j < n; j++) {
      var d = Math.hypot(pts[i][0][0] - pts[j][0][0], pts[i][0][1] - pts[j][0][1]);
      if (d > 5 && d < 40) local = Math.max(local, Math.abs(pts[i][1] - pts[j][1]) / d * 100);
    }
    return [Math.hypot(a, b) * 100, aspect, local];
  }
  function compass(d) { return ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'][Math.floor((d + 22.5) / 45) % 8]; }

  /* ------------------------------------------------------------ parcel lookup */
  function lirUrl(c) { return UGRC + '/Parcels_' + c.replace(/ /g, '') + '_LIR/FeatureServer/0'; }

  function makeParcel(county, f) {
    var rings = f.geometry.rings, outer = rings[0];
    var cx = outer.reduce(function (s, p) { return s + p[0]; }, 0) / outer.length;
    var cy = outer.reduce(function (s, p) { return s + p[1]; }, 0) / outer.length;
    return { county: county, attrs: f.attributes, rings: rings, cx: cx, cy: cy, id: f.attributes.PARCEL_ID,
      geometry: { rings: rings }, point: { x: cx, y: cy } };
  }

  async function findByParcel(pid, county) {
    var raw = String(pid).trim().toUpperCase().replace(/'/g, ''), bare = raw.replace(/[^0-9A-Z]/g, '');
    var f = await arcgisQuery(lirUrl(county), { where: "PARCEL_ID IN ('" + raw + "','" + bare + "')", returnGeometry: true });
    if (!f.length) { var e = new Error('Parcel ' + raw + ' not found in ' + county + ' County'); e.notFound = true; throw e; }
    return makeParcel(county, f[0]);
  }

  async function parcelAtPoint(county, x, y) {
    var f = await arcgisQuery(lirUrl(county), { geometry: { x: x, y: y }, returnGeometry: true });
    if (!f.length) f = await arcgisQuery(lirUrl(county), { geometry: { x: x, y: y }, distance: 25, returnGeometry: true });
    if (!f.length) { var e = new Error('No parcel boundary at that address in ' + county + ' County'); e.notFound = true; throw e; }
    return makeParcel(county, f[0]);
  }

  var FIPS_BY_NAME = {};
  var FIPS = { '49001': 'Beaver', '49003': 'Box Elder', '49005': 'Cache', '49007': 'Carbon', '49009': 'Daggett', '49011': 'Davis', '49013': 'Duchesne',
    '49015': 'Emery', '49017': 'Garfield', '49019': 'Grand', '49021': 'Iron', '49023': 'Juab', '49025': 'Kane', '49027': 'Millard', '49029': 'Morgan',
    '49031': 'Piute', '49033': 'Rich', '49035': 'Salt Lake', '49037': 'San Juan', '49039': 'Sanpete', '49041': 'Sevier', '49043': 'Summit',
    '49045': 'Tooele', '49047': 'Uintah', '49049': 'Utah', '49051': 'Wasatch', '49053': 'Washington', '49055': 'Wayne', '49057': 'Weber' };
  Object.keys(FIPS).forEach(function (k) { FIPS_BY_NAME[FIPS[k].toUpperCase()] = k; });

  function looksLikeParcel(t) { return /^[0-9]{2}[- ]?[0-9]{3}[- ]?[0-9]{3,4}$|^[0-9]{8,10}$/.test(String(t).trim().replace(/[ ,]+[A-Za-z ]+ COUNTY$/i, '')); }

  var DIRS = { N: 'N', S: 'S', E: 'E', W: 'W', NORTH: 'N', SOUTH: 'S', EAST: 'E', WEST: 'W' };
  var TYPES = { RD: 'RD', ROAD: 'RD', DR: 'DR', DRIVE: 'DR', ST: 'ST', STREET: 'ST', LN: 'LN', LANE: 'LN', AVE: 'AVE', AVENUE: 'AVE', AV: 'AVE',
    WAY: 'WAY', CIR: 'CIR', CIRCLE: 'CIR', CT: 'CT', COURT: 'CT', BLVD: 'BLVD', PL: 'PL', PLACE: 'PL', HWY: 'HWY', HIGHWAY: 'HWY', TRL: 'TRL',
    TRAIL: 'TRL', LOOP: 'LOOP', PKWY: 'PKWY', PARKWAY: 'PKWY', CV: 'CV', COVE: 'CV', TER: 'TER', XING: 'XING', CROSSING: 'XING', RUN: 'RUN', ROW: 'ROW' };

  // "123 e aspen ridge rd eden, utah 84310" -> {number, pre, name, type, suf, city, zip}
  function parseStreet(address) {
    var s = address.toUpperCase().replace(/\./g, '').replace(/\s+/g, ' ').trim();
    var zip = (/\b(\d{5})(?:-\d{4})?\s*$/.exec(s) || [])[1] || null;
    s = s.replace(/\b\d{5}(-\d{4})?\s*$/, '').replace(/[ ,]+(UT|UTAH)\s*$/, '').replace(/^[ ,]+|[ ,]+$/g, '');
    var parts = s.split(',').map(function (p) { return p.trim(); }).filter(Boolean);
    var tokens = parts[0].split(' '), city = parts.length > 1 ? parts.slice(1).join(' ').replace(/\b(UT|UTAH)\b/g, '').trim() : null;
    if (!/^\d+$/.test(tokens[0] || '')) throw new Error('Start the address with the house number');
    var t = tokens.slice(1), pre = null, suf = null, type = null;
    if (t.length > 1 && DIRS[t[0]]) pre = DIRS[t.shift()];
    // No comma before the city ("123 e aspen ridge rd eden"): words after the last street type or trailing
    // direction are the city. Grid streets end in a direction ("400 S"), named streets in a type ("RIDGE RD").
    if (!city && t.length > 2) {
      for (var i = t.length - 2; i >= 1; i--) {
        if (TYPES[t[i]] || (DIRS[t[i]] && /^\d+$/.test(t[i - 1]))) { city = t.slice(i + 1).join(' '); t = t.slice(0, i + 1); break; }
      }
    }
    // No comma before the city: peel trailing words that aren't part of a street (handled by matching below).
    if (t.length > 1 && DIRS[t[t.length - 1]]) suf = DIRS[t.pop()];
    if (t.length > 1 && TYPES[t[t.length - 1]]) type = TYPES[t.pop()];
    return { number: tokens[0], pre: pre, name: t.join(' '), words: t, type: type, suf: suf, city: city || null, zip: zip };
  }

  async function zipsForPlace(name) {
    if (!name) return [];
    try {
      var f = await arcgisQuery(UGRC + '/UtahZipCodeAreas/FeatureServer/0', { where: "UPPER(NAME) = '" + name.replace(/'/g, '') + "'", outFields: 'ZIP5' });
      return f.map(function (z) { return String(z.attributes.ZIP5); });
    } catch (e) { return []; }
  }

  function ambiguous(msg, options) { return Object.assign(new Error(msg), { notFound: true, ambiguous: true, options: options }); }

  async function locate(query) {
    query = String(query || '').trim();
    var countyHint = null;
    var m = /^(.*?)[ ,]+(\w[\w ]*?) COUNTY$/i.exec(query);
    if (m && FIPS_BY_NAME[m[2].toUpperCase()]) { countyHint = FIPS[FIPS_BY_NAME[m[2].toUpperCase()]]; query = m[1]; }
    if (looksLikeParcel(query)) {
      if (countyHint) return findByParcel(query, countyHint);
      // Search every county; parcel-number formats overlap, so ask when more than one county has the ID.
      var all = [];
      for (var j = 0; j < COUNTIES.length; j += 8) {
        var got = await Promise.all(COUNTIES.slice(j, j + 8).map(function (c) { return findByParcel(query, c).catch(function () { return null; }); }));
        all = all.concat(got.filter(Boolean));
      }
      if (!all.length) throw Object.assign(new Error('No parcel ' + query + ' found in Utah county records'), { notFound: true });
      if (all.length > 1) throw ambiguous('Parcel ' + query + ' exists in ' + all.map(function (p) { return p.county; }).join(' and ') + ' counties. Enter the street address instead, or add the county (for example "' + query + ' ' + all[0].county + '").',
        all.map(function (p) { return {label: p.county + ' County · parcel ' + p.id, query: p.id + ' ' + p.county + ' County'}; }));
      return all[0];
    }

    var a = parseStreet(query);
    // 1. Statewide address points: the authoritative way to place a Utah address (they carry city, ZIP and county).
    var where = ["AddNum='" + a.number + "'", "UPPER(StreetName) LIKE '" + a.words[0].replace(/'/g, '') + "%'"];
    if (a.pre) where.push("PrefixDir='" + a.pre + "'");
    if (a.suf) where.push("SuffixDir='" + a.suf + "'");
    var pts = [];
    try { pts = await arcgisQuery(UGRC + '/UtahAddressPoints/FeatureServer/0', { where: where.join(' AND '), outFields: 'FullAdd,StreetName,City,ZipCode,CountyID', returnGeometry: true }); }
    catch (e) { pts = []; }
    pts = pts.filter(function (f) { var sn = String(f.attributes.StreetName || '').toUpperCase(); return a.words.every(function (w) { return sn.indexOf(w) >= 0; }) || sn === a.name; });
    var pick = pts;
    if (a.zip) pick = pick.filter(function (f) { return String(f.attributes.ZipCode) === a.zip; });
    if (!a.zip && a.city) {
      var c = a.city.toUpperCase(), byCity = pick.filter(function (f) { return String(f.attributes.City || '').toUpperCase().indexOf(c) === 0; });
      if (!byCity.length) { var zs = await zipsForPlace(c); byCity = pick.filter(function (f) { return zs.indexOf(String(f.attributes.ZipCode)) >= 0; }); }
      pick = byCity;
    }
    if (countyHint) pick = pick.filter(function (f) { return FIPS[f.attributes.CountyID] && FIPS[f.attributes.CountyID].toUpperCase() === countyHint.toUpperCase(); });
    // Same address can have several points (units); collapse to distinct places.
    var places = [], seen = {};
    pick.forEach(function (f) {
      var base = String(f.attributes.FullAdd || '').replace(/\s+(APT|UNIT|STE|SUITE|#|BLDG|LOT|SP|TRLR)\b.*$/i, '');
      var k = f.attributes.CountyID + '|' + f.attributes.ZipCode + '|' + base;
      if (!seen[k]) { seen[k] = 1; f.attributes.FullAdd = base; places.push(f); }
    });
    if (places.length === 1 || (places.length > 1 && places.every(function (f) { return f.attributes.CountyID === places[0].attributes.CountyID && f.attributes.ZipCode === places[0].attributes.ZipCode; }))) {
      var g = places[0];
      return parcelAtPoint(FIPS[g.attributes.CountyID], g.geometry.x, g.geometry.y);
    }
    if (places.length > 1) {
      var opts = places.slice(0, 12).map(function (f) { return f.attributes.FullAdd + ', ' + (f.attributes.City ? title(f.attributes.City) + ' ' : '') + f.attributes.ZipCode + ' (' + FIPS[f.attributes.CountyID] + ' County)'; });
      throw ambiguous('"' + query + '" matches ' + places.length + ' places in Utah. Add the city or ZIP code, for example "' + opts[0].replace(/ \(.*$/, '') + '".', opts);
    }
    // A postal label mismatch is not proof that the address is absent. County situs
    // records can corroborate the address within the requested ZIP's county.

    // 2. Fallback for brand-new lots not yet in the address points: county parcel addresses, limited to the hinted county
    //    (from the ZIP/city) when there is one, and never silently picking one of several matches.
    var zips = a.zip ? [a.zip] : await zipsForPlace(a.city);
    var counties = countyHint ? [countyHint] : COUNTIES;
    if (zips.length && !countyHint) {
      try {
        // ZIP polygons can extend across mountains and county lines. Their vertex
        // average is not an address location (Eden's average falls in Cache County).
        // COUNTYNBR is Utah's alphabetical county code, not the federal FIPS code.
        var za = await arcgisQuery(UGRC + '/UtahZipCodeAreas/FeatureServer/0', { where: "ZIP5 IN ('" + zips.join("','") + "')", outFields:'COUNTYNBR' });
        var ordered = COUNTIES.slice().sort(), zipCounties = [];
        za.forEach(function(z){var cn=ordered[Number(z.attributes.COUNTYNBR)-1];if(cn&&zipCounties.indexOf(cn)<0)zipCounties.push(cn);});
        if (zipCounties.length) counties = zipCounties;
      } catch (e) {}
    }
    var hits = [];
    for (var k = 0; k < counties.length; k += 8) {
      var res = await Promise.all(counties.slice(k, k + 8).map(async function (cn) {
        var feats = await arcgisQuery(lirUrl(cn), { where: "PARCEL_ADD LIKE '" + a.number + " %'", outFields: 'PARCEL_ID,PARCEL_ADD,PARCEL_CITY' }).catch(function () { return []; });
        return feats.filter(function (f2) {
          var ad = String(f2.attributes.PARCEL_ADD || '').replace(/\s+(APT|UNIT|STE|SUITE|#|BLDG|LOT|SP|TRLR)\b.*$/i, '');
          try { var pa = parseStreet(ad); return pa.number === a.number && pa.name === a.name &&
            (!a.pre || pa.pre === a.pre) && (!a.suf || pa.suf === a.suf) && (!a.type || pa.type === a.type); }
          catch (e) { return false; }
        })
          .map(function (f2) { return { county: cn, id: f2.attributes.PARCEL_ID, add: f2.attributes.PARCEL_ADD, city: f2.attributes.PARCEL_CITY }; });
      }));
      hits = hits.concat([].concat.apply([], res));
    }
    if (hits.length === 1) {
      var matched = await findByParcel(hits[0].id, hits[0].county);
      if (pts.length && (a.zip || a.city)) matched.addressMatchNote = 'Address confirmed from the county parcel situs record. The statewide address-point postal label differs from the supplied city or ZIP; it was not used to reject this county-confirmed match.';
      return matched;
    }
    if (hits.length > 1) throw ambiguous('"' + query + '" matches ' + hits.length + ' parcels. Add the city or ZIP code, or enter the parcel ID.',
      hits.slice(0, 12).map(function (h) { return {label:h.add + ', ' + (h.city || '') + ' (' + h.county + ' County, parcel ' + h.id + ')',query:h.id+' '+h.county+' County'}; }));
    // A county street-range geocode is only a discovery hint, never proof of a lot's identity.
    // Vacant lots may have no situs address at all; require a parcel-ID confirmation.
    if (counties.length === 1 && counties[0] === 'Weber') {
      var nearby = [];
      try {
        var street = [a.number, a.pre, a.name, a.type, a.suf].filter(Boolean).join(' ');
        var geo = await fetchJSON(WEBER + '/SDE_composite_geocode/GeocodeServer/findAddressCandidates', {form:{f:'json',SingleLine:street,outFields:'*',outSR:4326}});
        var candidates = (geo.candidates || []).filter(function (c) {
          var v = c.attributes || {};
          return c.score >= 95 && v.AddNum === a.number && String(v.StName).toUpperCase() === a.name &&
            (!a.pre || v.StPreDir === a.pre) && (!a.suf || v.StDir === a.suf) &&
            (!a.type || v.StType === a.type) && ['PointAddress','StreetAddress'].indexOf(v.Addr_type) >= 0;
        });
        // Conflicting locations are not a reliable basis for nearby suggestions.
        if (candidates.length && candidates.every(function(c){return distPts(c.location.x,c.location.y,candidates[0].location.x,candidates[0].location.y)<10;})) {
          nearby = await arcgisQuery(lirUrl('Weber'), {geometry:candidates[0].location,distance:60,outFields:'PARCEL_ID,PARCEL_ADD,PARCEL_ACRES,SUBDIV_NAME'});
        }
      } catch (e) { nearby = []; }
      if (nearby.length && nearby.length <= 12) throw ambiguous('This address is missing from parcel records. These parcels are near an approximate street location—not confirmed address matches. Compare the parcel ID with your listing or deed, then select it and generate the dossier.',
        nearby.map(function(f){var v=f.attributes;return {label:'Parcel '+v.PARCEL_ID+' · '+v.PARCEL_ACRES+' acres'+(v.SUBDIV_NAME?' · '+v.SUBDIV_NAME:'')+(v.PARCEL_ADD?' · '+v.PARCEL_ADD:''),query:v.PARCEL_ID+' Weber County'};}));
    }
    if (pts.length && (a.zip || a.city)) throw Object.assign(new Error('The statewide address record has a different city or ZIP, and no matching county parcel address could be confirmed for \"' + query + '\"'), {notFound:true});
    throw Object.assign(new Error('No parcel found for "' + query + '"'), { notFound: true });
  }

  /* ------------------------------------------------------------ checks */
  function F(section, item, status, headline, detail, source, url, cost, next) {
    return { section: section, item: item, status: status, headline: headline, detail: detail || '', source: source || null,
      url: url || null, cost: cost || null, next_step: next || null };
  }
  function fmt(n) { return Math.round(n).toLocaleString('en-US'); }
  function area(ctx, url, o) { return arcgisQuery(url, Object.assign({ geometry: ctx.parcel.geometry }, o || {})); }
  function title(s) {
    // Title-case, but keep short all-caps acronyms (IFD, PID, CRA) as they are.
    return String(s).split(/(\s+)/).map(function (w) { return /^[A-Z]{2,3}$/.test(w) && !/^(OF|AND|THE|NO)$/.test(w) ? w : w.toLowerCase().replace(/\b\w/g, function (c) { return c.toUpperCase(); }); }).join('');
  }

  async function weberIdentify(ctx, service, layers) {
    var p = ctx.parcel;
    var d = await fetchJSON(WEBER + '/' + service + '/MapServer/identify', { params: {
      geometry: p.cx + ',' + p.cy, geometryType: 'esriGeometryPoint', sr: 4326, layers: 'all:' + layers.join(','), tolerance: 1,
      mapExtent: [p.cx - .01, p.cy - .01, p.cx + .01, p.cy + .01].join(','), imageDisplay: '800,600,96', returnGeometry: 'false', f: 'json' } });
    return d.results || [];
  }
  function coverage(ctx, feats) {
    if (!ctx.grid.length) return 0;
    var hit = ctx.grid.filter(function (pt) { return feats.some(function (f) { return f.geometry && inRings(pt[0], pt[1], f.geometry.rings); }); }).length;
    return hit / ctx.grid.length;
  }

  var C = {};

  C.check_parcel = async function (ctx) {
    var a = ctx.parcel.attrs, lotSf = ringArea(ctx.parcel.rings[0], ctx.lat0) * FT_PER_M * FT_PER_M, d = dimsFt(ctx.parcel.rings);
    ctx.facts.lot_sf = lotSf; ctx.facts.lot_dims = d;
    var bits = [a.PARCEL_ACRES + ' acres (' + fmt(lotSf) + ' sq ft by boundary)', "roughly " + Math.round(d[0]) + "' x " + Math.round(d[1]) + "'"];
    if (a.PROP_CLASS) bits.push('assessor class: ' + a.PROP_CLASS);
    if (a.SUBDIV_NAME) bits.push('subdivision: ' + a.SUBDIV_NAME);
    var status = 'ok', extra = '';
    if (a.BLDG_SQFT || a.BUILT_YR) { status = 'watch'; extra = ' Assessor shows an existing structure (' + a.BLDG_SQFT + ' sq ft, built ' + a.BUILT_YR + '): demolition or remodel may apply.'; }
    return [F('land', 'Parcel', status, 'Parcel ' + ctx.parcel.id + ', ' + (a.PARCEL_ADD || 'no situs address'), bits.join('; ') + '.' + extra + (ctx.parcel.addressMatchNote ? ' ' + ctx.parcel.addressMatchNote : ''),
      'UGRC statewide parcels (LIR)', a.ASSESSOR_SRC)];
  };

  C.weber_assessor = async function (ctx) {
    if (ctx.parcel.county !== 'Weber') return [];
    var f = await arcgisQuery(WEBER + '/gis/OpenGov_Layers/MapServer/9', { where: "PARCEL_ID='" + ctx.parcel.id + "'",
      outFields: 'PARCEL_ID,TOT_MARKET,PROP_DESC,SUB_PHASE,NAME_ONE,TaxYear' });
    if (!f.length) return [];
    var a = f[0].attributes; ctx.facts.prop_desc = a.PROP_DESC || ''; ctx.facts.assessed = a.TOT_MARKET; ctx.facts.owner = (a.NAME_ONE || '').trim();
    return [F('land', 'Assessor', 'ok', a.TaxYear + ' assessed market value $' + fmt(a.TOT_MARKET || 0),
      'Owner of record: ' + (a.NAME_ONE || '').trim() + '. Property type: ' + a.PROP_DESC + '. Plat: ' + a.SUB_PHASE +
      '. Assessed value lags the market; use it to sanity-check asking price, not as an appraisal. The county parcel page lists recorded documents and links the subdivision plat images.',
      'Weber County parcel record', 'https://webercountyutah.gov/parcelsearch/ownership-info.php?id=' + encodeURIComponent(ctx.parcel.id))];
  };

  /* Researched jurisdiction facts (public ordinances, minutes and fee schedules), so the dossier can state them instead
   * of saying "call the city". Each entry carries its sources and an as-of date; extend this table as jurisdictions are added. */
  var JURIS = {
    'Ogden Valley City': {
      asOf: 'Nov 2026',
      permits: 'Ogden Valley City issues residential building permits. Plan review and inspections are contracted to Beacon Code Consultants (Resolution 2026-24, May 5, 2026); permits Weber County opened before then stay with the county at county fees.',
      landUse: "Ogden Valley City Land Use Code (adopted April-October 2026). It replaces Weber County's land use Titles 101-110 inside city limits (LUC 101-1-2), reusing the county's chapter numbers.",
      portal: 'http://utah.cityinspect.com/register?registration_id=Pg3vQmmIh7',
      planning: 'https://ogdenvalley.gov/planning/',
      submittal: 'https://ogdenvalley.gov/wp-content/uploads/2026/09/OgdenValley_PermitSubmissionRequirements.pdf',
      code: 'https://ogdenvalley.gov/land-use/',
      impact: [['Roads', 4512.14, 'Ord. 2026-19'], ['Trails', 3101.97, 'Ord. 2026-19'], ['Storm drain (per ESU)', 1575.78, 'Ord. 2026-19']],
      impactSrc: 'https://ogdenvalley.gov/wp-content/uploads/2026/04/Ordinance-2026-19-Impact-Fees-FINAL.pdf',
      fireImpact: [704, 'Weber Fire District public safety impact fee, Resolution 16-2025, adopted Sept 23, 2025 ($704 per residential unit)', 'https://www.utah.gov/pmn/files/1336665.pdf'],
      designReview: 'City design review (LUC 108-1) applies to commercial, resort, public and larger multifamily projects, not single-family homes. Single-family standards (108-15) require only a permanent foundation and code compliance; no roof pitch or eave minimums.',
      lighting: 'Outdoor lighting ordinance (LUC 108-16) applies to new homes: fully shielded, downward fixtures, 3000K or warmer, lights off by 10 pm (fixtures of 105 lumens or less exempt), and a lighting plan at permit.',
      septicZones: 'Septic is prohibited in drinking water source protection Zones 1 and 2 (LUC 108-18-6).',
      turf: { rule: 'Irrigated turf is capped at 35% of the front and side yards or 3,000 sq ft of the lot, whichever is greater, with no turf in park strips or yard areas under 8 ft wide.', cite: 'LUC 108-7-12', url: 'https://ogdenvalley.gov/land-use/' },
      stormwater: { esuSqft: 6200, esuFee: 1575.78, cityPermit: 'A city stormwater permit is required for land disturbance over 500 sq ft or more than 20 cubic yards of cut and fill (City Code Ch. 6.15, Ord. 2026-51).',
        esuNote: '1 ESU = 6,200 sq ft of impervious surface per the storm drain impact fee analysis (draft, March 2026)', url: 'https://ogdenvalley.gov/wp-content/uploads/2026/04/OgdenValleyCity_StormDrainIFFP_Draft-1.pdf' },
      fireDistrict: 'Weber Fire District',
      swpppTemplate: 'https://ogdenvalley.gov/wp-content/uploads/2026/09/CPP_SWPPP_Template.pdf',
      excavation: 'Apply in the same City Inspect portal; excavation permit fees are set by Resolution 2026-34.',
      wui: 'Weber Fire District adopted the 2024 International Wildland-Urban Interface Code as amended by Utah (Resolution 23-2026, June 11, 2026). It applies in designated WUI areas, not valley-wide; no local designation map had been published as of Nov 2026.',
      zones: {
        'AV-3': { name: 'Agricultural Valley', cite: 'LUC 104-2-5', area: '3 acres', width: 150, front: 30, side: 10, sideTotal: 24, rear: 30, height: 35 },
        'FV-3': { name: 'Forest Valley', cite: 'LUC 104-14-5', area: '3 acres', width: 150, front: 30, side: 20, rear: 30, height: 35 },
        'RE-15': { name: 'Residential Estates', cite: 'LUC 104-3', area: '15,000 sq ft', width: 100, front: 30, side: 10, sideTotal: 24, rear: 30, height: 35 },
        'RE-20': { name: 'Residential Estates', cite: 'LUC 104-3', area: '20,000 sq ft', width: 100, front: 30, side: 10, sideTotal: 24, rear: 30, height: 35 },
        'F-5': { name: 'Forest', cite: 'LUC 104-9-5', area: '5 acres', width: 300, front: 30, side: 20, rear: 30, height: null }
      },
      // Development agreements that change fees for a specific developer's permits.
      feeAgreements: [{ match: /EDEN VALLEY OPPORTUNITY|\bEVO\b/i, name: 'Eden Valley Opportunity (EVO)',
        text: 'Resolution 2026-25 (Development Mitigation Contribution and Impact Fee Lock Agreement, adopted May 19, 2026, 4-1) lets EVO pay impact fees at the lower Weber County rate on its building permits, in exchange for a mitigation contribution to the city. EVO had 19 building permits pending when it was negotiated, and the council discussed a cap or sunset.',
        src: 'https://www.utah.gov/pmn/files/1452527.pdf' }],
      // Records the dossier relies on and the fee actions already reviewed (config/records.json, shared with the weekly agenda watch).
      records: ((root.LR_DATA || {}).records || {})['Ogden Valley City'],
      permitFees: { adopted: 'Resolution 2026-28, adopted May 5, 2026', src: 'https://www.utah.gov/pmn/files/1438293.pdf',
        note: 'The schedule itself is not posted online. Council minutes (May 4, 2026 work session) say the residential plan review fee is higher than Weber County\'s but not the maximum allowed.' },
      sources: ['https://www.utah.gov/pmn/files/1438293.pdf', 'https://ogdenvalley.gov/about-ogden-valley-city/']
    }
  };
  // Who approves plans and how to reach the jurisdiction, from each jurisdiction's own published pages. Role-based.
  var CONTACTS = {
    'Ogden Valley City': {
      asOf: 'Nov 2026', source: 'https://ogdenvalley.gov/planning/',
      office: { name: 'Ogden Valley City', lines: ['City office: Maintenance Building, 167 S 7500 E, Huntsville, UT 84317', 'Mail: PO Box 6, Eden, UT 84310', 'Hours: Mon and Wed 9 am to 1 pm, Thu 1 to 5 pm'], url: 'https://ogdenvalley.gov/' },
      building: { name: 'Building department (Beacon Code Consultants, for the city)', approver: "the city's building official at Beacon Code Consultants",
        people: [{ role: 'Building official (plan approval)', email: 'tyler@beaconinspected.com' }, { role: 'Permit technician', phone: '801-726-1606', email: 'robyn@beaconinspected.com' },
          { role: 'Inspection scheduling', phone: '801-564-0897', email: 'beaconcodeconsultants@gmail.com' }],
        lines: ['Apply online through City Inspect', 'Permit mail and payments: Attn: Building Department, PO Box 6, Eden, UT 84310'], portal: 'http://utah.cityinspect.com/register?registration_id=Pg3vQmmIh7' },
      planning: { name: 'Planning & zoning', people: [{ role: 'City planner (JUB Engineering)', email: 'planning@ogdenvalley.gov' }], url: 'https://ogdenvalley.gov/planning/' }
    },
    'Unincorporated Weber County': {
      asOf: 'Nov 2026', source: 'https://www.webercountyutah.gov/inspection/',
      office: { name: 'Weber County', lines: ['Weber Center, 2380 Washington Blvd, Ogden, UT 84401'], url: 'https://www.webercountyutah.gov/' },
      building: { name: 'Weber County Building Inspection Division', approver: "the Weber County Building Inspection Division",
        people: [{ role: 'Building Inspection (plan review and permits)', phone: '801-399-8770' }],
        lines: ['2380 Washington Blvd, Suite 270, Ogden, UT 84401', 'Hours: Mon to Fri 8 am to 5 pm', 'Apply online through the county OpenGov portal'], portal: 'https://countyofweberut.portal.opengov.com/' },
      planning: { name: 'Weber County Planning Division', people: [{ role: 'Planning (zoning and land use)', phone: '801-399-8374' }], lines: ['2380 Washington Blvd, Suite 240, Ogden, UT 84401'], url: 'https://www.webercountyutah.gov/planning/' }
    }
  };

  // ICC Building Valuation Data, August 2026 (Type VB wood frame). Weber County values permits on the latest table.
  var BVD = { asOf: 'August 2026', r3: 177.63, garage: 71.79, unfinishedBasement: 31.50, src: 'https://www.iccsafe.org/wp-content/uploads/BVD-BSJ-AUG2026.pdf' };
  // Weber County building permit fee (County Code 12-3-6) by total valuation.
  function weberPermitFee(v) {
    var k = function (base, rate, from) { return base + rate * Math.ceil((v - from) / 1000); };
    if (v <= 2000) return 69.25;
    if (v <= 25000) return k(69.25, 14, 2000);
    if (v <= 50000) return k(391.75, 10.10, 25000);
    if (v <= 100000) return k(643.75, 7, 50000);
    if (v <= 500000) return k(993.75, 5.60, 100000);
    if (v <= 1e6) return k(3233.75, 4.75, 500000);
    return k(5608.75, 3.65, 1e6);
  }
  // Building permit + plan review (35%, 12-3-8) + electrical/plumbing/mechanical + 1% state surcharge on the permit fee.
  function weberBuildingFees(houseSf, garageSf) {
    var val = houseSf * BVD.r3 + (garageSf || 0) * BVD.garage, permit = weberPermitFee(val);
    return { valuation: val, permit: permit, planReview: permit * 0.35, trades: 350, surcharge: permit * 0.01, total: permit * 1.36 + 350 };
  }

  var HEALTH = {
    'Weber-Morgan': {
      reg: 'https://webermorganhealth.gov/wp-content/uploads/sites/60/2023/05/Onsite-Wastewater-Treatment-Systems-Regulation.pdf',
      fees: 'https://webermorganhealth.gov/wp-content/uploads/2026/07/WMHD-2026-Fee-Schedule.pdf',
      rules: 'Weber-Morgan rules (state R317-4 plus local amendments): at least 20,000 sq ft of contiguous buildable area under 25% slope on public water (1-1.75 acres on a private well); in Ogden Valley soils percolating faster than 5 min/inch need a packed-bed media system; mound and packed-bed systems need an annual operating permit; feasibility letters expire after 18 months.',
      feeText: 'Fees (July 2026): site evaluation $250 per test hole; permit $415 conventional, $440 deep trench, $890 mound/packed bed, $990 at-grade (each including the $40 state fee).',
      evalCost: 250
    }
  };

  async function weberDistricts(ctx) {
    if (ctx.facts.districts) return ctx.facts.districts;
    var p = ctx.parcel, names = [];
    try {
      var d = await fetchJSON(WEBER + '/tax_entities/tax_entities/MapServer/identify', { params: {
        geometry: p.cx + ',' + p.cy, geometryType: 'esriGeometryPoint', sr: 4326, layers: 'all', tolerance: 0,
        mapExtent: [p.cx - .01, p.cy - .01, p.cx + .01, p.cy + .01].join(','), imageDisplay: '800,600,96', returnGeometry: 'false', f: 'json' } });
      names = Array.from(new Set((d.results || []).map(function (r) { return r.layerName.replace(/_+/g, ' ').replace(/\s+-\s+/g, ' - ').trim(); })));
    } catch (e) { names = []; }
    ctx.facts.districts = names;
    return names;
  }

  C.check_jurisdiction = async function (ctx) {
    var f = await arcgisQuery(UGRC + '/UtahMunicipalBoundaries/FeatureServer/0', { geometry: ctx.parcel.point });
    if (!f.length) {
      ctx.facts.jurisdiction = 'Unincorporated ' + ctx.parcel.county + ' County';
      return [F('land', 'Jurisdiction', 'ok', ctx.facts.jurisdiction, 'Zoning, permits and inspections run through the county.', 'UGRC municipal boundaries')];
    }
    var name = f[0].attributes.NAME; ctx.facts.jurisdiction = name;
    var j = JURIS[name]; ctx.facts.kb = j || null;
    if (j) return [F('land', 'Jurisdiction', 'ok', name + ': permits and land use run through the city',
      j.permits + ' Land use: ' + j.landUse + ' (as of ' + j.asOf + ')', name + ' planning & permits', j.planning)];
    return [F('land', 'Jurisdiction', 'ok', name, 'Zoning, building permits and inspections run through ' + name + '.', 'UGRC municipal boundaries')];
  };

  var ZONES = { 'FB': 'Form-Based Zone', 'FV-3': 'Forest Valley (3 ac)', 'AV-3': 'Agricultural Valley (3 ac)', 'F-5': 'Forest (5 ac)',
    'F-40': 'Forest (40 ac)', 'RE-15': 'Residential Estates', 'RE-20': 'Residential Estates', 'CVR-1': 'Commercial Valley Resort Recreation',
    'DRR-1': 'Destination & Recreation Resort' };
  C.check_zoning = async function (ctx) {
    if (ctx.parcel.county === 'Weber') {
      var f = await arcgisQuery(WEBER + '/gis/City_Zoning/MapServer/2', { geometry: ctx.parcel.point });
      if (f.length) {
        var a = f[0].attributes, zone = a.ZONE_NAME; ctx.facts.zone = zone;
        var detail = 'Zoning sets setbacks, height, lot coverage and allowed uses.';
        if (zone === 'FB') detail += ' Form-based zones regulate building form (frontage, massing, materials) more tightly than standard residential zones, so expect more design constraints and possibly a design review step.';
        var watch = zone === 'FB' || /^(CV|DRR)/.test(zone || '');
        var kb = ctx.facts.kb, zs = kb && kb.zones && kb.zones[zone], out = [];
        if (zs) {
          ctx.facts.zone_std = { zone: zone, front: zs.front, side: zs.side, totalSide: zs.sideTotal || null, source: kb.code, sourceSection: zs.cite, rear: zs.rear, height: zs.height, coverage: null };
          out.push(F('land', 'Zoning', 'ok', zone + ' ' + zs.name + ': ' + zs.front + "' front, " + zs.side + "' side" + (zs.sideTotal ? ' (' + zs.sideTotal + "' both sides)" : '') + ', ' + zs.rear + "' rear" + (zs.height ? ', ' + zs.height + "' max height" : ''),
            'Base standards from the ' + ctx.facts.jurisdiction + ' Land Use Code (' + zs.cite + '): minimum lot ' + zs.area + ', ' + zs.width + "' minimum width. No lot-coverage cap for the main house in this zone. (as of " + kb.asOf + ')',
            ctx.facts.jurisdiction + ' Land Use Code', kb.code));
          if (ctx.parcel.attrs.SUBDIV_NAME) out.push(F('land', 'Plat setbacks', 'verify', 'Subdivision plat may override the base setbacks',
            'Planned and master-planned subdivisions often set their own setbacks and building envelopes in plat notes or a development agreement, and those govern over the base zone. The plat images are linked from the county parcel page.',
            'County parcel record (plat images)', ctx.parcel.county === 'Weber' ? 'https://webercountyutah.gov/parcelsearch/ownership-info.php?id=' + encodeURIComponent(ctx.parcel.id) : null, null,
            'Read the setback note on the recorded plat and use it for the site plan.'));
          return out;
        }
        if (kb && zone === 'FB') detail += ' Note: the FB zone is not part of ' + ctx.facts.jurisdiction + "'s adopted land use code; the zoning map layer may be out of date.";
        return [F('land', 'Zoning', watch ? 'watch' : 'ok', zone + ' (' + (ZONES[zone] || a.ASSES_GROU || 'see code') + ')', detail,
          'Weber County GIS: City Zoning', kb ? kb.code : (a.link || null), null, 'Pull setbacks, height limit and coverage for zone ' + zone + ' and check them against the site plan.')];
      }
    }
    var g = await arcgisQuery(UGRC + '/planning_generalized_zoning/FeatureServer/1', { geometry: ctx.parcel.point });
    if (g.length) return [F('land', 'Zoning', 'verify', 'Generalized zoning layer found', 'Statewide generalized zoning only; confirm with the city or county zoning map.', 'UGRC generalized zoning')];
    return [F('land', 'Zoning', 'verify', 'No zoning layer for this jurisdiction', 'Utah has no statewide zoning layer. Look this up on the city/county zoning map.',
      null, null, null, 'Get the zoning district and its setbacks, height and coverage limits.')];
  };

  C.check_water = async function (ctx) {
    var out = [], cul = await area(ctx, UGRC + '/UtahWaterServiceAreas/FeatureServer/0');
    if (cul.length) {
      var a = cul[0].attributes; ctx.facts.culinary = a.WRNAME;
      out.push(F('water', 'Culinary water', 'watch', 'Inside ' + a.WRNAME + ' service area' + (a.ENDYEAR ? ' (mapped ' + a.ENDYEAR + ')' : ''),
        'A public water system serves this area, so a well may not be needed. Being inside a service area does not guarantee a connection: get a will-serve letter and the connection fee or share requirement. Small mutual water companies often require buying shares.' +
        (a.ENDYEAR && a.ENDYEAR < 2020 ? ' This service-area map dates from ' + a.ENDYEAR + '; newer subdivisions are sometimes served by a different system under their development approval, so check the plat notes.' : ''),
        'Utah Division of Water Rights: water service areas', a.WRLINK, ctx.cost('culinary_connection'), 'Request a will-serve letter and fee/share cost from ' + a.WRNAME + '.'));
    } else {
      out.push(F('water', 'Culinary water', 'verify', 'No public water system mapped; supply unverified',
        'The service-area dataset does not establish whether this lot has an existing connection, a private or mutual system, or needs a well. Confirm the source and service entitlement before selecting a water-supply design.',
        'Utah Division of Water Rights: water service areas', 'https://www.waterrights.utah.gov/', ctx.cost('well'), 'Have a water rights consultant confirm a source before closing.'));
    }
    var sec = await area(ctx, UGRC + '/Utah_DNR_Secondary_Water_Systems/FeatureServer/0');
    if (sec.length) {
      var s = sec[0].attributes;
      out.push(F('water', 'Secondary (irrigation) water', 'watch', s.SYSTEMNAME,
        'A secondary or pressurized irrigation system covers this lot. Landscaping may need to be irrigated from it, and shares or assessments may convey with the lot.',
        'Utah DNR secondary water systems', s.WRLINK, null, 'Confirm whether irrigation shares come with the lot.'));
    }
    var pou = await area(ctx, UTAH_AGO + '/Utah_Place_of_Use_Irrigation/FeatureServer/0').catch(function () { return []; });
    if (pou.length) {
      var wr = Array.from(new Set([].concat.apply([], pou.map(function (f) { return String(f.attributes.WRNUMS || '').trim().split(/[\s,]+/); })).filter(Boolean)));
      var ac = Math.max.apply(0, pou.map(function (f) { return +f.attributes.ACRES || 0; }));
      ctx.facts.irrigation_rights = wr;
      out.push(F('water', 'Irrigation water right', 'watch', 'Lot is inside the place of use for water right' + (wr.length > 1 ? 's ' : ' ') + wr.slice(0, 4).join(', '),
        'The Division of Water Rights maps this land as irrigated under ' + (wr.length > 1 ? 'these rights' : 'this right') + (ac ? ' (a ' + fmt(ac) + '-acre service area, typical of an irrigation company)' : '') +
        '. Water for landscaping comes through shares in the company that holds the right, so confirm whether shares are deeded with the lot.',
        'Utah Division of Water Rights: irrigation places of use', pou[0].attributes.dbURL || 'https://www.waterrights.utah.gov/',
        null, 'Ask the seller for the irrigation share certificate, or confirm in the purchase contract that shares convey.'));
    }
    var pods = await arcgisQuery(UTAH_AGO + '/Utah_Points_of_Diversion/FeatureServer/0', { geometry: ctx.parcel.point, distance: 800 });
    var wells = pods.map(function (p) { return p.attributes; }).filter(function (p) { return p.TYPE === 'Underground'; });
    if (pods.length) {
      var rights = Array.from(new Set(wells.map(function (w) { return w.WRNUM; }))).sort().slice(0, 6);
      out.push(F('water', 'Nearby water rights', cul.length ? 'ok' : 'watch', pods.length + ' points of diversion within 800 m (' + wells.length + ' wells)',
        "Nearby wells show groundwater is reachable here; their water rights show what's typical for the area. Sample rights: " + (rights.join(', ') || 'none') + '.',
        'Utah Division of Water Rights: points of diversion', 'https://maps.waterrights.utah.gov/EsriMap/map.asp'));
    }
    var lu = await area(ctx, UGRC + '/WaterRelatedLandUse/FeatureServer/0');
    var irr = lu.map(function (f) { return f.attributes; }).filter(function (a) { return /^Active IR/.test(a.LU_Group || ''); });
    if (irr.length) out.push(F('water', 'Irrigated land', 'watch', 'Mapped as irrigated ' + (irr[0].Description || '').toLowerCase() + ' (' + irr[0].SURV_YEAR + ' survey)',
      'Land that is still irrigated usually has water rights or shares attached. Find out whether they convey with the lot or were reserved by the seller or developer.', 'Utah DNR water-related land use'));
    return out;
  };

  C.check_landslides = async function (ctx) {
    var feats = [];
    for (var n of ['LandslideCompilationPolygons', 'LandslideInventoryPolygons']) feats = feats.concat(await area(ctx, UGRC + '/' + n + '/FeatureServer/0', { returnGeometry: true }));
    if (!feats.length) return [F('geo', 'Landslides', 'ok', 'No mapped landslides on the lot', 'Mapping is regional; a site geotech report still governs.', 'UGS landslide compilation via UGRC')];
    var cov = coverage(ctx, feats); ctx.facts.landslide_cov = cov; ctx.facts.landslide_unit = feats[0].attributes.LSUnit;
    var a = feats[0].attributes, src = (a.MapName || 'UGS map') + ', ' + (a.Author_s || '') + ' (' + (a.PubDate || 'n.d.') + ')';
    return [F('geo', 'Landslides', 'flag', 'Mapped ' + (a.LSUnit || 'landslide deposit') + ' covers about ' + Math.round(cov * 100) + '% of the lot',
      'Source map: ' + src + ', ' + (a.MapScale || '?') + ' scale. ' + (a.Notes || '') + ' Weber County/Ogden Valley typically requires a geologic hazards study and geotechnical report before permitting on mapped landslides, and the findings can move the building pad or require engineered foundations or drainage.',
      'UGS landslide compilation via UGRC', 'https://geology.utah.gov/apps/hazards/', ctx.cost('geologic_hazards_study'),
      'Order a geologic hazards study and geotech report before closing, or make the purchase contingent on one.')];
  };

  C.check_faults = async function (ctx) {
    var feats = await arcgisQuery(UGRC + '/QuaternaryFaults/FeatureServer/0', { geometry: ctx.parcel.point, distance: 8000, returnGeometry: true });
    if (!feats.length) return [F('geo', 'Active faults', 'ok', 'No Quaternary faults within 5 miles', '', 'UGS Quaternary faults')];
    var best = null;
    feats.forEach(function (f) { var d = distToLines(ctx.parcel.cx, ctx.parcel.cy, f.geometry.paths, ctx.lat0); if (!best || d < best[0]) best = [d, f.attributes]; });
    var ft = best[0] * FT_PER_M, a = best[1], status = ft < 1000 ? 'flag' : ft < 5280 ? 'watch' : 'ok';
    ctx.facts.fault = { ft: ft, name: a.FaultName };
    return [F('geo', 'Active faults', status, a.FaultName + ' is about ' + (ft > 2640 ? (ft / 5280).toFixed(1) + ' mi' : Math.round(ft) + ' ft') + ' from the lot',
      'Age: ' + a.FaultAge + ' years; slip rate ' + a.SlipRate + '; ' + (a.MappingConstraint || '').toLowerCase() + '. Within ~500-1,000 ft of a mapped fault, a surface-fault-rupture study and building setback usually apply.',
      'UGS Quaternary faults via UGRC', a.USGS_Link, status === 'flag' ? ctx.cost('fault_study') : null)];
  };

  C.check_liquefaction_groundwater = async function (ctx) {
    var out = [], liq = await area(ctx, UGRC + '/LiquefactionPotential/FeatureServer/0');
    if (liq.length) {
      // Legend from the 1994 USU/UGS studies (labels published in Utah Division of Emergency Management's copy of this layer):
      // chance of an earthquake strong enough to cause liquefaction within 100 years.
      var LIQ = { 1: ['Very Low', '<5%', 'ok'], 2: ['Very Low to Low', '<5-10%', 'ok'], 3: ['Low', '5-10%', 'ok'], 4: ['Low to Moderate', '5-50%', 'watch'],
        5: ['Moderate', '10-50%', 'watch'], 6: ['Moderate to High', '10->50%', 'flag'], 7: ['High', '>50%', 'flag'], 8: ['Landslide (not rated)', null, 'watch'] };
      var codes = Array.from(new Set(liq.map(function (f) { return f.attributes.PCODE; }))).sort(function (x, y) { return x - y; });
      var rank = { ok: 0, watch: 1, flag: 2 }, worst = codes.map(function (c) { return LIQ[c] || ['Not classified', null, 'watch']; })
        .reduce(function (w, c) { return !w || rank[c[2]] > rank[w[2]] ? c : w; }, null);
      out.push(F('geo', 'Liquefaction', worst[2], worst[0] + ' liquefaction potential' + (worst[1] ? ' (' + worst[1] + ' chance in 100 years)' : ''),
        'Mapped classes on the lot: ' + codes.map(function (c) { return (LIQ[c] || ['code ' + c])[0]; }).join(', ') + '. The 1994 USU/UGS county studies rate the chance of an earthquake strong enough to liquefy saturated sandy soils within 100 years. ' +
        (worst[2] === 'ok' ? 'A low rating reflects the soils and groundwater the 1994 study mapped at regional scale; the site geotechnical report still has to address liquefaction for seismic design category D.' : 'Expect the geotechnical report to test for liquefaction and possibly require ground improvement or deeper foundations.'),
        'UGS/USU liquefaction potential (UGRC; legend via Utah DEM)', 'https://geology.utah.gov/apps/hazards/', worst[2] === 'flag' ? ctx.cost('geotech_mitigation') : null));
    }
    var gw = await area(ctx, UGRC + '/ShallowGroundWater/FeatureServer/0');
    if (gw.length) {
      var depth = Math.min.apply(0, gw.map(function (f) { return f.attributes.DEPTH; }));
      out.push(F('geo', 'Shallow groundwater (regional)', 'watch', 'Regional map shows groundwater within about ' + Math.max(depth, 10) + ' ft',
        'Regional 1:750,000 map, so treat it as a hint only. Shallow groundwater affects basements, footing drains and septic design. See the soil-survey water table under Septic.', 'UGS shallow groundwater via UGRC'));
    }
    return out;
  };

  C.check_flood = async function (ctx) {
    var weber = ctx.parcel.county === 'Weber';
    var feats = await area(ctx, weber ? WEBER + '/gis/OpenGov_Layers/MapServer/14' : UGRC + '/Utah_Floodplains_2017/FeatureServer/0');
    var src = weber ? 'FEMA flood map (2023) via Weber County GIS' : 'FEMA floodplains (2017) via UGRC';
    if (!feats.length) return [F('geo', 'Flood zone', 'verify', 'No FEMA flood mapping found', '', src, 'https://msc.fema.gov/portal/home')];
    var zones = Array.from(new Set(feats.map(function (f) { return f.attributes.FLD_ZONE; }))).sort();
    ctx.facts.sfha = feats.some(function (f) { return f.attributes.SFHA_TF === 'T'; });
    if (ctx.facts.sfha)
      return [F('geo', 'Flood zone', 'flag', 'Part of the lot is in a FEMA Special Flood Hazard Area (' + zones.join(', ') + ')',
        'The house must be elevated or sited outside the floodplain, and flood insurance will be required for financed buyers.', src, 'https://msc.fema.gov/portal/home', ctx.cost('flood_mitigation'))];
    var unknown=zones.indexOf('D')>=0||zones.some(function(z){return !z;});
    return [F('geo', 'Flood zone', unknown?'verify':'watch', 'FEMA Zone ' + zones.join('/') + (unknown?': flood hazard partly undetermined':': review mapped flood subtype'), 'Zone D means undetermined flood hazard. Zone X can be shaded (moderate hazard) or unshaded (minimal hazard); verify the effective panel and subtype before siting improvements. Absence of a mapped Special Flood Hazard Area is not flood clearance.', src, 'https://msc.fema.gov/portal/home')];
  };

  C.check_seismic = async function (ctx) {
    // ASCE 7-16 is the standard the 2021 IRC references (and its USGS endpoint allows browser requests).
    // USGS sends CORS headers to real web origins but not to pages opened from disk (origin "null"), and its CDN can
    // replay a cached copy without them, so each request gets a unique title. If it's blocked, link to the official tool.
    var lat = ctx.parcel.cy.toFixed(5), lon = ctx.parcel.cx.toFixed(5), d;
    try {
      d = (await fetchJSON('https://earthquake.usgs.gov/ws/building-codes/asce7-16/calculate', { params: {
        latitude: lat, longitude: lon, riskCategory: 'II', siteClass: 'D', title: 'lot-' + Date.now().toString(36) }, retries: 2, timeout: 30000 })).response.data;
    } catch (e) {
      return [F('geo', 'Seismic design', 'verify', 'Look up the seismic design category',
        'The USGS seismic service blocks requests from files opened directly from disk; it works when this app is hosted on a website. ' +
        'Along the Wasatch Front and back valleys most lots fall in IRC seismic design category D0-D2, which needs braced-wall and hold-down detailing.',
        'ASCE Hazard Tool', 'https://ascehazardtool.org/?lat=' + lat + '&lng=' + lon, null,
        'Look up SDS for this location (ASCE 7-16, risk category II, site class D) and confirm the seismic design category with the structural engineer.')];
    }
    var sds = d.sds; ctx.facts.sds = sds;
    var irc = sds <= 0.33 ? 'A/B' : sds <= 0.5 ? 'C' : sds <= 0.67 ? 'D0' : sds <= 0.83 ? 'D1' : sds <= 1.25 ? 'D2' : 'E';
    ctx.facts.irc_sdc = irc;
    return [F('geo', 'Seismic design', /^[DE]/.test(irc) ? 'watch' : 'ok', 'IRC seismic design category ' + irc + ' (SDS = ' + sds.toFixed(2) + ' g)',
      "Assumes site class D, the code default, so the geotech's site class may change it. Category D needs braced-wall and hold-down detailing, which is normal along the Wasatch but costs more than low-seismic regions.",
      'USGS seismic design web service (ASCE 7-16)', 'https://earthquake.usgs.gov/ws/building-codes/')];
  };

  async function sda(sql) {
    var d = await fetchJSON(SDA, { json: { query: sql, format: 'JSON+COLUMNNAME' } });
    var t = d.Table || [];
    return t.length ? t.slice(1).map(function (r) { var o = {}; t[0].forEach(function (k, i) { o[k] = r[i]; }); return o; }) : [];
  }

  C.check_soils_septic = async function (ctx) {
    var wkt = 'polygon((' + ctx.parcel.rings[0].map(function (p) { return p[0].toFixed(6) + ' ' + p[1].toFixed(6); }).join(',') + '))';
    var base = "FROM SDA_Get_Mukey_from_intersection_with_WktWgs84('" + wkt + "') k JOIN mapunit mu ON mu.mukey=k.mukey ";
    var comp = "JOIN component c ON c.mukey=mu.mukey AND c.majcompflag='Yes' ";
    var res = await Promise.all([
      sda('SELECT mu.mukey, mu.muname, ma.wtdepannmin, ma.brockdepmin ' + base + 'LEFT JOIN muaggatt ma ON ma.mukey=mu.mukey'),
      sda('SELECT mu.mukey, i.mrulename, i.interphrc ' + base + comp + "JOIN cointerp i ON i.cokey=c.cokey AND i.ruledepth=0 AND i.mrulename IN ('ENG - Septic Tank Absorption Fields','ENG - Dwellings With Basements')"),
      sda('SELECT DISTINCT i.interphrc ' + base + comp + "JOIN cointerp i ON i.cokey=c.cokey AND i.ruledepth=1 AND i.mrulename='ENG - Septic Tank Absorption Fields' AND i.interphr>0.5")
    ]);
    var units = res[0], rules = res[1], reasons = res[2], out = [];
    var names = Array.from(new Set(units.map(function (u) { return u.muname; }))).sort();
    ctx.facts.soils = names;
    var wt = units.map(function (u) { return +u.wtdepannmin; }).filter(Boolean), rock = units.map(function (u) { return +u.brockdepmin; }).filter(Boolean);
    var detail = 'Soil map units: ' + names.join('; ') + '.';
    if (wt.length) { ctx.facts.water_table_in = Math.round(Math.min.apply(0, wt) / 2.54); detail += ' Shallowest seasonal water table: ' + ctx.facts.water_table_in + ' in.'; }
    if (rock.length) detail += ' Shallowest bedrock: ' + Math.round(Math.min.apply(0, rock) / 2.54) + ' in.';
    var order = { 'Not limited': 0, 'Somewhat limited': 1, 'Very limited': 2 };
    var worst = function (xs) { return xs.length ? xs.reduce(function (a, b) { return (order[b] || 0) > (order[a] || 0) ? b : a; }) : null; };
    var baseR = rules.filter(function (r) { return r.mrulename === 'ENG - Dwellings With Basements'; }).map(function (r) { return r.interphrc; });
    var sepR = rules.filter(function (r) { return r.mrulename === 'ENG - Septic Tank Absorption Fields'; }).map(function (r) { return r.interphrc; });
    if (baseR.length) {
      var w = worst(baseR), head = 'Basements rated ' + w.toLowerCase();
      ctx.facts.basement_rating = w;
      if (wt.length && Math.min.apply(0, wt) < 100) {
        head = 'Seasonal water table ~' + ctx.facts.water_table_in + ' in below surface; basements rated ' + w.toLowerCase();
        detail += ' A water table this shallow favors slab or crawlspace foundations, footing drains and raised finish grades. A full basement would need waterproofing and possibly dewatering.';
      }
      out.push(F('geo', 'Soils for foundations', w === 'Not limited' ? 'ok' : 'watch', head, detail,
        'USDA NRCS Soil Survey (SSURGO) via Soil Data Access', 'https://websoilsurvey.nrcs.usda.gov/', ctx.cost('geotech_report')));
    }
    var sewer = null, districts = [], sewerDist = null, finDist = null;
    if (ctx.parcel.county === 'Weber') {
      sewer = (await area(ctx, WEBER + '/gis/OpenGov_Layers/MapServer/13')).length > 0;
      districts = await weberDistricts(ctx);
      sewerDist = districts.filter(function (n) { return /sewer/i.test(n); })[0] || null;
      finDist = districts.filter(function (n) { return /\bIFD\b|\bPID\b|infrastructure|financ/i.test(n); })[0] || null;
      if (sewerDist) sewer = true;
    }
    var health = await arcgisQuery(UGRC + '/HealthDistricts/FeatureServer/0', { geometry: ctx.parcel.point });
    var hdName = health.length ? health[0].attributes.DISTNAME : null, hk = HEALTH[hdName];
    var hd = hdName ? hdName + ' Health Department' : 'the local health department';
    var sw = worst(sepR); ctx.facts.septic = { required: !sewer, rating: sw, hd: hd };
    var reasonTxt = reasons.length ? ' Limiting factors: ' + reasons.map(function (r) { return r.interphrc.toLowerCase(); }).join(', ') + '.' : '';
    if (sewer) {
      ctx.facts.septic.required = false;
      out.push(F('septic', 'Sewer vs. septic', 'watch', sewerDist ? 'Inside ' + sewerDist : 'Inside a mapped sewer service area', 'Sewer service avoids the septic limits on these soils. Confirm the main is reachable from the lot and get the connection/impact fee.',
        sewerDist ? 'Weber County taxing districts' : 'Weber County sewer impact-fee area', null, ctx.cost('sewer_connection')));
    } else if (finDist && ctx.parcel.attrs.SUBDIV_NAME) {
      ctx.facts.septic.required = null;
      out.push(F('septic', 'Sewer vs. septic', 'verify', 'Septic soils are ' + (sw || 'unrated').toLowerCase() + ', but the lot is in ' + title(finDist),
        'No sewer district covers the lot on the county tax map, and the soil survey rates septic fields as ' + (sw || 'unrated').toLowerCase() + '.' + reasonTxt +
        ' However, the lot is inside ' + title(finDist) + ', an infrastructure financing district. New subdivisions use these to fund sewer and water mains, and district boundaries on the tax map often lag the service agreements. Check the plat notes and development approval for sewer service before budgeting a septic system.' +
        (hk ? ' If it is septic: ' + hk.rules + ' ' + hk.feeText : ''),
        'Weber County taxing districts + USDA soil survey', ctx.parcel.county === 'Weber' ? 'https://webercountyutah.gov/parcelsearch/ownership-info.php?id=' + encodeURIComponent(ctx.parcel.id) : null, null,
        'Confirm sewer on the recorded plat; only order perc tests if the lot is not sewered.'));
    } else {
      var r = (sw || 'unrated').toLowerCase(), unknown = sewer === null;
      out.push(F('septic', 'Sewer vs. septic', unknown ? 'verify' : (sw === 'Very limited' ? 'flag' : 'watch'),
        unknown ? 'Sewer service not mapped for this county; soils rated ' + r + ' if septic' : 'Septic likely required; soils rated ' + r + ' for absorption fields',
        (sewer === false ? 'No mapped sewer service.' : 'Sewer availability not mapped here.') + ' The soil survey rates septic absorption fields as ' + r + '.' + reasonTxt +
        " A \"very limited\" rating doesn't rule out septic, but expect a larger or engineered/alternative system. " + hd + ' issues the permit after a soil profile and percolation test.' +
        (hk ? ' ' + hk.rules + ' ' + hk.feeText : ''),
        'USDA NRCS Soil Survey + ' + hd, hk ? hk.reg : null,
        ctx.cost(sw === 'Very limited' ? 'septic_alternative' : 'septic_conventional'), "Schedule a soil profile/perc test with " + hd + "; it's cheap and decisive."));
    }
    if (ctx.parcel.county === 'Weber') {
      var z = await weberIdentify(ctx, 'planning/Ground_Water_Zones_23', [8, 9, 11]);
      if (z.length) {
        var za = z[0].attributes, nm = za.FACNAME || za.SourceName || 'public water source';
        var zn = +za.ProtZone, kbz = ctx.facts.kb && ctx.facts.kb.septicZones;
        out.push(F('septic', 'Drinking-water source protection', zn && zn <= 2 ? 'flag' : 'ok', 'Inside protection zone ' + (za.ProtZone || '?') + ' for ' + title(nm),
          'Mapped source-protection overlap may restrict onsite wastewater disposal. Confirm the zone boundary, source type and current applicable rules before relying on septic feasibility. This map does not establish a permit approval or a lot-specific prohibition. '+(kbz?'The jurisdiction reference flags Zones 1 and 2 for restrictions. ':''),
          'Weber County GIS: groundwater/surface water protection zones'));
      }
    }
    return out;
  };

  // GIS bare-earth DEM mosaic (variable source resolution; values in meters). run() starts it early because it's the slowest call.
  async function lidarSamples(pts) {
    try {
      var d = await fetchJSON('https://elevation.nationalmap.gov/arcgis/rest/services/3DEPElevation/ImageServer/getSamples', { form: {
        geometry: JSON.stringify({ points: pts.map(function (p) { return [+p[0].toFixed(7), +p[1].toFixed(7)]; }), spatialReference: { wkid: 4326 } }),
        geometryType: 'esriGeometryMultipoint', returnFirstValueOnly: 'true', f: 'json' }, timeout: 60000 });
      return (d.samples || []).filter(function (s) { return s.value !== 'NoData' && s.value != null && s.value !== ''; })
        .map(function (s) { return [s.location.x, s.location.y, parseFloat(s.value) * FT_PER_M]; }).filter(function(s){return s.every(Number.isFinite) && s[2]>-1e5;});
    } catch (e) { return []; }
  }

  async function epqsSamples(pts) {
    return (await Promise.all(pts.map(function(p){
      return fetchJSON('https://epqs.nationalmap.gov/v1/json',{params:{x:p[0],y:p[1],wkid:4326,units:'Feet',includeDate:'true'},timeout:30000,retries:1})
        .then(function(r){if(r.value==null || r.value==='' || !Number.isFinite(+r.value) || +r.value<=-1e5)return null;var point=[p[0],p[1],+r.value];point.metadata={resolution:r.resolution,rasterId:r.rasterId,acquisitionDate:(r.attributes||{}).AcquisitionDate};return point;}).catch(function(){return null;});
    }))).filter(Boolean);
  }
  C.check_slope = async function (ctx) {
    var pts=ctx.grid;
    if(pts.length<4)return [F('survey','GIS terrain','verify','Lot too small to sample')];
    var sparse=pts.filter(function(_,i){return i%Math.max(1,Math.ceil(pts.length/24))===0;});
    var results=await Promise.all([ctx.elevation||lidarSamples(pts),ctx.elevationComparison||epqsSamples(sparse)]);
    var definitions=[['USGS 3DEP GIS DEM mosaic','https://elevation.nationalmap.gov/arcgis/rest/services/3DEPElevation/ImageServer'],['USGS Elevation Point Query Service','https://epqs.nationalmap.gov/v1/docs']];
    var rows=[],measurements=[];
    results.forEach(function(samples,i){
      var source=definitions[i], expected=i?sparse.length:pts.length;
      if(samples.length<4){rows.push(F('survey','GIS terrain · '+source[0],'verify','Elevation source unavailable or insufficient samples',samples.length+' usable samples of '+expected+' requested. No zero elevation or agreement inferred.',source[0],source[1]));return;}
      var zs=samples.map(function(p){return p[2];}),lo=Math.min.apply(null,zs),hi=Math.max.apply(null,zs),fit=fitSlope(samples,ctx.lat0);
      if(!fit.every(Number.isFinite)){rows.push(F('survey','GIS terrain · '+source[0],'verify','Sample geometry cannot support a slope calculation','Usable points are collinear or degenerate; no slope inferred.',source[0],source[1]));return;}
      var m={source:source[0],url:source[1],samples:samples.length,requested:expected,slope:fit[0],relief:hi-lo,elev:zs.reduce(function(a,b){return a+b;},0)/zs.length,min:lo,max:hi,local:fit[2],points:samples,metadata:samples.map(function(p){return p.metadata;}).filter(Boolean),checkedAt:new Date().toISOString()};measurements.push(m);
      var status=m.slope<8&&m.local<15?'ok':m.slope<15&&m.local<25?'watch':'flag';
      rows.push(F('survey','GIS terrain · '+source[0],samples.length<expected?'verify':status,m.slope.toFixed(1)+'% fitted slope · '+m.relief.toFixed(1)+' ft relief',
        samples.length+' of '+expected+' requested GIS samples. Mean elevation '+m.elev.toFixed(1)+' ft; range '+lo.toFixed(1)+'–'+hi.toFixed(1)+' ft; steepest sampled local slope '+m.local.toFixed(1)+'%; downhill '+compass(fit[1])+'. Resolution varies by underlying DEM. These are computed screening metrics, not survey measurements. '+(m.metadata.length?' Returned source metadata: '+Array.from(new Set(m.metadata.map(function(d){return 'raster '+d.rasterId+', resolution '+d.resolution+' m, acquired '+(d.acquisitionDate||'unknown');}))).join('; ')+'. ':'')+'Both services may share USGS 3DEP source data; agreement is not independent corroboration. Checked '+m.checkedAt+'. Responses may be cached for up to seven days.',source[0],source[1],status==='flag'?ctx.cost('steep_site_work'):null));
    });
    ctx.facts.terrainSources=measurements;
    if(measurements.length){var primary=measurements[0];ctx.facts.slope=primary.slope;ctx.facts.relief=primary.relief;ctx.facts.elev=primary.elev;}
    if(measurements.length===2){
      var first=measurements[0],second=measurements[1],paired=[];
      second.points.forEach(function(p){var q=first.points.find(function(q){return Math.abs(q[0]-p[0])<1e-6&&Math.abs(q[1]-p[1])<1e-6;});if(q)paired.push(Math.abs(p[2]-q[2]));});
      rows.push(F('survey','Terrain source comparison','verify','Slope difference '+Math.abs(first.slope-second.slope).toFixed(2)+' percentage points · relief difference '+Math.abs(first.relief-second.relief).toFixed(1)+' ft',
        (paired.length?paired.length+' matching coordinates; mean absolute elevation difference '+(paired.reduce(function(a,b){return a+b;},0)/paired.length).toFixed(2)+' ft; maximum '+Math.max.apply(null,paired).toFixed(2)+' ft. ':'No matching coordinates; pointwise agreement cannot be computed. ')+
        'See both cited source rows above. Slope and relief use different sample densities; differences can reflect sampling and DEM resolution. No engineering agreement tolerance has been established. Shared underlying data is possible.','USGS GIS DEM / EPQS comparison',definitions[0][1]));
    }
    rows.push(F('survey','Boundary & topo survey','verify','Licensed survey with topography required','GIS elevation supports screening; permit and placement decisions require a stamped boundary and topographic survey.',null,null,ctx.cost('survey_topo'),'Order a boundary + topo survey.'));
    return rows;
  };

  C.check_utilities = async function (ctx) {
    var pt = ctx.parcel.point, out = [];
    var r = await Promise.all([UGRC + '/UtahElectricServiceAreas/FeatureServer/0', UGRC + '/UtahNaturalGasServiceAreas_Approx/FeatureServer/0',
      UGRC + '/TelecomBoundaries/FeatureServer/0'].map(function (u) { return arcgisQuery(u, { geometry: pt }); }));
    var homes = await arcgisQuery(lirUrl(ctx.parcel.county), { geometry: pt, distance: 400, where: 'BUILT_YR > 0', outFields: 'BUILT_YR' }).catch(function () { return []; });
    var years = homes.map(function (h) { return +h.attributes.BUILT_YR; }).filter(Boolean).sort();
    ctx.facts.homes_nearby = { n: years.length, newest: years[years.length - 1] };
    if (r[0].length) {
      var e = r[0][0].attributes, platted = !!ctx.parcel.attrs.SUBDIV_NAME;
      if (years.length >= 5) {
        out.push(F('utilities', 'Power', 'ok', e.PROVIDER + '; ' + years.length + ' homes within 400 m (newest built ' + years[years.length - 1] + ')',
          'Occupied homes nearby mean distribution lines already serve the area' + (platted ? ', and recorded subdivisions normally have power stubbed to each lot as a plat condition' : '') +
          '. The remaining cost is the service lateral from the lot line to the house, which is usually trenched with the other utilities.',
          'UGRC electric service areas + county parcels', e.WEBLINK));
      } else {
        out.push(F('utilities', 'Power', 'watch', e.PROVIDER + ' territory; only ' + years.length + ' homes within 400 m',
          'Few built homes nearby, so the nearest line or transformer may be some distance away. Line extensions are billed per foot and can add tens of thousands on rural lots.',
          'UGRC electric service areas + county parcels', e.WEBLINK, ctx.cost('power_extension'), 'Request a ' + e.PROVIDER + ' line-extension estimate for the lot.'));
      }
    } else out.push(F('utilities', 'Power', 'flag', 'No electric provider mapped', '', 'UGRC electric service areas'));
    ctx.facts.gas = r[1].length > 0;
    if (r[1].length) {
      var g = r[1][0].attributes;
      out.push(F('utilities', 'Natural gas', 'ok', g.PROVIDER + ' service area (approximate)', 'Confirm a main runs along the lot frontage.', 'UGRC natural gas service areas', g.WEBLINK));
    } else out.push(F('utilities', 'Natural gas', 'watch', 'No natural gas service mapped', 'Plan for propane or all-electric heat.', 'UGRC natural gas service areas', null, ctx.cost('propane')));
    var prov = Array.from(new Set(r[2].map(function (f) { return f.attributes.PROVIDER; }))).sort().join(', ') || 'none mapped';
    var fccUrl = 'https://broadbandmap.fcc.gov/location-summary/fixed?lat=' + ctx.parcel.cy.toFixed(6) + '&lon=' + ctx.parcel.cx.toFixed(6);
    // Utah Broadband Center service areas, built from providers' FCC Broadband Data Collection filings (H3 hexagons, ~0.3 sq mi).
    var bb = await area(ctx, BROADBAND, { outFields: 'brand_name,max_advertised_download_speed,max_advertised_upload_speed,common_tech,category' }).catch(function () { return null; });
    if (!bb) {
      out.push(F('utilities', 'Internet', 'verify', 'Wireline telecom territory: ' + prov, 'The broadband availability layer did not respond. Buyers of high-end spec homes expect fiber.', 'UGRC telecom boundaries + FCC', fccUrl));
      return out;
    }
    var best = {};
    bb.forEach(function (f) {
      var a = f.attributes, k = a.brand_name + '|' + a.common_tech;
      if (!best[k] || a.max_advertised_download_speed > best[k].down) best[k] = { name: a.brand_name, tech: a.common_tech, cat: a.category, down: a.max_advertised_download_speed, up: a.max_advertised_upload_speed };
    });
    var list = Object.keys(best).map(function (k) { return best[k]; }).sort(function (x, y) { return y.down - x.down; });
    var spd = function (m) { return m >= 1000 ? (m / 1000) + ' Gbps' : m + ' Mbps'; };
    var desc = function (x) { return x.name + ' (' + x.tech + ', ' + spd(x.down) + ' down / ' + spd(x.up) + ' up)'; };
    var fiber = list.filter(function (x) { return /fiber/i.test(x.tech); }), cable = list.filter(function (x) { return /cable/i.test(x.tech); });
    var wired = list.filter(function (x) { return x.cat === 'wired'; }), other = list.filter(function (x) { return x.cat !== 'wired'; });
    ctx.facts.fiber = fiber.length > 0;
    var caveat = ' Providers report coverage to the FCC by hexagon (about 0.3 sq mi), so a listed provider serves part of the area around the lot, not necessarily this lot. A new lot may not be in the FCC location list until a home is built.';
    var status = fiber.length ? 'ok' : wired.length ? 'watch' : 'verify';
    var head = fiber.length ? 'Fiber reported nearby: ' + fiber.map(function (x) { return x.name + ' ' + spd(x.down); }).join(', ')
      : cable.length ? 'No fiber reported; cable from ' + cable.map(function (x) { return x.name; }).join(', ')
      : wired.length ? 'No fiber or cable; best wired option is ' + desc(wired[0]) : 'No wired broadband in this dataset; service availability unverified';
    out.push(F('utilities', 'Internet', status, head,
      'Wired: ' + (wired.map(desc).join('; ') || 'none') + '. Wireless and satellite: ' + (other.slice(0, 5).map(desc).join('; ') || 'none') + '.' + caveat +
      (fiber.length ? '' : ' Buyers of high-end spec homes expect fiber; a line extension may be negotiable with a provider before closing.'),
      'Utah Broadband Center (FCC filings)', fccUrl, null,
      fiber.length ? 'Ask ' + fiber[0].name + "'s new-construction team to confirm service to this lot and any build-out charge." : 'Ask wired providers for a line-extension quote to the lot.'));
    return out;
  };

  // Distance a fire crew lays hose: along mapped roads from each hydrant to the lot frontage, then from the frontage to the
  // middle of the lot (where the house is assumed to sit). Roads are densified to ~10 m nodes; segments sharing an endpoint connect.
  function hydrantRoute(ctx, roads, hydrants) {
    var lat0 = ctx.parcel.cy, key = function (q) { return Math.round(q[0] * 2) + ',' + Math.round(q[1] * 2); };
    var nodes = [], idx = {}, adj = [];
    var node = function (q) { var k = key(q); if (idx[k] == null) { idx[k] = nodes.length; nodes.push(q); adj.push([]); } return idx[k]; };
    roads.forEach(function (r) {
      ((r.geometry || {}).paths || []).forEach(function (path) {
        var prev = null;
        path.forEach(function (pt) {
          var q = toLocal(pt[0], pt[1], lat0);
          if (prev) {
            var d = Math.hypot(q[0] - prev[0], q[1] - prev[1]), n = Math.max(1, Math.ceil(d / 10)), a = node(prev);
            for (var i = 1; i <= n; i++) {
              var b = node([prev[0] + (q[0] - prev[0]) * i / n, prev[1] + (q[1] - prev[1]) * i / n]), w = d / n;
              if (a !== b) { adj[a].push([b, w]); adj[b].push([a, w]); }
              a = b;
            }
          }
          prev = q;
        });
      });
    });
    if (!nodes.length) return null;
    var c = toLocal(ctx.parcel.cx, ctx.parcel.cy, lat0), ring = ctx.parcel.rings[0].map(function (q) { return toLocal(q[0], q[1], lat0); });
    var toRing = function (q) {
      var best = Infinity;
      for (var i = 0; i < ring.length - 1; i++) {
        var a = ring[i], b = ring[i + 1], dx = b[0] - a[0], dy = b[1] - a[1], t = ((q[0] - a[0]) * dx + (q[1] - a[1]) * dy) / (dx * dx + dy * dy || 1);
        t = Math.max(0, Math.min(1, t)); best = Math.min(best, Math.hypot(q[0] - a[0] - t * dx, q[1] - a[1] - t * dy));
      }
      return best;
    };
    // Multi-source Dijkstra from frontage nodes (within 25 m of the lot line), starting cost = walk to the lot center.
    var dist = nodes.map(function () { return Infinity; }), done = nodes.map(function () { return false; }), open = [];
    nodes.forEach(function (q, i) { if (toRing(q) <= 25) { dist[i] = Math.hypot(q[0] - c[0], q[1] - c[1]); open.push(i); } });
    if (!open.length) return null;
    while (open.length) {
      var bi = 0; for (var j = 1; j < open.length; j++) if (dist[open[j]] < dist[open[bi]]) bi = j;
      var u = open[bi]; open.splice(bi, 1); if (done[u]) continue; done[u] = true;
      adj[u].forEach(function (e) { var nd = dist[u] + e[1]; if (nd < dist[e[0]]) { dist[e[0]] = nd; open.push(e[0]); } });
    }
    var best = null;
    hydrants.forEach(function (h) {
      var q = toLocal(h.geometry.x, h.geometry.y, lat0), ni = -1, nd = Infinity;
      nodes.forEach(function (n, i) { var d = Math.hypot(n[0] - q[0], n[1] - q[1]); if (d < nd) { nd = d; ni = i; } });
      if (nd > 40 || !isFinite(dist[ni])) return; // hydrant not on a mapped road, or not connected
      var total = dist[ni] + nd;
      if (!best || total < best.m) best = { m: total, straight: Math.hypot(q[0] - c[0], q[1] - c[1]) };
    });
    return best;
  }

  C.check_access_fire = async function (ctx) {
    var out = [], roads = await area(ctx, UGRC + '/UtahRoads/FeatureServer/0', { distance: 30 });
    if (roads.length) {
      var names = Array.from(new Set(roads.map(function (r) { return r.attributes.FULLNAME; }).filter(Boolean))).sort().slice(0, 3);
      out.push(F('access', 'Road access', 'ok', 'Fronts or adjoins ' + names.join(', '),
        'Confirm frontage is legal access (public road or recorded easement) and get driveway approach rules.', 'UGRC roads'));
    } else out.push(F('access', 'Road access', 'flag', 'No mapped road within 100 ft', 'Access may depend on a private road or easement. Confirm legal access on the plat/title report.',
      'UGRC roads', null, ctx.cost('long_driveway')));
    var wui = ctx.parcel.county === 'Weber' ? (await area(ctx, WEBER + '/gis/OpenGov_Layers/MapServer/12')).length > 0 : false;
    var hi = await area(ctx, UTAH_AGO + '/Utah_High_Risk_WUI_Properties/FeatureServer/1');
    var codes = (ctx.plan.codes || []).join(' ').toUpperCase(), cites = /WUI|WILDLAND/.test(codes);
    ctx.facts.wui = !!(wui || hi.length);
    if (wui || hi.length) out.push(F('access', 'Wildfire (WUI)', 'watch', 'Inside a mapped wildland-urban interface area',
      'The Utah Wildland-Urban Interface Code can require ignition-resistant siding, roofing, vents and decking, defensible space and water supply for firefighting.',
      'Weber County WUI / Utah FFSL high-risk WUI', null, ctx.cost('wui_construction')));
    else {
      var kw = ctx.facts.kb && ctx.facts.kb.wui;
      out.push(F('access', 'Wildfire (WUI)', 'ok', 'Not inside a mapped WUI boundary',
        (kw ? kw + ' This lot is outside the county and state WUI maps, so WUI construction requirements should not apply unless the district designates the area.' : 'The lot is outside the county and state WUI maps.') +
        (cites ? ' The plan set cites the WUI code anyway, which costs more but is not wrong.' : ''),
        'Weber County WUI map + Utah FFSL WUI risk', 'https://ffsl.utah.gov/wuirisk'));
    }
    if (ctx.parcel.county === 'Weber') {
      var hy = await arcgisQuery(WEBER + '/gis/OpenGov_Layers/MapServer/11', { geometry: ctx.parcel.point, distance: 2000, returnGeometry: true, outFields: 'OBJECTID' }).catch(function () { return null; });
      if (hy) {
        var hft = hy.length ? Math.min.apply(0, hy.map(function (h) { return distPts(ctx.parcel.cx, ctx.parcel.cy, h.geometry.x, h.geometry.y); })) * FT_PER_M : null;
        var route = null;
        if (hy.length) {
          var rd = await arcgisQuery(UGRC + '/UtahRoads/FeatureServer/0', { geometry: ctx.parcel.point, distance: 2200, returnGeometry: true, outFields: 'FULLNAME' }).catch(function () { return null; });
          route = rd && hydrantRoute(ctx, rd, hy);
        }
        var rft = route ? route.m * FT_PER_M : null, use = rft || hft;
        ctx.facts.hydrant_ft = use;
        var rule = 'For one- and two-family homes the fire code allows up to 600 ft from a hydrant on the fire access road, measured along the route a crew would lay hose to every part of the house (IFC 507.5.1, Exception 1; the fire district can require more). ';
        if (hft == null) out.push(F('access', 'Fire hydrant', 'verify', 'No mapped hydrant within 6,500 ft; fire-water supply unverified',
          'No hydrant was returned by the county dataset. This does not prove that none exists or determine the required fire-protection design. Verify hydrants, available flow and any approved alternative water supply with the fire authority.', 'Weber County GIS: fire hydrants', null, ctx.cost('fire_sprinklers')));
        else out.push(F('access', 'Fire hydrant', use <= 600 ? 'ok' : 'watch',
          rft ? 'Nearest hydrant about ' + fmt(rft) + ' ft by road to the middle of the lot' : 'Nearest mapped hydrant about ' + fmt(hft) + ' ft from the lot center (straight line)',
          rule + (rft ? 'Measured along mapped roads from the hydrant to the lot frontage, then to the lot center (' + fmt(route.straight * FT_PER_M) + ' ft straight-line). Where the house sits on the lot changes this. ' : 'No road route could be traced, so this is straight-line and the real hose route is longer. ') +
            (use <= 600 ? 'Within the limit; keep the house near the front of the lot if the margin is thin.' : 'Over the limit: expect a hydrant extension along the road or residential fire sprinklers.' +
              (ctx.parcel.attrs.SUBDIV_NAME ? " Hydrants installed with a recent subdivision's improvements may not be on the county map yet; the subdivision's approved improvement drawings show them." : '')),
          'Weber County GIS hydrants + UGRC roads', null, use <= 600 ? null : ctx.cost('fire_sprinklers'),
          use <= 600 ? null : 'Ask the fire district whether it will accept sprinklers in place of a hydrant extension, and price both.'));
      }
    }
    var st = await arcgisQuery(UGRC + '/FireStations/FeatureServer/0', { geometry: ctx.parcel.point, distance: 25000, returnGeometry: true });
    if (st.length) {
      var dmi = function (f) { return distPts(ctx.parcel.cx, ctx.parcel.cy, f.geometry.x, f.geometry.y) / 1609.34; };
      var near = st.reduce(function (a, b) { return dmi(b) < dmi(a) ? b : a; }), miles = dmi(near);
      out.push(F('access', 'Fire station', miles < 5 ? 'ok' : 'watch', title(near.attributes.NAME || 'Fire station') + ', ' + miles.toFixed(1) + ' mi straight-line',
        'More than 5 road miles from a station can raise insurance costs and trigger sprinkler or water-storage requirements.', 'UGRC fire stations'));
    }
    return out;
  };

  C.check_ccr_permits = async function (ctx) {
    var a = ctx.parcel.attrs, sub = a.SUBDIV_NAME, pud = /PUD/i.test(ctx.facts.prop_desc || ''), out = [], kb = ctx.facts.kb;
    var parcelPage = ctx.parcel.county === 'Weber' ? 'https://webercountyutah.gov/parcelsearch/ownership-info.php?id=' + encodeURIComponent(ctx.parcel.id) : a.BOUNDARY_SRC;
    if (sub) {
      out.push(F('ccr', 'CC&Rs / HOA', 'verify', sub + (pud ? ' (PUD lot)' : '') + ': recorded CC&Rs likely',
        'Subdivision lots, especially PUD lots, usually carry recorded CC&Rs: minimum square footage, materials, roof pitch, colors, building envelopes, architect requirements, HOA dues and construction deposits. ' +
        'The county parcel page lists the recorded entries for this lot and links the plat. ' +
        (ctx.parcel.county === 'Weber' ? 'Weber County has no free online document search (copies are $1/page from the Recorder), so the title company is the fastest source. ' : '') +
        "The Utah HOA registry shows the association's registered contact but not its CC&Rs.",
        'County parcel record + Utah HOA registry', parcelPage, null, 'Get the CC&Rs, design guidelines and HOA fees from the title commitment or the HOA contact in the state registry.'));
    } else out.push(F('ccr', 'CC&Rs / HOA', 'verify', 'Not in a platted subdivision per assessor', 'There may still be recorded covenants; check the title report.', 'County parcel record', parcelPage));
    if (kb && kb.designReview) out.push(F('ccr', 'City design review', 'verify', 'Check municipal design-review triggers', 'Review the adopted code against use, zoning, overlays and development agreements. Rules & Approvals records the controlling requirement and stage. ' + (sub ? ' HOA architectural review may still apply under the CC&Rs.' : ''),
      ctx.facts.jurisdiction + ' Land Use Code', kb.code));
    else if (sub) out.push(F('ccr', 'Design review', 'verify', 'HOA architectural review likely', 'Confirm recorded membership, the responsible committee and its required approval sequence. Timing varies by governing documents.', null, null, null, 'Request design guidelines and review schedule from the HOA/developer.'));

    var juris = ctx.facts.jurisdiction || 'the jurisdiction';
    if (kb) {
      var known = kb.impact.reduce(function (t, x) { return t + x[1]; }, 0), fire = kb.fireImpact ? kb.fireImpact[0] : 0;
      var list = kb.impact.map(function (x) { return x[0] + ' $' + x[1].toLocaleString('en-US', { minimumFractionDigits: 2 }); }).join(', ');
      var pc = ctx.cost('permit_impact_fees'), fp = ctx.plan.footprint || {}, hasPlan = !!fp.residence_sf;
      var hs = fp.residence_sf || 3500, gs = hasPlan ? (fp.garage_sf || 0) : 800, wb = weberBuildingFees(hs, gs);
      var pf = kb.permitFees, money2 = function (n) { return '$' + fmt(n); };
      var bldTxt = 'Building permit and plan review: ' + (pf ? pf.adopted + ' sets the city\'s fees. ' + pf.note + ' ' : 'set locally. ') +
        'As a floor, Weber County\'s published schedule (County Code 12-3-6 and 12-3-8) on ' + (hasPlan ? 'this plan (' + fmt(hs) + ' sq ft house' + (gs ? ' + ' + fmt(gs) + ' sq ft garage' : '') + ')' : 'a typical ' + fmt(hs) + ' sq ft house with an ' + fmt(gs) + ' sq ft garage') +
        ' gives a valuation of ' + money2(wb.valuation) + ' (ICC ' + BVD.asOf + ' rates: $' + BVD.r3 + '/sq ft house, $' + BVD.garage + '/sq ft garage), a permit fee of ' + money2(wb.permit) +
        ', plan review ' + money2(wb.planReview) + ', trade permits $350 and the 1% state surcharge: about ' + money2(wb.total) + '. Expect the city\'s total to be somewhat higher.';
      out.push(F('permits', 'Permit & impact fees', 'watch', 'Impact fees about $' + fmt(known + fire) + ' + building permit and plan review from about $' + fmt(wb.total),
        'Impact fees: ' + list + ' (' + kb.impact[0][2] + ', one storm-drain unit assumed; more impervious area means more units).' +
        (kb.fireImpact ? ' Plus $' + fire + ' fire impact fee: ' + kb.fireImpact[1] + '.' : '') + ' ' + bldTxt + ' Permits: ' + kb.permits,
        juris + ' impact fee ordinance + Weber County fee schedule', kb.impactSrc,
        pc ? { key: 'permit_impact_fees', low: Math.round(known + fire + wb.total), high: Math.round(known + fire + wb.total * 1.5), label: 'Impact fees (published) + building permit & plan review (Weber schedule as floor)' } : null,
        'Ask the building department for the Resolution 2026-28 fee schedule to replace the floor estimate, then submit through the permit portal (checklist: ' + kb.submittal + ').'));
      out.push(F('permits', 'Outdoor lighting', 'watch', 'Dark-sky lighting plan required at permit', kb.lighting, juris + ' Land Use Code 108-16', kb.code));
    } else {
      out.push(F('permits', 'Building permit', 'verify', 'Permitting authority: ' + juris, 'Permits through ' + juris + '. Fee schedules are set locally.', null, null, ctx.cost('permit_impact_fees'),
        'Get the current residential fee schedule (permit, plan review, impact fees) and typical review time.'));
    }
    return out;
  };

  /* Home performance requirements and restrictions. Statewide rules, then local facts from the jurisdiction table. */
  var UTAH_ENERGY = { since: 'July 1, 2026', cite: 'Utah Code 15A-3-203(3), 2026 H.B. 65', url: 'https://le.utah.gov/xcode/Title15A/Chapter3/C15A-3-S203_2026050620260701.html',
    ceiling: 38, wall: 21, floor: 30, basement: 'R-10 continuous or R-13 cavity', windowU: 0.32, ach50: 5.0 };
  // R307-302-2(1): PM2.5 nonattainment/maintenance areas where only EPA-certified stoves / EPA-qualified fireplaces may be installed.
  function solidFuelArea(ctx) {
    var c = ctx.parcel.county, j = ctx.facts.jurisdiction || '', lon = ctx.parcel.cx;
    if (/^(Salt Lake|Davis|Utah|Cache)$/.test(c)) return { inside: true, why: c === 'Cache' ? 'Cache Valley' : 'all of ' + c + ' County' };
    if (c === 'Weber') {
      var east = /Ogden Valley|Huntsville/.test(j) || lon > -111.875; // the rule covers Weber County west of the Wasatch only
      return east ? { inside: false, why: 'Ogden Valley, east of the Wasatch (outside the Weber County area the rule covers)' } : { inside: true, why: 'Weber County west of the Wasatch' };
    }
    if (c === 'Box Elder' || c === 'Tooele') return { inside: null, why: 'only part of ' + c + ' County is covered (' + (c === 'Tooele' ? 'north of Route 199 between the Oquirrh and Stansbury mountains' : 'from the Wasatch west to the Promontory range, south of Portage') + ')' };
    if (c === 'Summit' && /Park City|Snyderville/.test(j + ' ' + (ctx.parcel.attrs.PARCEL_CITY || '')) ) return { inside: false, local: 'Summit County bans solid-fuel devices in new construction in the Snyderville Basin (upheld in Property Rights Ombudsman Advisory Opinion 194).' };
    return { inside: false, why: c + ' County is outside the state PM2.5 areas' };
  }

  C.check_performance = async function (ctx) {
    var out = [], kb = ctx.facts.kb, E = UTAH_ENERGY;
    ctx.facts.energyCode = E;
    out.push(F('performance', 'Energy code', 'watch', "Utah's residential energy code: R-38 ceiling, R-21 walls, U-0.32 windows, 5.0 ACH50",
      'Since ' + E.since + ', new homes follow Utah\'s own energy chapter, the same in every climate zone: ceiling R-' + E.ceiling + ', above-grade walls R-' + E.wall + ', floors over unconditioned space R-' + E.floor +
      ', conditioned basement walls ' + E.basement + ', windows U-' + E.windowU + ' or better. Air leakage may not exceed ' + E.ach50 + ' ACH50; a blower-door test by a BPI or RESNET-certified tester, or the air-sealing checklist, shows compliance. ' +
      'Ducts in unconditioned attics must be leakage-tested, and homes tested tighter than 3 ACH50 need whole-house mechanical ventilation. Cities cannot require more than the state code (Utah Code 15A-1-204(8)), so this is the ceiling, not just the floor.',
      E.cite, E.url, null, 'Line up a blower-door tester or plan to use the air-sealing checklist; confirm duct location (in-attic ducts must be tested).'));

    var sf = solidFuelArea(ctx);
    if (sf.inside === true) out.push(F('performance', 'Wood-burning fireplaces', 'watch', 'Only EPA-certified stoves or EPA-qualified fireplaces may be installed here',
      'This lot is in a PM2.5 area (' + sf.why + '), where Utah rule R307-302-6 bans installing wood stoves that are not EPA-certified and fireplaces that are not EPA-qualified. Gas fireplaces are not affected. Mandatory no-burn days apply when PM2.5 is forecast at 25 µg/m³ or more.',
      'Utah Admin. Code R307-302', 'https://www.law.cornell.edu/regulations/utah/environmental-quality/title-R307/rule-R307-302'));
    else if (sf.inside === null) out.push(F('performance', 'Wood-burning fireplaces', 'verify', 'Check whether the lot is in the state wood-burning area',
      'Utah rule R307-302 restricts new wood-burning devices in ' + sf.why + '.', 'Utah Admin. Code R307-302', 'https://www.law.cornell.edu/regulations/utah/environmental-quality/title-R307/rule-R307-302'));
    else out.push(F('performance', 'Wood-burning fireplaces', sf.local ? 'watch' : 'ok', sf.local ? 'Local ban on new solid-fuel devices' : 'No state ban on new wood-burning fireplaces here',
      (sf.local || ('The state install ban (R307-302-6) covers the PM2.5 areas; this lot is in ' + sf.why + '.')) + ' The countywide smoke rules (20% opacity, prohibited fuels) still apply in the seven covered counties.',
      'Utah Admin. Code R307-302', 'https://www.law.cornell.edu/regulations/utah/environmental-quality/title-R307/rule-R307-302'));
    ctx.facts.solidFuel = sf;

    var sw = kb && kb.stormwater, sub = !!ctx.parcel.attrs.SUBDIV_NAME, acres = +ctx.parcel.attrs.PARCEL_ACRES || 0;
    var stateTxt = 'Disturbing 1 acre or more, or building one lot within a larger common plan of development of 1 acre or more, requires a Utah UPDES construction stormwater permit (' +
      (sub ? 'for a lot in a subdivision, typically the Common Plan Permit UTRH00000' : 'the Construction General Permit UTRC00000') + ') with a stormwater pollution prevention plan.';
    out.push(F('performance', 'Impervious surface & stormwater', sub || acres >= 1 ? 'watch' : 'ok',
      sw ? 'No lot-coverage cap; storm drain fee by impervious area; stormwater permits' : (sub || acres >= 1 ? 'State construction stormwater permit likely' : 'No impervious-surface limits found'),
      (sw ? 'The zone sets no impervious or lot-coverage cap for a single-family home. The storm drain impact fee is $' + sw.esuFee.toLocaleString('en-US', { minimumFractionDigits: 2 }) + ' per ESU (' + sw.esuNote + '), so roof, driveway and patio area drive the fee. ' + sw.cityPermit + ' ' : '') + stateTxt,
      sw ? ctx.facts.jurisdiction + ' code + Utah DEQ' : 'Utah DEQ', sw ? sw.url : 'https://deq.utah.gov/water-quality/general-construction-storm-water-updes-permits', null,
      'Keep a stormwater plan (silt fence, inlet protection, stabilized entrance) in the permit set; file the state permit before grading.'));

    var turf = kb && kb.turf;
    if (turf) out.push(F('performance', 'Water-wise landscaping', 'watch', 'Turf limited to 35% of front and side yards (or 3,000 sq ft)',
      turf.rule + ' (' + turf.cite + '). Utah law also bars requiring lawn in strips narrower than 8 ft.', ctx.facts.jurisdiction + ' Land Use Code', turf.url));
    out.push(F('performance', 'Other statewide requirements', 'ok', 'No state radon, sprinkler, EV-ready or solar-ready mandates',
      'Utah does not adopt the IRC radon appendix, deleted the IRC residential sprinkler requirement (sprinklers only "when installed"), and has no EV-ready or solar-ready rules; cities cannot add them to the building code. A fire district can still require sprinklers or fire flow for large homes far from a hydrant.',
      'Utah Code 15A-2-103, 15A-3-202', 'https://le.utah.gov/xcode/Title15A/Chapter3/C15A-3-S202_2026050620260701.html'));
    return out;
  };

  // Utah residential ground snow load: Utah amends the IRC to use the 2018 Utah Snow Load Study (USU/SEAU) grid.
  var snowGrid = null;
  C.check_snow = async function (ctx) {
    try {
      if (!snowGrid) snowGrid = (await fetchJSON('https://www.usu.edu/utahsnowload/files/json/snowloadMat.json', { timeout: 90000, retries: 2 })).snowloadMatrix;
      var lat = ctx.parcel.cy, lng = ctx.parcel.cx, lats = Object.keys(snowGrid).map(Number).sort(function (a, b) { return a - b; });
      var lo = lats.filter(function (v) { return v <= lat; }).pop(), hi = lats.filter(function (v) { return v >= lat; })[0];
      var key = function (v) { return Object.keys(snowGrid).find(function (k) { return +k === v; }); };
      var row = snowGrid[key(lo)], lngs = Object.keys(row).map(Number).sort(function (a, b) { return a - b; });
      var lo2 = lngs.filter(function (v) { return v <= lng; }).pop(), hi2 = lngs.filter(function (v) { return v >= lng; })[0];
      var g = function (la, ln) { return snowGrid[key(la)][Object.keys(snowGrid[key(la)]).find(function (k) { return +k === ln; })]; };
      var tx = hi === lo ? 0 : (lat - lo) / (hi - lo), ty = hi2 === lo2 ? 0 : (lng - lo2) / (hi2 - lo2);
      var pg = g(lo, lo2) * (1 - tx) * (1 - ty) + g(hi, lo2) * tx * (1 - ty) + g(lo, hi2) * (1 - tx) * ty + g(hi, hi2) * tx * ty;
      pg = Math.max(21, Math.round(pg));
      ctx.facts.snow = { pg: pg, basis: 'the Utah Snow Load Study' };
      var planPg = (ctx.plan.structural || {}).ground_snow_load_psf;
      return [F('permits', 'Ground snow load', 'ok', pg + ' psf ground snow load required for homes here',
        "Utah's residential code (Utah Code 15A-3-202) takes ground snow loads from the 2018 Utah Snow Load Study rather than ASCE 7. This is the study's 50-year value interpolated at the lot (3,350 ft grid)." +
        (planPg ? ' The plan uses ' + planPg + ' psf; see "Your plan vs. this lot".' : ''),
        'Utah Snow Load Study (USU / SEAU)', 'https://www.usu.edu/utahsnowload/process?latitude=' + lat.toFixed(5) + '&longitude=' + lng.toFixed(5))];
    } catch (e) {
      return [F('permits', 'Ground snow load', 'verify', 'Look up the Utah ground snow load', 'The Utah Snow Load Study grid could not be loaded (' + e.message + ').',
        'Utah Snow Load Study (USU / SEAU)', 'https://www.usu.edu/utahsnowload/process?latitude=' + ctx.parcel.cy.toFixed(5) + '&longitude=' + ctx.parcel.cx.toFixed(5))];
    }
  };

  C.check_districts = async function (ctx) {
    if (ctx.parcel.county !== 'Weber') return [];
    var names = await weberDistricts(ctx);
    var notable = names.filter(function (n) { return /water|sewer|fire|park|IFD|PID|improve|service area|flood|redev|CRA/i.test(n) && !/judgment|g\.?o\.? bond|levy/i.test(n); });
    if (!notable.length) return [];
    return [F('land', 'Special districts', 'ok', notable.length + ' service and financing districts cover the lot',
      notable.map(title).join('; ') + '. These set part of the property tax and often provide water, sewer, fire or parks service.', 'Weber County taxing entities')];
  };

  /* Plan vs. lot: compare what the plan set says with what the site checks found. Each rule names the plan element,
   * the site condition it runs into, and where the plan value came from. */
  C.check_plan_fit = async function (ctx) {
    var p = ctx.plan, fp = p.footprint || {}, fx = ctx.facts, out = [], src = p.src || {};
    if (!p.footprint && !p.bedrooms && !p.foundation) return [];
    var from = function (k) { return src[k] ? ' (plan: ' + src[k] + ')' : ''; };
    var P = function (item, status, headline, detail, cost, next) { return F('plan', item, status, headline, detail, 'Plan ' + (p.filename ? '"' + p.filename + '"' : 'inputs') + ' vs. site findings', null, cost, next); };
    out.push(P('House and driveway vs. easements', 'verify', 'Easement clearance has not been established',
      'The plat evidence section preserves candidate restrictions and all linked sheets, but easement boundaries are not mapped. A house that fits zoning setbacks can still intersect a utility, access, drainage or other easement. Neither the house nor the driveway has been cleared against them.'));
    var wt = fx.water_table_in, wtSource = 'Mapped soil-survey estimate';
    if (fx.boreholes && fx.boreholes.gwMin != null && fx.boreholes.nearestKm < 0.5 && (wt == null || fx.boreholes.gwMin * 12 < wt)) {
      wt = Math.round(fx.boreholes.gwMin * 12); wtSource = 'Nearby boring archive';
    }
    var wtEvidence = wtSource + ': approximately ' + wt + ' in below ground. This is not a groundwater measurement at the proposed foundation.';

    // Foundation vs. seasonal groundwater
    if (p.foundation === 'basement' && wt != null && wt < 60) out.push(P('Foundation vs. groundwater', 'flag',
      'Basement plan needs groundwater review; available evidence indicates ~' + wt + ' in',
      'The plan shows a basement' + from('foundation') + '. ' + wtEvidence + ' If confirmed at basement depth, groundwater could require waterproofing, drainage, construction dewatering or a different foundation design. Seasonal site measurements and geotechnical design are still needed.',
      ctx.cost('basement_waterproofing'), 'Have the geotech measure groundwater (test pits in spring) before committing to the basement.'));
    else if (p.foundation === 'crawlspace' && wt != null && wt < 36) out.push(P('Foundation vs. groundwater', 'watch',
      'Crawlspace plan needs groundwater review; available evidence indicates ~' + wt + ' in',
      wtEvidence + ' Compare the proposed floor elevation with seasonal site measurements before selecting drainage and moisture-control details.', null,
      'Ask the geotech for the minimum crawlspace floor elevation.'));
    else if (p.foundation === 'slab' && wt != null && wt < 36) out.push(P('Foundation vs. groundwater', 'verify',
      'Slab proposed; shallow-groundwater evidence still needs site verification',
      wtEvidence + ' Slab elevation, bearing, capillary protection and drainage require site-specific design' + from('foundation') + '. A slab selection alone does not resolve groundwater risk.'));
    else if (!p.foundation && wt != null && wt < 60) out.push(P('Foundation vs. groundwater', 'verify',
      'Foundation type not found; shallow groundwater indicated in available evidence',
      wtEvidence + ' Establish seasonal groundwater and compare foundation options with the geotechnical engineer.'));

    // Septic sizing by bedrooms
    if (fx.septic && fx.septic.required && p.bedrooms) {
      var vl = fx.septic.rating === 'Very limited';
      out.push(P('Septic vs. bedrooms', vl ? 'flag' : 'watch',
        p.bedrooms + '-bedroom design on soils rated ' + (fx.septic.rating || 'unrated').toLowerCase() + ' for septic',
        'Utah sizes onsite wastewater systems by bedroom count and the soil\'s percolation rate (Utah Admin. Code R317-4), so a ' + p.bedrooms + '-bedroom plan' + from('bedrooms') +
        ' needs a proportionally larger absorption field. On "' + (fx.septic.rating || '').toLowerCase() + '" soils that usually means a larger or alternative system and more of the lot set aside for the field and its replacement area. ' +
        'Rooms labeled office, bonus or game room can be counted as bedrooms by the health department if they have a closet and egress window.', null,
        'Get the perc test done before finalizing the bedroom count; ask ' + (fx.septic.hd || 'the health department') + ' how they count bonus rooms.'));
    }

    // Heating fuel vs. gas service
    if (p.fuel === 'gas') out.push(fx.gas
      ? P('Gas appliances', 'ok', 'Plan uses gas appliances; lot is in a natural gas service area', 'Gas appliances or a gas line schedule appear in the plan' + from('fuel') + '. Confirm the main runs along the frontage.')
      : P('Gas appliances', 'watch', 'Plan uses gas appliances, but no natural gas service is mapped', 'Plan on a buried propane tank (setbacks from the house and lot lines apply) or convert to heat pumps.' + from('fuel'), ctx.cost('propane')));

    // Exterior cladding vs. wildfire code
    var citesWui = (p.codes || []).some(function (c) { return /WILDLAND/i.test(c); });
    if (p.cladding === 'combustible' && !fx.wui && citesWui) out.push(P('Exterior vs. wildfire code', 'ok',
      'Plan cites the WUI code, but the lot is outside mapped WUI areas: a possible savings',
      'The plan calls for cedar siding and cites the Wildland-Urban Interface Code' + from('cladding') + '. The fire district applies that code only in designated WUI areas, and this lot is outside the county and state WUI maps, so fire-retardant-treated siding, ember-resistant vents and other WUI upgrades are likely not required. Ask the designer whether any were priced in.'));
    else if (p.cladding === 'combustible' && fx.wui) out.push(P('Exterior vs. wildfire code', 'flag',
      'Wood/cedar siding specified on a lot inside a mapped WUI area',
      'Where the Utah Wildland-Urban Interface Code applies, exterior walls need ignition-resistant materials: fire-retardant-treated cedar, noncombustible siding, or an approved assembly, plus ember-resistant vents and Class A roofing' + from('cladding') + '. ' +
      (fx.wui ? 'This lot is mapped in the WUI.' : 'The lot is not in a mapped WUI boundary, so confirm whether the code actually applies before paying for FRT materials.'),
      fx.wui ? ctx.cost('wui_construction') : null, 'Confirm WUI applicability with the fire marshal before ordering siding.'));

    // Seismic design value vs. site
    if (p.plan_sds && fx.sds) out.push(P('Seismic design', p.plan_sds >= fx.sds ? 'ok' : 'flag',
      'Plan designs for SDS ' + p.plan_sds.toFixed(2) + 'g; site value is ' + fx.sds.toFixed(2) + 'g',
      p.plan_sds >= fx.sds ? 'The structural design uses a seismic value at or above what USGS gives for this site (site class D), so it is conservative' + from('plan_sds') + '.'
        : 'The structural design uses a lower seismic value than USGS gives for this site. The engineer needs to re-run lateral design' + from('plan_sds') + '.'));

    // Soil bearing assumption vs. mapped soils
    var bearing = (p.structural || {}).bearing_psf, soils = (fx.soils || []).join('; ');
    if (bearing && soils) {
      var fine = /clay|silt/i.test(soils);
      out.push(P('Footing design vs. soils', fine && bearing > 1500 ? 'flag' : 'ok',
        'Footings designed for ' + fmt(bearing) + ' psf; mapped soil is ' + soils,
        fine ? (bearing > 1500 ? 'The IRC presumes only 1,500 psf for clay and silt soils without a geotechnical report, so the footings are undersized unless a soils report supports ' + fmt(bearing) + ' psf.'
          : 'That matches the IRC presumptive value for clay and silt soils (1,500 psf), so the footing design is reasonable for these soils. A soils report is still needed in mapped hazard areas.')
          : 'Mapped soils are coarser than clay/silt, so ' + fmt(bearing) + ' psf is likely conservative.' + from('bearing_psf'),
        null, fine && bearing > 1500 ? 'Get a geotechnical report confirming bearing capacity, or resize footings for 1,500 psf.' : null));
    }

    // Snow load (jurisdiction rule supplied by ctx.facts.snow if known)
    var pg = (p.structural || {}).ground_snow_load_psf;
    if (pg && fx.snow && fx.snow.pg) out.push(P('Roof snow load', pg >= fx.snow.pg ? 'ok' : 'flag',
      'Plan uses ' + pg + ' psf ground snow; Utah requires ' + fx.snow.pg + ' psf here',
      (pg >= fx.snow.pg ? 'Roof framing is designed at or above the ground snow load Utah requires for homes at this location (' + fx.snow.basis + ').'
        : 'Roof framing is designed below the ground snow load Utah requires here (' + fx.snow.basis + '); trusses, rafters and headers need to be re-checked.') + from('ground_snow_load_psf') +
      ' If the plan labels its value "ultimate" (ASCE 7-22), it uses a different basis than the study; the higher of the two is conservative.'));

    // Footprint vs. lot and setbacks
    var lot = fx.lot_sf || 1, d = fx.lot_dims || [0, 0], foot = (fp.residence_sf || 0) + (fp.garage_sf || 0);
    if (foot) {
      var maxCov = fx.zone_std && fx.zone_std.coverage;
      out.push(P('Lot coverage', maxCov && foot / lot > maxCov ? 'flag' : foot / lot < 0.25 ? 'ok' : 'watch',
        fmt(foot) + ' sq ft footprint = ' + Math.round(foot / lot * 100) + '% of the lot' + (maxCov ? ' (zone max ' + Math.round(maxCov * 100) + '%)' : ''),
        'House ' + fmt(fp.residence_sf || 0) + ' + garage ' + fmt(fp.garage_sf || 0) + ' sq ft' + from('residence_sf') + '.'));
    }
    var bw = Math.min(fp.width_ft || 0, fp.depth_ft || 0), bd = Math.max(fp.width_ft || 0, fp.depth_ft || 0);
    if (bw && bd) {
      var z = fx.zone_std, ew = d[0], ed = d[1], setTxt = '';
      if (z && z.front != null) { ew = d[0] - 2 * z.side; ed = d[1] - z.front - z.rear; setTxt = ' after ' + z.zone + ' setbacks (front ' + z.front + "', side " + z.side + "', rear " + z.rear + "')"; }
      var fits = bw <= ew && bd <= ed;
      out.push(P('Footprint vs. setback-only dimensions', fits ? 'verify' : 'flag',
        Math.round(bw) + "' x " + Math.round(bd) + "' envelope vs. ~" + Math.max(0, Math.round(ew)) + "' x " + Math.max(0, Math.round(ed)) + "' setback-only dimensions" + setTxt,
        (fits ? 'The envelope fits an approximate bounding-rectangle screen' + setTxt + '.' : 'The envelope exceeds the approximate bounding-rectangle screen' + setTxt + '.') +
        ' This is not a verified buildable area: easements and other no-build restrictions have not been subtracted. Confirm the actual lot shape and setback lines on the survey' + from('width_ft') + '.', null,
        'Overlay the footprint on the survey with setbacks, the septic field and any no-build areas.'));
    }
    if (p.height_ft && fx.zone_std && fx.zone_std.height) out.push(P('Building height', p.height_ft <= fx.zone_std.height ? 'ok' : 'flag',
      'Plan height ' + p.height_ft + "' vs. " + fx.zone_std.zone + " maximum " + fx.zone_std.height + "'",
      p.height_ft <= fx.zone_std.height ? 'Within the zone height limit.' : 'Over the zone height limit; lower the roof or seek a variance.'));

    // Fire flow & hydrant vs. house size
    if (foot > 3600 && fx.hydrant_ft != null) {
      var far = fx.hydrant_ft > 600, sprk = (p.features || []).some(function (f) { return /sprinkler/i.test(f.label); });
      out.push(P('House size vs. fire protection', far && !sprk ? 'watch' : 'ok',
        fmt(foot) + ' sq ft under one roof; nearest hydrant ~' + fmt(fx.hydrant_ft) + ' ft',
        'Homes over 3,600 sq ft of fire area need more fire flow under the fire code\'s Appendix B, and a hydrant must be within 600 ft of every part of a one- or two-family home, measured along the hose route. ' +
        (far ? (sprk ? 'The plan shows sprinklers, which helps.' : 'The plan shows no fire sprinklers; expect the fire district to require them or a closer hydrant.') : 'The hydrant distance looks workable; the district will confirm required fire flow.'),
        far && !sprk ? ctx.cost('fire_sprinklers') : null, 'Ask the fire district for the required fire flow for a ' + fmt(foot) + ' sq ft wood-frame house.'));
    }

    // Envelope vs. Utah's energy code (plan keynotes)
    var E = fx.energyCode, en = p.energy || {}, es = p.energySrc || {};
    if (E && (en.wallR || en.ceilingR || en.windowU || en.ach50)) {
      var gaps = [], meets = [];
      if (en.wallR) { var wr = en.wallR.cavity + (en.wallR.ci || 0); (wr >= E.wall ? meets : gaps).push('walls R-' + en.wallR.cavity + (en.wallR.ci ? '+' + en.wallR.ci + 'ci' : '') + ' vs R-' + E.wall); }
      if (en.ceilingR) (en.ceilingR >= E.ceiling ? meets : gaps).push('ceiling R-' + en.ceilingR + ' vs R-' + E.ceiling);
      if (en.windowU) (en.windowU <= E.windowU ? meets : gaps).push('windows U-' + en.windowU + ' vs U-' + E.windowU);
      if (en.ach50) (en.ach50 <= E.ach50 ? meets : gaps).push(en.ach50 + ' ACH50 target vs ' + E.ach50);
      var over = en.ceilingR && en.ceilingR > E.ceiling + 5 ? ' The ceiling (R-' + en.ceilingR + ') exceeds the R-' + E.ceiling + ' minimum, an upgrade rather than a requirement.' : '';
      out.push(P('Envelope vs. energy code', gaps.length ? 'flag' : 'ok',
        gaps.length ? 'Plan envelope falls short of Utah\'s code: ' + gaps.join('; ') : 'Plan envelope meets Utah\'s current energy code (' + meets.join('; ') + ')',
        'Compared with the code in effect since ' + E.since + ' (' + E.cite + ').' + over +
        (Object.keys(es).length ? ' Read from the plan: ' + Object.keys(es).map(function (k) { return es[k]; }).join('; ') + '.' : '') +
        ' Plan notes that quote IECC tables (for example R-20 + R-5 continuous walls) reflect the older code; Utah\'s 2026 chapter sets R-21 walls with no continuous-insulation path.' +
        (en.ach50 ? '' : ' The plan states no air-leakage target; the house must test at or below ' + E.ach50 + ' ACH50 or follow the air-sealing checklist.')));
    }
    // Fireplace vs. solid-fuel rules
    var sfa = fx.solidFuel;
    if (p.fireplace && sfa) {
      if (sfa.inside === true && p.fireplace !== 'gas') out.push(P('Fireplace vs. air-quality rule', p.fireplace === 'wood' ? 'flag' : 'watch',
        (p.fireplace === 'wood' ? 'Wood-burning fireplace' : 'Fireplace (fuel not confirmed)') + ' in a PM2.5 area',
        'Only EPA-qualified fireplaces or EPA-certified stoves may be installed here (R307-302-6). Specify an EPA-qualified unit or a gas fireplace' + from('fireplace') + '.'));
      else if (sfa.local && p.fireplace !== 'gas') out.push(P('Fireplace vs. local rule', 'flag', 'Plan shows a fireplace where new solid-fuel devices are banned', sfa.local + from('fireplace')));
      else out.push(P('Fireplace vs. air-quality rule', 'ok', p.fireplace === 'gas' ? 'Gas fireplace: not restricted' : 'Fireplace allowed here (outside the state wood-burning area)',
        (p.fireplace === 'unknown' ? 'The plan shows a masonry fireplace without a stated fuel' + from('fireplace') + '. ' : '') + 'This lot is outside the R307-302 install-ban area; no-burn-day rules and smoke limits still apply.'));
    }
    // Impervious area -> storm drain fee
    var swk = fx.kb && fx.kb.stormwater;
    if (swk && foot) {
      var esu = foot / swk.esuSqft, fee = Math.ceil(esu * 10) / 10 * swk.esuFee;
      out.push(P('Impervious area vs. storm drain fee', 'watch',
        fmt(foot) + ' sq ft of roof alone is about ' + esu.toFixed(2) + ' ESU (~$' + fmt(fee) + ' storm drain impact fee)',
        'At 6,200 sq ft of impervious surface per ESU and $' + swk.esuFee.toLocaleString('en-US', { minimumFractionDigits: 2 }) + ' per ESU. Add the driveway, walks and patios from the site plan; how the city rounds partial ESUs is not published.' + from('residence_sf'),
        { key: 'storm_drain_fee', low: Math.round(swk.esuFee * Math.max(1, esu)), high: Math.round(swk.esuFee * Math.max(1, esu) * 1.6), label: 'Storm drain impact fee (roof + estimated hardscape)' }));
    }

    // Hazards under the house
    if (fx.landslide_cov) out.push(P('Building pad vs. landslide', fx.landslide_cov > 0.6 ? 'flag' : 'watch',
      Math.round(fx.landslide_cov * 100) + '% of the lot is mapped ' + (fx.landslide_unit || 'landslide'),
      'Site the ' + fmt(foot || 0) + ' sq ft footprint on the unmapped part of the lot if possible; the geologic hazards study decides what\'s buildable.'));
    if (fx.sfha) out.push(P('Building pad vs. floodplain', 'flag', 'Part of the lot is in a FEMA flood zone',
      'The lowest floor (including any basement or crawlspace) must be at or above the base flood elevation; site the house outside the mapped zone if the lot allows.'));
    if (fx.fault && fx.fault.ft < 1000) out.push(P('Building pad vs. fault', 'flag', 'Mapped fault ~' + fmt(fx.fault.ft) + ' ft from the lot',
      'A surface-fault-rupture study sets a no-build setback; the footprint has to stay outside it.'));
    if (fx.slope != null && fx.slope > 10 && p.foundation !== 'basement') out.push(P('Design vs. slope', 'watch', 'Lot slopes ' + fx.slope.toFixed(0) + '%, plan has no walkout',
      'On a slope this steep a slab or crawlspace design needs tall stem walls or retaining on the downhill side; a walkout level often costs less.'));
    return out;
  };

  /* ------------------------------------------------------------ recorded documents (hosted document service)
   * /api/parcel-docs reads the county parcel record and OCRs the recorded plat; /api/notices searches Utah's Public Notice
   * Website for the subdivision and reads the matching meeting packets. Both return facts with citations. */
  function apiBase() {
    var cfg = (root.LR_DATA || {}).apiBase;
    if (cfg) return cfg.replace(/\/$/, '');
    try { if (/^https?:$/.test(root.location.protocol)) return ''; } catch (e) {}
    return null;
  }
  // GET a document-service endpoint; resolves to {error} on failure or timeout, never rejects.
  function apiGet(path, ms) {
    var base = apiBase();
    if (base == null) return Promise.resolve({ error: 'not connected' });
    var ctl = typeof AbortController !== 'undefined' ? new AbortController() : null, t = ctl && setTimeout(function () { ctl.abort(); }, ms || 290000);
    var ver = (root.LR_DATA || {}).apiVersion;
    return fetch(base + path + (ver ? (path.indexOf('?') >= 0 ? '&' : '?') + 'v=' + ver + ((root.LR_DATA||{}).refreshNonce ? '&refresh=' + root.LR_DATA.refreshNonce : '') : ''), { signal: ctl && ctl.signal }).then(function (r) { return r.json(); }).catch(function (e) { return { error: String(e.message || e) }; })
      .finally(function () { t && clearTimeout(t); });
  }

  function fetchDocs(parcel, juris) {
    if (apiBase() == null) return Promise.resolve({ unavailable: 'This copy of the app is not connected to the document service.' });
    var get = apiGet;
    var sub = parcel.attrs.SUBDIV_NAME;
    // Parcel record first (fast), then every recorded plat sheet OCR'd in parallel, one function call per sheet.
    var record = get('/api/parcel-docs?county=' + encodeURIComponent(parcel.county) + '&parcel=' + encodeURIComponent(parcel.id) + '&sheets=0').then(function (rec) {
      if (!rec || rec.error || !rec.plats || !rec.plats.length) return rec;
      var sheets = rec.plats;
      return Promise.all(sheets.map(function (sh) {
        // Cap each sheet at 90 s: dense certificate sheets can take two minutes and rarely hold lot detail. A capped
        // sheet keeps running server-side and is cached, so the next dossier for this lot includes it.
        return get('/api/plat-sheet?url=' + encodeURIComponent(sh.url) + (rec.lot ? '&lot=' + encodeURIComponent(rec.lot) : ''), 90000);
      })).then(function (rs) {
        var plat = { setbacks: null, entries: [], approvals: [], associations: [], hazardReports: [], notes: [] }, lotNotes = [];
        rs.forEach(function (r, i) {
          if (!r || r.error || !r.plat) return;
          var p = r.plat, sheet = r.sheet || sheets[i].sheet;
          if (!plat.setbacks && p.setbacks) plat.setbacks = Object.assign({}, p.setbacks, { sheet: sheet, url: r.url });
          ['entries', 'approvals', 'associations', 'hazardReports', 'notes'].forEach(function (k) {
            (p[k] || []).forEach(function (v) { var key = JSON.stringify(v.entry || v.text || v); if (!plat[k].some(function (x) { return JSON.stringify(x.entry || x.text || x) === key; })) plat[k].push(v); });
          });

          (r.notesForLot || []).forEach(function (n) { lotNotes.push(Object.assign({ sheet: sheet }, n)); });
        });
        var merged = root.PlatEvidence.mergeSheets(rec, rs);
        rec.plat = plat; rec.lotInfo = merged.lot; rec.lotNotes = lotNotes; rec.platEvidence = merged;
        rec.sheetsRead = merged.coverage.processed; rec.sheetsTotal = merged.coverage.total;
        return rec;
      });
    });
    var hoaQ = sub ? get('/api/hoa?q=' + encodeURIComponent(sub) + '&county=' + encodeURIComponent(parcel.county)) : Promise.resolve(null);
    return Promise.all([
      record,
      sub ? get('/api/notices?q=' + encodeURIComponent(sub) + '&county=' + encodeURIComponent(parcel.county) + '&juris=' + encodeURIComponent(juris || '')) : Promise.resolve(null)
    ]).then(function (r) {
      // Scanned will-serve letters in the subdivision's own staff report: OCR them (one call per exhibit, capped at 2).
      var docsWithScans = ((r[1] && r[1].documents) || []).filter(function (x) { return x && x.scans && x.scans.length; });
      var jobs = docsWithScans.slice(0, 2).map(function (x) {
        var sc = x.scans[0], pg = sc.pages[0] + '-' + sc.pages[sc.pages.length - 1];
        return get('/api/packet-ocr?url=' + encodeURIComponent(x.url) + '&pages=' + pg, 120000).then(function (o) { return o && !o.error ? { doc: x, scan: sc, ocr: o } : null; });
      });
      return Promise.all([hoaQ].concat(jobs)).then(function (h) { return { record: r[0], notices: r[1], hoa: h[0], letters: h.slice(1).filter(Boolean) }; });
    });
  }
  function cite(doc, page) { return doc.name + (page ? ', p. ' + page : '') + ' (' + doc.notice.entity + ', ' + doc.notice.date + ')'; }
  function replaceFinding(ctx, section, item, f) {
    var i = ctx.findings.findIndex(function (x) { return x.section === section && x.item === item; });
    if (i >= 0) ctx.findings[i] = f; else ctx.findings.push(f);
  }

  C.check_documents = async function (ctx) {
    var d = await (ctx.docs || fetchDocs(ctx.parcel, ctx.facts.jurisdiction)), out = [], rec = d.record || {}, no = d.notices || {};
    if (d.unavailable) {
      ctx.facts.platEvidence = { assessedAt: new Date().toISOString(), sheets: [], evidence: [], recordSource: { error: d.unavailable } };
      return [F('ccr', 'Recorded documents', 'verify', 'Plat and public-record lookup not connected', d.unavailable + ' Open the hosted version to read the plat and meeting records automatically.')];
    }
    ctx.facts.documentDiscovery={record:rec,documents:(no.documents||[]).filter(Boolean)};
    var plat = rec.plat || {}, docs = (no.documents || []).filter(Boolean), sub = ctx.parcel.attrs.SUBDIV_NAME || 'the subdivision';
    if (rec.supported === false) out.push(F('ccr', 'Recorded plat', 'verify', 'Recorded plat not read for ' + ctx.parcel.county + ' County yet',
      'Automatic plat reading (setback notes, recorded agreements, utility approvals) covers Weber County so far. Public meeting records were still searched for the subdivision.' +
      (docs.length ? '' : ' None mentioning it were found.'), 'County recorder', ctx.parcel.attrs.BOUNDARY_SRC || null));
    ctx.facts.platEvidence = rec.platEvidence || { sheets: (rec.plats || []).map(function (s) { return Object.assign({}, s, { processed: false }); }), readings: [], evidence: [], conflicts: [], coverage: { processed: 0, total: (rec.plats || []).length, geometryVerified: false, titleSearchComplete: false } };
    ctx.facts.platEvidence.references = (plat.entries || []).filter(function (e) { return /easement/i.test(e.label); }).concat((rec.references || []).filter(function (e) { return /easement/i.test(e.label || e.kind); }));
    ctx.facts.platEvidence.priorParcels = rec.priorParcels || [];
    ctx.facts.platEvidence.history = rec.history || null;
    ctx.facts.platEvidence.assessedAt = new Date().toISOString();
    ctx.facts.platEvidence.recordSource = { url: rec.parcelPage || null, legal: rec.legal || null, lot: rec.lot || null,
      parcel: ctx.parcel.id, error: rec.error || null };
    if (rec.plats && rec.plats.length) ctx.facts.platEvidence.bundleUrl = apiBase() + '/api/plat-bundle?county=' + encodeURIComponent(ctx.parcel.county) + '&parcel=' + encodeURIComponent(ctx.parcel.id) + '&v=' + encodeURIComponent((root.LR_DATA || {}).apiVersion || '');
    var platUrl = (rec.plats && rec.plats[0] && rec.plats[0].url) || rec.parcelPage;

    // Preserve existing candidate selection, but do not adjudicate source precedence.
    var std = docs.map(function (x) { return x.standards && Object.assign({ doc: x }, x.standards); }).filter(Boolean)[0];
    var sb = plat.setbacks;
    if (sb || std) {
      var front = sb ? sb.front : std.front, side = sb ? sb.side : std.side, rear = sb ? sb.rear : std.rear, street = sb ? sb.streetSide : std.streetSide;
      ctx.facts.zone_std = { zone: sb ? 'plat' : 'development standards', source: sb ? sb.url : std.doc.url, sourceSection: sb ? 'Plat setback note' : 'Development standards', front: front, side: side, rear: rear, street: street || null,
        height: std && std.heightMax || (ctx.facts.zone_std || {}).height || null, coverage: std && std.coverageMax ? std.coverageMax / 100 : null };
      replaceFinding(ctx, 'land', 'Plat setbacks', F('land', 'Plat setbacks', 'verify',
        'Reported setback candidates: ' + front + "' front, " + side + "' side" + (street ? ', ' + street + "' street side on corners" : '') + ', ' + rear + "' rear",
        (sb ? 'From the setback note on the recorded plat (sheet ' + (sb.sheet || '1') + '), which cites the ' + (sb.basis || 'plat') + (sb.entry ? ' recorded as Entry #' + sb.entry : '') + '. Controlling applicability is unverified. Retrieve cited original instruments and review their scope before relying on these values.'
          : 'From the development standards in ' + cite(std.doc) + '. Controlling applicability is unverified. Retrieve cited original instruments and review their scope before relying on these values.'),
        sb ? 'Recorded plat ' + (sb.sheet || '') : cite(std.doc), sb ? sb.url : std.doc.url));
    }
    if (std) {
      var bits = [];
      if (std.minLotArea && !/^NA$/i.test(std.minLotArea.trim())) bits.push('minimum lot ' + std.minLotArea.trim().toLowerCase());
      if (std.minLotWidth) bits.push(std.minLotWidth + "' minimum width");
      if (std.minStories) bits.push('at least one story');
      if (std.heightMax) bits.push(std.heightMax + "' max height" + (std.accessoryHeight ? ' (' + std.accessoryHeight + "' accessory)" : ''));
      if (std.coverageMax) bits.push(std.coverageMax + '% max lot coverage');
      var u = std.doc.uses;
      if (u && u.adu) bits.push('ADUs ' + ({ P: 'permitted', C: 'conditional', N: 'not allowed' }[u.adu.singleFamily] || u.adu.singleFamily));
      if (u && u.shortTermRental) bits.push('short-term rentals ' + ({ P: 'permitted', C: 'conditional', N: 'not allowed' }[u.shortTermRental.singleFamily] || u.shortTermRental.singleFamily));
      out.push(F('ccr', 'Development standards', 'watch', sub + ' ' + (std.section === 'single-family' ? 'single-family ' : '') + 'standards: ' + bits.slice(0, 3).join(', '),
        'From the development standards table in ' + cite(std.doc, std.doc.standardsPage) + ': ' + bits.join('; ') + '. Applicability and precedence over zone standards require review of the controlling originals; this table alone does not establish which rule governs.',
        cite(std.doc), std.doc.url));
    }

    // CC&Rs and the association.
    var ccr = [].concat.apply([], docs.map(function (x) { return (x.ccrs || []).map(function (c) { return Object.assign({ doc: x }, c); }); }));
    var platCcr = (plat.entries || []).filter(function (e) { return /CC&R|declaration/i.test(e.label); });
    var assoc = (plat.associations || [])[0];
    if (ccr.length || platCcr.length || assoc) {
      var main = ccr.find(function (c) { return c.entries.length; }) || ccr[0];
      var entries = Array.from(new Set((main ? main.entries : []).concat(platCcr.map(function (e) { return e.entry; }))));
      var head = main && main.entries.length ? main.title.replace(/\s+/g, ' ').slice(0, 90) + (main.dated ? ' (' + main.dated + ')' : '') : (assoc ? 'Governed by ' + title(assoc) : 'CC&Rs referenced in the public record');
      replaceFinding(ctx, 'ccr', 'CC&Rs / HOA', F('ccr', 'CC&Rs / HOA', 'watch', head,
        (assoc ? 'Association named on the recorded plat: ' + title(assoc).replace(/\.$/, '') + '. ' : '') +
        ((plat.entries || []).filter(function (e) { return /agreement/i.test(e.label); }).map(function (e) { return 'The plat also cites the ' + e.label.toLowerCase() + ' recorded as Entry #' + e.entry + '. '; }).join('')) +
        (entries.length ? 'Recorded as Entry ' + entries.join(', ') + ' with the ' + ctx.parcel.county + ' County Recorder. ' : '') +
        (main ? 'Source: ' + cite(main.doc, main.doc.mentionPages[0]) + '. ' : '') +
        'The recorded text itself is only sold by the Recorder (Weber: $1/page), so the dossier relies on the development standards above for design rules.',
        main ? cite(main.doc) : 'Recorded plat', main ? main.doc.url : platUrl, null,
        entries.length ? 'Order Entry ' + entries.join(', ') + ' from the County Recorder to read the full covenants.' : null));
    }

    // State HOA registry: registration status and the association's designated contact.
    var reg = d.hoa && d.hoa.matches && d.hoa.matches[0];
    if (reg) {
      ctx.facts.hoaReg = reg;
      ctx.facts.contacts = ctx.facts.contacts || [];
      ctx.facts.contacts.push({ kind: 'hoa', name: reg.name, people: (reg.contacts || []).map(function (c) { return { role: c.role, phone: c.phone, email: c.email }; }),
        lines: [(reg.status || 'Status unknown') + (reg.expires ? ', registration expires ' + reg.expires : '')], url: reg.source, source: reg.source });
      var pickC = (reg.contacts || []).filter(function (c) { return /Community Manager/i.test(c.role); })[0] || (reg.contacts || []).filter(function (c) { return /Payoff/i.test(c.role); })[0] || (reg.contacts || [])[0];
      var active = /active/i.test(reg.status || '');
      var others = (d.hoa.matches || []).slice(1).map(function (m) { return m.name + ' (' + (m.status || '?') + ')'; });
      out.push(F('ccr', 'HOA registration', active ? 'ok' : 'watch', reg.name + ': ' + (reg.status || 'status unknown') + (reg.expires ? ', registration ' + (active ? 'through ' : 'expired ') + reg.expires : ''),
        'From the Utah HOA registry (registration ' + (reg.registration || 'n/a') + ', ' + [reg.city, reg.county && reg.county + ' County'].filter(Boolean).join(', ') + '). ' +
        (active ? '' : 'An expired registration can mean the association is not current with the state; ask about its standing, reserves and any pending assessments. ') +
        (pickC ? 'Contact for documents (' + pickC.role.toLowerCase() + '): ' + [pickC.phone, pickC.email].filter(Boolean).join(', ') + '. ' : '') +
        (others.length ? 'Other registered associations with this name: ' + others.join('; ') + '. ' : '') +
        'The registry lists contacts only, not CC&Rs or design guidelines.',
        'Utah HOA registry', reg.source, null,
        'Ask the association for its CC&Rs, architectural design guidelines, review timeline and fees' + (pickC && pickC.email ? ' (' + pickC.email + ')' : '') + '.'));
    }

    // Utilities: will-serve statements in the approval record and the plat's approval blocks.
    var util = [].concat.apply([], docs.map(function (x) { return (x.utilities || []).map(function (q) { return Object.assign({ doc: x }, q); }); }));
    var sewerDoc = util.find(function (q) { return q.kind === 'sewer' && q.provider; });
    var sewerPlat = (plat.approvals || []).find(function (a) { return /SEWER/.test(a); });
    if (sewerDoc || sewerPlat) {
      var prov = sewerDoc ? sewerDoc.provider : title(sewerPlat);
      ctx.facts.sewer = prov;
      ctx.facts.septic = Object.assign(ctx.facts.septic || {}, { required: false });
      replaceFinding(ctx, 'septic', 'Sewer vs. septic', F('septic', 'Sewer vs. septic', 'watch', 'Sewered: ' + prov + ' serves the subdivision',
        (sewerDoc ? '"' + sewerDoc.text.replace(/\s+/g, ' ').slice(0, 220) + '" (' + cite(sewerDoc.doc) + '). ' : '') +
        (sewerPlat ? 'The recorded plat carries the ' + title(sewerPlat) + ' approval block. ' : '') +
        'The septic soil limits do not apply; budget the sewer connection and impact fee instead.',
        sewerDoc ? cite(sewerDoc.doc) : 'Recorded plat', sewerDoc ? sewerDoc.doc.url : platUrl, ctx.cost('sewer_connection'),
        'Get the connection and impact fee from ' + prov + '.'));
    }
    var waterDoc = util.find(function (q) { return q.kind === 'culinary water' && q.provider; });
    if (waterDoc) {
      ctx.facts.culinary = waterDoc.provider;
      replaceFinding(ctx, 'water', 'Culinary water', F('water', 'Culinary water', 'watch', 'Culinary water: ' + waterDoc.provider + ' (will-serve letter on file)',
        '"' + waterDoc.text.replace(/\s+/g, ' ').slice(0, 240) + '" (' + cite(waterDoc.doc) + '). This supersedes the state service-area map for this subdivision.',
        cite(waterDoc.doc), waterDoc.doc.url, ctx.cost('culinary_connection'), 'Get the connection fee and any share requirement from ' + waterDoc.provider + '.'));
    }

    // Water will-serve letter (OCR'd from the staff report exhibit) and the staff reports' water lines.
    var letter = (d.letters || []).filter(function (l) { return l.ocr.water && l.ocr.water.supplier; })[0];
    var wnotes = [].concat.apply([], docs.map(function (x) { return (x.water || []).map(function (w) { return Object.assign({ doc: x }, typeof w === 'string' ? { text: w } : w); }); }));
    var wellNote = wnotes.filter(function (w) { return /wells? ha(?:ve|s) been drilled/i.test(w.text); })[0];
    var secNotes = wnotes.filter(function (w) { return /secondary water|Landscape Covenant/i.test(w.text) && !/exempt|wildland|covenant shall/i.test(w.text); });
    if (letter) {
      var wf = letter.ocr.water, lp = function (k) { return wf[k] ? cite(letter.doc, wf[k].page) : ''; }, v = function (k) { return wf[k] && wf[k].value; };
      var sup = v('supplier'), both = /secondary/i.test(v('services') || '');
      ctx.facts.waterServices = v('services');
      ctx.facts.culinary = sup;
      var supply = [v('storage') && 'Storage: ' + v('storage') + (v('fireFlow') ? ', sized for a fire flow of ' + v('fireFlow') : '') + '.',
        v('wells') && 'Supply: ' + v('wells') + ' at the time of the letter' + (wellNote ? '; a later staff report says "' + ((wellNote.text.replace(/\s+/g, ' ').match(/[^.]*wells? ha(?:ve|s) been drilled[^.]*\./i) || [wellNote.text])[0]).trim().slice(0, 200) + '" (' + cite(wellNote.doc, wellNote.page) + ')' : '') + '.',
        v('waterRights') && 'Water rights: ' + v('waterRights') + '.',
        v('connections') && 'System approved for ' + v('connections') + '.'].filter(Boolean).join(' ');
      replaceFinding(ctx, 'water', 'Culinary water', F('water', 'Culinary water', 'watch', 'Culinary' + (both ? ' and secondary' : '') + ' water: ' + sup + ' (feasibility letter' + (v('date') ? ', ' + v('date') : '') + ')',
        (v('formerly') ? sup + ' (formerly ' + v('formerly') + ')' : sup) + (v('pws') ? ', public water system #' + v('pws') : '') + ', confirmed capacity to serve the subdivision. ' +
        (v('shares') ? v('shares') + '. ' : '') + supply + (v('fees') ? ' Buyers pay ' + v('fees').replace(/\s+/g, ' ') + '.' : '') +
        ' Read from the scanned letter in ' + lp('supplier') + '; this supersedes the state service-area map.',
        cite(letter.doc, wf.supplier.page), letter.doc.url, ctx.cost('culinary_connection'),
        'Confirm in the purchase contract that the lot\'s ' + (v('shares') && /Class A/i.test(v('shares')) ? 'Class A (connection)' + (/Class C/i.test(v('shares')) ? ' and Class C (irrigation)' : '') + ' shares' : 'water shares') + ' convey at closing, and get the hook-up and connection fees from ' + sup + '.'));
      if (both || secNotes.length) replaceFinding(ctx, 'water', 'Secondary (irrigation) water', F('water', 'Secondary (irrigation) water', secNotes.length ? 'watch' : 'ok',
        both ? 'Secondary water from ' + sup + (v('shares') && /Class C/i.test(v('shares')) ? ' (Class C irrigation shares)' : '') : 'Secondary water: see staff report',
        (both ? 'The feasibility letter covers secondary (irrigation) water as well as culinary. ' : '') +
        secNotes.slice(0, 3).map(function (w) { return '"' + w.text.replace(/\s+/g, ' ').slice(0, 200) + '" (' + cite(w.doc, w.page) + ')'; }).join(' ') +
        (secNotes.length ? ' A Restricted Landscape Covenant, if recorded, limits landscaping to what the lot\'s water allotment supports.' : '') +
        ' The state map also shows an irrigation company system over this area; for this subdivision the letter governs.',
        cite(letter.doc, wf.supplier.page), letter.doc.url, null,
        'Get the per-lot secondary water allotment from ' + sup + ', and check the title commitment for a Restricted Landscape Covenant on the lot.'));
    } else if (secNotes.length) {
      out.push(F('water', 'Secondary water (staff report)', 'watch', 'Staff report: secondary water allotment not settled',
        secNotes.slice(0, 3).map(function (w) { return '"' + w.text.replace(/\s+/g, ' ').slice(0, 200) + '" (' + cite(w.doc, w.page) + ')'; }).join(' '),
        cite(secNotes[0].doc, secNotes[0].page), secNotes[0].doc.url, null, 'Check the title commitment for a Restricted Landscape Covenant and ask the water company for the per-lot allotment.'));
    }

    // Developer-specific fee agreements (matched on the developer named in the water letter or the owner of record).
    var kbx = ctx.facts.kb, devName = letter && letter.ocr.water.developer && letter.ocr.water.developer.value;
    ((kbx && kbx.feeAgreements) || []).forEach(function (ag) {
      var hit = [devName, ctx.facts.owner].filter(function (n) { return n && ag.match.test(n); })[0];
      if (!hit) return;
      var i = ctx.findings.findIndex(function (x) { return x.item === 'Permit & impact fees'; });
      if (i < 0) return;
      var fnd = ctx.findings[i];
      fnd.detail = 'Developer fee agreement: ' + ag.text + ' ' + (hit === devName ? 'The water company\'s letter names ' + devName + ' as the subdivision\'s developer' : 'The owner of record is ' + hit) +
        (ctx.facts.owner && hit !== ctx.facts.owner ? ' (owner of record: ' + ctx.facts.owner + ')' : '') + ', so impact fees for this lot may be lower than the city rates below if the agreement covers your permit. ' + fnd.detail;
      fnd.next_step = 'Ask the city whether Resolution 2026-25 applies to a permit you pull on this lot, or only to ' + ag.name + '\'s own permits. ' + (fnd.next_step || '');
    });

    // Fee figures vs. the city's agendas: anything adopted after the records we hold makes the numbers suspect.
    var recs = kbx && kbx.records, wd = ctx.watch ? await ctx.watch : null, wl = wd && wd.items;
    var feeRow = ctx.findings.filter(function (x) { return x.item === 'Permit & impact fees'; })[0];
    if (recs && feeRow) {
      if (!wl) feeRow.detail += ' (Could not check the city\'s agendas for newer fee actions this time.)';
      else {
        var fresh = wl.filter(function (i) { return /XX/i.test(i.number) ? i.date > recs.asOf : recs.known.indexOf(i.kind + ' ' + i.number) < 0; });
        var since = wl.filter(function (i) { return i.date > recs.feeAdopted && !/XX/i.test(i.number) && !(i.kind === 'Resolution' && i.number === '2026-28') && fresh.indexOf(i) < 0; }).slice(0, 4);
        var desc = function (i) { return i.kind + ' ' + i.number + ' (' + i.date + '): ' + i.title.replace(/^An? (?:Resolution|Ordinance) of (?:the City Council of )?[^,]+,\s*Utah,?\s*/i, '').replace(/&#0?39;/g, "'").slice(0, 110); };
        if (fresh.length) {
          feeRow.status = 'verify';
          feeRow.detail = 'Newer fee action on the city\'s agendas: ' + fresh.slice(0, 3).map(desc).join('; ') + '. The figures below predate it. ' + feeRow.detail;
          feeRow.next_step = 'Request the current fee schedule from the ' + recs.custodian.role + ' (' + recs.custodian.email + '). ' + (feeRow.next_step || '');
        }
        feeRow.detail += ' Checked the city\'s agendas through ' + (wl[0] ? wl[0].date : 'today') + (since.length ? '; other fee actions since the schedule was adopted: ' + since.map(desc).join('; ') + '.' : '; no other fee actions since the schedule was adopted.');
      }
    }

    // The lot itself, as drawn on the recorded plat.
    var L = rec.lotInfo;
    if (L || (rec.lotNotes && rec.lotNotes.length)) {
      var bits = [];
      if (L && L.acres) bits.push(L.acres + ' acres platted');
      if (L && L.easements.length) bits.push(L.easements.join(', '));
      if (L && L.mentions.length) bits.push(L.mentions.map(function (x) { return x.toLowerCase(); }).join(', ') + ' detected near the lot label');
      var lotNo = (L && L.lot) || rec.lot;
      ctx.facts.ownerRecord = rec.ownerRecord || null;
      ctx.facts.parcelDoc = { lot: lotNo, legal: rec.legal || null, platAddress: L && L.platAddress, acres: L && L.acres, easements: (L && L.easements) || [] };
      out.push(F('land', 'Lot on the recorded plat', 'verify', 'Lot ' + lotNo + (bits.length ? ': ' + bits.join('; ') : ''),
        (rec.legal ? 'Legal description: ' + rec.legal + ' ' : '') +
        (L ? 'Across the linked plat sheets (suggested starting sheet ' + L.sheet + '): ' + (L.acres ? L.acres + ' acres; ' : '') + (L.platAddress ? 'platted address ' + L.platAddress + '; ' : '') +
          (L.easements.length ? 'easement labels detected near this lot: ' + L.easements.join(', ') + '. Exact extent, applicability and restrictions are not verified. ' : 'No easement labels detected near this lot by OCR; this does not establish absence of easements. ') : '') +
        (rec.lotNotes && rec.lotNotes.length ? 'Plat notes naming this lot: ' + rec.lotNotes.map(function (n) { return '"' + n.text.slice(0, 160) + '"'; }).join(' ') + ' ' : '') +
        (rec.sheetsTotal ? '(' + rec.sheetsRead + ' of ' + rec.sheetsTotal + ' plat sheets processed by OCR; not a complete easement or title review.)' : ''),
        'Recorded plat ' + ((L && L.sheet) || ''), (L && L.url) || platUrl));
    }

    var pe = ctx.facts.platEvidence, categories = Array.from(new Set([].concat.apply([], pe.evidence.map(function (e) { return e.categories || []; }))));
    out.push(F('easements', 'Easement evidence and coverage', 'verify',
      pe.evidence.length ? 'Potential easements found; lot boundaries and legal effect unverified' : 'Easement review incomplete',
      (categories.length ? 'Plat text mentions: ' + categories.join('; ') + '. These can refer to other lots or legend symbols. ' : 'No reliable easement text was extracted. ') +
      'All linked sheets are listed in the evidence section below. A lot can continue across sheets. OCR labels do not trace easement boundaries, and a current plat does not reveal every separately recorded, historical, amended or released easement. ' +
      'The generated site plan excludes easement geometry and cannot establish a buildable envelope.',
      'Recorded plat set', pe.bundleUrl || platUrl));
    out.push(F('easements', 'Recorded instruments and title exceptions', 'verify', 'Separate easement instruments and title exceptions still unresolved',
      'Parcel-page references and plat citations are discovery leads, not a complete chain-of-title search. ' +
      (pe.references.length ? 'Easement references detected: ' + pe.references.map(function (e) { return 'Entry ' + e.entry; }).join(', ') + '. ' : '') +
      (pe.priorParcels.length ? 'Prior parcels identified for historical record matching: ' + pe.priorParcels.join(', ') + '. ' : '') +
      'Recorded instrument images, amendments/releases and a current title exception schedule have not been reconciled. No all-clear is issued for utility, access, drainage, conservation, temporary, blanket or other easements.',
      'County parcel record', rec.parcelPage || platUrl));

    // Subdivision geologic report referenced on the plat.
    (plat.hazardReports || []).slice(0, 1).forEach(function (h) {
      out.push(F('geo', 'Subdivision geologic report', 'ok', 'Geologic hazards report on file' + (h.date ? ' (' + title(h.date) + ')' : ''),
        (h.title ? '"' + title(h.title) + '"' : 'A geologic hazards evaluation') + (h.firm ? ' by ' + title(h.firm) : '') + ' covers the subdivision, per the recorded plat.' +
        (h.publicReview ? ' The plat says it is available for public review at the county planning office; ask for it before ordering a new study.' : '') +
        ' The link searches the state geologic report archive for this title.',
        'Recorded plat + UGS GeoData Archive', 'https://geodata.geology.utah.gov/pages/search.php?search=' + encodeURIComponent((h.title || '').replace(/,.*$/, '') + (h.firm ? ' ' + h.firm.split(' ')[0] : ''))));
    });

    // Approval history from public meetings.
    var hist = (no.notices || []).filter(function (n) { return /planning|commission|administrative|council/i.test(n.body + ' ' + n.title); }).slice(0, 5);
    if (hist.length) out.push(F('land', 'Approval history', 'ok', hist.length + ' public meetings on ' + sub.replace(/\s+Phase.*$/i, ''),
      hist.map(function (n) { return n.date + ' ' + n.body + ': ' + n.title; }).join('; ') + '.', 'Utah Public Notice Website', hist[0].url));
    if (rec.error && no && no.error) out.push(F('ccr', 'Recorded documents', 'verify', 'Document service did not respond', rec.error));
    return out;
  };

  /* Utah Geological Survey GeoData Archive: site-specific consultant reports (geologic hazards, fault, geotechnical).
   * Since HB 384 (May 2024) agencies must submit every such report they receive during permitting. The archive is
   * browser-only (no open API), so the dossier links to a pre-filled search the user opens in their own browser. */
  /* UGS Subsurface Geotechnical Database (the borehole map's open WFS): geolocated test borings and pits from
   * consultant reports, with measured groundwater depth, bedrock depth and a link to the source report. */
  var BOREHOLES = 'https://ugs-geoserver-prod-flbcoqv7oa-uc.a.run.app/geoserver/wfs';
  C.check_boreholes = async function (ctx) {
    var lat = ctx.parcel.cy, lon = ctx.parcel.cx, dLat = 0.0145, dLon = 0.0145 / Math.cos(lat * Math.PI / 180); // ~1 mile box
    var d = await fetchJSON(BOREHOLES, { params: { service: 'WFS', version: '1.1.0', request: 'GetFeature', typeName: 'hazards:boreholes_locations_current',
      outputFormat: 'application/json', maxFeatures: 300,
      propertyName: 'boreid,project_name,consultant,date_completed,latitude,longitude,gw_depth,bedrock_refusal,geologic_unit,exploration_type,report_url',
      cql_filter: 'latitude BETWEEN ' + (lat - dLat).toFixed(5) + ' AND ' + (lat + dLat).toFixed(5) + ' AND longitude BETWEEN ' + (lon - dLon).toFixed(5) + ' AND ' + (lon + dLon).toFixed(5) } });
    var holes = (d.features || []).map(function (f) { var p = f.properties; p.km = distPts(lon, lat, p.longitude, p.latitude) / 1000; return p; })
      .filter(function (p) { return p.km <= 1.61; }).sort(function (a, b) { return a.km - b.km; });
    if (!holes.length) return [F('geo', 'Nearby test borings', 'ok', 'No archived geotechnical borings within 1 mile',
      "Checked the Utah Geological Survey's Subsurface Geotechnical Database (16,000+ borings and test pits from consultant reports). Coverage is densest along the Wasatch Front; without nearby borings, the site geotechnical report will be the first subsurface data for this lot.",
      'UGS Subsurface Geotechnical Database', 'https://borehole.geology.utah.gov/')];
    var reports = {};
    holes.forEach(function (h) { (reports[h.report_url] = reports[h.report_url] || []).push(h); });
    var list = Object.keys(reports).map(function (u) { var hs = reports[u]; return { url: u, holes: hs, km: hs[0].km, p: hs[0] }; }).sort(function (a, b) { return a.km - b.km; });
    var gw = holes.filter(function (h) { return h.gw_depth != null; }), rock = holes.filter(function (h) { return h.bedrock_refusal != null; });
    var shallow = gw.length ? Math.min.apply(0, gw.map(function (h) { return h.gw_depth; })) : null;
    ctx.facts.boreholes = { n: holes.length, gwMin: shallow, nearestKm: holes[0].km };
    var mi = function (km) { return (km / 1.609).toFixed(km < 0.8 ? 2 : 1) + ' mi'; };
    return [F('geo', 'Nearby test borings', shallow != null && shallow < 10 ? 'watch' : 'ok',
      holes.length + ' archived boring' + (holes.length > 1 ? 's' : '') + ' within 1 mile (nearest ' + mi(holes[0].km) + ')' + (shallow != null ? '; groundwater measured as shallow as ' + shallow + ' ft' : ''),
      list.slice(0, 3).map(function (r) {
        var g = r.holes.filter(function (h) { return h.gw_depth != null; }).map(function (h) { return h.gw_depth; });
        return '"' + r.p.project_name + '" (' + (r.p.consultant || 'consultant') + ', ' + (r.p.date_completed || '').slice(0, 4) + ', ' + mi(r.km) + ' away, ' + r.holes.length + ' ' +
          (r.p.exploration_type || 'boring').toLowerCase() + (r.holes.length > 1 ? 's' : '') + (g.length ? ', groundwater at ' + g.slice(0, 4).join(', ') + ' ft' : '') + ')';
      }).join('; ') + '. Measured depths from real borings are better evidence than the soil-survey estimate; share the nearest report with your geotechnical engineer.' +
      (rock.length ? ' Refusal on bedrock at ' + rock.slice(0, 3).map(function (h) { return h.bedrock_refusal + ' ft'; }).join(', ') + '.' : ''),
      'UGS Subsurface Geotechnical Database', list[0].url)];
  };

  C.check_contacts = async function (ctx) {
    var juris = ctx.facts.jurisdiction, c = CONTACTS[juris];
    ctx.facts.contacts = ctx.facts.contacts || [];
    if (!c) {
      ctx.facts.contacts.push({ name: juris, lines: ['Contacts for this jurisdiction are not on file yet.'] });
      return [F('permits', 'Building department', 'verify', 'Building department contacts not on file for ' + juris + ' yet',
        'Cornerpin has verified building-department and city contacts for its pilot jurisdictions. For ' + juris + ', use the official city or county website; the Utah Public Notice Website lists its public bodies and meeting locations.',
        'Utah Public Notice Website', 'https://www.utah.gov/pmn/search.html', null, 'Find who approves building plans in ' + juris + ' and how plans are submitted.')];
    }
    ['building', 'planning', 'office'].forEach(function (k) { if (c[k]) ctx.facts.contacts.push(Object.assign({ kind: k, source: c.source, asOf: c.asOf }, c[k])); });
    var rq = ctx.facts.kb && ctx.facts.kb.records;
    // Check the city's agendas for fee actions newer than the records we hold (read back in check_documents).
    if (rq) ctx.watch = apiGet('/api/watch?entity=' + encodeURIComponent(juris) + '&since=' + rq.since, 60000);
    if (rq && rq.unposted && rq.unposted.length) {
      var body = 'Under the Utah Government Records Access and Management Act (Utah Code 63G-2-204), I am requesting copies of the following ' + juris + ' records:\n\n' +
        rq.unposted.map(function (u, i) { return (i + 1) + '. ' + u; }).join('\n\n') +
        '\n\nElectronic copies (PDF) by email are preferred. If fees will exceed $25, please send an estimate before processing.\n\nThank you,\n\n[Your name]\n[Mailing address]\n[Daytime phone]';
      ctx.facts.contacts.push({ kind: 'records', name: 'Public records (GRAMA)', people: [{ role: rq.custodian.role, email: rq.custodian.email }],
        lines: ['Not posted online: ' + rq.unposted.map(function (u) { return u.split(',')[0]; }).join('; ') + '.', 'The city has 10 business days to respond to a written request with your name, mailing address and phone.'],
        mailto: 'mailto:' + rq.custodian.email + '?subject=' + encodeURIComponent('GRAMA records request') + '&body=' + encodeURIComponent(body) });
    }
    var b = c.building, lead = b.people[0];
    return [F('permits', 'Building department', 'ok', 'Plans are approved by ' + b.approver,
      b.people.map(function (p) { return p.role + ': ' + [p.phone, p.email].filter(Boolean).join(', '); }).join('. ') + '. ' + (b.lines || []).join('. ') + '. (as of ' + c.asOf + ')',
      juris + ' building department', b.portal || c.source, null,
      'Submit plans through the permit portal' + (lead.email ? '; plan-review questions to ' + lead.email : lead.phone ? '; plan-review questions to ' + lead.phone : '') + '.')];
  };

  // National Register historic districts (UGRC). Listing alone doesn't restrict private owners, but many listed districts
  // are also local historic overlays with design review by a landmark commission.
  C.check_historic = async function (ctx) {
    var hits = [];
    for (var n of ['HistoricDistricts', 'National_Historic_Building_Districts']) {
      var f = await arcgisQuery(UGRC + '/' + n + '/FeatureServer/0', { geometry: ctx.parcel.geometry, outFields: 'NAME,CITY,COUNTY' }).catch(function () { return []; });
      f.forEach(function (x) { if (hits.indexOf(x.attributes.NAME) < 0) hits.push(x.attributes.NAME); });
      if (hits.length) break;
    }
    if (!hits.length) return [F('land', 'Historic district', 'ok', 'Not in a National Register historic district', 'Checked the state historic district layers.', 'UGRC historic districts')];
    return [F('land', 'Historic district', 'watch', 'Inside the ' + hits.join(' and '),
      'National Register listing by itself does not limit what a private owner builds, but many listed districts are also local historic districts where new construction and exterior changes need design approval from a landmark or historic preservation commission. Check the city zoning map for a historic overlay.',
      'UGRC historic districts', null, null, 'Confirm with ' + (ctx.facts.jurisdiction || 'the city') + ' planning whether a local historic overlay applies and what its design review requires.')];
  };

  C.check_ugs_archive = async function (ctx) {
    var a = ctx.parcel.attrs, ugs = 'https://geodata.geology.utah.gov/pages/search.php?search=';
    var sub = (a.SUBDIV_NAME || '').replace(/\b(phase|ph\.?|plat|unit|amended|subdivision|subd\.?|pud|no\.?)\b.*$/i, '').trim();
    var street = String(a.PARCEL_ADD || '').replace(/^\d+\s+/, '').trim();
    var city = String(a.PARCEL_CITY || '').replace(/ City$/i, '').trim();
    var term = sub || (street && city ? street + ' ' + city : street) || ctx.parcel.county + ' County';
    var hz = ctx.facts.landslide_cov || (ctx.facts.fault && ctx.facts.fault.ft < 5280);
    return [F('geo', 'State geologic report archive', 'verify', 'Search the UGS archive for site reports on ' + (sub || street || 'this area'),
      "The Utah Geological Survey's GeoData Archive holds thousands of consultant geologic-hazard, fault and geotechnical reports, and since May 2024 every such report filed for a permit must be submitted to it. " +
      'A report for this subdivision or a neighbor can stand in for, or narrow, a new study' + (hz ? ', which matters here given the mapped hazards nearby' : '') + '. ' +
      'The link opens a search for "' + term + '"' + (sub && street ? '; also try "' + street + '" or the consultant named on the plat' : '') + '.',
      'UGS GeoData Archive', ugs + encodeURIComponent(term), null,
      'Open the archive search; if a report covers this lot, share it with your geotechnical engineer before ordering a new study.')];
  };

  /* ------------------------------------------------------------ permit packet */
  // Everything we can gather or estimate for the building permit application, so the user only supplies what needs
  // their judgment, a signature or a professional's stamp. Statute: Utah Code 10-20-909(12) (complete application).
  var PROVIDERS = [
    { re: /Ogden Valley Mutual Water/i, kind: 'water', name: 'Ogden Valley Mutual Water Company', mail: '3718 N. Wolf Creek Drive, Eden, UT 84310',
      lines: ['3718 N. Wolf Creek Drive, Eden, UT 84310 (address on its letterhead; no published phone or email)'] },
    { re: /Wolf Creek Water (and|&) Sewer/i, kind: 'sewer', name: 'Wolf Creek Water & Sewer Improvement District', email: 'aames@wcwsid.com', phone: '801-745-3435',
      lines: ['P.O. Box 658, Eden, UT 84310', 'Office: 2580 N Highway 162, Suite A'], src: 'https://www.utah.gov/pmn/sitemap/publicbody/875.html' },
    { re: /Weber Fire District/i, kind: 'fire', name: 'Weber Fire District, Fire Marshal\'s Office', email: 'prevention@weberfiredistrict.gov', phone: '801-782-3580 ext. 305',
      lines: ['Plan reviews and fire permits'], src: 'https://www.weberfiredistrict.gov/fire-prevention' }
  ];
  function provider(name) { return name ? PROVIDERS.filter(function (p) { return p.re.test(name); })[0] || null : null; }

  // Business days after a date (weekends skipped; state holidays not counted, so dates can slip a day).
  function addBusinessDays(d, n) {
    var x = new Date(d.getTime());
    while (n > 0) { x.setDate(x.getDate() + 1); if (x.getDay() !== 0 && x.getDay() !== 6) n--; }
    return x;
  }
  function day(d) { return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); }

  function streetCase(t) { return title(t).replace(/\b(RD|DR|ST|LN|CT|AVE|CIR|WAY|PL|BLVD|HWY|PKWY|TRL|LOOP|XING)\b/g, function (m) { return m[0] + m.slice(1).toLowerCase(); }); }
  function polyArea(p) { var s = 0; for (var i = 0; i < p.length; i++) { var a = p[i], b = p[(i + 1) % p.length]; s += a[0] * b[1] - b[0] * a[1]; } return s / 2; }
  function centroid(p) { var x = 0, y = 0; p.forEach(function (q) { x += q[0]; y += q[1]; }); return [x / p.length, y / p.length]; }
  function segDist(p, a, b) {
    var dx = b[0] - a[0], dy = b[1] - a[1], t = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy || 1);
    t = Math.max(0, Math.min(1, t)); return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy);
  }
  function inPoly(p, poly) { return inRing(p[0], p[1], poly); }

  // Marching squares on a regular grid of elevations (feet); returns [[x1,y1,x2,y2,level],...] in local feet.
  function contours(grid, nx, ny, x0, y0, step, interval, levels) {
    var segs = [], zs = grid.filter(function (z) { return z != null; });
    if (zs.length < 4) return segs;
    var lo = Math.ceil(Math.min.apply(0, zs) / interval) * interval, hi = Math.max.apply(0, zs), list = levels || [];
    if (!levels) for (var l0 = lo; l0 <= hi; l0 += interval) list.push(l0);
    for (var li = 0; li < list.length; li++) { var lev = list[li];
      for (var j = 0; j < ny - 1; j++) for (var i = 0; i < nx - 1; i++) {
        var c = [grid[j * nx + i], grid[j * nx + i + 1], grid[(j + 1) * nx + i + 1], grid[(j + 1) * nx + i]];
        if (c.some(function (z) { return z == null; })) continue;
        var P = [[i, j], [i + 1, j], [i + 1, j + 1], [i, j + 1]], pts = [];
        for (var k = 0; k < 4; k++) {
          var za = c[k], zb = c[(k + 1) % 4];
          if ((za < lev) !== (zb < lev)) {
            var t = (lev - za) / (zb - za), A = P[k], B = P[(k + 1) % 4];
            pts.push([x0 + (A[0] + (B[0] - A[0]) * t) * step, y0 + (A[1] + (B[1] - A[1]) * t) * step]);
          }
        }
        if (pts.length >= 2) segs.push([pts[0][0], pts[0][1], pts[1][0], pts[1][1], lev]);
        if (pts.length === 4) segs.push([pts[2][0], pts[2][1], pts[3][0], pts[3][1], lev]);
      }
    }
    return segs;
  }

  // Draft site plan: lot lines, setback (buildable) area, house footprint placed toward the street, driveway, GIS elevation
  // contours, distances to lot lines, north arrow and scale. Public data only; a surveyor finalizes it.
  async function sitePlan(ctx) {
    var lat0 = ctx.parcel.cy, F2 = FT_PER_M, toFt = function (q) { var m = toLocal(q[0], q[1], lat0); return [m[0] * F2, m[1] * F2]; };
    var ring = ctx.parcel.rings.reduce(function (a, r) { return r.length > a.length ? r : a; }, []), lot = ring.map(toFt);
    if (lot.length > 2 && lot[0][0] === lot[lot.length - 1][0] && lot[0][1] === lot[lot.length - 1][1]) lot.pop();
    if (polyArea(lot) < 0) lot.reverse();
    var c0 = centroid(lot); lot = lot.map(function (p) { return [p[0] - c0[0], p[1] - c0[1]]; });
    var shift = function (q) { var p = toFt(q); return [p[0] - c0[0], p[1] - c0[1]]; };
    // Street edges: lot edges whose midpoint lies within 60 ft of a mapped road centerline.
    var roads = await arcgisQuery(UGRC + '/UtahRoads/FeatureServer/0', { geometry: ctx.parcel.geometry, distance: 40, returnGeometry: true, outFields: 'FULLNAME' }).catch(function () { return []; });
    var rsegs = [];
    roads.forEach(function (r) { ((r.geometry || {}).paths || []).forEach(function (pa) { for (var i = 0; i < pa.length - 1; i++) rsegs.push([shift(pa[i]), shift(pa[i + 1]), r.attributes.FULLNAME]); }); });
    var edges = lot.map(function (p, i) {
      var q = lot[(i + 1) % lot.length], mid = [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2], len = Math.hypot(q[0] - p[0], q[1] - p[1]);
      var near = rsegs.reduce(function (b, s) { var d = segDist(mid, s[0], s[1]); return !b || d < b.d ? { d: d, name: s[2] } : b; }, null);
      return { a: p, b: q, mid: mid, len: len, roadD: near ? near.d : Infinity, road: near && near.d < 60 ? near.name : null };
    });
    // Frontages: runs of consecutive edges along the same street (curves are drawn as many short segments).
    var runs = [], start = edges.findIndex(function (e, i) { return e.road !== edges[(i + edges.length - 1) % edges.length].road; });
    if (start < 0) start = 0;
    for (var k = 0; k < edges.length; k++) {
      var e = edges[(start + k) % edges.length], last = runs[runs.length - 1];
      if (last && last.road === e.road && e.road) { last.edges.push(e); last.len += e.len; }
      else runs.push({ road: e.road, edges: [e], len: e.len });
    }
    var streets = runs.filter(function (r) { return r.road && r.len > 25; });
    var addr = String(ctx.parcel.attrs.PARCEL_ADD || '').toUpperCase().replace(/^\d+\s+[NSEW]\s+/, '').replace(/\s+(RD|ROAD|DR|DRIVE|ST|STREET|LN|LANE|WAY|CIR|CT|AVE)$/, '');
    var front = streets.filter(function (r) { return addr && r.road.toUpperCase().indexOf(addr) >= 0; })[0] || streets.reduce(function (a, r) { return !a || r.len > a.len ? r : a; }, null);
    var zs = ctx.facts.zone_std || {}, sb = { front: zs.front || 30, side: zs.side || 10, rear: zs.rear || 30, street: zs.street || zs.side || 20 };
    // Front direction: chord of the front run; inward normal points into the lot (polygon is counter-clockwise).
    var fa = front ? front.edges[0].a : lot[0], fb = front ? front.edges[front.edges.length - 1].b : lot[1];
    var fdx = fb[0] - fa[0], fdy = fb[1] - fa[1], fL = Math.hypot(fdx, fdy) || 1, ux = fdx / fL, uy = fdy / fL, vx = -uy, vy = ux;
    edges.forEach(function (e) {
      var dx = e.b[0] - e.a[0], dy = e.b[1] - e.a[1], L = Math.hypot(dx, dy) || 1, dot = (-dy / L) * vx + (dx / L) * vy;
      e.kind = front && front.edges.indexOf(e) >= 0 ? 'front' : e.road && streets.some(function (r) { return r.edges.indexOf(e) >= 0; }) ? 'street side' : dot < -0.5 ? 'rear' : 'side';
      e.set = e.kind === 'front' ? sb.front : e.kind === 'rear' ? sb.rear : e.kind === 'street side' ? sb.street : sb.side;
    });
    // Setback margin at a point: how far it is inside every applicable setback line (negative = inside a setback).
    var margin = function (pt) {
      if (!inPoly(pt, lot)) return -999;
      var m = Infinity;
      for (var i = 0; i < edges.length; i++) { var d = segDist(pt, edges[i].a, edges[i].b) - edges[i].set; if (d < m) m = d; }
      return m;
    };
    var xs0 = lot.map(function (p) { return p[0]; }), ys0 = lot.map(function (p) { return p[1]; });
    var bx0 = Math.min.apply(0, xs0), by0 = Math.min.apply(0, ys0), bx1 = Math.max.apply(0, xs0), by1 = Math.max.apply(0, ys0);
    var gs = Math.max(4, Math.sqrt((bx1 - bx0) * (by1 - by0) / 12000)), gnx = Math.ceil((bx1 - bx0) / gs) + 1, gny = Math.ceil((by1 - by0) / gs) + 1, mg = [], buildArea = 0;
    for (var gj = 0; gj < gny; gj++) for (var gi = 0; gi < gnx; gi++) { var mv = margin([bx0 + gi * gs, by0 + gj * gs]); mg.push(mv); if (mv >= 0) buildArea += gs * gs; }
    var buildSegs = contours(mg, gnx, gny, bx0, by0, gs, 1, [0]);
    // House: plan width x depth (long side along the street), at the fitting position closest to the front frontage.
    var fp = (ctx.plan && ctx.plan.footprint) || {}, W = fp.width_ft, D = fp.depth_ft, house = null, fits = null, drive = null, dims = [], worst = null;
    var frontDist = function (pt) { return front ? Math.min.apply(0, front.edges.map(function (e) { return segDist(pt, e.a, e.b); })) : 0; };
    if (W && D && front) {
      if (W < D) { var t0 = W; W = D; D = t0; }
      var rect = function (cx, cy) { return [[-W / 2, -D / 2], [W / 2, -D / 2], [W / 2, D / 2], [-W / 2, D / 2]].map(function (p) { return [cx + ux * p[0] + vx * p[1], cy + uy * p[0] + vy * p[1]]; }); };
      var rimMargin = function (r) {
        var m = Infinity;
        for (var e = 0; e < 4; e++) { var A = r[e], B = r[(e + 1) % 4], n = Math.max(2, Math.ceil(Math.hypot(B[0] - A[0], B[1] - A[1]) / 6));
          for (var q = 0; q <= n; q++) { var v = margin([A[0] + (B[0] - A[0]) * q / n, A[1] + (B[1] - A[1]) * q / n]); if (v < m) m = v; if (m < -50) return m; } }
        return m;
      };
      var best = null, step2 = Math.max(6, gs * 2);
      for (var cy2 = by0; cy2 <= by1; cy2 += step2) for (var cx2 = bx0; cx2 <= bx1; cx2 += step2) {
        if (margin([cx2, cy2]) < Math.min(W, D) / 2 - 5) continue;
        var r = rect(cx2, cy2), m = rimMargin(r), fd = frontDist([cx2, cy2]);
        var score = m >= 0 ? fd : 1e6 - m; // fitting positions: nearest the street; otherwise the least-bad one
        if (!best || score < best.score) best = { r: r, m: m, score: score, c: [cx2, cy2] };
      }
      if (best) {
        house = best.r; fits = best.m >= 0; worst = best.m;
        // Driveway: 16 ft wide from the middle of the street face, straight out to the front lot line.
        var mid = [best.c[0] - vx * D / 2, best.c[1] - vy * D / 2], len = 0;
        while (len < 2000 && inPoly([mid[0] - vx * len, mid[1] - vy * len], lot)) len += 1;
        drive = { len: len, poly: [[mid[0] - ux * 8, mid[1] - uy * 8], [mid[0] + ux * 8, mid[1] + uy * 8], [mid[0] + ux * 8 - vx * len, mid[1] + uy * 8 - vy * len], [mid[0] - ux * 8 - vx * len, mid[1] - uy * 8 - vy * len]] };
        var bestBy = {};
        edges.forEach(function (e) {
          var hp = house.reduce(function (b, p) { return segDist(p, e.a, e.b) < segDist(b, e.a, e.b) ? p : b; }), d = segDist(hp, e.a, e.b);
          var dx = e.b[0] - e.a[0], dy = e.b[1] - e.a[1], tt = Math.max(0, Math.min(1, ((hp[0] - e.a[0]) * dx + (hp[1] - e.a[1]) * dy) / (dx * dx + dy * dy || 1)));
          if (!bestBy[e.kind] || d < bestBy[e.kind].d) bestBy[e.kind] = { kind: e.kind, d: d, set: e.set, from: hp, to: [e.a[0] + dx * tt, e.a[1] + dy * tt] };
        });
        dims = Object.keys(bestBy).map(function (k) { return bestBy[k]; });
      }
    }
    // Labels: one per street frontage, one per other edge longer than 30 ft.
    var outside = function (e, d) { var dx = e.b[0] - e.a[0], dy = e.b[1] - e.a[1], L = Math.hypot(dx, dy) || 1; return [e.mid[0] + dy / L * d, e.mid[1] - dx / L * d]; };
    var labels = streets.map(function (r) { var e = r.edges[Math.floor(r.edges.length / 2)]; return { at: outside(e, 28), text: Math.round(r.len) + "' " + (r === front ? 'front' : 'street side') + ' (' + streetCase(r.road) + ')' }; })
      .concat(edges.filter(function (e) { return !e.road && e.len > 30; }).map(function (e) { return { at: outside(e, 16), text: Math.round(e.len) + "' " + e.kind }; }));
    var build = [];
    // GIS elevation contours on a regular grid over the lot (<= ~900 samples).
    var xs = lot.map(function (p) { return p[0]; }), ys = lot.map(function (p) { return p[1]; });
    var minX = Math.min.apply(0, xs) - 20, maxX = Math.max.apply(0, xs) + 20, minY = Math.min.apply(0, ys) - 20, maxY = Math.max.apply(0, ys) + 20;
    var step = Math.max(12, Math.sqrt((maxX - minX) * (maxY - minY) / 900)), nx = Math.ceil((maxX - minX) / step) + 1, ny = Math.ceil((maxY - minY) / step) + 1;
    var pts = [], mPerDegLon = M_PER_DEG * Math.cos(lat0 * Math.PI / 180);
    for (var j = 0; j < ny; j++) for (var i = 0; i < nx; i++) {
      var X = (minX + i * step + c0[0]) / F2, Y = (minY + j * step + c0[1]) / F2;
      pts.push([X / mPerDegLon, Y / M_PER_DEG]);
    }
    var samp = await lidarSamples(pts), grid = new Array(nx * ny).fill(null);
    samp.forEach(function (s) {
      var p = shift([s[0], s[1]]), i = Math.round((p[0] - minX) / step), j = Math.round((p[1] - minY) / step);
      if (i >= 0 && i < nx && j >= 0 && j < ny) grid[j * nx + i] = s[2];
    });
    var zsv = grid.filter(function (z) { return z != null; }), relief = zsv.length ? Math.max.apply(0, zsv) - Math.min.apply(0, zsv) : 0;
    var interval = relief > 60 ? 10 : relief > 25 ? 5 : 2, segs = contours(grid, nx, ny, minX, minY, step, interval);
    var lotArea = Math.abs(polyArea(lot));
    return { lot: lot, edges: edges, buildSegs: buildSegs, buildArea: buildArea, house: house, fits: fits, worst: worst, drive: drive, dims: dims, segs: segs, interval: interval, labels: labels,
      bbox: [minX, minY, maxX, maxY], lotArea: lotArea, front: front && { road: front.road, len: front.len }, streets: streets.map(function (r) { return r.road; }), setbacks: sb, samples: samp.length };
  }

  function sitePlanSvg(sp, info) {
    var W = 1000, H = 720, M = 40, DW = 680, bb = sp.bbox, sx = (DW - 2 * M) / (bb[2] - bb[0]), sy = (H - 2 * M - 40) / (bb[3] - bb[1]), s = Math.min(sx, sy);
    var X = function (x) { return M + (x - bb[0]) * s; }, Y = function (y) { return H - M - 40 - (y - bb[1]) * s; };
    var pth = function (p) { return p.map(function (q, i) { return (i ? 'L' : 'M') + X(q[0]).toFixed(1) + ' ' + Y(q[1]).toFixed(1); }).join(' ') + ' Z'; };
    var e = function (t) { return String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;'); };
    var o = ['<svg xmlns="http://www.w3.org/2000/svg" width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '" font-family="Helvetica, Arial, sans-serif" font-size="11">',
      '<rect width="100%" height="100%" fill="#fff"/>'];
    // Contours (every 5th interval heavier, labelled once).
    var labelled = {};
    sp.segs.forEach(function (g) {
      var major = Math.round(g[4]) % (sp.interval * 5) === 0;
      o.push('<line x1="' + X(g[0]).toFixed(1) + '" y1="' + Y(g[1]).toFixed(1) + '" x2="' + X(g[2]).toFixed(1) + '" y2="' + Y(g[3]).toFixed(1) + '" stroke="#b9a58a" stroke-width="' + (major ? 1 : 0.5) + '"/>');
      if (major && !labelled[g[4]] && inPoly([(g[0] + g[2]) / 2, (g[1] + g[3]) / 2], sp.lot)) { labelled[g[4]] = 1; o.push('<text x="' + X(g[0]).toFixed(1) + '" y="' + (Y(g[1]) - 2).toFixed(1) + '" fill="#8a7454" font-size="9">' + Math.round(g[4]) + '</text>'); }
    });
    o.push('<path d="' + pth(sp.lot) + '" fill="#eef4ea" stroke="none"/>');
    sp.buildSegs.forEach(function (g) { o.push('<line x1="' + X(g[0]).toFixed(1) + '" y1="' + Y(g[1]).toFixed(1) + '" x2="' + X(g[2]).toFixed(1) + '" y2="' + Y(g[3]).toFixed(1) + '" stroke="#5b8a4f" stroke-width="1.2" stroke-dasharray="5 3"/>'); });
    o.push('<path d="' + pth(sp.lot) + '" fill="none" stroke="#111" stroke-width="2"/>');
    sp.labels.forEach(function (lb) {
      o.push('<text x="' + X(lb.at[0]).toFixed(1) + '" y="' + Y(lb.at[1]).toFixed(1) + '" fill="#333" font-size="10" text-anchor="middle" paint-order="stroke" stroke="#fff" stroke-width="3">' + e(lb.text) + '</text>');
    });
    o.push('<text x="' + M + '" y="' + (M - 12) + '" fill="#5b8a4f" font-size="10">Dashed green: setbacks only. EASEMENTS NOT MAPPED. Blue: illustrative house envelope.</text>');
    if (sp.drive) o.push('<path d="' + pth(sp.drive.poly) + '" fill="#d9d9d9" stroke="#888" stroke-width="0.8"/>');
    if (sp.house) o.push('<path d="' + pth(sp.house) + '" fill="' + (sp.fits ? '#c9d8ee' : '#f2c4c0') + '" stroke="#1f3b63" stroke-width="1.5"/>',
      '<text x="' + X(centroid(sp.house)[0]).toFixed(1) + '" y="' + Y(centroid(sp.house)[1]).toFixed(1) + '" text-anchor="middle" font-weight="bold" fill="#1f3b63">HOUSE</text>');
    sp.dims.forEach(function (d) {
      var mx = (d.from[0] + d.to[0]) / 2, my = (d.from[1] + d.to[1]) / 2, ok = d.d + 0.5 >= d.set;
      o.push('<line x1="' + X(d.from[0]).toFixed(1) + '" y1="' + Y(d.from[1]).toFixed(1) + '" x2="' + X(d.to[0]).toFixed(1) + '" y2="' + Y(d.to[1]).toFixed(1) + '" stroke="' + (ok ? '#1f3b63' : '#b42318') + '" stroke-width="0.8" marker-end="url(#a)" marker-start="url(#a)"/>',
        '<text x="' + X(mx).toFixed(1) + '" y="' + (Y(my) - 3).toFixed(1) + '" fill="' + (ok ? '#1f3b63' : '#b42318') + '" font-size="10" text-anchor="middle">' + Math.round(d.d) + "'</text>");
    });
    o.push('<defs><marker id="a" viewBox="0 0 6 6" refX="3" refY="3" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0 0 L6 3 L0 6 z" fill="#1f3b63"/></marker></defs>');
    // North arrow and scale bar.
    o.push('<g transform="translate(' + (DW - 40) + ',' + (M + 10) + ')"><path d="M0 -14 L7 10 L0 5 L-7 10 Z" fill="#111"/><text y="24" text-anchor="middle" font-weight="bold">N</text></g>');
    var bar = [20, 50, 100, 200, 500].filter(function (v) { return v * s <= 160; }).pop() || 20;
    o.push('<g transform="translate(' + M + ',' + (H - M - 10) + ')"><rect width="' + (bar * s).toFixed(1) + '" height="5" fill="#111"/><text y="18">' + bar + " ft</text><text x=\"" + ((bar * s) + 8).toFixed(1) + '" y="6">Contours every ' + sp.interval + " ft (USGS 3DEP GIS DEM)</text></g>");
    // Title block.
    o.push('<g transform="translate(' + (DW + 10) + ',' + M + ')"><rect width="' + (W - DW - 10 - M) + '" height="' + (H - 2 * M) + '" fill="#fafafa" stroke="#ccc"/>');
    var ty = 22, line = function (t, b) {
      var words = String(t).split(' '), cur = '', out = [];
      words.forEach(function (w) { if ((cur + ' ' + w).trim().length > 44) { out.push(cur.trim()); cur = w; } else cur += ' ' + w; });
      if (cur.trim()) out.push(cur.trim());
      out.forEach(function (ln, i) { o.push('<text x="' + (i ? 20 : 12) + '" y="' + ty + '"' + (b ? ' font-weight="bold" font-size="13"' : '') + '>' + e(ln) + '</text>'); ty += b ? 20 : 15; });
    };
    line('DRAFT SITE PLAN', true);
    line('EASEMENTS NOT MAPPED', true);
    line('Placement checks setbacks only. Buildability is unverified.');
    info.forEach(function (r) { if (r === '') { ty += 6; return; } line(r); });
    ty += 8;
    ['Drawn from public data: county parcel boundary,', 'recorded plat setbacks, USGS GIS elevation. Not a survey.', 'A licensed surveyor must verify the boundary,', 'easements and topography before submittal.']
      .forEach(function (t) { o.push('<text x="12" y="' + ty + '" fill="#b42318" font-size="10">' + e(t) + '</text>'); ty += 13; });
    o.push('</g></svg>');
    return o.join('');
  }

  C.check_permit_packet = async function (ctx) {
    var f = ctx.facts, p = ctx.plan || {}, fp = p.footprint || {}, kb = f.kb, a = ctx.parcel.attrs, pd = f.parcelDoc || {};
    var hasPlan = !!(fp.residence_sf || fp.width_ft), juris = f.jurisdiction || 'the city';
    // Mailing form of the address: postal city and ZIP from the state ZIP areas (address points carry the municipality).
    var zipF = await arcgisQuery(UGRC + '/UtahZipCodeAreas/FeatureServer/0', { geometry: ctx.parcel.point, outFields: 'ZIP5,NAME' }).catch(function () { return []; });
    var zip = zipF[0] && String(zipF[0].attributes.ZIP5), postal = zipF[0] && zipF[0].attributes.NAME;
    var street = a.PARCEL_ADD ? streetCase(a.PARCEL_ADD) : null;
    var fullAddr = street ? street + ', ' + (postal ? title(postal) : a.PARCEL_CITY || '') + ', UT' + (zip ? ' ' + zip : '') : null;
    var sp = await sitePlan(ctx).catch(function (e) { return { error: String(e.message || e) }; });

    // Estimates.
    var house = fp.residence_sf || null, garage = fp.garage_sf || 0, stories = p.stories || 1;
    var footprint = house ? house / stories + garage : fp.width_ft && fp.depth_ft ? fp.width_ft * fp.depth_ft * 0.6 : null; // overall dims are a bounding box
    var driveLen = sp.drive ? Math.max(sp.drive.len, f.zone_std && f.zone_std.front || 20) : (f.zone_std && f.zone_std.front || 30) + 10;
    var driveSf = driveLen * 16, flatwork = 400, impervious = footprint ? footprint + driveSf + flatwork : null;
    var esu = impervious && kb && kb.stormwater ? Math.max(1, Math.ceil(impervious / kb.stormwater.esuSqft)) : null;
    var disturb = footprint ? (Math.sqrt(footprint) + 20) * (Math.sqrt(footprint) + 20) + driveSf + 1500 : null;
    var depth = p.foundation === 'basement' ? 9.5 : p.foundation === 'crawlspace' ? 4 : 2, perim = footprint ? 4 * Math.sqrt(footprint) : 0;
    var cut = footprint ? Math.round((footprint * depth + perim * 2 * depth + driveSf * 1) / 27) : null;
    var fees = hasPlan ? weberBuildingFees(house, garage) : null;
    var est = { valuation: fees && fees.valuation, permitFloor: fees && fees.total, footprint: footprint, driveLen: driveLen, impervious: impervious, esu: esu,
      stormFee: esu && kb && kb.stormwater ? esu * kb.stormwater.esuFee : null, disturb: disturb, cut: cut };

    // Providers and contacts.
    var water = provider(f.culinary), sewer = provider(f.sewer), fire = provider(kb && kb.fireDistrict), hoa = f.hoaReg;
    var lotPart = [pd.lot && a.SUBDIV_NAME ? 'Lot ' + pd.lot + ' of ' + title(a.SUBDIV_NAME) : a.SUBDIV_NAME ? title(a.SUBDIV_NAME) : null, 'parcel ' + ctx.parcel.id].filter(Boolean).join(', ');
    var lotLine = fullAddr ? fullAddr + ' (' + lotPart + ')' : lotPart;
    var reqLine = kb && kb.submittal ? juris + ' requires a will-serve letter specific to the building lot. ' : '';
    var planLine = hasPlan ? 'a ' + (p.bedrooms ? p.bedrooms + '-bedroom, ' : '') + (house ? fmt(house) + ' sq ft ' : '') + 'single-family home' + (garage ? ' with a ' + fmt(garage) + ' sq ft garage' : '') : 'one single-family home';
    var sign = '\n\nThank you,\n\n[Your name]\n[Company, if any]\n[Phone]';
    var letters = [];
    if (water || f.culinary) letters.push({ id: 'water', title: 'Lot-specific ' + (/secondary/i.test(f.waterServices || '') ? 'culinary and secondary water' : 'water') + ' will-serve letter', to: water ? water.name : f.culinary, email: water && water.email, mail: water && water.mail,
      subject: 'Will-serve request: ' + lotLine,
      body: 'Hello,\n\nI am preparing a building permit application for ' + lotLine + '. ' + reqLine + 'Could you issue a will-serve letter for culinary' + (/secondary/i.test(f.waterServices || '') ? ' and secondary (irrigation)' : '') + ' water for this lot?\n\n' +
        'Proposed use: ' + planLine + ', 1 equivalent residential connection.' + (est.impervious ? ' Estimated impervious area about ' + fmt(est.impervious) + ' sq ft; irrigated turf will stay within the city cap (35% of front and side yards or 3,000 sq ft, whichever is greater).' : '') +
        '\n\nPlease also let me know the connection, hook-up and share-transfer requirements and fees for this lot, and the secondary water allotment per lot.' + sign });
    if (sewer || f.sewer) letters.push({ id: 'sewer', title: 'Lot-specific sewer will-serve letter', to: sewer ? sewer.name : f.sewer, email: sewer && sewer.email, mail: sewer && sewer.lines[0],
      subject: 'Sewer will-serve request: ' + lotLine,
      body: 'Hello,\n\nI am preparing a building permit application for ' + lotLine + '. ' + reqLine.replace('a will-serve', 'a sewer will-serve') + 'Could you issue a sewer will-serve letter for this lot?\n\nProposed use: ' + planLine + '.' +
        '\n\nPlease also send the connection and impact fees, the lateral location for this lot if known, and any inspection requirements for the connection.' + sign });
    var hydrant = f.hydrant_ft;
    if (fire) letters.push({ id: 'fire', title: 'Fire district: hydrant distance and sprinkler requirement', to: fire.name, email: fire.email,
      subject: 'Fire protection requirements: ' + lotLine,
      body: 'Hello,\n\nI am preparing a building permit application for ' + lotLine + ' (' + planLine + ').' +
        (hydrant ? ' By mapped roads, the nearest hydrant appears to be about ' + fmt(hydrant) + ' ft from the middle of the lot, beyond the 600 ft in IFC 507.5.1.' : '') +
        '\n\nCould you confirm (1) whether a residential fire sprinkler system (NFPA 13D) will be required in place of a hydrant extension, (2) the required fire flow, (3) any driveway width, turnaround or access requirements for this lot, and (4) what you need with the building permit submittal?' + sign });
    var hoaC = hoa && (hoa.contacts || []).filter(function (c) { return c.email; })[0];
    if (hoa) letters.push({ id: 'hoa', title: 'HOA architectural review: guidelines and submittal process', to: hoa.name, email: hoaC && hoaC.email,
      subject: 'Architectural review and governing documents: ' + lotLine,
      body: 'Hello,\n\nI am planning to build ' + planLine + ' on ' + lotLine + '. Could you send:\n\n1. The CC&Rs and any amendments, and the architectural or design guidelines\n2. The architectural review submittal requirements, review timeline and fees (including any construction deposit)\n3. Current dues and any pending special assessments\n\nI would like to submit for architectural review before applying for the building permit.' + sign });

    // Items: the statute's complete-application list, the city's submission checklist, and lot-specific approvals.
    var sh = p.sheets || {}, has = function (k) { return !!(sh[k] && sh[k].length); }, items = [];
    var I = function (o) { items.push(o); };
    var cityReq = kb && kb.submittal;
    I({ group: 'Application', title: 'Applicant and contractor contact information', status: 'you', who: 'You', lead: [0, 0], why: 'Utah Code 10-20-909(12)(a)',
      detail: 'Name, address, phone and email for the applicant and the general contractor, with the contractor\'s Utah license number (or an owner-builder declaration).' });
    I({ group: 'Application', title: 'Application data (parcel, legal description, zoning, building data, design loads, valuation)', status: 'ready', who: 'Cornerpin', lead: [0, 0],
      detail: 'Prefilled below from the county record, the recorded plat, the zoning and the plan. Copy it into the permit portal.' });
    I({ group: 'Drawings', title: 'Scaled site plan with existing and proposed contours and distances to property lines', status: sp && !sp.error ? 'drafted' : 'pro', who: 'Surveyor (final)', lead: [10, 20], why: '10-20-909(12)(b)',
      detail: sp && !sp.error ? 'Draft below: lot lines, setback area, ' + (sp.house ? 'house placed from the plan dimensions, driveway, distances to lot lines, ' : '') + 'contours from GIS DEM. A surveyor needs to verify the boundary and topography; ' + (sp.house && !sp.fits ? 'as drawn, the house does not fit inside the setbacks.' : 'easements are not mapped and house placement is unverified against them.') : 'Order a boundary and topographic survey.' });
    var sheetRow = function (title, keys, who, why) {
      var got = keys.filter(has), status = !hasPlan ? 'pro' : got.length === keys.length ? 'ready' : got.length ? 'partial' : 'pro';
      I({ group: 'Drawings', title: title, status: status, who: who, lead: status === 'ready' ? [0, 0] : [5, 15], why: why,
        detail: !p.sheets ? 'Upload the plan set to check this.' : got.length ? 'Found: ' + got.map(function (k) { return k + ' (' + sh[k].join(', ') + ')'; }).join('; ') + (got.length < keys.length ? '. Missing: ' + keys.filter(function (k) { return !has(k); }).join(', ') + '.' : '.') : 'Not found in the plan set.' });
    };
    sheetRow('Construction drawings: code analysis, floor plans, elevations, sections', ['code', 'floor', 'elevations', 'sections'], 'Designer', '10-20-909(12)(c)');
    sheetRow('Structural: foundation, floor and roof framing, structural details', ['foundation', 'floorFraming', 'roofFraming', 'structural'], 'Designer / engineer', '10-20-909(12)(c)');
    sheetRow('Electrical plan', ['electrical'], 'Designer', 'City checklist');
    I({ group: 'Drawings', title: 'Structural calculations (stamped)', status: has('stamp') ? 'partial' : 'pro', who: 'Structural engineer', lead: [10, 20], why: '10-20-909(12)(e)',
      detail: (!p.sheets ? 'Needed with the plan set. ' : has('stamp') ? 'The plan set names an engineer (' + sh.stamp.join(', ') + '); include the signed calculation package. ' : 'No engineer named on the plan set. ') + 'Stamped plans also keep the statutory plan-review deadline enforceable.' });
    I({ group: 'Drawings', title: 'Building area breakdown (each level, basement, garage, porches, decks)', status: hasPlan && house ? (has('areas') ? 'ready' : 'partial') : 'pro', who: 'Designer', lead: [1, 3], why: 'City checklist',
      detail: hasPlan && house ? 'From the plan: ' + fmt(house) + ' sq ft living' + (garage ? ', ' + fmt(garage) + ' sq ft garage' : '') + '. ' + (has('areas') ? '' : 'Add covered porches, decks and patios, and split by level, as the city asks.') : 'Upload the plan set.' });
    var en = p.energy, enOk = f.energyCheck;
    I({ group: 'Drawings', title: 'Energy code compliance (Utah prescriptive path or REScheck)', status: has('energy') ? 'ready' : en ? 'partial' : 'pro', who: 'Designer', lead: [1, 3], why: '10-20-909(12)(d)',
      detail: (en ? 'Plan values read: ' + Object.keys(en).map(function (k) { var v = en[k]; return k + ' ' + (typeof v === 'object' ? JSON.stringify(v).replace(/[{}"]/g, '') : v); }).join(', ') + '. ' : '') + (enOk ? enOk + ' ' : '') + (has('energy') ? '' : p.sheets ? 'Add a REScheck report or a prescriptive compliance table to the set.' : 'Upload the plan set to check this; it needs a REScheck report or a prescriptive compliance table.') });
    I({ group: 'Drawings', title: 'Outdoor lighting plan (dark-sky)', status: has('lighting') ? 'ready' : kb && kb.lighting ? 'pro' : kb ? 'na' : 'you', who: kb && !kb.lighting ? '' : 'Designer', lead: [1, 3], why: kb && kb.lighting ? 'City land use code 108-16' : '',
      detail: kb && kb.lighting ? kb.lighting + ' Show each exterior fixture, its height and a cut sheet.' : kb ? 'Not required here.' : 'Check whether ' + juris + ' requires an exterior lighting plan.' });
    var steep = f.slope != null && f.slope > 15;
    I({ group: 'Reports', title: 'Geotechnical report', status: steep ? 'pro' : 'optional', who: 'Geotechnical engineer', lead: steep ? [15, 25] : [0, 0], why: '10-20-909(12)(f): only if slope exceeds 15% and the city requires it',
      detail: 'Lot slope about ' + (f.slope != null ? f.slope.toFixed(1) + '%' : '?') + (steep ? ', so the city may require one.' : ', so the statute does not require one for the application.') +
        (f.water_table_in != null && f.water_table_in < 48 ? ' Recommended anyway: the soil survey shows a seasonal water table about ' + f.water_table_in + ' in. down.' : '') });
    I({ group: 'Stormwater', title: 'Storm water statement, SWPPP and city stormwater permit', status: est.disturb ? 'drafted' : 'partial', who: 'You / builder', lead: [1, 2], why: '10-20-909(12)(g); city code ch. 6.15',
      detail: (est.disturb ? 'Estimated land disturbance about ' + fmt(est.disturb) + ' sq ft and ' + fmt(est.cut) + ' cubic yards of excavation' + (kb && kb.stormwater ? ', above the city\'s 500 sq ft / 20 cubic yard permit threshold. ' : '. ') : '') +
        (a.SUBDIV_NAME ? 'The lot is part of a larger subdivision (a common plan of development), so state coverage under the Common Plan Permit (UTRH) is likely needed' + (kb && kb.swpppTemplate ? '; the city posts the SWPPP template for it.' : '.') : ''),
      link: kb && kb.swpppTemplate });
    letters.forEach(function (l) {
      I({ group: 'Approvals', title: l.title, status: 'drafted', who: l.to, lead: l.id === 'hoa' ? [10, 30] : [5, 15], letter: l.id,
        detail: 'Request drafted below' + (l.email ? ', ready to send to ' + l.email : l.mail ? '; mail it to ' + l.mail : '') + '.' });
    });
    if (!water && !f.culinary) I({ group: 'Approvals', title: 'Water will-serve letter or approved well permit', status: 'you', who: 'Water provider', lead: [5, 15], detail: 'No water provider identified for this lot.' });
    I({ group: 'Approvals', title: 'Excavation permit (driveway approach and utility connections in the street)', status: 'you', who: 'You / builder', lead: [1, 5], why: kb && kb.excavation ? 'City permit portal' : '',
      detail: kb && kb.excavation ? kb.excavation : 'Most cities require a right-of-way or excavation permit for the driveway approach and utility taps; check with ' + juris + '.' });
    var feeRow = ctx.findings.filter(function (x) { return x.item === 'Permit & impact fees'; })[0];
    I({ group: 'Fees', title: 'Permit, plan review and impact fees', status: 'you', who: 'You', lead: [0, 0], why: '10-20-909(12)(h)',
      detail: (feeRow ? feeRow.headline + '. ' : '') + (est.esu > 1 ? 'With about ' + fmt(est.impervious) + ' sq ft of impervious area this lot is ' + est.esu + ' storm-drain units, so the storm drain impact fee is about $' + fmt(est.stormFee) + ' rather than one unit. ' : '') + 'Paid at issuance through the portal.' });

    // Timeline: everything that gates submittal runs in parallel; then screening (3) + plan review (14) business days.
    var gating = items.filter(function (x) { return x.status !== 'ready' && x.status !== 'na' && x.status !== 'optional' && x.lead; });
    var lo = Math.max.apply(0, gating.map(function (x) { return x.lead[0]; }).concat([1])), hi = Math.max.apply(0, gating.map(function (x) { return x.lead[1]; }).concat([2]));
    var now = new Date(), subLo = addBusinessDays(now, lo), subHi = addBusinessDays(now, hi);
    var timeline = { submitLo: day(subLo), submitHi: day(subHi), screen: 3, review: 14, issueLo: day(addBusinessDays(subLo, 17)), issueHi: day(addBusinessDays(subHi, 17)),
      critical: gating.filter(function (x) { return x.lead[1] === hi; }).map(function (x) { return x.title; }) };

    // Application data sheet.
    var zstd = f.zone_std || {}, rows = [];
    var R = function (k, v, src) { if (v != null && v !== '') rows.push([k, String(v), src || '']); };
    R('Project address', fullAddr, 'County parcel record + USPS ZIP area');
    R('Jurisdiction', juris, 'Municipal boundaries');
    R('Platted address', pd.platAddress, 'Recorded plat');
    R('Parcel ID', ctx.parcel.id, ctx.parcel.county + ' County');
    R('Subdivision / lot', (a.SUBDIV_NAME ? title(a.SUBDIV_NAME) : '') + (pd.lot ? ', Lot ' + pd.lot : ''), 'County record / plat');
    R('Legal description', pd.legal, 'County parcel record');
    R('Lot area', (a.PARCEL_ACRES ? a.PARCEL_ACRES + ' acres' : '') + (f.lot_sf ? ' (' + fmt(f.lot_sf) + ' sq ft)' : ''), 'County parcel record');
    R('Owner of record', f.owner, 'County assessor');
    R('Zoning', f.zone, 'Zoning map');
    if (zstd.front) R('Required setbacks', zstd.front + "' front, " + zstd.side + "' side, " + zstd.rear + "' rear" + (zstd.street ? ', ' + zstd.street + "' street side" : ''), zstd.zone === 'plat' ? 'Recorded plat' : 'Development standards');
    R('Type of work', 'New single-family dwelling');
    R('Occupancy / construction type', 'R-3 / V-B (wood frame)', 'Typical for a wood-frame house');
    if (hasPlan) {
      R('Stories', p.stories, 'Plan'); R('Bedrooms', p.bedrooms, 'Plan'); R('Living area', house && fmt(house) + ' sq ft', 'Plan'); R('Garage', garage && fmt(garage) + ' sq ft', 'Plan');
      R('Overall dimensions', fp.width_ft && fp.depth_ft ? Math.round(fp.width_ft) + "' x " + Math.round(fp.depth_ft) + "'" : null, 'Plan');
      R('Building height', p.height_ft && p.height_ft + "'", 'Plan'); R('Foundation', p.foundation, 'Plan'); R('Heating fuel', p.fuel, 'Plan'); R('Fireplace', p.fireplace, 'Plan');
      R('Construction valuation', est.valuation && '$' + fmt(est.valuation), 'ICC Building Valuation Data, ' + BVD.asOf);
    }
    R('Fire sprinklers', hydrant > 600 ? 'Likely required (NFPA 13D): nearest hydrant about ' + fmt(hydrant) + ' ft by road' : hydrant ? 'Not expected: hydrant about ' + fmt(hydrant) + ' ft by road' : null, 'Hydrant map + roads');
    R('Ground snow load', f.snow && f.snow.pg && f.snow.pg + ' psf', 'Utah Snow Load Study');
    R('Seismic', f.sds != null ? 'SDS ' + f.sds.toFixed(2) + ' g, seismic design category ' + (f.irc_sdc || '?') : null, 'USGS, site class D default');
    R('Soil bearing', p.structural && p.structural.bearing_psf ? p.structural.bearing_psf + ' psf (plan)' : (f.soils || []).some(function (s) { return /clay|silt/i.test(s); }) ? '1,500 psf presumptive (IRC Table R401.4.1, clay/silt soils) unless the geotech says otherwise' : null, 'Soil survey');
    R('Culinary water', f.culinary); R('Sewer', f.sewer || (f.septic && f.septic.required ? 'Septic' : null));
    R('Impervious area (estimate)', est.impervious && fmt(est.impervious) + ' sq ft = ' + est.esu + ' storm-drain unit' + (est.esu > 1 ? 's' : ''), 'Footprint + ' + Math.round(driveLen) + "' x 16' driveway + 400 sq ft walks");
    R('Land disturbance (estimate)', est.disturb && fmt(est.disturb) + ' sq ft; ' + fmt(est.cut) + ' cu yd excavation', 'Footprint + 10\' work zone + driveway + staging');

    // Site plan title-block lines.
    if (sp && !sp.error) {
      var tb = [fullAddr || '', pd.lot ? 'Lot ' + pd.lot + (a.SUBDIV_NAME ? ', ' + title(a.SUBDIV_NAME) : '') : a.SUBDIV_NAME ? title(a.SUBDIV_NAME) : '', 'Parcel ' + ctx.parcel.id + ', ' + juris].filter(Boolean);
      tb = tb.concat(['', 'Zone: ' + (f.zone || '?'), 'Setbacks: ' + sp.setbacks.front + "' front, " + sp.setbacks.side + "' side, " + sp.setbacks.rear + "' rear",
        'Lot area: ' + fmt(sp.lotArea) + ' sq ft; setback-only area ' + fmt(sp.buildArea) + ' sq ft']);
      if (sp.house) tb = tb.concat(['House envelope: ' + Math.round(Math.max(fp.width_ft, fp.depth_ft)) + "' x " + Math.round(Math.min(fp.width_ft, fp.depth_ft)) + "' (plan overall)", 'Driveway: about ' + Math.round(sp.drive.len) + "' x 16'",
        'Impervious (est.): ' + fmt(est.impervious) + ' sq ft', sp.fits ? 'Setback-only fit; easements not checked' : 'DOES NOT FIT inside the setbacks as placed']);
      if (pd.easements && pd.easements.length) tb.push('Unverified easement labels: ' + pd.easements.join(', '));
      if (sp.front && sp.front.road) tb.push('Front: ' + streetCase(sp.front.road) + (sp.streets.length > 1 ? '; corner lot' : ''));
      if (sp.house && !sp.fits) tb.push('Short of fitting by about ' + Math.ceil(-sp.worst) + ' ft');
      sp.svg = sitePlanSvg(sp, tb);
    }

    var ready = items.filter(function (x) { return x.status === 'ready' || x.status === 'drafted'; }).length, needed = items.filter(function (x) { return x.status !== 'na' && x.status !== 'optional'; }).length;
    f.packet = { jurisdiction: juris, items: items, letters: letters, rows: rows, est: est, timeline: timeline, sitePlan: sp && !sp.error ? { svg: sp.svg, fits: sp.fits, samples: sp.samples } : null,
      sitePlanError: sp && sp.error, ready: ready, needed: needed, portal: kb && kb.portal, checklist: cityReq };
    return [F('permits', 'Permit packet', ready >= needed ? 'ok' : 'verify', ready + ' of ' + needed + ' application items ready or drafted',
      'Utah law makes the city screen a complete application in 3 business days and finish plan review for a house within 14 business days after that (Utah Code 10-20-909). The permit packet below lists every item, fills in what public records and the plan show, and drafts the requests to the water, sewer and fire providers' + (hoa ? ' and the HOA' : '') + '. Earliest realistic submittal ' + timeline.submitLo + ' to ' + timeline.submitHi + '; the longest lead item is: ' + timeline.critical.slice(0, 2).join('; ') + '.',
      'Utah Code 10-20-909', 'https://le.utah.gov/xcode/Title10/Chapter20/C10-20-S909_2025110620251206.html', null, 'Send the drafted requests now; they run in parallel with the survey and engineering.')];
  };

  C.check_pool = async function (ctx) {
    return root.PoolScreen.screen(ctx.facts);
  };
  C.check_minerals = async function (ctx) {
    var result = await root.MineralScreen.screen(ctx.parcel.rings);
    ctx.facts.minerals = result.result;
    return result.findings;
  };
  C.check_public_research = async function(ctx) {
    var base=apiBase(), ctl=new AbortController(), timer=setTimeout(function(){ctl.abort();},240000), data;
    try {
      if(base==null)throw new Error('Public document service unavailable');
      var response=await fetch(base+'/api/public-research',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({rings:ctx.parcel.rings,county:ctx.parcel.county,parcelId:ctx.parcel.id}),signal:ctl.signal});
      if(!response.ok)throw new Error('Public research HTTP '+response.status);data=await response.json();if(data.error)throw new Error(data.error);
    } catch(e) {return [F('easements','Public record-chain research','verify','Public research source unavailable',String(e.message)+'; ownership and restriction completeness remain unresolved.')];}finally{clearTimeout(timer);}
    ctx.facts.publicResearch=data;
    if(data.titleResearch?.acquisition&&root.OriginalDocuments){
      await root.OriginalDocuments.drain(data.titleResearch.acquisition,async function(url,page){return apiGet('/api/original-document?url='+encodeURIComponent(url)+'&page='+page,170000);},{maxPages:6});
    }

    (ctx.facts.publicSurveys?.documents||[]).forEach(function(doc){doc.alignment=root.SurveyAlignment.align(doc,data.surveyControl);doc.boundaryCheck=root.SurveyBoundary.compare(doc,ctx.parcel,ctx.facts.parcelDoc||{});});
    var federal=data.federal||{}, records=federal.features||[], history=data.history||{}, out=[];
    var transport=data.transportation;
    if(transport)out.push(F('easements','State highway property records','verify',transport.status==='retrieved'?transport.features.length+' mapped UDOT parcel intersection(s)':'UDOT source unavailable',(transport.error||'UDOT inventory is a work in progress; an empty result does not establish absence of highway rights. ')+(transport.features||[]).map(function(f){var a=f.attributes;return 'Parcel '+a.PARCEL_NUMBER+'; acquisition '+(a.ACQ_ENTRY_NUMBER||'not populated')+'; sale reference '+(a.SELL_ENTRY_NUMBER||'not populated')+'.';}).join(' '),'UDOT parcel inventory',transport.source));
    var title=data.titleResearch;
    if(title){
      var cv=title.coverage;
      var aq=title.acquisition;
      if(aq){
        out.push(F('easements','Automatic original-document reading','verify',(aq.processing?.processedDocuments||0)+' of '+aq.documents.length+' candidate documents processed',aq.scope+' '+aq.requests.length+' exact instrument requests remain unresolved. Full page processing does not establish legibility, current legal effect or title completeness.','Weber County recorded sources','https://www.webercountyutah.gov/Recorder_Surveyor/index.php'));
        aq.documents.forEach(function(d){out.push(F('easements','Public original '+d.id,'verify',d.label,(d.pages||[]).length+' of '+(d.totalPages||'unknown')+' pages processed. '+d.matchBasis.join('; ')+'. '+(d.error||'Applicability and handwritten clauses require review.'),'Original document',d.url));
          (d.pages||[]).forEach(function(p){p.claims.filter(function(c){return ['minerals','duration','uses'].includes(c.category);}).slice(0,8).forEach(function(c,i){out.push(F(c.category==='minerals'?'minerals':'easements','Original '+d.id+' page '+p.page+' candidate '+i,'verify','Source passage · '+c.category,c.excerpt+' — Machine-extracted candidate; scope, negation and lot applicability unverified.',d.label+' page '+p.page,d.url+'#page='+p.page));});});
        });
      }

      out.push(F('easements','Historical abstract reading','verify',cv.machineReadSheets+' of '+cv.discoveredSheets+' parcel-section sheets machine-read',cv.visuallyCheckedEntries+' entries visually checked; '+cv.fullyVerifiedSheets+' complete sheets verified. '+cv.unsegmentedSheets+' sheets lack reliable entry-row segmentation. '+title.limitation,'County historical abstracts',data.historicAbstracts?.source));
      (title.transferTrace?.nodes||[]).filter(function(d){return d.interest==='highway_acquisition'||(d.references||[]).some(function(r){return r.relation==='exception';});}).forEach(function(d){out.push(F('easements','Later indexed record '+d.id,'verify','Later recorded action',d.summary,'County abstract '+d.source.pages,d.source.url));});
      (title.originalEvidence||[]).forEach(function(d){d.findings.forEach(function(f,i){out.push(F(f.category,'Original record '+d.id+' · '+(i+1),'verify',d.kind,f.text+' '+d.reviewScope+' Current legal applicability remains unresolved.',d.reference,d.sources[0].url));});});
      title.records.forEach(function(r){out.push(F('easements','Historical entry '+r.entry,'verify',r.kind,root.TitleResearchView.spatial(r.spatial)+' '+r.summary+' Source: '+r.source.sheet+', lines '+r.source.lines+'. Original Book '+r.book+', page '+r.page+' has not been retrieved.','County abstract',r.source.url));});
      (title.federalRoot?.cases||[]).forEach(function(c){out.push(F('minerals','Federal grant '+c.serial,'verify',c.report?'Federal report records patent issued '+c.report.patentIssued:'Federal grant case discovered',c.landMatches.map(function(m){return m.description+' ('+m.match.replace(/_/g,' ')+')';}).join('; ')+'. '+c.limitation+(c.report?' '+c.report.limitation:''),'BLM serial register',c.reportSource));});
      out.push(F('minerals','Historical mineral-title research','verify',title.mineralStatus==='patent_terms_located_later_chain_unresolved'?'Patent terms located; later mineral chain unresolved':'Root and subsequent mineral chain remain unresolved',cv.machineReadSheets+' historical sheets have cached machine readings. Abstracts do not reproduce all mineral clauses. '+title.gaps.filter(function(g){return ['patent-root','mineral-chain','current-chain'].includes(g.id);}).map(function(g){return g.detail;}).join(' '),'BLM federal land records','https://glorecords.blm.gov/s/'));
    }
    out.push(F('minerals','Federal mineral-estate screen',records.length?'watch':'verify',federal.status==='retrieved'?(records.length+' intersecting BLM mineral record(s)'):'Federal mineral source unavailable',
      records.map(function(x){var a=x.attributes;return 'Record '+a.OBJECTID+': patent '+(a.Patent_NR||'not supplied')+', serial '+(a.Serial_NR||'not supplied')+', all minerals '+(a.ALL_MIN||'unspecified')+', oil/gas '+(a.Oil_Gas||'unspecified')+', coal '+(a.Coal||'unspecified')+'.';}).join(' ')+' '+(federal.error||'Intersections include possible boundary touches. Public mapping is discovery evidence; original patents/reservations and later private transfers remain unverified.'),'BLM Utah Federal Minerals Estate',federal.source));
    out.push(F('easements','Parent-parcel record inventory','verify',(history.records||[]).length+' public parcel-history record(s) retrieved',
      (history.limitation||history.error||'Coverage unavailable')+' '+(history.gaps||[]).map(function(g){return g.parcelId+': '+g.reason;}).join('; '),'Weber County parcel records','https://webercountyutah.gov/parcelsearch/ownership-info.php?id='+ctx.parcel.id));
    ['surveyProperty','surveyUtilities','surveyControl'].forEach(function(k){var v=data[k]||{};out.push(F('survey',k==='surveyProperty'?'Public survey property geometry':k==='surveyControl'?'Nearby survey monuments':'Public survey utility geometry','verify',v.status==='retrieved'?(v.features.length+(k==='surveyControl'?' nearby monument record(s)':' intersecting source feature(s)')):'Geometry source unavailable',(v.error||v.coverage||'Coverage unavailable')+' Coordinate registration, current applicability and survey accuracy remain unverified.','Weber County surveyor GIS',v.source));});
    (ctx.facts.publicSurveys?.documents||[]).forEach(function(doc){var a=doc.alignment;if(a?.registration)out.push(F('survey','Survey alignment '+doc.recordNumber,'verify',a.pairs.length+' monument pairs produce a candidate alignment','Independent check residual '+a.registration.maxErrorM.toFixed(3)+' m. This is not absolute survey accuracy: source monument quality and dates, symbol matching, boundary interpretation and applicability remain unverified.','County survey monuments and original drawing',doc.url));});
    return out;
  };
  C.check_public_surveys = async function (ctx) {
    var source='https://www.webercountyutah.gov/forms/survey_index/', name=ctx.parcel.attrs.SUBDIV_NAME;
    if(ctx.parcel.county!=='Weber'||!name) return [F('survey','Public filed-survey discovery','verify','Survey discovery needs additional coverage',ctx.parcel.county!=='Weber'?'The automated filed-survey index currently covers Weber County.':'No subdivision name is available for index matching. Coordinate and historical-name discovery are not yet implemented.')];
    var result=await apiGet('/api/surveys?county=Weber&q='+encodeURIComponent(name),25000);
    ctx.facts.publicSurveys=result;
    if(result.error||!Array.isArray(result.candidates))return [F('survey','Public filed-survey discovery','verify','Filed-survey source unavailable',String(result.error||'Unexpected response')+'. This does not establish that no survey exists.','Weber County survey index',source)];
    var findings=[F('survey','Public filed-survey discovery','verify',result.totalMatches+' candidate survey index record(s)',
      'Searched the public filed-survey index by subdivision-name words. '+result.matchBasis+' Retrieved '+result.retrievedAt+'. '+(result.truncated?'Showing the first 20 matches; additional candidates remain. ':'')+'Name matching does not establish that a survey covers this lot. A zero-match result does not establish absence of surveys under other names. Geometry extraction and applicability review remain open.','Weber County survey index',source)];
    result.candidates.forEach(function(s){findings.push(F('survey','Candidate filed survey '+s.recordNumber,'verify',s.name,
      'Filed '+s.filedDate+'; '+s.pages+' indexed page(s); township '+s.township+', range '+s.range+', section '+s.section+'. '+(s.url?'Public original PDF linked. ':'No original PDF link was available in this index row. ')+'Boundary coverage, current applicability and georeferencing have not been verified.','Weber County filed survey '+s.recordNumber,s.url||source));});
    var readable=result.candidates.filter(function(s){return !!s.url;}).slice(0,3);
    result.documents=await Promise.all(readable.map(async function(s){
      var doc=await apiGet('/api/survey-document?record='+encodeURIComponent(s.recordNumber),75000);
      if(doc.error)return {recordNumber:s.recordNumber,error:doc.error};
      return doc;
    }));
    result.documents.forEach(function(doc){
      if(doc.error){findings.push(F('survey','Survey reading '+doc.recordNumber,'verify','Public survey could not be read',String(doc.error)+'; source discovery remains available.','Weber County survey index',source));return;}
      findings.push(F('survey','Survey reading '+doc.recordNumber,'verify',doc.pagesRead+' of '+doc.totalPages+' pages read',
        (doc.partial?'Reading is incomplete. ':'')+(doc.textStatus==='unreadable_text'?'Insufficient machine-readable text; OCR remains required. ':'')+doc.limitation,'Public filed survey '+doc.recordNumber,doc.url));
      (doc.references||[]).forEach(function(ref){findings.push(F('survey','Survey '+doc.recordNumber+' entry '+ref.entry+' page '+ref.page,'verify','Recording reference discovered: '+ref.entry,
        ref.excerpt+' — This is a subdivision-document reference; whether it burdens this lot and remains effective has not been determined.','Filed survey '+doc.recordNumber+', page '+ref.page,doc.url+'#page='+ref.page));});
    });
    if(result.candidates.filter(function(s){return !!s.url;}).length>readable.length)findings.push(F('survey','Additional survey reading','verify','Additional candidate documents remain unread','Automatic PDF reading is limited to three candidates per report; the remaining source links are listed above.'));
    return findings;
  };

  var STEPS = [
    ['check_parcel', 'Parcel boundary & assessor record'], ['weber_assessor', 'County assessor value'], ['check_jurisdiction', 'City / county jurisdiction'], ['check_contacts', 'Building department & city contacts'],
    ['check_zoning', 'Zoning district'], ['check_historic', 'Historic district'], ['check_water', 'Culinary water, irrigation & water rights'], ['check_landslides', 'Mapped landslides'],
    ['check_faults', 'Active faults'], ['check_liquefaction_groundwater', 'Liquefaction & groundwater'], ['check_flood', 'FEMA flood zones'], ['check_districts', 'Service & financing districts'],
    ['check_seismic', 'Seismic design category'], ['check_boreholes', 'Nearby test borings'], ['check_soils_septic', 'Soils, septic & sewer'], ['check_slope', 'GIS terrain & source comparison'],
    ['check_utilities', 'Power, gas & internet'], ['check_access_fire', 'Road access & wildfire'], ['check_ccr_permits', 'CC&Rs, design review, fees'], ['check_snow', 'Utah ground snow load'], ['check_performance', 'Home performance & restrictions'], ['check_documents', 'Recorded plat & public records'], ['check_ugs_archive', 'State geologic report archive'],
    ['check_public_surveys', 'Public filed surveys'], ['check_public_research', 'Federal minerals, parent parcels & survey geometry'], ['check_minerals', 'Mineral interests & title coverage'], ['check_pool', 'Pool feasibility'], ['check_plan_fit', 'Plan vs. lot conflicts'], ['check_permit_packet', 'Permit packet']
  ];

  async function run(parcel, plan, costs, onStep, documents) {
    var ctx = { parcel: parcel, plan: plan || {}, lat0: parcel.cy, grid: gridInside(parcel.rings, 60), facts: {},
      cost: function (k) { return costs[k] ? Object.assign({ key: k }, costs[k]) : null; } };
    if (ctx.grid.length >= 4) {ctx.elevation = lidarSamples(ctx.grid);ctx.elevationComparison=epqsSamples(ctx.grid.filter(function(_,i){return i%Math.max(1,Math.ceil(ctx.grid.length/24))===0;}));}
    var findings = [];
    ctx.findings = findings;
    // Start the slow document lookup now so it runs alongside the map checks (jurisdiction resolves early; refine later).
    // A plan revision reuses this property's retrieved documents, including missing-record outcomes.
    // It does not claim to refresh title evidence or silently repeat the slow document downloads.
    ctx.docs = documents ? Promise.resolve(documents) : fetchDocs(parcel, null);
    for (var i = 0; i < STEPS.length; i++) {
      var id = STEPS[i][0];
      onStep && onStep(id, 'running');
      try { var got = await C[id](ctx); for (var g = 0; g < got.length; g++) findings.push(got[g]); onStep && onStep(id, 'done'); }
      catch (e) {
        onStep && onStep(id, 'failed');
        findings.push(F('land', STEPS[i][1], 'verify', 'Automated check failed', String(e && e.message || e).slice(0, 300)));
      }
    }
    var areas=[{name:'Parcel record',value:Number(parcel.attrs.PARCEL_ACRES),url:parcel.attrs.ASSESSOR_SRC||lirUrl(parcel.county),basis:'Published parcel acreage'},
      {name:'GIS parcel boundary',value:ctx.facts.lot_sf/43560,url:lirUrl(parcel.county),basis:'Calculated from mapped outer boundary; holes and survey accuracy unresolved'},
      {name:'Recorded plat extraction',value:Number((ctx.facts.parcelDoc||{}).acres),url:'https://webercountyutah.gov/parcelsearch/ownership-info.php?id='+encodeURIComponent(parcel.id),basis:'Machine-read plat acreage; confirm lot attribution against original sheets'}].filter(function(m){return Number.isFinite(m.value)&&m.value>0;});
    if(Number.isFinite(ctx.facts.water_table_in) && ctx.facts.boreholes && Number.isFinite(ctx.facts.boreholes.gwMin)){
      findings.push(F('geo','Groundwater source comparison','verify','Mapped seasonal depth '+(ctx.facts.water_table_in/12).toFixed(2)+' ft · nearby boring minimum '+ctx.facts.boreholes.gwMin+' ft',
        'Absolute difference '+Math.abs(ctx.facts.water_table_in/12-ctx.facts.boreholes.gwMin).toFixed(2)+' ft. USDA SSURGO estimates mapped seasonal groundwater; UGS archives measurements at nearby borings, potentially at different dates and locations. These are not matched site measurements, so agreement or disagreement cannot establish groundwater beneath the proposed building. See the separately cited Soils and Nearby test borings findings.','USDA SSURGO and UGS boring archive','https://borehole.geology.utah.gov/'));
    }
    ctx.facts.areaSources=areas;
    areas.forEach(function(m){findings.push(F('land','Lot area · '+m.name,'verify',m.value.toFixed(4)+' acres ('+Math.round(m.value*43560)+' sq ft)',m.basis+'. Values are retained separately to compare source agreement; no value establishes a surveyed legal area.',m.name,m.url));});
    if(areas.length>1){var values=areas.map(function(m){return m.value;});findings.push(F('land','Lot area source comparison','verify','Source spread '+((Math.max.apply(null,values)-Math.min.apply(null,values))*43560).toFixed(1)+' sq ft','Compare the individually cited parcel, GIS and available plat measurements above. Parcel records and GIS can share an upstream source; matching values are not independent confirmation.'));}
    return { findings: findings, facts: ctx.facts, documents: await ctx.docs };
  }

  function reviewFindings(findings) {
    return (findings||[]).map(function(original){var f=Object.assign({},original);
      if(f.item==='City design review'&&/No city design review/.test(f.headline||'')){f.status='verify';f.headline='Check municipal design-review triggers';f.detail='Review use, zoning, overlays and development agreements against the current adopted code. Open Rules & Approvals for sourced requirements and timing.';}
      // Presentation correction for older snapshots; retain saved records and frozen packages unchanged.
      if(['Plat setbacks','Development standards'].includes(f.item)&&/These replace the base zone setbacks|Where these differ from the zone, they govern/.test(f.detail||'')){
        f.status=f.item==='Plat setbacks'?'verify':'watch';f.headline=(f.headline||'').replace('Setbacks for this lot:','Reported setback candidates:');
        f.detail=f.detail.replace(/These replace the base zone setbacks\.|Where these differ from the zone, they govern\./g,'Controlling applicability is unverified. Retrieve cited original instruments and review their scope before relying on these values.');
      }
      if(f.item==='Culinary water'&&/^No public water system mapped/.test(f.headline)){f.status='verify';f.headline='No public water system mapped; supply unverified';f.detail='No service area was returned by this dataset. An existing connection or private/mutual supply may still serve the lot. Verify the source and service entitlement; a well requirement has not been established.';}
      if(f.item==='Fire hydrant'&&/^No mapped hydrant within/.test(f.headline)){f.status='verify';f.detail='No hydrant was returned by the county dataset. Verify hydrant availability, flow and any approved alternative supply with the fire authority; missing map coverage is not proof that no fire-water supply exists.';}
      if(f.item==='Flood zone'&&/Zone .*D.*minimal flood hazard/.test(f.headline)){f.status='verify';f.headline=f.headline.replace(': minimal flood hazard',': flood hazard partly undetermined');f.detail='Interpretation corrected: FEMA Zone D is undetermined hazard, not minimal risk. Check the effective panel and Zone X subtype before siting improvements. Source data has not been refreshed.';}
      if(f.item==='Internet'&&/No wired broadband reported; wireless and satellite only/.test(f.headline)){f.status='verify';f.headline='No wired broadband in this dataset; service availability unverified';}
      if(f.item==='Drinking-water source protection'&&/Septic systems are not allowed|allows septic/.test(f.detail)){f.detail='Interpretation corrected: mapped source-protection overlap may restrict onsite wastewater. Confirm the zone boundary, source type and current applicable rules. This map alone does not establish a lot-specific septic prohibition or approval.';}
      return f;
    });
  }
  root.LotReport = { reviewFindings:reviewFindings, locate: locate, run: run, STEPS: STEPS, CHECKLIST: CHECKLIST, looksLikeParcel: looksLikeParcel };
})(typeof window !== 'undefined' ? window : globalThis);
