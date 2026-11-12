const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const D=require('../lib/record-discovery-engine'),PMN=require('../lib/pmn');
(async()=>{
 const profile={id:'test',scope:'fixture',routes:['released_records_archive'],hosts:['example.org'],seeds:[],terms:['Cobabe','224410004']};
 const store=fs.mkdtempSync(path.join(os.tmpdir(),'discovery-test-'));
 try{
  assert.equal(D.exactIdentifierMatch('22-441-0004','224410004'),true);
  assert.equal(D.exactIdentifierMatch('224140004 and 224140015','224410004'),false);
  assert.equal(D.permitted('https://example.org.evil.test/x',profile),false);
  assert.equal(D.permitted('http://example.org/x',profile),false);
  await assert.rejects(()=>D.request('https://example.org/file',profile,{request:async()=>new Response(null,{status:302})}),/omitted Location/);
  const embedded=D.links('<html><body><iframe src="/rules.pdf"></iframe><script>{"file":"https:\\/\\/example.org\\/covenants.pdf"}</script></body></html>','https://example.org');
  assert.equal(embedded.links.length,2);
  const s=D.create(profile);
  const j=D.add(s,{kind:'nextrequest',url:'https://example.org',resource:'requests',term:'224410004',page:1,route:profile.routes[0]});
  const fetch=async url=>({url,status:200,type:'application/json',bytes:Buffer.from(JSON.stringify({total_count:2,requests:[{id:'26-1',request_text:'Parcel 224140004'},{id:'26-2',request_text:'Parcel 224410004'}]})),retrievedAt:new Date().toISOString()});
  await D.processJob(s,profile,j,store,{fetch});
  assert.equal(s.jobs.filter(j=>j.kind==='release').length,1);
  assert.equal(s.jobs.find(j=>j.kind==='release').requestId,'26-2');
  assert.equal(D.summarize(s,profile).publicRouteChecksComplete,false);
  s.jobs.forEach(j=>j.status='complete');s.documents.push({unreadPages:[1]});
  assert.equal(D.summarize(s,profile).publicRouteChecksComplete,false);
  s.documents=[];s.externalLeads.push({route:profile.routes[0],status:'requires_source_review'});
  assert.equal(D.summarize(s,profile).publicRouteChecksComplete,false);
  s.externalLeads=[];s.jobs[0].status='rate_limited';
  assert.equal(D.summarize(s,profile).publicRouteChecksComplete,false);
  assert.equal(s.contactFallbackEligible,false);
  let calls=0;
  const result=await PMN.searchAll('Cobabe',{startDate:'2025-01-01',endDate:'2025-01-02'},async(k,r)=>{
   calls++;return Array.from({length:r.startDate===r.endDate?14:25},(_,n)=>({id:r.startDate+'-'+n}));
  });
  assert.equal(calls,3);assert.equal(result.complete,true);
  const saturated=await PMN.searchAll('Cobabe',{startDate:'2025-01-01',endDate:'2025-01-01'},async()=>Array.from({length:25},(_,id)=>({id})));
  assert.equal(saturated.complete,false);
  const failed=await PMN.searchAll('Cobabe',{},async()=>{throw Error('429');});assert.equal(failed.complete,false);
  // Follow a public document viewer to its real download, persist and resume without refetching.
  const p={...profile,routes:['association_libraries'],seeds:[{url:'https://example.org/documents/123',route:'association_libraries',mode:'attachments',depth:0}]};
  let fetched=0;const fixture=async url=>{fetched++;return {url,status:200,type:url.includes('download')?'application/pdf':'text/html',retrievedAt:new Date().toISOString(),bytes:Buffer.from(url.includes('download')?'%PDF-fake':'<html><body><a href="/documents/123/download?token=">Download</a></body></html>')};};
  const result2=await D.run(p,store,{fetch:fixture,readPdf:async()=>[{page:1,text:'Cobabe covenant text requiring review before construction.',needsOCR:false}]});
  assert.equal(result2.documents.length,1);assert.equal(result2.coverage.publicRouteChecksComplete,true);
  await D.run(p,store,{fetch:fixture});assert.equal(fetched,2);
  const failedStore=require('node:path').join(store,'native-retry');
  const failedRead=await D.run(p,failedStore,{fetch:fixture,readPdf:async()=>{throw Error('Temporary extraction timeout');}});assert.equal(failedRead.documents.length,1);assert(failedRead.documents[0].readError);assert.equal(failedRead.coverage.publicRouteChecksComplete,false);
  // Recover legacy checkpoints that incorrectly marked the acquisition complete after extraction failed.
  failedRead.jobs.find(j=>j.documentHash===failedRead.documents[0].sha256).status='complete';fs.writeFileSync(require('node:path').join(failedStore,'manifest.json'),JSON.stringify(failedRead));
  const recovered=await D.run(p,failedStore,{retry:true,fetch:fixture,readPdf:async()=>[{page:1,text:'Cobabe covenant text successfully recovered.',needsOCR:false}]});assert.equal(recovered.documents.length,1);assert(!recovered.documents[0].readError);assert.equal(recovered.coverage.publicRouteChecksComplete,true);
  // A hosted checkpoint deliberately omits source bytes and page text; resume by exact content hash.
  const doc=result2.documents[0];doc.unreadPages=[1];
  fs.rmSync(require('node:path').join(store,'blobs'),{recursive:true,force:true});
  fs.rmSync(require('node:path').join(store,'readings'),{recursive:true,force:true});
  const ocrJob={kind:'ocr',documentHash:doc.sha256,page:1,route:'association_libraries',status:'queued'};
  await D.processJob(result2,p,ocrJob,store,{fetch:fixture,readPdf:async()=>[{page:1,text:'',needsOCR:true}],ocr:async()=>({pages:[{page:1,text:'Cobabe public covenant',method:'test'}]})});
  assert.equal(ocrJob.status,'complete');assert.equal(doc.unreadPages.length,0);
  doc.unreadPages=[1];
  await assert.rejects(()=>D.processJob(result2,p,{...ocrJob,status:'queued'},store,{ocr:async()=>({pages:[{page:1,text:''}]})}),/no readable/);
  const blankJob={...ocrJob,status:'queued'};await D.processJob(result2,p,blankJob,store,{ocr:async()=>({pages:[{page:1,text:'',blank:true,method:'rendered_blank_page'}]})});assert.equal(blankJob.status,'complete');assert.deepEqual(doc.blankPages,[1]);assert.equal(doc.unreadPages.length,0);
  fs.rmSync(require('node:path').join(store,'blobs'),{recursive:true,force:true});
  await assert.rejects(()=>D.processJob(result2,p,{...ocrJob,status:'queued'},store,{fetch:async url=>({url,status:200,bytes:Buffer.from('changed document')})}),/unavailable or changed/);
  console.log('Discovery tests passed: exact parcel identity, host boundary, embedded files, complete pagination, honest gaps, document download and resumable ingestion.');
 }finally{fs.rmSync(store,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1;});
