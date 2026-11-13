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
 plan.questions[0].references=(profile.references||[]).map(r=>({...r,verification:{url:r.url,checkedAt:c.target.checkedAt}}));
 const investigation=require('./research-outcomes').evaluate(plan,state);
 return {county:c.target.county,parcelId:c.target.parcelId,checkedAt:new Date().toISOString(),status,
  target:{address:c.target.address,subdivision:c.target.subdivision,lot:c.target.lot,municipality:c.target.municipality,source:c.target.source},
  investigation,interpretations:c.interpretations||[],errors:(c.errors||[]).slice(-5),
  coverage:state.coverage?require('./discovery-metadata').publicCoverage(state.coverage):{routes:[],documents:0,unreadDocuments:0},documents:(state.documents||[]).map(d=>({sha256:d.sha256,urls:d.urls,pages:d.pages,unreadPages:d.unreadPages||[]})),
  limitation:'Automatic public-source investigation. Source-supported interpretations retain their applicability and amendment limits; no approval or exemption is inferred.'};
}
async function tick(){
 const job=await S.rpc('claim');if(!job)return {idle:true};const c=job.checkpoint,started=Date.now(),dir=fs.mkdtempSync(path.join(os.tmpdir(),'cp-investigation-'));
 let status='queued',phase='discover',delaySeconds=0;
 try{
  if(!c.profile){c.profile=await P.profile(c.target);c.state=D.create(c.profile);c.state.externalLeads.push(...c.profile.initialLeads);}
  fs.mkdirSync(path.join(dir,'readings'),{recursive:true});
  for(const [hash,reading] of Object.entries(c.pageTexts||{}))fs.writeFileSync(path.join(dir,'readings',hash+'.json'),JSON.stringify(reading));
  fs.writeFileSync(path.join(dir,'manifest.json'),JSON.stringify(c.state));
  let count=0;
  do{
   c.state=await D.run(c.profile,dir,{maxJobs:1,ocrConcurrency:1,readPdf:require('./discovery-native-reader').read,ocr:(bytes,page)=>require('./original-reader').execute(bytes,page,1)});
   count++;
  }while(c.state.coverage.pending&&Date.now()-started<45000&&count<12);
  for(const name of fs.readdirSync(path.join(dir,'readings'))){const value=JSON.parse(fs.readFileSync(path.join(dir,'readings',name)));if(!c.interpreted[value.sha256])c.pageTexts[value.sha256]=value;}
  const candidate=c.state.documents.find(d=>!d.readError&&!d.unreadPages?.length&&c.pageTexts[d.sha256]&&!c.interpreted[d.sha256]);
  if(candidate&&Date.now()-started<80000){
   phase='interpret';const pages=c.pageTexts[candidate.sha256].pages;
   const done=c.interpretations.filter(x=>x.sha256===candidate.sha256).flatMap(x=>x.pagesRead),remaining=pages.filter(p=>!done.includes(p.page));
   const batch=[];let size=0;for(const p of remaining){if(size+p.text.length>120000&&batch.length)break;batch.push({page:p.page,text:p.text});size+=p.text.length;}
   if(batch.length){
    if(batch.every(p=>!/(approv|architect|covenant|declaration|permit|review committee|design review)/i.test(p.text))){c.interpretations.push({sha256:candidate.sha256,source:candidate.urls[0],documentTitle:'Public original',documentStatus:'not_established',requirements:[],missingDocuments:[],rejected:[],pagesRead:batch.map(p=>p.page),summary:'No approval-related language detected in these machine-read pages; this is not an exemption finding.',method:'text screening'});}
    else c.interpretations.push(await I.interpret(batch,c.target,candidate));
   }
   const read=new Set(c.interpretations.filter(x=>x.sha256===candidate.sha256).flatMap(x=>x.pagesRead));
   if(pages.every(p=>read.has(p.page))){c.interpreted[candidate.sha256]=true;delete c.pageTexts[candidate.sha256];}
   // Recording references are new search work, not merely a note for the user.
   for(const ref of c.interpretations.flatMap(x=>x.missingDocuments||[])){
    const ids=String(ref.identifier).match(/\b\d{6,9}\b/g)||[];
    for(const term of ids){
     D.add(c.state,{kind:'nextrequest',url:'https://webercountyut.nextrequest.com',resource:'documents',route:'released_records_archive',term,page:1});
     D.add(c.state,{kind:'pmn',route:'public_notice_attachments',term,startDate:'2000-01-01',endDate:c.profile.endDate});
    }
   }
  }
  // Never accept an unread or failed source as a completed interpretation.
  D.summarize(c.state,c.profile);
  const waiting=c.state.documents.some(d=>!d.readError&&!d.unreadPages?.length&&!c.interpreted[d.sha256]);
  if(!c.state.coverage.pending&&!waiting){
   const retryable=c.state.jobs.filter(j=>['source_error','search_incomplete','rate_limited','deferred_rate_limit'].includes(j.status)&&(j.autoRetries||0)<3);
   if(retryable.length){for(const j of retryable){j.autoRetries=(j.autoRetries||0)+1;j.status='queued';}status='retry_wait';phase='source_retry';delaySeconds=900;}
   else {status='complete_with_gaps';phase='finished';}
  }
  c.errors=[];
 }catch(e){
  c.errors.push({at:new Date().toISOString(),message:e.message});status='retry_wait';phase='retry';
  delaySeconds=e.status===429?3600:300;
 }
 finally{fs.rmSync(dir,{recursive:true,force:true});}
 const result=publicResult(c,status);
 await S.rpc('save',{id:job.id,lease:job.lease,checkpoint:c,result,status,phase,delaySeconds});
 return {id:job.id,status,phase,pending:result.coverage.pending,interpreted:c.interpretations.length,requirements:c.interpretations.reduce((n,d)=>n+d.requirements.length,0)};
}
async function status(county,parcelId){const job=await S.rpc('status',{county,parcelId});if(!job)return null;const fallback=require('./research-outcomes').evaluate(require('./research-plans').unconfigured(county,parcelId),{});return {investigation:fallback,...job.result,county,parcelId,automation:{id:job.id,status:job.status,phase:job.phase,createdAt:job.createdAt,updatedAt:job.updatedAt},status:job.status};}
module.exports={enqueue,tick,status,publicResult};
