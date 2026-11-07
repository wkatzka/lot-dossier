const assert = require('node:assert/strict');
const { extractMentions, mergeSheets, assess } = require('../web/plat-evidence');
const { parseLot } = require('../lib/plat');
const { allowed, bundlePlats } = require('../lib/plat-bundle');

const plats = ['001-001', '001-002', '001-003'].map(sheet => ({ sheet, url: 'https://webercountyutah.gov/mounts/ded_plats/Book_1/' + sheet + '.tif' }));
function sheet(i, lot, text = '') { return { ...plats[i], lot, plat: { easementMentions: extractMentions(text) } }; }
const common = { lot: '7', mentions: [], platAddress: null };
// More legible text on an edge sheet must not override the useful interior sheet, or discard either one's evidence.
const results = [
  sheet(0, { ...common, acres: null, nearSheetEdge: false, labelClearance: .3, easements: ["20' public utility easement"] }, 'CENTERLINE 20 P.U.E.\nCONSERVATION EASEMENT'),
  sheet(1, { ...common, acres: 2.5, nearSheetEdge: true, labelClearance: .02, easements: ["30' drainage easement"] }, 'TEMPORARY TURN AROUND EASEMENT\nENTRY #1234567'),
  { error: 'OCR timed out' }
];
const merged = mergeSheets({ plats }, results);
assert.equal(merged.lot.sheet, plats[0].sheet);
assert.equal(merged.lot.acres, 2.5);
assert.equal(merged.lot.fieldSources.acres[0].sheet, plats[1].sheet);
assert.equal(merged.lot.easements.length, 2);
assert.deepEqual(merged.coverage, { processed: 2, total: 3, geometryVerified: false, titleSearchComplete: false });
assert(merged.evidence.some(x => x.entries.includes('1234567')));
assert(merged.evidence.every(x => x.scope.includes('may concern other lots')));
assert.equal(merged.sheets[2].processed, false);
// Builder asks: do all five downloaded sheets establish complete easement coverage?
const completePlats = mergeSheets({ plats }, results.slice(0, 2).concat(sheet(2, null)));
const checked = assess({ ...completePlats, assessedAt: '2026-11-07T12:00:00Z',
  recordSource: { legal: 'LOT 7, EXAMPLE SUBDIVISION' },
  references: [{ entry: '1234567' }], titleSearchComplete: true, geometryVerified: true,
  checklist: { done: true }, attachments: ['title.pdf', 'survey.pdf'] });
assert.equal(checked.linkedSheets.complete, true);
assert.equal(checked.stage, 'Partial evidence');
assert.equal(checked.rows.length, 5);
assert.match(checked.rows.find(x => x.id === 'instruments').gap, /have not been reconciled/);
assert.deepEqual(checked.references, ['1234567']);
assert.equal(checked.assessedAt, '2026-11-07T12:00:00Z');
assert.equal(assess({}).linkedSheets.complete, false); // zero of zero is not complete
assert.equal(assess(merged).linkedSheets.complete, false);
assert.match(assess(merged).rows.find(x => x.id === 'plats').evidence, /001-003/);
const omitted = mergeSheets({ plats }, results.slice(0, 1));
assert.equal(omitted.sheets.length, 3); // omitted result must still expose the missing source
assert.equal(assess(omitted).linkedSheets.complete, false);
assert.equal(assess({ sheets: [{ processed: true, error: 'unreadable' }], coverage: { total: 1 } }).linkedSheets.complete, false);
assert.equal(assess({ sheets: [{ processed: true }], coverage: { total: 2 } }).linkedSheets.complete, false);
results[0].lot.acres = 3.5;
const conflict = mergeSheets({ plats }, results);
assert.equal(conflict.lot.acres, null);
assert.equal(conflict.conflicts[0].field, 'acres');
assert.match(assess(conflict).rows[0].evidence, /Conflicting readings: acres/);
assert(extractMentions('BLANKET ACCESS EASEMENT\nSubject to release recorded separately').some(e => e.categories.includes('Access / roadway')));
assert(extractMentions('AVIGATION EASEMENT').some(e => e.categories.includes('Other recorded restriction')));
const words = [{ t: 'LOT', x: 80, y: 300 }, { t: '7', x: 120, y: 300 }];
assert.equal(parseLot(words, '7', { width: 5400, height: 3600 }).nearSheetEdge, true);
assert.equal(parseLot(words, '8', { width: 5400, height: 3600 }), null);
assert(!allowed('https://example.com/fake.tif'));
assert(!allowed('https://webercountyutah.gov.evil.test/mounts/ded_plats/Book_1/a.tif'));
async function main() {
  await assert.rejects(bundlePlats([]), /No recorded/);
  await assert.rejects(bundlePlats(Array(13).fill(plats[0])), /No partial|no partial/);
  await assert.rejects(bundlePlats([{ url: 'https://example.com/a.tif' }]), /Unsupported/);
  console.log('Plat evidence regressions passed: edge sheets, retained evidence, source attribution, missing sheets, conflicts, unusual easements, and download bounds.');
}
main().catch(e => { console.error(e); process.exit(1); });
