// GET /api/notices?q=Example%20Ridge%20Phase%201&county=Weber&juris=Ogden%20Valley%20City
// Search Utah public notices for a subdivision, read matching agendas/minutes and their packet PDFs, and extract
// development standards, utility providers and CC&R recordings, each with a citation.
const pmn = require('../lib/pmn');
const ex = require('../lib/extract');
const { buffer, pool } = require('../lib/http');
const { cors, query, send } = require('../lib/respond');

const GENERIC = /^(the|eden|north|south|east|west|river|mountain|valley|park|village|estates?|ranch|meadows?|hills?|creek|ridge|view|point|lake|summit|canyon)$/i;

function baseName(q) {
  const b = q.replace(/\b(phase|ph\.?|plat|unit|amended|amendment|subdivision|subd\.?|pud|lot|no\.?)\b.*$/i, '').replace(/[^A-Za-z0-9' -]/g, ' ').replace(/\s+/g, ' ').trim();
  const words = b.split(' ');
  // Search on the most distinctive word (agendas abbreviate: "Example Phase 1" for "Example Ridge Phase 1"), then require the fuller name in the text.
  return { full: b, search: words.length > 1 && !GENERIC.test(words[0]) && words[0].length >= 5 ? words[0] : b };
}

// The subdivision as a subdivision ("Example Ridge", "Example Phase 1", "Example development agreement"), not a
// person or other use of the word ("John Example, Planner"). Distinctive first words are often also surnames.
function subdivisionRe(kw) {
  const esc = x => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const rest = kw.full.split(' ').slice(1).map(esc).join('\\s+');
  const ctx = ['phase', 'ph\\.?', 'subdivision', 'subd', 'pud', 'townhomes?', 'development', 'da\\b', 'plat', 'estates', 'lots?', 'project',
    'master', 'amendment', 'final', 'preliminary', 'rezone', 'concept', 'mpd'].concat(rest ? [rest] : []).join('|');
  return kw.search === kw.full && kw.full.includes(' ') ? new RegExp(esc(kw.full), 'i') : new RegExp('\\b' + esc(kw.search) + '\\b,?\\s+(?:' + ctx + ')', 'i');
}

function snippets(text, word, n = 3) {
  const out = [], re = new RegExp(word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'); let m;
  while ((m = re.exec(text)) && out.length < n) out.push(text.slice(Math.max(0, m.index - 260), m.index + 340).replace(/\s+/g, ' ').trim());
  return out;
}

module.exports = async (req, res) => {
  if (cors(req, res)) return;
  const q = query(req), t0 = Date.now();
  const name = String(q.q || '').trim(), county = String(q.county || '').trim(), juris = String(q.juris || '').trim();
  if (!name) return send(res, 400, { error: 'q (subdivision name) is required' });
  const kw = baseName(name);
  const deadline = t0 + Math.min(280, +q.budget || 50) * 1000;
  try {
    // County-wide, city-wide and statewide searches (each returns the 25 newest matches).
    const entities = Array.from(new Set([county ? county.replace(/ County$/i, '') + ' County' : '', juris && !/County/i.test(juris) ? juris.replace(/ City$/i, '') : '', '']));
    const sets = await pool(entities, 3, e => pmn.search(kw.search, { entityName: e }));
    const seenIds = new Set(), all = [];
    sets.forEach(r => Array.isArray(r) && r.forEach(n => { if (!seenIds.has(n.id)) { seenIds.add(n.id); all.push(n); } }));
    const local = new RegExp([county, juris].filter(Boolean).map(s => s.replace(/ (City|County)$/i, '')).concat(['Water and Sewer', 'Improvement District', 'Fire District']).join('|'), 'i');
    // Land-use bodies (planning commission, county commission/city council, administrative review) carry the approvals and
    // agreements; utility boards carry service evidence. Read the land-use notices first, then fill with the rest.
    const landUse = n => /planning|commission|council|administrative review|adm(?:in|ini)strative/i.test(n.body + ' ' + n.title + ' ' + n.entity);
    const ranked = all.filter(n => local.test(n.entity + ' ' + n.body))
      .sort((a, b) => (landUse(b) - landUse(a)) || b.date.localeCompare(a.date)).slice(0, +q.notices || 20);
    const read = (await pool(ranked, 4, n => pmn.notice(n))).filter(n => n && !n.error);
    const subRe = subdivisionRe(kw);
    const mentions = read.filter(n => subRe.test(n.text));
    const notices = mentions.map(n => ({ id: n.id, title: n.title, date: n.date, entity: n.entity, body: n.body, url: n.url,
      snippets: snippets(n.text, kw.search), utilities: ex.utilities(snippets(n.text, kw.search, 6).join(' '), kw.search), files: n.files.map(f => ({ name: f.name, url: f.url })) }));

    // Packets/staff reports attached to the matching notices: read the pages around the subdivision's item.
    const files = [];
    mentions.forEach(n => n.files.filter(f => f.type === 'pdf' && /packet|staff|report|agreement|minutes|agenda/i.test(f.name)).forEach(f => files.push({ ...f, notice: n })));
    // Rank: packets from hearings on the subdivision's development agreement / rezone first (that's where design standards live).
    const score = f => (/packet|staff|agreement/i.test(f.name) ? 2 : 0) + (/planning commission|county commission|city council/i.test(f.notice.title + ' ' + f.notice.body) ? 1 : 0)
      + (new RegExp(subRe.source + '[^.]{0,160}(development agreement|rezone|master plan|MPD|PUD)|(development agreement|rezone|MPD|PUD)[^.]{0,160}' + kw.search, 'i').test(f.notice.text) ? 4 : 0)
      + (new RegExp(kw.search + '[^.]{0,120}(final|subdivision)', 'i').test(f.notice.text) ? 2 : 0);
    const chosen = files.sort((a, b) => score(b) - score(a) || b.notice.date.localeCompare(a.notice.date)).slice(0, +q.docs || 5);
    const documents = (await pool(chosen, 3, async f => {
      if (Date.now() > deadline - 20000) return null;
      const buf = await buffer(f.url, { timeout: Math.max(10000, Math.min(90000, deadline - Date.now() - 15000)), maxBytes: 120e6 });
      const { pages, numPages, truncated } = await ex.pdfPages(buf, { maxPages: 500, deadline: deadline - 5000 });
      const hits = pages.map((p, i) => subRe.test(p.replace(/\s+/g, ' ')) ? i : -1).filter(i => i >= 0);
      if (!hits.length) return null;
      // The subdivision's item: from its first mention through the following pages (staff report + exhibits).
      const from = Math.max(0, hits[0] - 1), to = Math.min(pages.length, hits[hits.length - 1] + 25);
      const windowText = pages.slice(from, to).join('\n');
      const near = hits.map(i => pages[i]).join('\n');
      return { name: f.name, url: f.url, notice: { title: f.notice.title, date: f.notice.date, entity: f.notice.entity, url: f.notice.url },
        numPages, readPages: pages.length, truncated, mentionPages: hits.map(i => i + 1).slice(0, 20),
        standards: ex.standards(windowText), standardsPage: (pages.slice(from, to).findIndex(p => /Site Development Standards|Front Yard Setback/i.test(p)) + from + 1) || null,
        uses: ex.uses(windowText), ccrs: ex.ccrs(windowText),
        utilities: ex.utilities(near, kw.search).filter(u => subRe.test(u.text) || u.provider).slice(0, 8) };
    }));
    const skipped = chosen.map((f, i) => documents[i] && documents[i].error ? { name: f.name, url: f.url, error: documents[i].error } : (documents[i] ? null : { name: f.name, url: f.url, error: 'no mention of ' + kw.search + ' in the text (or out of time)' })).filter(Boolean);
    const docsOk = documents.filter(d => d && !d.error);

    send(res, 200, { query: name, keyword: kw, searched: all.length, relevant: ranked.length, notices, documents: docsOk, skipped, ms: Date.now() - t0 }, docsOk.length ? 7 * 86400 : 0);
  } catch (e) {
    send(res, 502, { error: String(e.message || e), ms: Date.now() - t0 });
  }
};
