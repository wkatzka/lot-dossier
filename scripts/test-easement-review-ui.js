// Exercise the actual renderer used by both live and saved dossiers with source failures and hostile OCR.
const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const PlatEvidence = require('../web/plat-evidence');
const source = fs.readFileSync('web/app.js', 'utf8');
const renderer = source.slice(source.indexOf('  function platEvidenceSection('), source.indexOf('  function reportHTML('));
const context = { window: { PlatEvidence }, esc: s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])) };
vm.createContext(context);
vm.runInContext(renderer, context);
const render = p => context.platEvidenceSection({facts: {platEvidence: p}});
const html = render({assessedAt:'2026-11-07T12:00:00Z', sheets:[{sheet:'001-001',url:'https://example.com/plat',processed:true}], coverage:{total:1},
  recordSource:{legal:'LOT 7 <script>bad()</script>',url:'https://example.com/parcel'}, readings:[], evidence:[]});
assert.match(html, /Complete for the retrieved inventory/);
assert.match(html, /1 of 1 linked sheets processed/);
assert.match(html, /Partial evidence/);
assert.match(html, /Blocked: title evidence/);
assert.match(html, /Unresolved: survey reconciliation/);
assert.equal((html.match(/Completion criterion:/g)||[]).length,5);
assert.match(html,/&lt;script&gt;/);
assert.doesNotMatch(html,/<script>bad/);
assert.match(render(undefined), /Incomplete \(0\/0\)/);
assert.match(render({sheets:[{sheet:'001-002',processed:false,error:'timeout'}]}),/Unread or failed: 001-002/);
assert.match(source, /platEvidenceSection\(r\)/);
if (process.argv[2]) {
  fs.mkdirSync(process.argv[2],{recursive:true});
  const preview = process.argv[3] ? render(JSON.parse(fs.readFileSync(process.argv[3],'utf8'))) : html;
  fs.writeFileSync(process.argv[2]+'/index.html','<!doctype html><meta charset="utf-8"><title>Cornerpin evidence checklist test</title><style>'+fs.readFileSync('web/styles.css','utf8')+'#rv{display:block!important;padding:24px;max-width:1050px;margin:auto}</style><div id="rv"><h1>Cornerpin · evidence checklist test</h1>'+preview+'</div>');
}
console.log('Evidence UI passed: five gates, missing data, failed source, escaped OCR, dated evaluation and completion scope.');
