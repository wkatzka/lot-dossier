const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const E=require('../web/approval-evidence'),A=require('../web/area-rules'),W=require('../web/permit-workflow');
function project(id='224410004'){return {schemaVersion:1,propertyKey:'Weber|'+id,property:{county:'Weber',parcelId:id},report:{parcel:{attrs:{PARCEL_ID:id,SUBDIV_NAME:'COBABE RANCH PHASE 1'}},facts:{},findings:[]},application:{areaMap:{version:A.version,parcelKey:'Weber|'+id,at:'2026-11-12',layers:[{id:'municipal',state:'checked',features:[{name:'OGDEN VALLEY'}]}]}},siteVersion:1,planVersion:1,documents:[],requirements:[],events:[],packages:[],corrections:[],receipts:[]};}
let p=project();assert(E.forProject(p));assert(E.forProject(project('22-441-0004')));assert.equal(E.forProject(project('224410005')),null);
const mismatch=project();mismatch.report.parcel.attrs.PARCEL_ID='224410005';assert.equal(E.forProject(mismatch),null);
const wrongCounty=project();wrongCounty.property.county='Cache';assert.equal(E.forProject(wrongCounty),null);
const c=E.forProject(p);for(const x of c.chain)for(const id of x.sources)assert(E.sources[id]?.url.startsWith('https://'));
assert.match(c.chain.find(x=>x.id==='agreement').finding,/3372687.*3372667/);assert.match(c.chain.find(x=>x.id==='timing').finding,/No retrieved applicable original/);
assert(c.chain.some(x=>x.id==='predecessor'));assert(c.chain.some(x=>x.id==='water'));assert.match(E.sources.predecessor.url,/202871-WOLF/);
const rules=A.rules(p);assert(!rules.some(x=>x.id==='covenants'));for(const id of ['cobabe-agreement-chain','cobabe-architectural-chain']){const r=rules.find(x=>x.id===id);assert.equal(r.stage,'verify');assert.equal(r.applicability,'verify');assert(r.blocksSubmission);}
assert(A.blockers(p).some(x=>/approval timing is not established/.test(x)));
const vested=project();vested.application.areaMap.layers.push({id:'ov-zoning',state:'checked',features:[{name:'AV-3',attributes:{ZONE_NAME:'AV-3'}}]});vested.application.ruleScope={work:'new-home',frontSetback:20,rearSetback:20};
const comparison=A.rules(vested).find(r=>r.id==='ov-dimensions-AV-3');assert(comparison);assert.equal(comparison.applicability,'verify');assert.equal(comparison.stage,'verify');assert(comparison.evidenceCheck,'Vested lot must not be declared noncompliant solely against city baseline');
assert.throws(()=>W.apply(p,{type:'rule_review',id:'cobabe-architectural-chain',state:'approved',reviewer:'Test',note:'Crawler finished'}),/evidence/);
p=W.apply(p,{type:'rule_review',id:'cobabe-architectural-chain',state:'not-applicable',reviewer:'Test reviewer',note:'Synthetic test only: applicable original reviewed',url:'https://example.org/record'});
assert(!A.blockers(p).some(x=>x.startsWith('Resolve Cobabe architectural')));p.planVersion++;assert(A.blockers(p).some(x=>x.startsWith('Resolve Cobabe architectural')));
const context={window:{AreaRules:A,OVCRules:require('../web/ovc-rules')}};vm.runInNewContext(fs.readFileSync('web/area-rules-ui.js','utf8'),context);
const html=context.window.AreaRulesUI.render(project());assert.match(html,/What the records establish/);assert.match(html,/3372687/);assert.match(html,/3372667/);assert.match(html,/101-020.tif/);assert(!html.includes('<details'));assert.match(html,/Submission, issuance and construction are separate/);assert.match(html,/only if applicable/);
assert(!context.window.AreaRulesUI.render(project('224410005')).includes('What the records establish'));
const unavailable={window:{}};vm.runInNewContext(fs.readFileSync('web/approval-evidence.js','utf8'),unavailable);assert.equal(unavailable.window.ApprovalEvidence.forProject(project()),null);
// Public response contains reviewed originals only, never account or saved-project fields.
const handler=require('../api/public-research');let body='',headers={};handler({method:'GET',query:{format:'approval-evidence'}},{setHeader(k,v){headers[k]=v},end(v){body=v}}).then(()=>{assert.match(headers['Content-Type'],/javascript/);const sandbox={window:{}};vm.runInNewContext(body,sandbox);assert.equal(sandbox.window.ApprovalEvidenceData.cases.length,1);assert(!body.includes('wkatzka'));assert(!body.includes('access_token'));console.log('PASS: exact identity, conflicting originals, unknown timing, evidence-gated readiness, stale review, raw links and public-data boundary');});
