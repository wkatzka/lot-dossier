// Utah Public Notice Website (utah.gov/pmn): every public body posts agendas, minutes and packets here.
// We search agenda text for a subdivision's name, then read the matching notices and their PDF attachments.
const { get, text, decode } = require('./http');

const BASE = 'https://www.utah.gov/pmn/';

async function session() {
  const r = await get(BASE + 'search.html', { timeout: 30000 });
  const cookie = (r.headers.getSetCookie ? r.headers.getSetCookie() : [r.headers.get('set-cookie')]).filter(Boolean).map(c => c.split(';')[0]).join('; ');
  const html = await r.text();
  const csrf = (/name="_csrf" value="([^"]+)"/.exec(html) || [])[1];
  if (!csrf) throw new Error('PMN session token not found');
  return { cookie, csrf };
}

function parseResults(html) {
  const out = [];
  const rows = html.match(/<tr[^>]*>[\s\S]*?<\/tr>/gi) || [];
  rows.forEach(r => {
    const cells = (r.match(/<td[^>]*>[\s\S]*?<\/td>/gi) || []).map(decode);
    const link = /href="([^"]*\/pmn\/sitemap\/notice\/(\d+)\.html)"/.exec(r);
    if (cells.length >= 4 && link) out.push({ id: link[2], url: 'https://www.utah.gov' + link[1].replace(/^https?:\/\/www\.utah\.gov/, ''),
      title: cells[0], date: cells[1].slice(0, 10), body: cells[2], entity: cells[3], attachments: cells[4] || '' });
  });
  return out;
}

// Results come 25 at a time, newest first; the site's paging endpoint only works from its own page scripts,
// so callers narrow searches by entity instead of paging.
async function search(keyword, { entityName = '', startDate = '2015-01-01', endDate } = {}) {
  const s = await session();
  const end = endDate || new Date(Date.now() + 90 * 864e5).toISOString().slice(0, 10);
  const form = (extra) => new URLSearchParams({ _csrf: s.csrf, entityName, publicBodyName: '', title: '', agenda: keyword, tags: '',
    startDate, endDate: end, deadlineDate: '', createdDate: '', sortColumn: '', sortOrder: '', ...extra }).toString();
  const headers = { Cookie: s.cookie, 'Content-Type': 'application/x-www-form-urlencoded', 'X-CSRF-TOKEN': s.csrf };
  const first = await text(BASE + 'search.html', { method: 'POST', headers, body: form({}), timeout: 60000 });
  let results = parseResults(first);
  const seen = new Set();
  return results.filter(r => !seen.has(r.id) && seen.add(r.id));
}

async function notice(n) {
  const html = await text(n.url, { timeout: 30000 });
  const body = decode(html.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<(br|p|li|div|tr)[^>]*>/gi, '\n'));
  const files = [];
  const fre = /href="([^"]*\/pmn\/files\/\d+\.(pdf|docx?))"[^>]*>([^<]*)</gi; let m;
  while ((m = fre.exec(html))) files.push({ url: m[1].startsWith('http') ? m[1] : 'https://www.utah.gov' + m[1], name: decode(m[3]) || m[1].split('/').pop(), type: m[2] });
  return { ...n, text: body, files };
}

module.exports = { search, notice, parseResults };
