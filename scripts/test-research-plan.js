/* Staged research: a quick first read, then only the research the chosen permits need; later
   changes run only what's missing; plan-approval research only for permits that change the outside;
   passes merge without losing or duplicating findings; saved full reports are not re-run. */
const assert=require('node:assert/strict');
global.window=globalThis;global.localStorage={getItem(){return null},setItem(){},removeItem(){}};
require('../web/lotreport.js');const LR=window.LotReport,RP=require('../web/research-plan'),I=require('../web/project-intent');
assert.deepEqual(LR.STEPS.map(s=>s[0]),RP.ORDER,'Research plan step order matches the report');
const inQuick=new Set(RP.QUICK);for(const id of RP.QUICK)for(const d of RP.DEPS[id]||[])assert(inQuick.has(d),'Quick read is self-contained: '+id+' needs '+d);
for(const [id,p] of Object.entries(I.PLANS))for(const t of p.typeIds)assert(RP.STEPS_FOR[t],'Permit '+t+' ('+id+') has a research list');
const closed=(list,done=[])=>{const have=new Set([...list,...done]);for(const id of list)for(const d of RP.DEPS[id]||[])assert(have.has(d),id+' runs without its input '+d);};
for(const t of Object.keys(RP.STEPS_FOR)){const s=RP.stepsFor([t],RP.QUICK);closed(s,RP.QUICK);assert.deepEqual(s,RP.ORDER.filter(id=>s.includes(id)),'Steps keep report order');}
const remodel=RP.stepsFor(['4'],RP.QUICK),home=RP.stepsFor(['1'],RP.QUICK),pool=RP.stepsFor(['2'],RP.QUICK);
assert(remodel.length<=4&&!remodel.includes('check_documents')&&!remodel.includes('check_public_research'),'Interior work skips the slow document and title research');
assert(pool.includes('check_documents')&&pool.includes('check_soils_septic')&&!pool.includes('check_minerals'),'A pool researches easements and soils, not minerals');
assert(home.includes('check_public_research')&&home.includes('check_permit_packet'),'A new home researches everything');
assert.deepEqual(RP.stepsFor(['3'],[...RP.QUICK,...home]),[],'Switching from a new home to an addition runs nothing new');
const delta=RP.stepsFor(['2'],[...RP.QUICK,...remodel]);assert(delta.length&&delta.every(id=>!remodel.includes(id)),'Remodel → pool runs only the missing steps');
assert(!RP.needsApprovalResearch(['4','70'])&&RP.needsApprovalResearch(['3'])&&RP.needsApprovalResearch(['*']),'Approval research only for permits that change the outside');
assert.deepEqual(RP.stepsRun({findings:[{item:'x'}],facts:{}}),RP.ORDER,'Saved reports without a step record count as fully researched');
assert.deepEqual(RP.notRun({findings:[{item:'x'}],facts:{}}),[]);
console.log('PASS: research plan — self-contained quick read, per-permit research lists closed over their inputs, deltas only, approval research gated on exterior permits, legacy reports treated as complete.');

