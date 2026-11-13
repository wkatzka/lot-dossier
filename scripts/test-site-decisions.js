'use strict';
const assert=require('node:assert/strict'),D=require('../web/site-decisions'),W=require('../web/permit-workflow'),O=require('../web/project-overview');
let p=W.create({date:'2026-11-12',parcel:{county:'Example',id:'test',attrs:{}},facts:{},findings:[{section:'utilities',item:'Power',status:'verify',headline:'Service unverified',source:'Map',url:'https://example.org/map'}]});
const key=D.id(p.report.findings[0]);
const legacy={key:p.propertyKey+'|utilities|Power',status:'done',files:[{name:'unreviewed.pdf',id:'old'}]};
p=W.apply(p,{type:'migrate_site_reviews',records:[legacy]});assert.equal(D.status(p,p.report.findings[0]).closed,false);assert.equal(p.siteReviews.legacy[legacy.key].record.provenance,'legacy-unverified');
assert.equal(W.apply(p,{type:'migrate_site_reviews',records:[legacy]}),p,'Repeat migration must not create revisions/events');
assert.throws(()=>W.apply(p,{type:'migrate_site_reviews',records:[{...legacy,key:'Other|parcel|x'}]}),/another property/);
const decision={type:'site_review',id:key,state:'resolved',reviewer:'Synthetic reviewer',conclusion:'Provider letter addresses the proposed service',scope:'This parcel and proposed dwelling',basis:'Original identifies the parcel and proposed load',url:'https://example.org/letter',locator:'Page 1',confirmed:true};
assert.throws(()=>W.apply(p,{...decision,url:'',documentId:''}),/cited evidence/);
assert.throws(()=>W.apply(p,{...decision,locator:''}),/Cite a page/);
assert.throws(()=>W.apply(p,{...decision,confirmed:false}),/Confirm/);
assert.throws(()=>W.apply(p,{...decision,url:'javascript:alert(1)'}),/HTTPS/);
assert.throws(()=>W.apply(p,{...decision,state:'needs-evidence',missing:''}),/specific missing/);
const before=JSON.stringify(p);p=W.apply(p,decision);assert.equal(D.status(p,p.report.findings[0]).closed,true);assert.equal(O.summary(p).siteOpen,0);assert.notEqual(JSON.stringify(p),before);
let changed=structuredClone(p);changed.report.findings[0].headline='Conflicting capacity evidence';assert.equal(D.status(changed,changed.report.findings[0]).state,'stale');assert.equal(O.summary(changed).siteOpen,1);
p=W.apply(p,{...decision,state:'needs-evidence',missing:'Current transformer capacity letter',conclusion:'Capacity conflict remains'});assert.equal(p.siteReviews.history.filter(h=>h.decision).length,1);assert.equal(O.summary(p).siteOpen,1);
p=W.apply(p,{type:'document',document:{id:'a',family:'service',name:'service.pdf',hash:'a'.repeat(64)}});p=W.apply(p,{...decision,url:'',documentId:'a'});assert.equal(D.status(p,p.report.findings[0]).closed,true);
p=W.apply(p,{type:'document',document:{id:'b',family:'service',name:'service-v2.pdf',hash:'b'.repeat(64)}});assert.equal(D.status(p,p.report.findings[0]).state,'stale');assert.throws(()=>W.apply(p,{...decision,url:'',documentId:'a'}),/current document/);
assert.equal(D.status(JSON.parse(JSON.stringify(p)),p.report.findings[0]).state,'stale','Decision and stale state survive serialization');
assert.match(D.panel(p,key),/Prior decisions/);assert.match(D.panel(p,key),/Page \/ section/);
console.log('PASS: legacy migration/idempotence, property isolation, cited decisions, conflict reopening, overview propagation, immutable history, document-version invalidation and serialization.');

const refs=[{url:'https://example.org/letter',locator:'Page 1',role:'supports'},{url:'https://example.org/old-map',locator:'Legend',role:'contradicts'}];
assert.throws(()=>W.apply(p,{...decision,references:refs,conflicts:''}),/conflicting evidence/);
let reconciled=W.apply(p,{...decision,references:refs,conflicts:'Fixture letter specifically identifies the lot; map is regional.'});
assert.equal(reconciled.siteReviews.items[key].references.length,2);
assert.equal(D.status(reconciled,reconciled.report.findings[0]).closed,true);
assert.throws(()=>W.apply(p,{...decision,references:[{...refs[0],role:'excluded'}]}),/cited evidence/);
let scoped=structuredClone(reconciled);scoped.application.ruleScope={pool:true};assert.equal(D.status(scoped,scoped.report.findings[0]).state,'stale');
console.log('PASS: competing evidence requires reconciliation; excluded sources cannot support closure; scope changes reopen decisions.');

