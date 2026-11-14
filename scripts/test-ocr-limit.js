/* Server cost guard: each research run reads at most OCR_PAGES_PER_DAY new scanned pages a day. Past that, the
   pages wait until tomorrow, the worker sleeps instead of re-running for nothing, documents already read keep
   being checked, and the research view says why. Stubbed store and engine, no network. */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),A=require('../lib/automatic-investigation'),S=require('../lib/investigation-store'),D=require('../lib/record-discovery-engine');
(async()=>{
 // 1. The gate: counts pages, stops at the limit with a pause until tomorrow, resets the next day.
 {const c={},day=new Date('2026-11-14T15:00:00Z');for(let i=0;i<A.OCR_PAGES_PER_DAY/3;i++)A.ocrGate(c,3,day);assert.equal(c.ocrPages,A.OCR_PAGES_PER_DAY);
  assert.throws(()=>A.ocrGate(c,1,day),e=>e.code==='AI_BUDGET_PAUSED'&&e.retryAt==='2026-11-15T00:05:00.000Z'&&/scanned pages/.test(e.message));
  A.ocrGate(c,3,new Date('2026-11-15T01:00:00Z'));assert.equal(c.ocrPages,3,'a new day starts a new count');
  console.log('PASS: at most '+A.OCR_PAGES_PER_DAY+' scanned pages per research run per day; the rest wait until tomorrow.');}
 // 2. Limit reached with nothing else to do: the worker sleeps until the reset instead of re-running every few seconds.
 const old={rpc:S.rpc,run:D.run};let saved;
 const profile={id:'ocr',county:'Weber',parcelId:'000000002',hosts:['example.org'],terms:['Example'],identityTerms:['Example'],routes:['association_libraries'],seeds:[],references:[]};
 const state=D.create(profile),hash='b'.repeat(64),until=new Date(Date.now()+6*3600000).toISOString();
 state.documents=[{sha256:hash,urls:['https://example.org/ccrs.pdf'],pages:40,unreadPages:[31,32,33],route:'association_libraries'}];
 state.jobs=[31,32,33].map(n=>({id:'ocr-'+n,kind:'ocr',documentHash:hash,page:n,key:'ocr|'+hash+'|'+n,route:'association_libraries',status:'queued',budgetPauseUntil:until,error:'Reached today’s limit of 150 scanned pages for this research; the remaining pages are read tomorrow.'}));
 let checkpoint={target:{county:'Weber',parcelId:'000000002',subdivision:'Example',municipality:'Example'},profile,state,interpretations:[],interpreted:{},pageTexts:{},errors:[],ocrDay:new Date().toISOString().slice(0,10),ocrPages:150};
 let runs=0;
 try{
  S.rpc=async(action,p)=>{if(action==='claim')return {id:'job',lease:'lease',checkpoint:structuredClone(checkpoint)};if(['progress','reading_put'].includes(action))return {saved:true};if(action==='save'){saved=structuredClone(p);checkpoint=saved.checkpoint;return {saved:true};}throw Error('unexpected rpc '+action);};
  D.run=async(p,dir)=>{runs++;const s=JSON.parse(fs.readFileSync(path.join(dir,'manifest.json')));D.summarize(s,p);return s;};
  await A.tick();
  assert.equal(saved.status,'retry_wait');assert.equal(saved.phase,'ocr_pause');assert(saved.delaySeconds>5*3600,'sleeps until the limit resets');
  assert(runs<=1,'paused pages are not runnable work: one pass, no spinning ('+runs+')');
  assert.equal(saved.result.ocrPause.until,until);assert.equal(saved.result.aiPause,null,'the page limit does not pause AI interpretation');
  assert(saved.checkpoint.state.jobs.every(j=>j.status==='queued'),'the unread pages are kept, not dropped');
  const html=require('../web/title-research-view').investigationPanel({...saved.result,automation:{status:saved.status,updatedAt:new Date().toISOString()}});
  assert(html.includes('Reading scanned pages is paused at today’s limit'));assert(!html.includes('shared daily AI limit'));
  console.log('PASS: past the limit the research sleeps until tomorrow, keeps its unread pages, and says so; AI interpretation is not paused by it.');
 }finally{S.rpc=old.rpc;D.run=old.run;}
})().catch(e=>{console.error(e);process.exitCode=1;});
