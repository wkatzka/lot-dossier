'use strict';
const assert=require('node:assert/strict'),W=require('../web/permit-workflow'),C=require('../web/city-application');
let p=W.create({parcel:{county:'Example',id:'synthetic',attrs:{}},facts:{jurisdiction:'Ogden Valley City'},findings:[]});
p=W.apply(p,{type:'city_application',permitType:'1'});
const row=()=>C.rows(p,'1').find(r=>r.name==='builder_valuation');
function review(state='confirmed',extra={}){return {type:'answer_review',permitType:'1',fieldKey:row().key,state,reviewer:'Fixture reviewer',reason:'Checked proposed work against scope estimate',locator:'Estimate page 1',expected:C.Reviews.fingerprint(p,row()),confirmed:true,...extra};}
assert.throws(()=>W.apply(p,review()),/blank/);
p=W.apply(p,{type:'city_application',permitType:'1',fieldKey:row().key,value:'500000',basis:'Fixture construction estimate'});
assert.equal(row().review.state,'unreviewed');assert.throws(()=>W.apply(p,review('confirmed',{confirmed:false})),/Confirm/);
p=W.apply(p,review());assert.equal(row().review.state,'confirmed');assert.equal(row().status,'Confirmed');
assert.equal(C.rows(p,'2').find(r=>r.name==='builder_valuation').review.state,'unreviewed');
let oldReview=review();p=W.apply(p,{type:'city_application',permitType:'1',fieldKey:row().key,value:'600000',basis:'Revised estimate'});assert.equal(row().review.state,'stale');assert.throws(()=>W.apply(p,oldReview),/changed/);
p=W.apply(p,review('rejected'));assert.equal(row().review.state,'rejected');assert.equal(row().review.history.length,1);assert.match(C.sheet(p),/Rejected/);
p=W.apply(p,review());p=W.apply(p,{type:'document',document:{id:'plan',family:'plan',name:'new.pdf',role:'plan',hash:'a'.repeat(64)}});assert.equal(row().review.state,'stale');
assert.equal(C.rows(JSON.parse(JSON.stringify(p)),'1').find(r=>r.name==='builder_valuation').review.state,'stale');
console.log('PASS: blank/unconfirmed answers rejected, permit isolation, value and plan invalidation, review history, stale-form protection and export status.');

assert(C.readiness(p,'1').unreviewed.some(r=>r.name==='builder_valuation'));
assert(W.blockers(p,'initial').includes('Designate the permit worksheet for this filing.'));
p=W.apply(p,{type:'filing_scope',permitType:'1'});assert(W.blockers(p,'initial').some(x=>/Builder.*Valuation.*stale answer/i.test(x)));
p=W.apply(p,{type:'city_application',permitType:'1',fieldKey:row().key,value:'',basis:''});assert(W.blockers(p,'initial').some(x=>/Valuation.*missing/i.test(x)));
p=W.apply(p,{type:'city_application',permitType:'2'});assert.equal(p.application.filingPermitType,'1','Opening a worksheet must not change filing identity');
const filed=structuredClone(p);filed.application.reference='TEST';assert.throws(()=>W.apply(filed,{type:'filing_scope',permitType:'2'}),/existing filing/);
console.log('PASS: required valuation and unconfirmed values gate handoff; worksheet navigation does not switch filing identity.');

let linked=W.create({parcel:{county:'Example',id:'linked',attrs:{PARCEL_ADD:'Synthetic address'}},facts:{jurisdiction:'Ogden Valley City'},findings:[{section:'land',item:'Address',status:'verify'}]});linked=W.apply(linked,{type:'site_review',id:'land/Address',state:'resolved',reviewer:'Test',conclusion:'Address matched',scope:'Synthetic',basis:'Official record',url:'https://example.org/record',locator:'Record 1',confirmed:true});
const linkedRow=()=>C.rows(linked,'1').find(r=>r.name==='property_address');linked=W.apply(linked,{type:'answer_review',permitType:'1',fieldKey:linkedRow().key,state:'confirmed',reviewer:'Test',reason:'Same parcel',locator:'Site question',siteQuestion:'land/Address',expected:C.Reviews.fingerprint(linked,linkedRow()),confirmed:true});assert.equal(linkedRow().review.state,'confirmed');linked=W.apply(linked,{type:'site_review',id:'land/Address',state:'needs-evidence',reviewer:'Test',conclusion:'Conflict reopened',scope:'Synthetic',basis:'New conflicting record',missing:'Address assignment',confirmed:true});assert.equal(linkedRow().review.state,'stale');
console.log('PASS: changing a linked site decision invalidates the dependent application answer.');
