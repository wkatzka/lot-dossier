// Utah HOA registry (Department of Commerce). Its search page calls a small backend that returns either a list of
// matching associations or, for a single match, the registration. Light, cached use only.
const { text, decode } = require('./http');

const URL = 'https://services.commerce.utah.gov/hoa/assets/js/hoa-ajax.php';
const PUBLIC_PAGE = 'https://services.commerce.utah.gov/hoa/';

async function call(params) {
  return text(URL, { method: 'POST', timeout: 20000, headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(params).toString() });
}

function parseList(html) {
  const out = [], re = /<tr data-pid="(\d+)"[^>]*>\s*<td[^>]*>([\s\S]*?)<\/td>\s*<td[^>]*>([\s\S]*?)<\/td>/gi; let m;
  while ((m = re.exec(html))) {
    const loc = decode(m[3]), parts = loc.split(',').map(s => s.trim());
    out.push({ pid: m[1], name: decode(m[2]), city: parts[0] || null, county: (parts[1] || '').replace(/ County$/i, '') || null });
  }
  return out;
}

// Registration plus role-based contacts (no individual board-member names).
function parseDetail(html) {
  const name = decode((/<h1[^>]*>([\s\S]*?)<\/h1>/i.exec(html) || [])[1] || '');
  if (!name) return null;
  const reg = decode((/<h6[^>]*>([\s\S]*?)<\/h6>/i.exec(html) || [])[1] || '');
  const field = (label) => (new RegExp(label + ':\\s*([^:]+?)(?=\\s+(?:Registration Type|Status|Expires)\\b|$)', 'i').exec(reg) || [])[1] || null;
  const loc = decode((/Location:<\/h5>\s*<p[^>]*>([\s\S]*?)<\/p>/i.exec(html) || [])[1] || '');
  const contacts = [];
  const re = /<h4[^>]*>(HOA President|HOA Community Manager|Payoff Contact|Management Company[^<]*)<\/h4>\s*<p[^>]*>([\s\S]*?)<\/p>/gi; let m;
  while ((m = re.exec(html))) {
    const body = m[2].replace(/<span[^>]*>[\s\S]*?<\/span>/i, ''); // drop the person's name; keep role, phone, email
    const t = decode(body.replace(/<br\s*\/?>/gi, ' | '));
    const phone = (/\(?\d{3}\)?[ .-]?\d{3}-\d{4}/.exec(t) || [])[0] || null, email = (/[\w.+-]+@[\w-]+\.[\w.-]+/.exec(t) || [])[0] || null;
    if (phone || email) contacts.push({ role: m[1].replace(/^HOA /, ''), phone, email });
  }
  const county = loc.split(',').map(s => s.trim())[1] || null;
  return { name, registration: field('Registration #'), type: field('Registration Type'), status: field('Status'), expires: field('Expires'),
    city: loc.split(',')[0].trim() || null, county, contacts, source: PUBLIC_PAGE };
}

function score(name, words) {
  const n = name.toUpperCase();
  const hit = words.filter(w => n.includes(w)).length;
  return hit === words.length ? 10 + (/OWNERS|HOMEOWNERS|MASTER/.test(n) ? 2 : 0) - (/TOWNHOME|CONDO|COMMERCIAL/.test(n) ? 3 : 0) : hit;
}

async function find(term, county) {
  const words = term.toUpperCase().replace(/[^A-Z0-9 ]/g, ' ').split(/\s+/).filter(w => w.length > 2);
  const html = await call({ f: 's', v: term });
  if (/<h1/i.test(html)) { const d = parseDetail(html); return d ? { matches: [d], candidates: [] } : { matches: [], candidates: [] }; }
  let list = parseList(html);
  if (county) { const inCounty = list.filter(r => (r.county || '').toUpperCase() === county.toUpperCase()); if (inCounty.length) list = inCounty; }
  list = list.map(r => ({ ...r, score: score(r.name, words) })).filter(r => r.score >= 10).sort((a, b) => b.score - a.score);
  const matches = [];
  for (const r of list.slice(0, 2)) {
    const d = parseDetail(await call({ f: 'd', v: r.pid }));
    if (d) matches.push(d);
  }
  return { matches, candidates: list.slice(0, 6).map(r => ({ name: r.name, city: r.city, county: r.county })) };
}

module.exports = { find, parseDetail, parseList };
