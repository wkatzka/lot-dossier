// GET /api/watch?entity=Ogden%20Valley%20City&since=2026-04-01
// Fee-related council actions on a public body's agendas (Utah Public Notice Website): fee schedules, impact fees,
// development fee agreements. The dossier compares them against the records it holds to flag stale figures.
const pmn = require('../lib/pmn');
const { pool } = require('../lib/http');
const { cors, query, send } = require('../lib/respond');

const KEYWORDS = ['fee schedule', 'impact fee', 'mitigation contribution', 'permit fee'];
// Agenda items are numbered ("6. Resolution 2026-55. A Resolution ... Discuss and possibly ..."); split on the numbers, then
// read the resolution/ordinance number and its title up to the "Discuss ..." boilerplate.
const ITEM = /\b(Resolution|Ordinance)\s+(?:No\.?\s*)?(\d{2,4}-(?:\d{1,3}|XX))\b\s*[:.\-–]?\s*(.*?)(?=\s+Discuss\b|\s+\(\w*\s*\d+ minutes\)|$)/i;
function agendaItems(t) { return t.split(/\s(?=(?:\d{1,2}|[a-z])\.\s+[A-Z])/); }
const FEE = /\bfees?\b|fee schedule|impact|mitigation contribution/i;

module.exports = async (req, res) => {
  if (cors(req, res)) return;
  const q = query(req), t0 = Date.now(), entity = String(q.entity || '').trim();
  if (!entity) return send(res, 400, { error: 'entity is required, e.g. Ogden Valley City' });
  const since = /^\d{4}-\d{2}-\d{2}$/.test(q.since || '') ? q.since : new Date(Date.now() - 365 * 864e5).toISOString().slice(0, 10);
  try {
    const sets = await pool(KEYWORDS, 2, k => pmn.search(k, { entityName: entity, startDate: since }).catch(() => []));
    const seen = new Set(), notices = [];
    sets.forEach(r => r.forEach(n => { if (!seen.has(n.id)) { seen.add(n.id); notices.push(n); } }));
    notices.sort((a, b) => b.date.localeCompare(a.date));
    const read = await pool(notices.slice(0, 20), 4, n => pmn.notice(n).catch(() => null));
    const items = new Map();
    read.filter(Boolean).forEach(n => {
      const t = n.text.replace(/\s+/g, ' ');
      agendaItems(t).forEach(chunk => {
        const m = ITEM.exec(chunk);
        if (!m) return;
        const title = m[3].replace(/\s+/g, ' ').trim().replace(/[.;,]$/, '');
        if (!FEE.test(title)) return;
        const kind = m[1][0].toUpperCase() + m[1].slice(1).toLowerCase(), key = kind + ' ' + m[2] + (/XX/i.test(m[2]) ? ' ' + title.slice(0, 40) : '');
        const prev = items.get(key), date = n.date.replace(/\//g, '-');
        const minutes = n.files.find(f => /minutes/i.test(f.name));
        // Keep the latest meeting it appeared at; note whether that meeting's minutes are posted (adoption is recorded there).
        if (!prev || date > prev.date) items.set(key, { kind, number: m[2], title: title.slice(0, 200), date, meeting: n.title.slice(0, 120), notice: n.url, minutes: minutes ? minutes.url : null });
      });
    });
    const list = Array.from(items.values()).sort((a, b) => b.date.localeCompare(a.date));
    send(res, 200, { entity, since, searched: notices.length, items: list, ms: Date.now() - t0 }, 86400);
  } catch (e) {
    send(res, 502, { error: String(e.message || e), ms: Date.now() - t0 });
  }
};