let old=W.create({parcel:{county:'Example',id:'legacy',attrs:{}},facts:{packet:{items:[{title:'Geotechnical report',status:'optional'}]}},findings:[]});old.packages=[{id:'unfiled',stale:false},{id:'filed',receiptId:'receipt',stale:false}];old.stage='ready_for_handoff';const migrated=W.apply(old,{type:'migrate_site_reviews',records:[]});assert.equal(migrated.requirements[1].required,true);assert.equal(migrated.requirements[1].state,'needs_review');assert.equal(migrated.packages[0].stale,true);assert.equal(migrated.packages[1].stale,false);assert.equal(migrated.stage,'preparing');assert.equal(W.apply(migrated,{type:'migrate_site_reviews',records:[]}),migrated);
console.log('PASS: one-time upgrade reopens legacy geotechnical applicability and unsubmitted reviews; filed history is retained.');

let pool=W.create({parcel:{county:'Example',id:'scope',attrs:{}},facts:{},findings:[{section:'pool',item:'Pool location',status:'verify'},{section:'water',item:'Water service',status:'verify'}]});assert.equal(O.summary(pool).siteOpen,1);pool=W.apply(pool,{type:'research_scope',pool:'included'});assert.equal(O.summary(pool).siteOpen,2);pool=W.apply(pool,{type:'research_scope',pool:'excluded'});assert.equal(O.summary(pool).siteOpen,1);assert.equal(pool.report.findings.length,2);
console.log('PASS: undecided/excluded pool research remains accessible without inflating open project work.');


// Published original evidence must invalidate dependent site reviews, not just rule reviews.
const evidenceData=require('../lib/approval-evidence-data'),hazard=evidenceData.cases[0].chain.find(x=>x.id==='hazards');
let cobabe=W.create({parcel:{county:'Weber',id:'224410004',attrs:{PARCEL_ID:'224410004'}},facts:{jurisdiction:'Ogden Valley City'},findings:[{section:'geo',item:'Landslides',status:'verify',headline:'Map screening'},{section:'utilities',item:'Power',status:'verify',headline:'Provider confirmation'},{section:'geo',item:'Flood zone',status:'verify',headline:'FEMA panel'}]});
for(const f of cobabe.report.findings)cobabe=W.apply(cobabe,{...decision,id:D.id(f)});
assert(cobabe.report.findings.every(f=>D.status(cobabe,f).closed));
const C=require('../web/city-application');
cobabe=W.apply(cobabe,{type:'city_application',permitType:'1'});
const valuation=()=>C.rows(cobabe,'1').find(r=>r.name==='builder_valuation');
cobabe=W.apply(cobabe,{type:'city_application',permitType:'1',fieldKey:valuation().key,value:'500000',basis:'Synthetic estimate dependent on site conditions'});
cobabe=W.apply(cobabe,{type:'filing_scope',permitType:'1'});
cobabe=W.apply(cobabe,{type:'answer_review',permitType:'1',fieldKey:valuation().key,state:'confirmed',reviewer:'Synthetic reviewer',reason:'Synthetic cost estimate based on reviewed site conditions',locator:'Fixture estimate page 1',siteQuestion:D.id(cobabe.report.findings[0]),expected:C.Reviews.fingerprint(cobabe,valuation()),confirmed:true});
assert.equal(valuation().review.state,'confirmed');
const stored=JSON.stringify(cobabe.siteReviews),originalFinding=hazard.finding;
try{
 hazard.finding+=' Synthetic newly identified scope conflict.';
 assert.equal(D.status(cobabe,cobabe.report.findings[0]).state,'stale');
 assert.equal(D.status(cobabe,cobabe.report.findings[1]).closed,true,'Unrelated topic review stays current');
 assert.equal(D.status(cobabe,cobabe.report.findings[2]).closed,true,'FEMA finding is not invalidated by geologic-report context');
 assert.equal(valuation().review.state,'stale','Dependent permit answer must reopen');
 assert(W.blockers(cobabe,'initial').some(x=>/Valuation.*stale answer/i.test(x)),'Handoff must see the stale linked answer');
 assert.match(D.panel(cobabe,D.id(cobabe.report.findings[0])),/Synthetic newly identified scope conflict/);
 assert.match(D.panel(cobabe,D.id(cobabe.report.findings[0])),/#page=106/);
 assert.equal(JSON.stringify(cobabe.siteReviews),stored,'Prior review and citations remain unchanged');
}finally{hazard.finding=originalFinding;}
const legacyCobabe=structuredClone(cobabe),gf=legacyCobabe.report.findings[0];
legacyCobabe.siteReviews.items[D.id(gf)].fingerprint=JSON.stringify({finding:gf,scope:{},plan:null});
assert.equal(D.status(legacyCobabe,gf).state,'stale','Old review without current-source binding needs renewed consideration');
console.log('PASS: changed published originals reopen affected site reviews and show new evidence; unrelated topics and review history remain intact.');