// Staged runs merge: earlier findings kept, summaries recomputed, step record accumulates, no investigation unless asked.
(async()=>{
 const posts=[];global.fetch=async(url,o)=>{if(o&&o.method==='POST')posts.push(String(url));return {ok:true,json:async()=>({features:[]}),text:async()=>'{}'};};
 const ring=[[-111.8108,41.3216],[-111.8106,41.3216],[-111.8106,41.3218],[-111.8108,41.3218],[-111.8108,41.3216]];
 const parcel={id:'222320023',county:'Weber',rings:[ring],cy:41.3217,cx:-111.8107,attrs:{PARCEL_ADD:'Test',PARCEL_ACRES:0.08}};
 const a=await LR.run(parcel,null,{},null,null,{steps:['check_parcel']});
 assert.deepEqual(Object.keys(a.facts.stepsRun),['check_parcel']);assert(a.findings.every(f=>f.step));
 assert(!posts.some(u=>/action=investigate/.test(u)),'The first read does not start paid approval research');
 const b=await LR.run(parcel,null,{},null,null,{steps:['check_jurisdiction'],prior:a});
 assert(b.findings.some(f=>f.step==='check_parcel')&&b.findings.some(f=>f.step==='check_jurisdiction'),'Earlier findings are kept and new ones added');
 assert.equal(b.findings.filter(f=>f.step==='_post').length,a.findings.filter(f=>f.step==='_post').length,'Summary findings are recomputed, not duplicated');
 assert.deepEqual(Object.keys(b.facts.stepsRun).sort(),['check_jurisdiction','check_parcel']);
 await LR.run(parcel,null,{},null,null,{steps:['check_parcel'],investigate:true});assert(posts.some(u=>/action=investigate/.test(u)),'Approval research is queued when asked');
 console.log('PASS: staged runs merge without loss or duplication and queue approval research only when asked.');

 // Bundles: a main permit plus add-ons; confirming asks the report to research those permits.
 const c=I.command('new-home',['pool','garage','nope']);assert.deepEqual(c.typeIds,['1','2','96']);assert.equal(c.label,'New home + pool + garage');assert.equal(c.pool,'included');
 assert.deepEqual(I.command('remodel',['adu']).scope,{work:'other',adu:'yes'});
 const {JSDOM}=require('jsdom');const dom=new JSDOM('<!doctype html><body></body>',{url:'https://x.example/'});
 global.window=dom.window;global.document=dom.window.document;global.CustomEvent=dom.window.CustomEvent;delete require.cache[require.resolve('../web/project-intent')];const IJ=require('../web/project-intent');
 const report={parcel:{attrs:{HOUSE_CNT:'0',TOTAL_MKT_VALUE:310000,LAND_MKT_VALUE:300000,PARCEL_ACRES:0.4}},facts:{lot_sf:17424},findings:[]};
 let proj={report,application:{}};const commits=[],events=[];
 window.ProjectWorkspace={project:()=>proj,commit:async cmd=>{commits.push(cmd);proj={...proj,application:{intent:{label:cmd.label,typeIds:cmd.typeIds}}};}};
 window.addEventListener('cornerpin:research-permits',e=>events.push(e.detail));
 document.body.innerHTML='<div id="overview-intent">'+IJ.card(report,{project:proj})+'</div>';
 document.querySelector('[data-intent="new-home"]').dispatchEvent(new window.MouseEvent('click',{bubbles:true}));
 assert(/Your permits/.test(document.body.textContent)&&document.querySelectorAll('input[data-addon]').length===5,'Choosing a main permit offers its add-on permits');
 document.querySelector('input[data-addon="pool"]').checked=true;
 document.querySelector('[data-intent-confirm="new-home"]').dispatchEvent(new window.MouseEvent('click',{bubbles:true}));
 for(let i=0;i<20&&!events.length;i++)await new Promise(r=>setTimeout(r,5));
 assert.deepEqual(commits[0].typeIds,['1','2']);assert.deepEqual(events[0],{typeIds:['1','2'],label:'New home + pool'},'Confirming asks for research on exactly those permits');
 assert(/Planning: New home \+ pool/.test(document.body.textContent));
 document.querySelector('[data-intent-change]').dispatchEvent(new window.MouseEvent('click',{bubbles:true}));
 document.querySelector('[data-intent-confirm="evaluate"]').dispatchEvent(new window.MouseEvent('click',{bubbles:true}));
 for(let i=0;i<20&&events.length<2;i++)await new Promise(r=>setTimeout(r,5));assert.deepEqual(events[1].typeIds,['*'],'Just evaluating researches everything');
 console.log('PASS: permit bundles — main permit, add-on permits, confirmation triggers research for exactly those permits; evaluating researches everything.');

 // Cards: approval research not started yet, and coverage with "Research everything".
 const V=require('../web/title-research-view');const notStarted=V.answerCard({status:'investigation_not_started',investigation:{questions:[]}});
 assert(/Approval research hasn't started/.test(notStarted)&&!/in progress/i.test(notStarted));
 window.ResearchPlan=RP;window.LotReport=LR;delete require.cache[require.resolve('../web/site-answer')];const SA=require('../web/site-answer');
 const partial={findings:[{item:'Landslides',section:'geo',status:'flag',headline:'h',next_step:'n',source:'s',url:'https://u.example/'}],facts:{stepsRun:Object.fromEntries(RP.QUICK.map(id=>[id,'2026-11-13']))}};
 const html=SA.card(partial,{project:{application:{intent:{label:'Remodel'}}}});assert(/Researched for: Remodel\. Not yet researched: Historic district, Culinary water/.test(html.replace(/<[^>]+>/g,'').replace(/\s+/g,' ').replace(/&amp;/g,'&'))&&/data-research-all/.test(html));
 assert(!/data-research-all/.test(SA.card({findings:partial.findings,facts:{}})),'Fully researched (legacy) reports show no coverage gap');
 document.body.innerHTML=html;document.querySelector('[data-research-all]').dispatchEvent(new window.MouseEvent('click',{bubbles:true}));assert.deepEqual(events.at(-1),{typeIds:['*'],label:'everything'});
 console.log('PASS: cards say when approval research has not started and what has not been researched, with a way to research everything.');
})().catch(e=>{console.error(e);process.exitCode=1;});
