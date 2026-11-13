const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const E=require('../web/approval-evidence'),A=require('../web/area-rules'),W=require('../web/permit-workflow');
function project(id='224410004'){return {schemaVersion:1,propertyKey:'Weber|'+id,property:{county:'Weber',parcelId:id},report:{parcel:{attrs:{PARCEL_ID:id,SUBDIV_NAME:'COBABE RANCH PHASE 1'}},facts:{},findings:[]},application:{areaMap:{version:A.version,parcelKey:'Weber|'+id,at:'2026-11-12',layers:[{id:'municipal',state:'checked',features:[{name:'OGDEN VALLEY'}]}]}},siteVersion:1,planVersion:1,documents:[],requirements:[],events:[],packages:[],corrections:[],receipts:[]};}
let p=project();assert(E.forProject(p));assert(E.forProject(project('22-441-0004')));assert.equal(E.forProject(project('224410005')),null);
const mismatch=project();mismatch.report.parcel.attrs.PARCEL_ID='224410005';assert.equal(E.forProject(mismatch),null);
const wrongCounty=project();wrongCounty.property.county='Cache';assert.equal(E.forProject(wrongCounty),null);
const c=E.forProject(p);for(const x of c.chain)for(const id of x.sources)assert(E.sources[id]?.url.startsWith('https://'));
assert.match(c.chain.find(x=>x.id==='agreement').finding,/3372687.*3372667/);assert.match(c.chain.find(x=>x.id==='timing').finding,/No retrieved applicable original/);
assert(c.chain.some(x=>x.id==='predecessor'));assert(c.chain.some(x=>x.id==='water'));assert.match(E.sources.predecessor.url,/202871-WOLF/);
const rules=A.rules(p);assert.match(rules.find(r=>r.id==='ov-water').trigger,/Lots 1–9, including Lot 4/);assert.match(rules.find(r=>r.id==='ov-water').trigger,/eight conditions/);assert.match(rules.find(r=>r.id==='ov-sewer').trigger,/not evidence that infrastructure is complete/);assert(!A.rules(project('224410005')).find(r=>r.id==='ov-water').trigger.includes('Lots 1–9'),'Do not infer coverage for another parcel from the reviewed Lot 4 identity');assert(A.blockers(p).some(x=>x.startsWith('Lot-specific water')),'Conditional letter must not auto-satisfy readiness');assert(!rules.some(x=>x.id==='covenants'));for(const id of ['cobabe-agreement-chain','cobabe-architectural-chain']){const r=rules.find(x=>x.id===id);assert.equal(r.stage,'verify');assert.equal(r.applicability,'verify');assert(r.blocksSubmission);}
assert(A.blockers(p).some(x=>/approval timing is not established/.test(x)));
const vested=project();vested.application.areaMap.layers.push({id:'ov-zoning',state:'checked',features:[{name:'AV-3',attributes:{ZONE_NAME:'AV-3'}}]});vested.application.ruleScope={work:'new-home',frontSetback:20,rearSetback:20};
const comparison=A.rules(vested).find(r=>r.id==='ov-dimensions-AV-3');assert(comparison);assert.equal(comparison.applicability,'verify');assert.equal(comparison.stage,'verify');assert(comparison.evidenceCheck,'Vested lot must not be declared noncompliant solely against city baseline');
assert.throws(()=>W.apply(p,{type:'rule_review',id:'cobabe-architectural-chain',state:'approved',reviewer:'Test',note:'Crawler finished'}),/evidence/);
p=W.apply(p,{type:'rule_review',id:'cobabe-architectural-chain',state:'not-applicable',reviewer:'Test reviewer',note:'Synthetic test only: applicable original reviewed',url:'https://example.org/record'});
assert(!A.blockers(p).some(x=>x.startsWith('Resolve Cobabe architectural')));p.planVersion++;assert(A.blockers(p).some(x=>x.startsWith('Resolve Cobabe architectural')));
const context={window:{AreaRules:A,OVCRules:require('../web/ovc-rules')}};vm.runInNewContext(fs.readFileSync('web/area-rules-ui.js','utf8'),context);
const html=context.window.AreaRulesUI.render(project());assert.match(html,/What the records establish/);assert.match(html,/3372687/);assert.match(html,/3372667/);assert.match(html,/101-020.tif/);assert(!/<details[^>]*>(?:(?!<\/details>)[\s\S])*(What the records establish|3372687)/.test(html),'The evidence summary is never folded away');assert.match(html,/Submission, issuance and construction are separate/);assert.match(html,/only if applicable/);
assert(!context.window.AreaRulesUI.render(project('224410005')).includes('What the records establish'));
const unavailable={window:{}};vm.runInNewContext(fs.readFileSync('web/approval-evidence.js','utf8'),unavailable);assert.equal(unavailable.window.ApprovalEvidence.forProject(project()),null);
// Public response contains reviewed originals only, never account or saved-project fields.
const handler=require('../api/public-research');let body='',headers={};handler({method:'GET',query:{format:'approval-evidence'}},{setHeader(k,v){headers[k]=v},end(v){body=v}}).then(()=>{assert.match(headers['Content-Type'],/javascript/);const sandbox={window:{}};vm.runInNewContext(body,sandbox);assert.equal(sandbox.window.ApprovalEvidenceData.cases.length,1);assert(!body.includes('wkatzka'));assert(!body.includes('access_token'));console.log('PASS: exact identity, conflicting originals, unknown timing, evidence-gated readiness, stale review, raw links and public-data boundary');});

