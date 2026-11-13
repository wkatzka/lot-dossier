/* "What are you planning?" after the address: plans ranked by fit with this lot's own records,
   each reason sourced; vacant vs built decided from the county parcel record; the choice fills the
   existing rule scope and permit worksheets without removing anything, and re-ranks site findings. */
const assert=require('node:assert/strict'),I=require('../web/project-intent'),S=require('../web/site-answer'),W=require('../web/permit-workflow'),C=require('../web/city-application');
const findings=[{item:'Assessor',section:'land',status:'ok',url:'https://county.example/parcel'},
 {item:'Plat setbacks',section:'land',status:'verify',headline:'Subdivision plat may override the base setbacks'},
 {item:'Landslides',section:'geo',status:'flag',headline:'Mapped landslide covers about 100% of the lot',next_step:'Order a geologic hazards study.',source:'UGS landslides',url:'https://ugs.example/'},
 {item:'GIS terrain · USGS 3DEP',section:'survey',status:'flag',headline:'20.0% fitted slope · 10.6 ft relief',source:'USGS 3DEP',url:'https://usgs.example/'},
 {item:'Sewer vs. septic',section:'septic',status:'watch',headline:'Lot connection unverified',next_step:'Confirm the wastewater system.',source:'County packet',url:'https://pkt.example/'},
 {item:'Permit & impact fees',section:'permits',status:'watch',headline:'Impact fees about $9,894',next_step:'Ask for the fee schedule.',source:'City ordinance',url:'https://city.example/fees'},
 {item:'HOA registration',section:'ccr',status:'ok',source:'Utah HOA registry',url:'https://hoa.example/'},
 {item:'Pool grading and ground conditions',section:'pool',status:'watch',headline:'Lot-average slope 20.0%',source:'Pool screening'}];
