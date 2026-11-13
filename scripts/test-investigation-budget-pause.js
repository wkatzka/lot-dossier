const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),A=require('../lib/automatic-investigation'),S=require('../lib/investigation-store'),D=require('../lib/record-discovery-engine'),I=require('../lib/approval-document-interpreter'),Y=require('../lib/investigation-synthesis');
(async()=>{
 const old={rpc:S.rpc,run:D.run,interpret:I.interpret,synthesize:Y.synthesize};let saved,claims=0,calls=0;
 const profile={id:'budget',county:'Weber',parcelId:'000000001',hosts:['example.org'],terms:['Example'],identityTerms:['Example'],routes:['association_libraries'],seeds:[],references:[]};
 const state=D.create(profile),hash='a'.repeat(64);state.documents=[{sha256:hash,urls:['https://example.org/terms.pdf'],pages:1,unreadPages:[],route:'association_libraries'}];state.jobs=[{id:'lookup',kind:'ocr',documentHash:hash,url:'https://example.org/library',route:'association_libraries',status:'queued'}];
 let checkpoint={target:{county:'Weber',parcelId:'000000001',subdivision:'Example Ridge',municipality:'Example'},profile,state,interpretations:[],interpreted:{},pageTexts:{[hash]:{sha256:hash,pages:[{page:1,text:'Architectural approval is required.'}]}},errors:[]};
 const until=new Date(Date.now()+3600000).toISOString();
 try{
 S.rpc=async(action,p)=>{if(action==='claim'){claims++;return {id:'job',lease:'lease',checkpoint:structuredClone(checkpoint)};}if(['progress','reading_put'].includes(action))return {saved:true};if(action==='save'){saved=structuredClone(p);checkpoint=saved.checkpoint;return {saved:true};}throw Error(action);};
 D.run=async(p,dir)=>{const s=JSON.parse(fs.readFileSync(path.join(dir,'manifest.json')));if(claims===2)s.jobs.forEach(j=>j.status='complete');D.summarize(s,p);return s;};
 I.interpret=async()=>{calls++;throw Object.assign(Error('Daily budget paused'),{status:429,code:'AI_BUDGET_PAUSED',retryAt:until});};
 // Avoid repeated source processing for the synthetic still-pending job.
 await A.tick();
 assert.equal(saved.status,'queued');assert.equal(saved.delaySeconds,0);assert.equal(saved.checkpoint.aiPause.until,until);assert.equal(calls,1);
 await A.tick();assert.equal(saved.status,'retry_wait');assert.equal(saved.phase,'budget_pause');assert(saved.delaySeconds>3500);assert.equal(calls,1);assert.equal(saved.result.coverage.pending,0);assert.equal(saved.checkpoint.state.jobs[0].status,'complete');assert.equal(saved.result.aiPause.until,until);
 // Failed non-AI sources also retry while interpretation remains paused.
 checkpoint.state.jobs.push({id:'retry-source',kind:'page',url:'https://example.org/retry',route:'association_libraries',status:'source_error',error:'Temporary source failure'});
 await A.tick();assert.equal(saved.phase,'source_retry');assert.equal(saved.checkpoint.state.jobs[1].status,'queued');assert.equal(saved.checkpoint.state.jobs[1].autoRetries,1);assert.equal(calls,1);
 checkpoint.state.jobs[1].status='complete';
 // A budget denial is not a failed synthesis attempt and must never exhaust its repair allowance.
 delete checkpoint.aiPause;checkpoint.interpreted[hash]=true;delete checkpoint.pageTexts[hash];checkpoint.synthesisAttempts=2;
 Y.synthesize=async()=>{throw Object.assign(Error('Daily budget paused'),{status:429,code:'AI_BUDGET_PAUSED',retryAt:until});};
 await A.tick();assert.equal(saved.checkpoint.synthesisAttempts,2);assert.equal(saved.checkpoint.synthesis,undefined);assert.equal(saved.status,'retry_wait');
 const html=require('../web/title-research-view').investigationPanel({...saved.result,automation:{status:saved.status,updatedAt:new Date().toISOString()}});assert(html.includes('will resume automatically'));assert(html.includes('Public-source discovery continues'));
 console.log('PASS: AI budget denial preserves interpretation work, continues independent public lookups, waits until reset and never consumes synthesis repair attempts.');
 }finally{S.rpc=old.rpc;D.run=old.run;I.interpret=old.interpret;Y.synthesize=old.synthesize;}
})().catch(e=>{console.error(e);process.exitCode=1});