const sewerRule=A.rules(project()).find(r=>r.id==='ov-sewer');
assert.match(sewerRule.trigger,/before Weber County permit issuance/);
assert.match(sewerRule.trigger,/does not establish Ogden Valley City/);
assert.equal(sewerRule.stage,'submission','Provider issuance wording must not erase the independently cited city intake requirement');
assert(require('../lib/approval-evidence-data').cases[0].chain.find(x=>x.id==='sewer-plan').sources.includes('sewerPolicy'));

// Every unresolved evidence-chain question needs an actionable, sourced destination.
for(const row of c.chain.filter(x=>x.missing)){
 assert(row.nextStep?.action && row.nextStep.organization && /^https:\/\//.test(row.nextStep.url),row.id+' must identify what to do and where');
}
const {JSDOM}=require('jsdom'),dom=new JSDOM('',{runScripts:'outside-only'});
dom.window.AreaRules=A;dom.window.OVCRules=require('../web/ovc-rules');
dom.window.eval(fs.readFileSync('web/area-rules-ui.js','utf8'));
const ui=dom.window.AreaRulesUI;
for(const id of ['cobabe-agreement-chain','cobabe-architectural-chain','cobabe-plat-conditions','ov-water','ov-sewer']){
 dom.window.document.body.innerHTML=ui.detail(p,id);
 const step=dom.window.document.querySelector('.evidence-next-step');assert(step?.textContent.includes('Next step'),id);
 assert(step.querySelector('a[href^="https://"]'),id+' needs an actual destination');
}
const timingHtml=ui.detail(p,'cobabe-architectural-chain');assert.match(timingHtml,/14305604-HOA1/);assert.match(timingHtml,/mailto:planning@ogdenvalley.gov/);
const geologyHtml=ui.detail(p,'cobabe-plat-conditions');assert.match(geologyHtml,/February 28, 2022/);assert.match(geologyHtml,/Weber County Planning/);
assert.match(ui.detail(p,'ov-sewer'),/tel:8017453435/);
assert(!ui.detail(project('224410005'),'ov-water').includes('14305604-HOA1'),'Do not send unrelated parcels to Cobabe');
console.log('PASS: every missing Cobabe instrument has an explicit source route; rendered actions preserve parcel isolation and authority limits');

assert.match(timingHtml,/John Lewis, registered president/);
assert.match(timingHtml,/tel:8017453737/);
assert.match(timingHtml,/mailto:accounting@wolfcreekresort.com/);
assert.match(c.chain.find(x=>x.id==='reviewer').nextStep.action,/does not designate the architectural reviewer/);

// Partial geologic evidence must preserve property scope and competing descriptions.
const hazard=c.chain.find(x=>x.id==='hazards');
assert(hazard.sources.includes('hazardStaff') && hazard.sources.includes('hazardExcerpt'));
assert.match(hazard.finding,/outside the study area/);
assert.match(hazard.finding,/Do not transfer townhome risk ratings to this lot/);
assert.match(hazard.missing,/study-area maps/);
assert.match(geologyHtml,/#page=106/);
assert(!ui.detail(project('224410005'),'ov-geologic').includes('reproduces §7.0'));
