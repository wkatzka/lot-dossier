/* Lot dossier engine: runs entirely in the browser (or Node 18+).
 * A port of lotreport/*.py. Every data source below sends CORS headers, so no server is needed. */
(function (root) {
  'use strict';

  var UGRC = 'https://services1.arcgis.com/99lidPhWCzftIe9K/arcgis/rest/services';
  var WEBER = 'https://maps.webercountyutah.gov/arcgis/rest/services';
  var UTAH_AGO = 'https://services.arcgis.com/ZzrwjTRez6FJiOq4/arcgis/rest/services';
  var SDA = 'https://sdmdataaccess.sc.egov.usda.gov/Tabular/post.rest';
  var FT_PER_M = 3.28084, M_PER_DEG = 111320;
  var COUNTIES = ['Weber', 'Morgan', 'Summit', 'Wasatch', 'Cache', 'Davis', 'Utah', 'Salt Lake', 'Box Elder', 'Washington',
    'Iron', 'Tooele', 'Rich', 'Juab', 'Sanpete', 'Uintah', 'Duchesne', 'Carbon', 'Emery', 'Grand', 'San Juan', 'Kane',
    'Garfield', 'Wayne', 'Sevier', 'Millard', 'Beaver', 'Piute', 'Daggett'];

  var CHECKLIST = [
    ['land', 'Land, zoning & jurisdiction'], ['water', 'Water rights & culinary water'], ['geo', 'Geologic & natural hazards'],
    ['septic', 'Septic / perc'], ['utilities', 'Power, gas & internet'], ['access', 'Access & fire protection'],
    ['ccr', 'CC&Rs & design review'], ['survey', 'Survey & topography'], ['permits', 'Building permits & code'], ['plan', 'Your plan vs. this lot']
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

  function looksLikeParcel(t) { return /^[0-9]{2}[- ]?[0-9]{3}[- ]?[0-9]{3,4}$|^[0-9]{8,10}$/.test(String(t).trim()); }

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
    if (looksLikeParcel(query)) {
      // Search every county; parcel-number formats overlap, so ask when more than one county has the ID.
      var all = [];
      for (var j = 0; j < COUNTIES.length; j += 8) {
        var got = await Promise.all(COUNTIES.slice(j, j + 8).map(function (c) { return findByParcel(query, c).catch(function () { return null; }); }));
        all = all.concat(got.filter(Boolean));
      }
      if (!all.length) throw Object.assign(new Error('No parcel ' + query + ' found in Utah county records'), { notFound: true });
      if (all.length > 1) throw ambiguous('Parcel ' + query + ' exists in ' + all.map(function (p) { return p.county; }).join(' and ') + ' counties. Enter the street address instead, or add the county (for example "' + query + ' ' + all[0].county + '").',
        all.map(function (p) { return p.county; }));
      return all[0];
    }
    var countyHint = null;
    var m = /^(.*?)[ ,]+(\w[\w ]*?) COUNTY$/i.exec(query);
    if (m && FIPS_BY_NAME[m[2].toUpperCase()]) { countyHint = m[2]; query = m[1]; }

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
    if (pts.length && (a.zip || a.city)) throw Object.assign(new Error('"' + query + '" exists in Utah, but not in ' + (a.zip || a.city) + '. Check the city or ZIP code'), { notFound: true });

    // 2. Fallback for brand-new lots not yet in the address points: county parcel addresses, limited to the hinted county
    //    (from the ZIP/city) when there is one, and never silently picking one of several matches.
    var zips = a.zip ? [a.zip] : await zipsForPlace(a.city);
    var counties = countyHint ? [countyHint] : COUNTIES;
    if (zips.length) {
      try {
        var za = await arcgisQuery(UGRC + '/UtahZipCodeAreas/FeatureServer/0', { where: "ZIP5 IN ('" + zips.join("','") + "')", returnGeometry: true });
        if (za.length) {
          var ring = za[0].geometry.rings[0], zx = ring.reduce(function (s2, q) { return s2 + q[0]; }, 0) / ring.length, zy = ring.reduce(function (s2, q) { return s2 + q[1]; }, 0) / ring.length;
          var cf = await arcgisQuery(UGRC + '/UtahCountyBoundaries/FeatureServer/0', { geometry: { x: zx, y: zy }, outFields: 'NAME' });
          if (cf.length) counties = [title(cf[0].attributes.NAME)];
        }
      } catch (e) {}
    }
    var hits = [];
    for (var k = 0; k < counties.length; k += 8) {
      var res = await Promise.all(counties.slice(k, k + 8).map(async function (cn) {
        var feats = await arcgisQuery(lirUrl(cn), { where: "PARCEL_ADD LIKE '" + a.number + " %'", outFields: 'PARCEL_ID,PARCEL_ADD,PARCEL_CITY' }).catch(function () { return []; });
        return feats.filter(function (f2) { var ad = String(f2.attributes.PARCEL_ADD || '').toUpperCase(); return a.words.every(function (w) { return ad.indexOf(w) >= 0; }) && (!a.pre || ad.indexOf(' ' + a.pre + ' ') >= 0); })
          .map(function (f2) { return { county: cn, id: f2.attributes.PARCEL_ID, add: f2.attributes.PARCEL_ADD, city: f2.attributes.PARCEL_CITY }; });
      }));
      hits = hits.concat([].concat.apply([], res));
    }
    if (hits.length === 1) return findByParcel(hits[0].id, hits[0].county);
    if (hits.length > 1) throw ambiguous('"' + query + '" matches ' + hits.length + ' parcels. Add the city or ZIP code, or enter the parcel ID.',
      hits.slice(0, 12).map(function (h) { return h.add + ', ' + (h.city || '') + ' (' + h.county + ' County, parcel ' + h.id + ')'; }));
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
    return [F('land', 'Parcel', status, 'Parcel ' + ctx.parcel.id + ', ' + (a.PARCEL_ADD || 'no situs address'), bits.join('; ') + '.' + extra,
      'UGRC statewide parcels (LIR)', a.ASSESSOR_SRC)];
  };

  C.weber_assessor = async function (ctx) {
    if (ctx.parcel.county !== 'Weber') return [];
    var f = await arcgisQuery(WEBER + '/gis/OpenGov_Layers/MapServer/9', { where: "PARCEL_ID='" + ctx.parcel.id + "'",
      outFields: 'PARCEL_ID,TOT_MARKET,PROP_DESC,SUB_PHASE,NAME_ONE,TaxYear' });
    if (!f.length) return [];
    var a = f[0].attributes; ctx.facts.prop_desc = a.PROP_DESC || ''; ctx.facts.assessed = a.TOT_MARKET;
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
      fireImpact: [704, 'Weber Fire District, proposed in its Sept 2025 impact fee study (adoption not confirmed)'],
      designReview: 'City design review (LUC 108-1) applies to commercial, resort, public and larger multifamily projects, not single-family homes. Single-family standards (108-15) require only a permanent foundation and code compliance; no roof pitch or eave minimums.',
      lighting: 'Outdoor lighting ordinance (LUC 108-16) applies to new homes: fully shielded, downward fixtures, 3000K or warmer, lights off by 10 pm (fixtures of 105 lumens or less exempt), and a lighting plan at permit.',
      septicZones: 'Septic is prohibited in drinking water source protection Zones 1 and 2 (LUC 108-18-6).',
      wui: 'Weber Fire District adopted the 2024 International Wildland-Urban Interface Code as amended by Utah (Resolution 23-2026, June 11, 2026). It applies in designated WUI areas, not valley-wide; no local designation map had been published as of Nov 2026.',
      zones: {
        'AV-3': { name: 'Agricultural Valley', cite: 'LUC 104-2-5', area: '3 acres', width: 150, front: 30, side: 10, sideTotal: 24, rear: 30, height: 35 },
        'FV-3': { name: 'Forest Valley', cite: 'LUC 104-14-5', area: '3 acres', width: 150, front: 30, side: 20, rear: 30, height: 35 },
        'RE-15': { name: 'Residential Estates', cite: 'LUC 104-3', area: '15,000 sq ft', width: 100, front: 30, side: 10, sideTotal: 24, rear: 30, height: 35 },
        'RE-20': { name: 'Residential Estates', cite: 'LUC 104-3', area: '20,000 sq ft', width: 100, front: 30, side: 10, sideTotal: 24, rear: 30, height: 35 },
        'F-5': { name: 'Forest', cite: 'LUC 104-9-5', area: '5 acres', width: 300, front: 30, side: 20, rear: 30, height: null }
      },
      sources: ['https://www.utah.gov/pmn/files/1438293.pdf', 'https://ogdenvalley.gov/about-ogden-valley-city/']
    }
  };
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
          ctx.facts.zone_std = { zone: zone, front: zs.front, side: zs.sideTotal ? zs.sideTotal / 2 : zs.side, rear: zs.rear, height: zs.height, coverage: null };
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
      out.push(F('water', 'Culinary water', 'flag', 'No public water system mapped',
        'Plan on a private well, which needs an approved water right (an existing right moved by change application, or a new appropriation if the basin is open). Ogden Valley and many mountain basins restrict new appropriations.',
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
      var codes = Array.from(new Set(liq.map(function (f) { return f.attributes.PCODE; }))).sort();
      out.push(F('geo', 'Liquefaction', 'verify', 'Inside a mapped liquefaction-potential area (class code ' + codes.join(', ') + ')',
        "From the 1994 USU/UGS county liquefaction studies. The class legend isn't published with the data layer; the geotech report should address liquefaction directly.",
        'UGS/USU liquefaction potential via UGRC', 'https://geology.utah.gov/apps/hazards/'));
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
    return [F('geo', 'Flood zone', 'ok', 'FEMA Zone ' + zones.join('/') + ': minimal flood hazard', '', src)];
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
          (zn && zn <= 2 ? 'Septic systems are not allowed in this zone. ' : 'Zone ' + zn + ' allows septic. ') + (kbz || 'Health departments add design and setback rules for septic systems inside source protection zones.'),
          'Weber County GIS: groundwater/surface water protection zones'));
      }
    }
    return out;
  };

  // One batched request to the 1 m 3DEP raster (values in meters). run() starts it early because it's the slowest call.
  async function lidarSamples(pts) {
    try {
      var d = await fetchJSON('https://elevation.nationalmap.gov/arcgis/rest/services/3DEPElevation/ImageServer/getSamples', { form: {
        geometry: JSON.stringify({ points: pts.map(function (p) { return [+p[0].toFixed(7), +p[1].toFixed(7)]; }), spatialReference: { wkid: 4326 } }),
        geometryType: 'esriGeometryMultipoint', returnFirstValueOnly: 'true', f: 'json' }, timeout: 60000 });
      return (d.samples || []).filter(function (s) { return s.value !== 'NoData' && s.value != null && s.value !== ''; })
        .map(function (s) { return [s.location.x, s.location.y, parseFloat(s.value) * FT_PER_M]; });
    } catch (e) { return []; }
  }

  C.check_slope = async function (ctx) {
    var pts = ctx.grid;
    if (pts.length < 4) return [F('survey', 'Slope', 'verify', 'Lot too small to sample')];
    var samples = await (ctx.elevation || lidarSamples(pts));
    if (samples.length < 4) {
      var sparse = pts.filter(function (_, i) { return i % Math.max(1, Math.floor(pts.length / 24)) === 0; });
      var got = await Promise.all(sparse.map(function (p) {
        return fetchJSON('https://epqs.nationalmap.gov/v1/json', { params: { x: p[0], y: p[1], wkid: 4326, units: 'Feet', includeDate: 'false' }, timeout: 30000, retries: 2 })
          .then(function (r) { return r.value > -1e5 ? [p[0], p[1], +r.value] : null; }).catch(function () { return null; });
      }));
      samples = got.filter(Boolean);
    }
    if (samples.length < 4) return [F('survey', 'Slope', 'verify', 'Elevation service unavailable')];
    var zs = samples.map(function (s) { return s[2]; }), lo = Math.min.apply(0, zs), hi = Math.max.apply(0, zs);
    var fit = fitSlope(samples, ctx.lat0), slope = fit[0], local = fit[2];
    ctx.facts.slope = slope; ctx.facts.relief = hi - lo; ctx.facts.elev = zs.reduce(function (s, z) { return s + z; }, 0) / zs.length;
    var status = slope < 8 && local < 15 ? 'ok' : slope < 15 && local < 25 ? 'watch' : 'flag';
    var detail = samples.length + ' LiDAR elevation samples across the lot. Elevation ' + Math.round(lo) + '-' + Math.round(hi) + ' ft (' + Math.round(hi - lo) +
      ' ft of relief); overall slope ' + slope.toFixed(1) + '%, falling to the ' + compass(fit[1]) + '; steepest local slope about ' + Math.round(local) + '%.';
    if (status !== 'ok') detail += ' Steeper ground means more excavation, retaining walls, longer driveways and possibly a walkout design.';
    return [F('survey', 'Slope (LiDAR)', status, slope.toFixed(1) + '% average slope, ' + Math.round(hi - lo) + ' ft relief', detail,
      'USGS 3DEP 1 m elevation', 'https://apps.nationalmap.gov/', status === 'flag' ? ctx.cost('steep_site_work') : null),
      F('survey', 'Boundary & topo survey', 'verify', 'Licensed survey with topography required',
        'Public LiDAR is good for screening, but permits and the site plan need a stamped boundary and topographic survey.', null, null, ctx.cost('survey_topo'),
        'Order a boundary + topo survey (often 2-4 weeks).')];
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
    out.push(F('utilities', 'Internet', 'verify', 'Wireline telecom territory: ' + prov,
      'Check the FCC National Broadband Map at this location for fiber/cable availability. Buyers of high-end spec homes expect fiber.', 'UGRC telecom boundaries + FCC',
      'https://broadbandmap.fcc.gov/location-summary/fixed?lat=' + ctx.parcel.cy.toFixed(6) + '&lon=' + ctx.parcel.cx.toFixed(6)));
    return out;
  };

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
        ctx.facts.hydrant_ft = hft;
        if (hft == null) out.push(F('access', 'Fire hydrant', 'flag', 'No mapped hydrant within 6,500 ft',
          'Without a hydrant, the fire code generally requires residential sprinklers or on-site water storage for firefighting.', 'Weber County GIS: fire hydrants', null, ctx.cost('fire_sprinklers')));
        else out.push(F('access', 'Fire hydrant', hft <= 600 ? 'ok' : 'watch', 'Nearest mapped hydrant about ' + fmt(hft) + ' ft from the lot center',
          hft <= 600 ? 'Within the 600 ft the fire code allows for sprinklered one- and two-family homes (400 ft unsprinklered); measured along the access road it may be longer.'
            : 'The fire code wants a hydrant within 400 ft of every part of the house (600 ft if sprinklered), measured along the access road. Expect a hydrant extension or residential sprinklers.',
          'Weber County GIS: fire hydrants', null, hft <= 600 ? null : ctx.cost('fire_sprinklers')));
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
    if (kb && kb.designReview) out.push(F('ccr', 'City design review', 'ok', 'No city design review for single-family homes', kb.designReview + (sub ? ' HOA architectural review may still apply under the CC&Rs.' : ''),
      ctx.facts.jurisdiction + ' Land Use Code', kb.code));
    else if (sub) out.push(F('ccr', 'Design review', 'verify', 'HOA architectural review likely', 'Expect an HOA architectural committee review before the permit application.', null, null, null, 'Request design guidelines and review schedule from the HOA/developer.'));

    var juris = ctx.facts.jurisdiction || 'the jurisdiction';
    if (kb) {
      var known = kb.impact.reduce(function (t, x) { return t + x[1]; }, 0), fire = kb.fireImpact ? kb.fireImpact[0] : 0;
      var list = kb.impact.map(function (x) { return x[0] + ' $' + x[1].toLocaleString('en-US', { minimumFractionDigits: 2 }); }).join(', ');
      var pc = ctx.cost('permit_impact_fees');
      out.push(F('permits', 'Permit & impact fees', 'watch', 'Published impact fees total about $' + fmt(known) + ' per house',
        'Impact fees: ' + list + ' (' + kb.impact[0][2] + ', one storm-drain unit assumed; more impervious area means more units).' +
        (kb.fireImpact ? ' Plus $' + fire + ' fire impact fee: ' + kb.fireImpact[1] + '.' : '') +
        ' The building permit and plan review fees are set by resolution but not posted online; the range below uses a placeholder for them. Permits: ' + kb.permits,
        juris + ' impact fee ordinance', kb.impactSrc,
        pc ? { key: 'permit_impact_fees', low: Math.round(known + 8000), high: Math.round(known + fire + 20000), label: 'Impact fees (published) + building permit & plan review (estimate)' } : null,
        'Submit through the city permit portal; the submission checklist is at ' + kb.submittal));
      out.push(F('permits', 'Outdoor lighting', 'watch', 'Dark-sky lighting plan required at permit', kb.lighting, juris + ' Land Use Code 108-16', kb.code));
    } else {
      out.push(F('permits', 'Building permit', 'verify', 'Permitting authority: ' + juris, 'Permits through ' + juris + '. Fee schedules are set locally.', null, null, ctx.cost('permit_impact_fees'),
        'Get the current residential fee schedule (permit, plan review, impact fees) and typical review time.'));
    }
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
    var wt = fx.water_table_in;

    // Foundation vs. seasonal groundwater
    if (p.foundation === 'basement' && wt != null && wt < 60) out.push(P('Foundation vs. groundwater', 'flag',
      'Basement planned, but the seasonal water table is ~' + wt + ' in below the surface',
      'The plan shows a basement' + from('foundation') + '. The soil survey puts the seasonal high water table at about ' + wt + ' inches and rates these soils "' + (fx.basement_rating || 'limited').toLowerCase() +
      '" for basements. A basement here would sit in groundwater part of the year: expect full waterproofing, perimeter drains to daylight or a sump, possibly dewatering during construction, or redesigning to a raised crawlspace or slab.',
      ctx.cost('basement_waterproofing'), 'Have the geotech measure groundwater (test pits in spring) before committing to the basement.'));
    else if (p.foundation === 'crawlspace' && wt != null && wt < 36) out.push(P('Foundation vs. groundwater', 'watch',
      'Crawlspace planned with a seasonal water table ~' + wt + ' in down',
      'Crawlspaces dug below the seasonal water table flood. Keep the crawlspace floor above grade where possible, raise finish grades, and add a sealed vapor barrier and sump.', null,
      'Ask the geotech for the minimum crawlspace floor elevation.'));
    else if (p.foundation === 'slab' && wt != null && wt < 36) out.push(P('Foundation vs. groundwater', 'ok',
      'Slab on grade suits the shallow water table (~' + wt + ' in)',
      'A slab with a capillary break and raised finish grade avoids most groundwater problems on this lot' + from('foundation') + '. Keep footings at frost depth with footing drains.'));
    else if (!p.foundation && wt != null && wt < 60) out.push(P('Foundation vs. groundwater', 'verify',
      'Foundation type not found in the plan; water table is ~' + wt + ' in',
      'Choose slab or a shallow crawlspace over a basement here unless a geotech report shows deeper groundwater.'));

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
      out.push(P('Footprint vs. buildable area', fits ? (bw < ew - 20 ? 'ok' : 'watch') : 'flag',
        Math.round(bw) + "' x " + Math.round(bd) + "' envelope vs. ~" + Math.max(0, Math.round(ew)) + "' x " + Math.max(0, Math.round(ed)) + "' buildable" + setTxt,
        (fits ? 'The house fits the buildable area of the lot\'s bounding rectangle' + setTxt + '.' : 'The house does not fit the buildable area' + setTxt + '.') +
        ' The lot is irregular, so confirm on the survey with the actual setback lines' + from('width_ft') + '.', null,
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
        'Homes over 3,600 sq ft of fire area need more fire flow under the fire code\'s Appendix B, and the hydrant must be within 400 ft (600 ft if sprinklered) of every part of the house. ' +
        (far ? (sprk ? 'The plan shows sprinklers, which helps.' : 'The plan shows no fire sprinklers; expect the fire district to require them or a closer hydrant.') : 'The hydrant distance looks workable; the district will confirm required fire flow.'),
        far && !sprk ? ctx.cost('fire_sprinklers') : null, 'Ask the fire district for the required fire flow for a ' + fmt(foot) + ' sq ft wood-frame house.'));
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
  function fetchDocs(parcel, juris) {
    var base = apiBase();
    if (base == null) return Promise.resolve({ unavailable: 'This copy of the app is not connected to the document service.' });
    var get = function (path) {
      var ctl = typeof AbortController !== 'undefined' ? new AbortController() : null, t = ctl && setTimeout(function () { ctl.abort(); }, 290000);
      return fetch(base + path, { signal: ctl && ctl.signal }).then(function (r) { return r.json(); }).catch(function (e) { return { error: String(e.message || e) }; })
        .finally(function () { t && clearTimeout(t); });
    };
    var sub = parcel.attrs.SUBDIV_NAME;
    return Promise.all([
      get('/api/parcel-docs?county=' + encodeURIComponent(parcel.county) + '&parcel=' + encodeURIComponent(parcel.id)),
      sub ? get('/api/notices?q=' + encodeURIComponent(sub) + '&county=' + encodeURIComponent(parcel.county) + '&juris=' + encodeURIComponent(juris || '')) : Promise.resolve(null)
    ]).then(function (r) { return { record: r[0], notices: r[1] }; });
  }
  function cite(doc, page) { return doc.name + (page ? ', p. ' + page : '') + ' (' + doc.notice.entity + ', ' + doc.notice.date + ')'; }
  function replaceFinding(ctx, section, item, f) {
    var i = ctx.findings.findIndex(function (x) { return x.section === section && x.item === item; });
    if (i >= 0) ctx.findings[i] = f; else ctx.findings.push(f);
  }

  C.check_documents = async function (ctx) {
    var d = await (ctx.docs || fetchDocs(ctx.parcel, ctx.facts.jurisdiction)), out = [], rec = d.record || {}, no = d.notices || {};
    if (d.unavailable) return [F('ccr', 'Recorded documents', 'verify', 'Plat and public-record lookup not connected', d.unavailable + ' Open the hosted version to read the plat and meeting records automatically.')];
    var plat = rec.plat || {}, docs = (no.documents || []).filter(Boolean), sub = ctx.parcel.attrs.SUBDIV_NAME || 'the subdivision';
    if (rec.supported === false) out.push(F('ccr', 'Recorded plat', 'verify', 'Recorded plat not read for ' + ctx.parcel.county + ' County yet',
      'Automatic plat reading (setback notes, recorded agreements, utility approvals) covers Weber County so far. Public meeting records were still searched for the subdivision.' +
      (docs.length ? '' : ' None mentioning it were found.'), 'County recorder', ctx.parcel.attrs.BOUNDARY_SRC || null));
    var platUrl = (rec.plats && rec.plats[0] && rec.plats[0].url) || rec.parcelPage;

    // Setbacks: plat note first (it governs the lot), then the development standards table.
    var std = docs.map(function (x) { return x.standards && Object.assign({ doc: x }, x.standards); }).filter(Boolean)[0];
    var sb = plat.setbacks;
    if (sb || std) {
      var front = sb ? sb.front : std.front, side = sb ? sb.side : std.side, rear = sb ? sb.rear : std.rear, street = sb ? sb.streetSide : std.streetSide;
      ctx.facts.zone_std = { zone: sb ? 'plat' : 'development standards', front: front, side: side, rear: rear,
        height: std && std.heightMax || (ctx.facts.zone_std || {}).height || null, coverage: std && std.coverageMax ? std.coverageMax / 100 : null };
      replaceFinding(ctx, 'land', 'Plat setbacks', F('land', 'Plat setbacks', 'ok',
        'Setbacks for this lot: ' + front + "' front, " + side + "' side" + (street ? ', ' + street + "' street side on corners" : '') + ', ' + rear + "' rear",
        (sb ? 'From the setback note on the recorded plat (sheet ' + (sb.sheet || '1') + '), which cites the ' + (sb.basis || 'plat') + (sb.entry ? ' recorded as Entry #' + sb.entry : '') + '. These replace the base zone setbacks.'
          : 'From the development standards in ' + cite(std.doc) + '. These replace the base zone setbacks.'),
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
      out.push(F('ccr', 'Development standards', 'ok', sub + ' ' + (std.section === 'single-family' ? 'single-family ' : '') + 'standards: ' + bits.slice(0, 3).join(', '),
        'From the development standards table in ' + cite(std.doc, std.doc.standardsPage) + ': ' + bits.join('; ') + '. Where these differ from the zone, they govern.',
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

    // Utilities: will-serve statements in the approval record and the plat's approval blocks.
    var util = [].concat.apply([], docs.map(function (x) { return (x.utilities || []).map(function (q) { return Object.assign({ doc: x }, q); }); }));
    var sewerDoc = util.find(function (q) { return q.kind === 'sewer' && q.provider; });
    var sewerPlat = (plat.approvals || []).find(function (a) { return /SEWER/.test(a); });
    if (sewerDoc || sewerPlat) {
      var prov = sewerDoc ? sewerDoc.provider : title(sewerPlat);
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

    // Subdivision geologic report referenced on the plat.
    (plat.hazardReports || []).slice(0, 1).forEach(function (h) {
      out.push(F('geo', 'Subdivision geologic report', 'ok', 'Geologic hazards report on file' + (h.date ? ' (' + title(h.date) + ')' : ''),
        (h.title ? '"' + title(h.title) + '"' : 'A geologic hazards evaluation') + (h.firm ? ' by ' + title(h.firm) : '') + ' covers the subdivision, per the recorded plat.' +
        (h.publicReview ? ' The plat says it is available for public review at the county planning office; ask for it before ordering a new study.' : ''),
        'Recorded plat', platUrl));
    });

    // Approval history from public meetings.
    var hist = (no.notices || []).filter(function (n) { return /planning|commission|administrative|council/i.test(n.body + ' ' + n.title); }).slice(0, 5);
    if (hist.length) out.push(F('land', 'Approval history', 'ok', hist.length + ' public meetings on ' + sub.replace(/\s+Phase.*$/i, ''),
      hist.map(function (n) { return n.date + ' ' + n.body + ': ' + n.title; }).join('; ') + '.', 'Utah Public Notice Website', hist[0].url));
    if (rec.error && no && no.error) out.push(F('ccr', 'Recorded documents', 'verify', 'Document service did not respond', rec.error));
    return out;
  };

  var STEPS = [
    ['check_parcel', 'Parcel boundary & assessor record'], ['weber_assessor', 'County assessor value'], ['check_jurisdiction', 'City / county jurisdiction'],
    ['check_zoning', 'Zoning district'], ['check_water', 'Culinary water, irrigation & water rights'], ['check_landslides', 'Mapped landslides'],
    ['check_faults', 'Active faults'], ['check_liquefaction_groundwater', 'Liquefaction & groundwater'], ['check_flood', 'FEMA flood zones'], ['check_districts', 'Service & financing districts'],
    ['check_seismic', 'Seismic design category'], ['check_soils_septic', 'Soils, septic & sewer'], ['check_slope', 'LiDAR slope & relief'],
    ['check_utilities', 'Power, gas & internet'], ['check_access_fire', 'Road access & wildfire'], ['check_ccr_permits', 'CC&Rs, design review, fees'], ['check_snow', 'Utah ground snow load'], ['check_documents', 'Recorded plat & public records'],
    ['check_plan_fit', 'Plan vs. lot conflicts']
  ];

  async function run(parcel, plan, costs, onStep) {
    var ctx = { parcel: parcel, plan: plan || {}, lat0: parcel.cy, grid: gridInside(parcel.rings, 60), facts: {},
      cost: function (k) { return costs[k] ? Object.assign({ key: k }, costs[k]) : null; } };
    if (ctx.grid.length >= 4) ctx.elevation = lidarSamples(ctx.grid);
    var findings = [];
    ctx.findings = findings;
    // Start the slow document lookup now so it runs alongside the map checks (jurisdiction resolves early; refine later).
    ctx.docs = fetchDocs(parcel, null);
    for (var i = 0; i < STEPS.length; i++) {
      var id = STEPS[i][0];
      onStep && onStep(id, 'running');
      try { var got = await C[id](ctx); for (var g = 0; g < got.length; g++) findings.push(got[g]); onStep && onStep(id, 'done'); }
      catch (e) {
        onStep && onStep(id, 'failed');
        findings.push(F('land', STEPS[i][1], 'verify', 'Automated check failed', String(e && e.message || e).slice(0, 300)));
      }
    }
    return { findings: findings, facts: ctx.facts };
  }

  root.LotReport = { locate: locate, run: run, STEPS: STEPS, CHECKLIST: CHECKLIST, looksLikeParcel: looksLikeParcel };
})(typeof window !== 'undefined' ? window : globalThis);