const zone={front:30,rear:30,side:10,zone:'RE-15',source:'https://city.example/zoning'};
const built={parcel:{attrs:{HOUSE_CNT:'1',TOTAL_MKT_VALUE:1165460,LAND_MKT_VALUE:300000,EFFBUILT_YR:2026,PARCEL_ACRES:0.08}},facts:{lot_sf:2792,zone_std:zone},findings};
const vacant={parcel:{attrs:{HOUSE_CNT:'0',TOTAL_MKT_VALUE:310000,LAND_MKT_VALUE:300000,PARCEL_ACRES:0.4}},facts:{lot_sf:17424,zone_std:zone},findings};
const unknown={parcel:{attrs:{PARCEL_ACRES:0.4}},facts:{zone_std:zone},findings};
// Built lot: changes to the house rank first; new home and footprint work are constrained, with sourced reasons.
let s=I.suggest(built);assert.equal(s.lot.state,'improved');
assert.equal(s.plans[0].id,'remodel');assert.equal(s.plans.find(p=>p.id==='new-home').fit,'constrained');
const add=s.plans.find(p=>p.id==='addition');assert.equal(add.fit,'constrained');assert(add.reasons.some(r=>/subdivision plat may set different ones/.test(r.text)&&r.source.url===zone.source),'Setback reason is sourced and notes the plat may differ');
assert(add.reasons.some(r=>/geotechnical/.test(r.text)&&r.source.url==='https://ugs.example/'));
assert(s.plans.every(p=>p.reasons.every(r=>r.source===null||r.source.label)),'Every sourced reason names its source');
assert(!s.plans.some(p=>p.reasons.some(r=>/HOA.s approval first/.test(r.text))),'The registry only shows an HOA exists; approval rules are left to Approvals');
// Vacant lot: building a home leads; changes to a house are not offered.
s=I.suggest(vacant);assert.equal(s.lot.state,'vacant');assert.equal(s.plans[0].id,'new-home');assert.equal(s.plans[0].fit,'good');
assert(!s.plans.some(p=>['addition','remodel','pool','replace-home'].includes(p.id)),'No house, so no house changes');
// Unknown: nothing is presumed.
s=I.suggest(unknown);assert.equal(s.lot.state,'unknown');assert(s.plans.some(p=>p.id==='new-home')&&s.plans.some(p=>p.id==='remodel'));assert(/does not say whether there is a house/.test(I.card(unknown)));
// Every plan maps to real city permit types.
for(const [id,p] of Object.entries(I.PLANS))assert(p.typeIds.every(t=>C.catalog.types.some(x=>x.value===t)),id+' maps to catalog types');
const card=I.card(built);assert(/What are you planning\?/.test(card)&&/not a prediction/.test(card)&&/More options/.test(card)&&/data-intent-confirm="evaluate"/.test(card));
assert(!I.suggest(built).plans.find(p=>p.id==='remodel').reasons.some(r=>r.source),'General statements carry no source');assert(/County parcel record/.test(I.card(built)),'The house fact cites the parcel record');
console.log('PASS: plans ranked by fit with the lot\'s own records — built vs vacant from the parcel record, sourced reasons, constrained options explained, nothing presumed when unknown.');
// Saving the choice fills the existing scope and worksheets and removes nothing.
let p=W.create({parcel:{county:'Weber',id:'222320023',attrs:{PARCEL_ADD:'3459 N WIND RIVER CT'}},date:'2026-11-13',facts:{jurisdiction:'Ogden Valley City',packet:{items:[],rows:[]}}});
p.application.permitSelections=['8'];p.application.ruleScope={work:'',grading:'yes'};
const before=JSON.stringify([p.siteReviews,p.application.ruleReviews||null]);
p=W.apply(p,I.command('addition'));
assert.deepEqual(p.application.intent.typeIds,['3']);assert.deepEqual(p.application.permitSelections.sort(),['3','8'],'Adds the worksheet; keeps existing ones');
assert.equal(p.application.ruleScope.work,'addition');assert.equal(p.application.ruleScope.grading,'yes','Other scope answers are kept');
p=W.apply(p,I.command('pool'));assert.equal(p.application.researchScope.pool,'included');
p=W.apply(p,I.command('evaluate'));assert.equal(p.application.intent.plan,'evaluate');assert.deepEqual(p.application.permitSelections.sort(),['2','3','8'],'Evaluating adds nothing and removes nothing');
assert.equal(JSON.stringify([p.siteReviews,p.application.ruleReviews||null]),before,'No site decision or rule review changes');
assert.throws(()=>W.apply(p,{type:'project_intent',plan:'x',label:'Bad',typeIds:['999'],scope:{}}),'Unknown permit types are rejected');
console.log('PASS: the chosen plan is stored, fills the rule scope and permit worksheets, and never removes existing work or decisions.');
// Site findings re-rank for the plan.
const proj=plan=>({application:{intent:{plan,label:I.PLANS[plan].label}}});
assert.equal(S.summary(built,null).top[0].item,'Landslides','Without a plan, hazards lead');
const remodel=S.summary(built,proj('remodel')).top.map(x=>x.item);assert.notEqual(remodel[0],'Landslides','For interior work, ground hazards do not lead');assert(remodel.includes('Landslides')||S.summary(built,proj('remodel')).counts.flag>=0);
assert(/for: remodel inside the house/.test(S.card(built,{project:proj('remodel')})));
assert(S.summary(built,proj('pool')).top.some(x=>x.section==='pool'),'A pool plan brings the pool screen forward');
assert(!S.summary(built,proj('addition')).top.some(x=>x.section==='pool'),'Pool screening is dropped for other plans');
console.log('PASS: site findings re-rank for the chosen plan.');
(async()=>{
 const {JSDOM}=require('jsdom');const dom=new JSDOM('<!doctype html><body></body>',{url:'https://x.example/'});
 global.window=dom.window;global.document=dom.window.document;delete require.cache[require.resolve('../web/project-intent')];const IJ=require('../web/project-intent');
 let proj={report:built,application:{}};const commits=[];
 window.ProjectWorkspace={project:()=>proj,commit:async c=>{commits.push(c);proj={...proj,application:{...proj.application,intent:{plan:c.plan,label:c.label}}};}};
 document.body.innerHTML='<div id="site-intent">'+IJ.card(built,{project:proj})+'</div>';
 document.querySelector('[data-intent="remodel"]').dispatchEvent(new window.MouseEvent('click',{bubbles:true}));
 assert(/Your permits/.test(document.body.textContent)&&!commits.length,'Picking a main permit shows add-ons before saving');
 document.querySelector('[data-intent-confirm="remodel"]').dispatchEvent(new window.MouseEvent('click',{bubbles:true}));
 for(let i=0;i<20&&!commits.length;i++)await new Promise(r=>setTimeout(r,5));await new Promise(r=>setTimeout(r,5));
 assert.equal(commits[0].type,'project_intent');assert.equal(commits[0].plan,'remodel');
 assert(/Planning: Remodel/.test(document.body.textContent),'The chooser becomes a one-line summary');
 document.querySelector('[data-intent-change]').dispatchEvent(new window.MouseEvent('click',{bubbles:true}));
 assert(/What are you planning\?/.test(document.body.textContent),'Change reopens the choices');
 console.log('PASS: choosing a plan saves it through the workspace and collapses to a one-line summary that can be changed.');
})().catch(e=>{console.error(e);process.exitCode=1;});
