/* Runaway and abuse guards for automatic research: a run may use RUNS_PER_DAY worker runs a day (then waits until
   tomorrow) and RUNS_TOTAL in all (then stops for review); RESEARCH_PAUSED=1 stops all research work and new starts.
   Stubbed store and engine, no network. */
const assert=require('node:assert/strict'),A=require('../lib/automatic-investigation'),S=require('../lib/investigation-store'),D=require('../lib/record-discovery-engine'),V=require('../web/title-research-view');
(async()=>{
 // 1. Counting: daily cap pauses until tomorrow, a new day resets it, the lifetime cap stops the run for review.
 {const c={},day=new Date('2026-11-16T12:00:00Z');for(let i=0;i<A.RUNS_PER_DAY;i++)assert.equal(A.runGuard(c,day),null);
  const over=A.runGuard(c,day);assert.equal(over.status,'retry_wait');assert.equal(over.phase,'run_limit_day');assert(over.delaySeconds>11*3600&&over.delaySeconds<13*3600,'waits until just after midnight UTC');
  assert.equal(A.runGuard(c,new Date('2026-11-17T00:20:00Z')),null,'a new day starts a new count');assert(!c.runPause,'and clears the pause');
  const old={...c.runGuard};c.runGuard.total=A.RUNS_TOTAL;const stop=A.runGuard(c,new Date('2026-11-17T01:00:00Z'));assert.equal(stop.status,'needs_review');assert.match(c.runStopped.reason,/stopped for review/);c.runGuard=old;
  console.log('PASS: each research run gets '+A.RUNS_PER_DAY+' worker runs a day and '+A.RUNS_TOTAL+' in all; past that it waits or stops for review.');}
 const old={rpc:S.rpc,run:D.run};let saved,runs=0,rpcs=[];
 try{
  // 2. Over the daily cap: the worker saves the pause and does no source, OCR or AI work.
  const checkpoint={target:{county:'Weber',parcelId:'000000003',subdivision:'Example',municipality:'Example'},interpretations:[],interpreted:{},pageTexts:{},errors:[],runGuard:{day:new Date().toISOString().slice(0,10),today:A.RUNS_PER_DAY,total:A.RUNS_PER_DAY}};
  S.rpc=async(action,p)=>{rpcs.push(action);if(action==='claim')return {id:'job',lease:'lease',checkpoint:structuredClone(checkpoint)};if(action==='save'){saved=structuredClone(p);return {saved:true};}throw Error('unexpected rpc '+action);};
  D.run=async()=>{runs++;throw Error('must not run');};
  const out=await A.tick();assert.equal(out.guarded,true);assert.equal(saved.status,'retry_wait');assert.equal(saved.phase,'run_limit_day');assert.equal(runs,0);assert.deepEqual(rpcs,['claim','save']);
  assert(saved.result.runPause?.until,'the pause is visible to the user');
  const html=V.investigationPanel({...saved.result,automation:{status:saved.status,updatedAt:new Date().toISOString()}});assert(html.includes('reached today’s run limit'));
  const stopped=V.investigationPanel({...saved.result,runPause:null,runStopped:{reason:'x'},automation:{status:'needs_review',updatedAt:new Date().toISOString()}});assert(stopped.includes('Research stopped for review')&&stopped.includes('stopped so it can be checked'));
  console.log('PASS: over the limit the worker only records the pause (no source, scanned-page or AI work) and the research view says so.');
  // 3. Off switch: no work is claimed and no new research starts.
  process.env.RESEARCH_PAUSED='1';rpcs=[];
  assert.deepEqual(await A.tick(),{paused:true});const start=await A.enqueue('Weber','224410004');assert.equal(start.limited,true);assert.match(start.message,/paused/);assert.deepEqual(rpcs,[],'nothing touches the database while paused');
  delete process.env.RESEARCH_PAUSED;
  console.log('PASS: RESEARCH_PAUSED=1 stops all research work and new starts without touching the database.');
 }finally{S.rpc=old.rpc;D.run=old.run;delete process.env.RESEARCH_PAUSED;}
})().catch(e=>{console.error(e);process.exitCode=1;});
