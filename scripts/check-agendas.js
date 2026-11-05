// Weekly agenda watch: for each jurisdiction in config/records.json, list the fee actions on its public agendas
// (via the deployed /api/watch) and open a GitHub issue for any that hasn't been reviewed yet.
// Usage: node scripts/check-agendas.js            (needs GH_TOKEN and the gh CLI to open issues)
//        DRY_RUN=1 node scripts/check-agendas.js  (print what it would open)
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const API = process.env.API_BASE || 'https://lot-dossier-assistant.vercel.app';
const DRY = !!process.env.DRY_RUN;
const config = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'config', 'records.json'), 'utf8'));

function gh(args) { return execFileSync('gh', args, { encoding: 'utf8' }); }
function existingTitles() {
  if (DRY) return new Set();
  const out = JSON.parse(gh(['issue', 'list', '--state', 'all', '--label', 'agenda-watch', '--limit', '200', '--json', 'title']));
  return new Set(out.map(i => i.title));
}

(async () => {
  if (!DRY) gh(['label', 'create', 'agenda-watch', '--color', 'C5DEF5', '--description', 'New fee action on a pilot city agenda', '--force']);
  const seen = existingTitles();
  let opened = 0, failed = 0;
  for (const [entity, rec] of Object.entries(config)) {
    if (entity.startsWith('_')) continue;
    // Bust the endpoint's one-day cache once per run day.
    const url = `${API}/api/watch?entity=${encodeURIComponent(entity)}&since=${rec.since}&run=${new Date().toISOString().slice(0, 10)}`;
    let data;
    try { data = await (await fetch(url, { signal: AbortSignal.timeout(90000) })).json(); } catch (e) { data = { error: String(e.message || e) }; }
    if (data.error || !Array.isArray(data.items)) { console.error(`${entity}: watch failed: ${data.error || 'no items'}`); failed++; continue; }
    const fresh = data.items.filter(i => /XX/i.test(i.number) ? i.date > rec.asOf : !rec.known.includes(`${i.kind} ${i.number}`));
    console.log(`${entity}: ${data.items.length} fee actions since ${rec.since}, ${fresh.length} not reviewed`);
    for (const i of fresh) {
      const title = `Fee action on ${entity} agenda: ${i.kind} ${i.number}${/XX/i.test(i.number) ? ' (' + i.date + ')' : ''}`;
      if (seen.has(title)) { console.log(`  already open: ${title}`); continue; }
      const body = [
        `**${i.kind} ${i.number}**: ${i.title.replace(/&#0?39;/g, "'")}`,
        '',
        `- Meeting: ${i.meeting} (${i.date})`,
        `- Agenda: ${i.notice}`,
        `- Minutes: ${i.minutes || 'not posted yet (adoption is confirmed in the minutes)'}`,
        '',
        `The dossier's fee figures for ${entity} were last reviewed as of ${rec.asOf}. Until this is reviewed, dossiers mark the permit and impact fee row as Verify.`,
        '',
        '**To close this:**',
        `1. Check the minutes for whether it was adopted. If it changes fees the dossier uses, request the document from the ${rec.custodian.role} (${rec.custodian.email}).`,
        `2. Update the figures in \`web/lotreport.js\` if needed, add \`${i.kind} ${i.number}\` to \`known\` in \`config/records.json\`, and set \`asOf\` to today.`,
      ].join('\n');
      if (DRY) { console.log(`  would open: ${title}\n${body.replace(/^/gm, '    ')}`); continue; }
      gh(['issue', 'create', '--title', title, '--body', body, '--label', 'agenda-watch', '--assignee', process.env.ISSUE_ASSIGNEE || '@me']);
      console.log(`  opened: ${title}`);
      opened++;
    }
  }
  console.log(`done: ${opened} issue(s) opened`);
  if (failed) process.exit(1); // a failed check fails the workflow run, which GitHub emails about
})();
