/* My projects cards: status, three-stage progress, permits and next step come only from saved project data.
   A saved report is not a finished site review, no percentage is shown, a permit is "Submitted" only after a
   recorded receipt and "Issued" only after a recorded issuance, and nothing is shown for permits nobody chose.
   Search, filter and sort appear only once there are several projects. Real modules, no network. */
const assert=require('node:assert/strict'),{JSDOM}=require('jsdom');
const W=require('../web/permit-workflow'),C=require('../web/city-application'),PC=require('../web/project-card');
const report=(id,addr,findings)=>({date:'2026-11-10T12:00:00Z',parcel:{county:'Weber',id,attrs:{PARCEL_ADD:addr,PARCEL_ACRES:1},rings:[]},findings,facts:{jurisdiction:'Ogden Valley City',stepsRun:{check_parcel:'x'},owner:'Jane Owner'}});
const ok=[{section:'land',item:'Flood zone',status:'ok',headline:'Zone X.',detail:'x'}];
const flag=[{section:'land',item:'Landslide susceptibility',status:'flag',headline:'Mapped landslide area.',detail:'x'}];
const verify=[{section:'water',item:'Groundwater depth',status:'verify',headline:'Shallow groundwater possible.',detail:'x'}];
const make=(f,id='224410004',addr='5241 E COBABE RANCH RD')=>W.create(report(id,addr,f),'2026-11-10T00:00:00Z');
const plan=(p,ids=['1'])=>{p.application.intent={plan:'new-home',label:'New single-family home',typeIds:ids};return W.apply(p,{type:'city_application',permitType:ids[0]});};
const stage=(s,k)=>s.stages.find(x=>x.key===k);

// 1. Addresses read in title case; directions stay capitals; the state is only named for counties Cornerpin covers.
assert.equal(PC.titleCase('5241 E COBABE RANCH RD'),'5241 E Cobabe Ranch Rd');
assert.equal(PC.titleCase('1420 S 7500 E'),'1420 S 7500 E');
assert.equal(PC.titleCase('210 N 1ST ST'),'210 N 1st St');
let s=PC.summary(make(ok));assert.equal(s.address,'5241 E Cobabe Ranch Rd');assert.equal(s.place,'Ogden Valley City · Weber County, Utah');
const other=make(ok);other.property.county='Example';assert.equal(PC.summary(other).place,'Ogden Valley City · Example County');
console.log('PASS: addresses in title case; jurisdiction, county and (where known) state under the address.');

// 2. Site review comes from open findings, not from having a saved report.
s=PC.summary(make(flag));assert.equal(stage(s,'site').state,'attention');assert.match(stage(s,'site').text,/1 concern open/);
s=PC.summary(make(verify));assert.equal(stage(s,'site').state,'active');assert.match(stage(s,'site').text,/1 to review/);
s=PC.summary(make(ok));assert.equal(stage(s,'site').state,'done');assert.equal(stage(s,'site').text,'Nothing open');
const blank=make([]);blank.report.facts.stepsRun={};assert.equal(stage(PC.summary(blank),'site').state,'todo');
console.log('PASS: site review is "concern open", "to review" or "nothing open" from the findings; a report alone is not "complete".');

// 3. No permits chosen: an empty state, not invented permits; status is Site review.
s=PC.summary(make(flag));assert.deepEqual(s.permits,[]);assert.equal(stage(s,'prep').text,'No permits chosen');assert.equal(s.status.label,'Site review');
let html=PC.card(make(flag));assert.match(html,/No permits tracked yet\./);
console.log('PASS: with no permits chosen the card says "No permits tracked yet." and invents none.');

// 4. A chosen permit is "Not started" until something on its checklist is done; never a percentage.
let p=plan(make(ok));s=PC.summary(p);assert.equal(s.permits.length,1);assert.equal(s.permits[0].label,'Single Family Dwelling');
assert.equal(s.status.label,'Permit preparation');assert.equal(stage(s,'submit').text,'Not submitted');assert.notEqual(s.permits[0].text,'Submitted');
html=PC.card(p);assert(!/\d+\s*%/.test(html),'no percentages anywhere on the card');assert(!/Approved|Issued|Under review/.test(html),'no approval language without a record');
p=W.apply(p,{type:'team_profile',role:'builder',name:'Ridge Line Builders',phone:'801-555-0142',email:'office@ridgeline.example',confirmed:true});
s=PC.summary(p);assert.equal(stage(s,'prep').state,'active');assert.equal(stage(s,'prep').text,'In progress');
console.log('PASS: a chosen permit shows its checklist state ("Not started", "Preparing · n of m"); no percentages or approval words.');

