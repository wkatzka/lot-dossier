const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),A=require('../lib/automatic-investigation'),S=require('../lib/investigation-store'),D=require('../lib/record-discovery-engine');
(async()=>{
 const rpc=S.rpc,run=D.run;let saved,progress=false;
 const profile={id:'interrupted',county:'Weber',parcelId:'000000001',hosts:['example.org'],terms:['Example'],identityTerms:['Example'],routes:['association_libraries'],seeds:[],references:[]};const state=D.create(profile);state.jobs=[{id:'interrupted',kind:'page',url:'https://example.org/slow',route:'association_libraries',status:'queued'},{id:'independent',kind:'page',url:'https://example.org/other',route:'association_libraries',status:'queued'}];
 const checkpoint={target:{county:'Weber',parcelId:'000000001',subdivision:'Example Ridge',municipality:'Example'},profile,state,interpretations:[],interpreted:{},pageTexts:{},errors:[],inFlight:{id:'interrupted'}};
 try{
 S.rpc=async(action,payload)=>{if(action==='claim')return {id:'job',lease:'lease',checkpoint};if(action==='progress'){progress=true;assert.equal(payload.checkpoint.state.jobs[0].status,'source_error');return {saved:true};}if(action==='save'){saved=payload;return {saved:true};}throw Error('Unexpected RPC '+action);};
 D.run=async(p,dir)=>{const s=JSON.parse(fs.readFileSync(path.join(dir,'manifest.json')));assert.equal(s.jobs[0].status,'source_error');assert.equal(s.jobs[1].status,'queued');s.jobs[1].status='complete';D.summarize(s,p);return s;};
 const result=await A.tick();assert(progress);assert.equal(result.status,'retry_wait');assert.equal(saved.checkpoint.state.jobs[1].status,'complete');assert.equal(saved.checkpoint.state.jobs[0].autoRetries,1);assert.equal(saved.result.coverage.pending,1);assert(saved.checkpoint.state.jobs[0].error.includes('not an empty result'));assert.equal(saved.checkpoint.inFlight,null);
 console.log('PASS: an expired worker operation becomes a bounded source retry; independent work completes and retry counts remain visible.');
 }finally{S.rpc=rpc;D.run=run;}
})().catch(e=>{console.error(e);process.exitCode=1});
