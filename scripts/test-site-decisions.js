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
