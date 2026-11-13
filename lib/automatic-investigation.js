const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const S=require('./investigation-store'),P=require('./automatic-research-profile'),D=require('./record-discovery-engine'),I=require('./approval-document-interpreter');
async function enqueue(county,parcelId){
 const prior=await S.rpc('status',{county,parcelId});if(prior)return prior;
 const target=await P.identity(county,parcelId);
 return S.rpc('enqueue',{county,parcelId,checkpoint:{target,interpretations:[],pageTexts:{},interpreted:{},errors:[]}});
}
function publicResult(c,status){
 const profile=c.profile||{county:c.target.county,parcelId:c.target.parcelId,routes:[],scope:'County identity resolved; source discovery is starting.'};
 const state=c.state||{jobs:[],documents:[],externalLeads:[]};
 const plan=require('./research-plans').forProfile(profile);
 plan.questions[0].references=(profile.references||[]).flatMap(r=>{const receipt=state.jobs.find(j=>j.status==='complete'&&j.httpStatus===200&&(j.url===r.url||(r.label==='Weber County Recorder'&&j.route==='recorder_index')||(/Directory-matched/.test(r.purpose||'')&&j.url==='https://wolfcreekresortmasterhoa.com/neighborhood-hoas/')));const verification=r.verification||(receipt?{url:receipt.fetchedUrl||receipt.url,checkedAt:receipt.checkedAt}:null);return verification?[{...r,verification}]:[];});
 const investigation=require('./research-outcomes').evaluate(plan,state);
 return {county:c.target.county,parcelId:c.target.parcelId,checkedAt:new Date().toISOString(),status,
  target:{address:c.target.address,subdivision:c.target.subdivision,lot:c.target.lot,municipality:c.target.municipality,municipalityAmbiguous:!!c.target.municipalityAmbiguous,source:c.target.source},
  aiPause:c.aiPause||null,investigation,searchLog:require('./investigation-checkpoint').publicLog(state),synthesis:c.synthesis||null,interpretations:(c.interpretations||[]).map(d=>({...d,requirements:d.requirements.map(I.refineTiming)})),errors:(c.errors||[]).slice(-5),
  coverage:state.coverage?require('./discovery-metadata').publicCoverage(state.coverage):{routes:[],documents:0,unreadDocuments:0},documents:(state.documents||[]).map(d=>({sha256:d.sha256,urls:d.urls,pages:d.pages,unreadPages:d.unreadPages||[]})),
  limitation:'Automatic public-source investigation. Source-supported interpretations retain their applicability and amendment limits; no approval or exemption is inferred.'};
}
function admitDocumentLeads(c){
 const previousHash=c.state.profileHash,admitted=[];
 for(const lead of c.state.externalLeads.filter(l=>l.status==='requires_source_review')){
  if((!lead.documentRedirect&&!/\.(?:pdf|docx?|tiff?)(?:\?|$)/i.test(lead.url))||!require('./public-source-transport').publicHost(lead.url))continue;
  const hostname=new URL(lead.url).hostname;if(!c.profile.hosts.includes(hostname)){c.profile.hosts.push(hostname);admitted.push({hostname,source:lead.from,url:lead.url});}
  D.add(c.state,{kind:'page',url:lead.url,route:lead.route,depth:0,maxDepth:0,mode:'attachments',from:lead.from});lead.status='followed';
 }
 if(admitted.length){c.state.profileHash=D.create(c.profile).profileHash;(c.state.profileRevisions||=[]).push({previousHash,nextHash:c.state.profileHash,checkedAt:new Date().toISOString(),reason:'Follow directly linked public originals and their observed redirects.',sources:admitted});}
}
function scopedReference(identifier,target,source=''){
 if(/\b\d{6,9}\b|weber|ogden valley|wolf creek/i.test(identifier))return identifier;
 const name=target.subdivision.replace(/\b(?:at wolf creek|pr[u]?d|phase).*$/i,'').trim();
 if(name&&identifier.toLowerCase().includes(name.toLowerCase()))return identifier;
 const area=source.includes('ogdenvalley.gov')?target.municipality:name||target.municipality;
 return area+' '+identifier;
}
function retireUnscopedNoticeLeads(c){
 const refined=new Set(c.state.jobs.filter(j=>j.refinement&&j.kind==='pmn').map(j=>j.term));
 const retired=new Map(),supported=new Set();
 for(const query of c.state.queries||[])for(const row of query.results||[]){
  if(!row.url)continue;
  if(refined.has(query.term))retired.set(row.url,row);else supported.add(row.url);
 }
 const name=c.target.subdivision.replace(/\b(?:at wolf creek|pr[u]?d|phase).*$/i,'').trim().toLowerCase();
 for(const job of c.state.jobs.filter(j=>j.kind==='page'&&j.status==='queued'&&retired.has(j.url)&&!supported.has(j.url))){
  const row=retired.get(job.url),text=(row.title+' '+(row.body||'')).toLowerCase();
  if((name&&text.includes(name))||text.includes(c.target.parcelId))continue;
  job.status='reviewed_not_relevant';job.scopeReview={reason:'Lead came only from a superseded unqualified notice search, with no property identifier in the retained result. Qualified searches remain active; this is not a finding that the attachment contains no relevant evidence.',source:job.url,checkedAt:new Date().toISOString()};
 }
}
function runnableSources(c){return c.state.jobs.some(j=>j.status==='queued'&&!(j.kind==='ocr'&&Date.parse(c.aiPause?.until)>Date.now()));}
async function tick(){
 const job=await S.rpc('claim');if(!job)return {idle:true};const c=job.checkpoint,started=Date.now(),dir=fs.mkdtempSync(path.join(os.tmpdir(),'cp-investigation-'));
 let status='queued',phase='discover',delaySeconds=0;
 try{
  if(c.inFlight&&c.state){const interrupted=c.state.jobs.find(j=>j.id===c.inFlight.id);if(interrupted?.status==='queued'){interrupted.status='source_error';interrupted.error='Worker interrupted during this source operation; retained for bounded retry, not an empty result.';}c.inFlight=null;}
  if(!c.profile){c.profile=await P.profile(c.target);c.state=D.create(c.profile);c.state.externalLeads.push(...c.profile.initialLeads);}
  for(const doc of c.state.documents){
   c.validationRetries||={};c.validationFeedback||={};
   const obsolete=c.interpretations.filter(x=>x.sha256===doc.sha256&&((x.version&&x.version!==I.VERSION)||(!x.effectExtractionVersion&&/declar|amend|terminat|covenant|bylaw/i.test(x.documentTitle+' '+x.source))||(x.rejected?.length&&(c.validationRetries[doc.sha256]||0)<2)));
   if(obsolete.some(x=>x.rejected?.length)){c.validationRetries[doc.sha256]=(c.validationRetries[doc.sha256]||0)+1;c.validationFeedback[doc.sha256]=obsolete.flatMap(x=>x.validationFailures?.length?x.validationFailures:x.rejected||[]);}
   if(obsolete.length){c.supersededInterpretations||=[];c.supersededInterpretations.push(...obsolete);c.interpretations=c.interpretations.filter(x=>!obsolete.includes(x));delete c.interpreted[doc.sha256];if(!c.pageTexts[doc.sha256]){doc.readError='Re-reading original for updated interpretation rules';for(const job of c.state.jobs.filter(j=>j.documentHash===doc.sha256&&j.kind==='page'))job.status='queued';}}
  }
  if(!c.archiveRouteVersion){
   const previousHash=c.state.profileHash;c.profile.hosts=[...new Set([...c.profile.hosts,'web.archive.org'])];c.profile.routes=[...new Set([...c.profile.routes,'public_mirrors_and_archives'])];
   c.state.profileHash=D.create(c.profile).profileHash;(c.state.profileRevisions||=[]).push({previousHash,nextHash:c.state.profileHash,checkedAt:new Date().toISOString(),reason:'Add public archival copies as an alternative for inaccessible original URLs.'});c.archiveRouteVersion=1;
  }
  if(!c.sourceCatalogVersion){for(const seed of require('./investigation-source-catalog').seeds(c.profile))D.add(c.state,seed);c.sourceCatalogVersion=1;}
  // Historic generic reference queries are refined, not recorded as empty searches.
  for(const old of c.state.jobs.filter(j=>j.status==='queued'&&['pmn','nextrequest'].includes(j.kind))){
   const term=scopedReference(old.term,c.target,old.from||old.discoveredFrom?.[0]||'');if(term===old.term)continue;
   const replacement=D.add(c.state,{...old,key:undefined,id:undefined,status:undefined,term,pmnCheckpoint:undefined,searchReceipt:undefined,error:undefined});old.status='reviewed_not_relevant';old.refinement={reason:'Unqualified instrument name replaced by property-specific search; this is not a negative result.',replacement:replacement.id,term};
  }
  require('./investigation-checkpoint').compact(c.state);
  retireUnscopedNoticeLeads(c);
  admitDocumentLeads(c);
  fs.mkdirSync(path.join(dir,'readings'),{recursive:true});
  for(const [hash,reading] of Object.entries(c.pageTexts||{}))fs.writeFileSync(path.join(dir,'readings',hash+'.json'),JSON.stringify(reading));
  fs.writeFileSync(path.join(dir,'manifest.json'),JSON.stringify(c.state));
  let count=0;
  do{
   const queued=c.state.jobs.filter(j=>j.status==='queued'&&!(j.kind==='ocr'&&Date.parse(c.aiPause?.until)>Date.now())),parallel=queued[0]?.kind==='ocr'&&queued.some(j=>j.kind==='ocr'&&j.documentHash!==queued[0].documentHash)?2:1;
   for(const name of fs.readdirSync(path.join(dir,'readings'))){const value=JSON.parse(fs.readFileSync(path.join(dir,'readings',name)));if(!c.interpreted[value.sha256])c.pageTexts[value.sha256]=value;}
   require('./investigation-checkpoint').compact(c.state);fs.writeFileSync(path.join(dir,'manifest.json'),JSON.stringify(c.state));
   c.inFlight=queued[0]?{id:queued[0].id,kind:queued[0].kind,url:queued[0].url,term:queued[0].term,startedAt:new Date().toISOString()}:null;
   await S.rpc('progress',{id:job.id,lease:job.lease,checkpoint:c,phase:'source_'+(queued[0]?.kind||'complete')});
   c.state=await D.run(c.profile,dir,{maxJobs:parallel,deferOCRUntil:c.aiPause?.until,ocrConcurrency:2,ocrBatchSize:3,readPdf:require('./public-reading-cache').read,ocr:(bytes,page,count)=>require('./original-reader').execute(bytes,page,count)});
   const budgetJob=c.state.jobs.find(j=>Date.parse(j.budgetPauseUntil)>Date.now());if(budgetJob)c.aiPause={until:budgetJob.budgetPauseUntil,reason:budgetJob.error};
   count+=parallel;
  }while(runnableSources(c)&&Date.now()-started<45000&&count<32);
  for(const name of fs.readdirSync(path.join(dir,'readings'))){const value=JSON.parse(fs.readFileSync(path.join(dir,'readings',name)));if(!c.interpreted[value.sha256])c.pageTexts[value.sha256]=value;}
  require('./investigation-checkpoint').compact(c.state);
  c.inFlight=null;await S.rpc('progress',{id:job.id,lease:job.lease,checkpoint:c,phase:'interpret'});
  c.sharedReadings||={};
  for(const d of c.state.documents){
   const reading=c.pageTexts[d.sha256];
   if(reading&&!d.readError&&!d.unreadPages?.length&&!c.sharedReadings[d.sha256]&&reading.pages.every(p=>p.text?.trim()||p.blank)){
    await S.rpc('reading_put',{sha256:d.sha256,version:1,reading:{sha256:d.sha256,pages:reading.pages.map(p=>({...p,needsOCR:false}))}});c.sharedReadings[d.sha256]=true;
   }
  }
  for(const d of c.state.documents){
   const reading=c.pageTexts[d.sha256];if(d.readError||d.unreadPages?.length||c.interpreted[d.sha256]||!reading)continue;
   if(reading.pages.every(p=>!/(approv|architect|covenant|declar|permit|review committee|design review|terminat|assign|delegat|successor|amend)/i.test(p.text))){
    c.interpretations.push({sha256:d.sha256,source:d.urls[0],documentTitle:'Public original',documentStatus:'not_established',requirements:[],missingDocuments:[],rejected:[],pagesRead:reading.pages.map(p=>p.page),summary:'No approval-related language detected in the machine-read pages; this is not an exemption finding.',method:'text screening',effectExtractionVersion:1});
    c.interpreted[d.sha256]=true;delete c.pageTexts[d.sha256];
   }
  }
  const candidate=[...c.state.documents].sort((a,b)=>(b.route==='planning_requirements')-(a.route==='planning_requirements')).find(d=>!d.readError&&!d.unreadPages?.length&&c.pageTexts[d.sha256]&&!c.interpreted[d.sha256]);
  if(candidate&&Date.now()-started<80000&&!(Date.parse(c.aiPause?.until)>Date.now())){
   phase='interpret';const pages=c.pageTexts[candidate.sha256].pages;
   const done=c.interpretations.filter(x=>x.sha256===candidate.sha256).flatMap(x=>x.pagesRead),remaining=pages.filter(p=>!done.includes(p.page));
   const batch=[];let size=0;for(const p of remaining){if(size+p.text.length>(c.interpretChunkSize||60000)&&batch.length)break;batch.push({page:p.page,text:p.text});size+=p.text.length;}
   if(batch.length){
    if(batch.every(p=>!/(approv|architect|covenant|declar|permit|review committee|design review|terminat|assign|delegat|successor|amend)/i.test(p.text))){c.interpretations.push({sha256:candidate.sha256,source:candidate.urls[0],documentTitle:'Public original',documentStatus:'not_established',requirements:[],missingDocuments:[],rejected:[],pagesRead:batch.map(p=>p.page),summary:'No approval-related language detected in these machine-read pages; this is not an exemption finding.',method:'text screening',effectExtractionVersion:1});}
    else c.interpretations.push(await I.interpret(batch,c.target,candidate,{feedback:c.validationFeedback?.[candidate.sha256]||[],contextPages:require('./interpretation-context').select(pages)}));
   }
   const read=new Set(c.interpretations.filter(x=>x.sha256===candidate.sha256).flatMap(x=>x.pagesRead));
   if(pages.every(p=>read.has(p.page))){c.interpreted[candidate.sha256]=true;if(!c.interpretations.some(x=>x.sha256===candidate.sha256&&x.rejected?.length))delete c.pageTexts[candidate.sha256];}
   // Follow named and numbered references; a missing original is additional search work.
   for(const ref of c.interpretations.flatMap(x=>x.missingDocuments||[])){
    const identifier=String(ref.identifier).replace(/\s*([.-])\s*/g,'$1').trim();
    const chapter=identifier.match(/\b\d{3}-\d{1,2}\b/)?.[0];
    const known=/ogden valley/i.test(c.target.municipality)&&chapter&&require('../web/ovc-code-sources')[chapter];
    if(known){D.add(c.state,{kind:'page',url:known.url,route:'planning_requirements',depth:0,mode:'attachments',maxDepth:1,from:ref.source});continue;}
    const ids=identifier.match(/\b\d{6,9}\b/g)||[];
    for(const term of ids.length?ids:[scopedReference(identifier,c.target,ref.source)]){
     D.add(c.state,{kind:'nextrequest',url:'https://webercountyut.nextrequest.com',resource:'documents',route:'released_records_archive',term,page:1,from:ref.source});
     D.add(c.state,{kind:'pmn',route:'public_notice_attachments',term,startDate:'2000-01-01',endDate:c.profile.endDate,from:ref.source});
     if(!ids.length&&new URL(ref.source).hostname==='ogdenvalley.gov')for(const resource of ['search','media'])D.add(c.state,{kind:'wordpress',url:'https://ogdenvalley.gov',route:'planning_requirements',term,resource,page:1});
    }
   }
  }
  for(const blocked of c.state.jobs.filter(j=>j.kind==='page'&&j.status==='access_restricted'&&j.url&&!j.url.startsWith('https://web.archive.org/'))){
   const url='https://web.archive.org/cdx/search/cdx?'+new URLSearchParams({url:blocked.url,output:'json',filter:'statuscode:200',collapse:'digest',limit:'100'});
   D.add(c.state,{kind:'archive',url,route:'public_mirrors_and_archives',from:blocked.url});
  }
  admitDocumentLeads(c);
  // Never accept an unread or failed source as a completed interpretation.
  D.summarize(c.state,c.profile);
  const waiting=c.state.documents.some(d=>!d.readError&&!d.unreadPages?.length&&!c.interpreted[d.sha256]);
  const repairPending=c.interpretations.some(x=>x.rejected?.length&&(c.validationRetries?.[x.sha256]||0)<2);
  if(!c.state.coverage.pending&&!waiting&&!repairPending){
   const retryable=c.state.jobs.filter(j=>['source_error','search_incomplete','rate_limited','deferred_rate_limit'].includes(j.status)&&(j.autoRetries||0)<3);
   if(retryable.length){const rateLimited=retryable.some(j=>['rate_limited','deferred_rate_limit'].includes(j.status));for(const j of retryable){j.autoRetries=(j.autoRetries||0)+1;j.status='queued';}status='retry_wait';phase='source_retry';delaySeconds=rateLimited?900:60;}
   else {
    if(!c.synthesis){
     c.synthesisAttempts=(c.synthesisAttempts||0)+1;
     try{c.synthesis=await require('./investigation-synthesis').synthesize(c.interpretations,c.target);}
     catch(e){if(e.code==='AI_BUDGET_PAUSED'){c.synthesisAttempts--;throw e;}c.synthesisError=e.message;if(c.synthesisAttempts<3)throw e;c.synthesis={version:1,findings:[],missingEvidence:[],limitation:'Cross-document explanation could not be validated. Individual original quotations remain available; current authority has not been established.'};}
    }
    status='complete_with_gaps';phase='finished';
   }
  }
  if(c.aiPause&&Date.parse(c.aiPause.until)>Date.now()&&!runnableSources(c)){status='retry_wait';phase='budget_pause';delaySeconds=Math.max(1,Math.ceil((Date.parse(c.aiPause.until)-Date.now())/1000));}
  else if(c.aiPause&&Date.parse(c.aiPause.until)<=Date.now())delete c.aiPause;
  c.errors=[];
 }catch(e){
  c.errors.push({at:new Date().toISOString(),message:e.message});status='retry_wait';phase='retry';
  delaySeconds=e.status===429?3600:300;
  if(e.code==='AI_BUDGET_PAUSED'){c.aiPause={until:e.retryAt,reason:e.message};phase='budget_pause';delaySeconds=Math.max(1,Math.ceil((Date.parse(e.retryAt)-Date.now())/1000));if(c.state&&runnableSources(c)){status='queued';phase='discover';delaySeconds=0;}}
  if(e.code==='INTERPRETATION_TOO_LARGE'&&(c.interpretChunkSize||60000)>12000){c.interpretChunkSize=Math.max(12000,Math.floor((c.interpretChunkSize||60000)/2));status='queued';phase='interpret_retry';delaySeconds=0;}
 }
 finally{fs.rmSync(dir,{recursive:true,force:true});}
 c.inFlight=null;
 if(c.state&&c.profile)D.summarize(c.state,c.profile);
 const result=publicResult(c,status);
 await S.rpc('save',{id:job.id,lease:job.lease,checkpoint:c,result,status,phase,delaySeconds});
 return {id:job.id,status,phase,pending:result.coverage.pending,interpreted:c.interpretations.length,requirements:c.interpretations.reduce((n,d)=>n+d.requirements.length,0)};
}
async function status(county,parcelId){const job=await S.rpc('status',{county,parcelId});if(!job)return null;const fallback=require('./research-outcomes').evaluate(require('./research-plans').unconfigured(county,parcelId),{});return {investigation:fallback,...job.result,county,parcelId,automation:{id:job.id,status:job.status,phase:job.phase,createdAt:job.createdAt,updatedAt:job.updatedAt},status:job.status};}
module.exports={enqueue,tick,status,publicResult,admitDocumentLeads,scopedReference,retireUnscopedNoticeLeads};
