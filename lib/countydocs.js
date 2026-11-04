// County document listings that aren't on the state notice site. Weber County's commission page lists every
// agenda attachment (staff reports, agreements, ordinances) with descriptive file names, so a subdivision's
// development agreement can be found by name.
const { text, decode } = require('./http');

const SOURCES = {
  Weber: [{ url: 'https://www.webercountyutah.gov/Transparency/commission_meetings.php', body: 'Weber County Commission' }]
};
const cache = new Map();

async function listing(src) {
  const hit = cache.get(src.url);
  if (hit && Date.now() - hit.t < 6 * 3600e3) return hit.items;
  const html = await text(src.url, { timeout: 30000 });
  const items = [];
  const re = /href=["']([^"']+\.(?:pdf|docx?))["'][^>]*>([\s\S]{0,200}?)<\/a>/gi; let m;
  while ((m = re.exec(html))) {
    const url = m[1].startsWith('http') ? m[1] : new URL(m[1], src.url).href;
    const name = decodeURIComponent(url.split('/').pop()).replace(/\.(pdf|docx?)$/i, '');
    items.push({ url, name, label: decode(m[2]) || name });
  }
  cache.set(src.url, { t: Date.now(), items });
  return items;
}

// Date in names like "5-29-25 -- CC Staff Report" or "November 3, 2026 Agenda".
function dateOf(name) {
  let m = /(\d{1,2})-(\d{1,2})-(\d{2,4})/.exec(name);
  if (m) { const y = m[3].length === 2 ? '20' + m[3] : m[3]; return `${y}/${m[1].padStart(2, '0')}/${m[2].padStart(2, '0')}`; }
  m = /(January|February|March|April|May|June|July|August|September|October|November|December) (\d{1,2}),? (\d{4})/i.exec(name);
  if (m) return `${m[3]}/${String(new Date(m[1] + ' 1, 2000').getMonth() + 1).padStart(2, '0')}/${m[2].padStart(2, '0')}`;
  return '';
}

async function find(county, keyword, subRe) {
  const srcs = SOURCES[county] || [];
  const out = [];
  for (const src of srcs) {
    let items = [];
    try { items = await listing(src); } catch (e) { continue; }
    items.filter(it => new RegExp('\\b' + keyword + '\\b', 'i').test(it.name + ' ' + it.label))
      // File names are short: accept the subdivision pattern, or the name next to an agreement/report keyword.
      .filter(it => subRe.test(it.name) || /agreement|\bDA\b|staff report|plat|subdivision|rezone|ordinance/i.test(it.name))
      .forEach(it => out.push({ url: it.url, name: it.name + '.pdf', type: /\.pdf$/i.test(it.url) ? 'pdf' : 'doc',
        notice: { title: src.body + ' document', date: dateOf(it.name), entity: county + ' County', body: src.body, url: src.url, text: it.name } }));
  }
  return out;
}

module.exports = { find, dateOf };