// 5. Submitted only with a recorded receipt; corrections only from a recorded review round; Issued only from issuance.
p=W.apply(p,{type:'receipt',reference:'BP-2026-0114',url:'https://example.org/receipt',receivedAt:'2026-11-10'});
s=PC.summary(p);assert.equal(s.status.label,'Submitted');assert.equal(s.permits[0].text,'Submitted');assert.equal(stage(s,'submit').text,'Submitted');assert.equal(stage(s,'prep').state,'done');
p=W.apply(p,{type:'review_round',sourceDate:'2026-11-12',url:'https://example.org/letter',confirmed:true,items:['Add a soils report.'],originalText:'Add a soils report.'});
s=PC.summary(p);assert.equal(s.status.label,'Corrections required');assert.equal(s.permits[0].text,'Corrections');assert.equal(s.permits[0].attention,true);assert.match(stage(s,'submit').text,/1 correction to answer/);
p={...p,issuance:{at:'2026-11-20'}};s=PC.summary(p);assert.equal(s.status.label,'Permit issued');assert.equal(s.permits[0].text,'Issued');assert.equal(s.next,null,'no next step once issued');
console.log('PASS: "Submitted", "Corrections required" and "Permit issued" each need the matching recorded receipt, review round or issuance.');

// 6. Up to three permits on the card, then "+N more"; each opens the project at Permit Preparation.
const ids=C.catalog.types.map(t=>t.value).filter(v=>/^\d+$/.test(v)).slice(0,5);
p=make(ok);p.application.intent={plan:'custom',label:'Several permits',typeIds:ids};html=PC.card(p);
const dom=new JSDOM('<div>'+html+'</div>'),d=dom.window.document;
assert.equal(d.querySelectorAll('.cp-proj-permits li').length,3);assert.equal(d.querySelector('.cp-proj-more').textContent,'+'+(ids.length-3)+' more');
assert(d.querySelector('.cp-proj-permit[data-action=open-at][data-tab=filing]'));
assert.equal(d.querySelectorAll('[data-action=open]').length,1,'one Open project action per card');
assert.equal(d.querySelector('.cp-proj-type'),null);assert.match(d.querySelector('.cp-proj-kind').textContent,/Several permits/);
assert(!/Saved to your account/.test(html));
console.log('PASS: at most three permits per card with "+N more"; one Open project; deep links open the right view.');

// 7. Search, status filter and sort only from four projects; they filter and order the grid.
const list=['5241 E COBABE RANCH RD','3870 N WOLF CREEK DR','1420 S 7500 E'].map((a,i)=>{const x=make(ok,'22000000'+i,a);x.updatedAt='2026-11-1'+i+'T00:00:00Z';return x;});
assert.equal(PC.toolbar(list.map(PC.summary)),'','no tools for three projects');
const four=[...list,(()=>{const x=plan(make(flag,'220000009','100 N MAIN ST'));x.updatedAt='2026-11-01T00:00:00Z';return x;})()];
const page=new JSDOM('<main>'+PC.toolbar(four.map(PC.summary))+'<div class="pw-project-grid">'+four.map(x=>PC.card(x)).join('')+'</div><p class="cp-proj-none" hidden></p></main>').window.document;
const main=page.querySelector('main'),names=()=>[...page.querySelectorAll('.cp-proj:not([hidden]) h2')].map(h=>h.textContent);
assert.equal(PC.filter(main),4);assert.deepEqual(names(),['1420 S 7500 E','3870 N Wolf Creek Dr','5241 E Cobabe Ranch Rd','100 N Main St'],'recently updated first');
page.querySelector('[name=proj-sort]').value='name';PC.filter(main);assert.equal(names()[0],'100 N Main St');
page.querySelector('[name=proj-q]').value='wolf';assert.equal(PC.filter(main),1);assert.equal(page.querySelector('.cp-proj-count').textContent,'1 of 4 projects');
page.querySelector('[name=proj-q]').value='';page.querySelector('[name=proj-status]').value='preparing';assert.equal(PC.filter(main),1);assert.deepEqual(names(),['100 N Main St']);
page.querySelector('[name=proj-status]').value='';page.querySelector('[name=proj-q]').value='nowhere';assert.equal(PC.filter(main),0);assert.equal(page.querySelector('.cp-proj-none').hidden,false);
console.log('PASS: search, status filter and sort appear from four projects and filter and order the cards.');
