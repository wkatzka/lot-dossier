/* Bounded, restartable worker. State is restored/persisted by the Actions artifact workflow. */
const fs=require('node:fs'),path=require('node:path');
const D=require('../lib/record-discovery-engine'),P=require('../lib/discovery-publish'),M=require('../lib/discovery-metadata');
function extendProfile(state,active,profile){
 const rest=p=>JSON.stringify({...p,endDate:undefined,hosts:undefined,seeds:undefined});
 const subset=(a,b)=>(a||[]).every(x=>(b||[]).some(y=>JSON.stringify(x)===JSON.stringify(y)));
 if(rest(active)!==rest(profile)||!subset(active.hosts,profile.hosts)||!subset(active.seeds,profile.seeds))return null;
 const next={...profile,endDate:active.endDate};
 const nextHash=D.create(next).profileHash;
 if(nextHash!==state.profileHash){
  (state.profileRevisions||=[]).push({previousHash:state.profileHash,nextHash,checkedAt:new Date().toISOString(),reason:'Additive reviewed hosts/seeds; existing results retained; new seeds are queued by the engine.'});
  state.profileHash=nextHash;
 }
 return next;
}
async function run({root='.discovery-state',minutes=15,profileId=''}={}){
 if(!Number.isFinite(minutes)||minutes<1||minutes>20)throw Error('Worker time must be 1–20 minutes');
 const deadline=Date.now()+minutes*60000, reports=[];
 fs.mkdirSync(root,{recursive:true});
 const profiles=fs.readdirSync('config/discovery').filter(f=>f.endsWith('.json')&&(!profileId||JSON.parse(fs.readFileSync(path.join('config/discovery',f))).id===profileId)).sort();
 if(!profiles.length)throw Error('Unknown reviewed discovery profile');
 for(const [profileIndex,filename] of profiles.entries()){
  const profile=JSON.parse(fs.readFileSync(path.join('config/discovery',filename))),dir=path.join(root,profile.id);
  const profileDeadline=Math.min(deadline,Date.now()+Math.max(0,deadline-Date.now())/(profiles.length-profileIndex));
  const manifest=path.join(dir,'manifest.json');
  let state=fs.existsSync(manifest)?JSON.parse(fs.readFileSync(manifest)):null;
  // Keep a fixed query interval throughout a resumed run. Refresh only after the previous queue drains.
  const persisted=path.join(dir,'profile.json');
  let active=fs.existsSync(persisted)?JSON.parse(fs.readFileSync(persisted)):profile;
  const signature=p=>JSON.stringify({...p,endDate:undefined});
  if(state&&signature(active)!==signature(profile)){
   const extended=extendProfile(state,active,profile);
   if(extended){active=extended;fs.writeFileSync(manifest,JSON.stringify(state));}
  }
  if(state&&(signature(active)!==signature(profile)||(state.coverage.pending===0&&Date.now()-Date.parse(state.startedAt)>7*86400000))){
   // The preceding Actions artifact retains older cycles; bound the active checkpoint to two cycles.
   fs.rmSync(dir+'-previous',{recursive:true,force:true});
   fs.renameSync(dir,dir+'-previous');state=null;active=profile;
  }
  if(!state)active={...active,endDate:new Date().toISOString().slice(0,10)};
  fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(persisted,JSON.stringify(active,null,2));
  // One job per checkpoint, with round-robin runs bounded by wall clock. No serverless timeout loses a queue.
  let jobs=0;
  do {
   state=await D.run(active,dir,{maxJobs:4,ocrConcurrency:4,retry:jobs===0,ocr:require('../lib/discovery-ocr').read,readPdf:require('../lib/discovery-native-reader').read});jobs++;
   if(jobs%10===0)console.log(JSON.stringify({profile:active.id,checkpoint:jobs,pending:state.coverage.pending}));
  }while(state.coverage.pending&&Date.now()<profileDeadline);
  if(active.parcelId)P.publish(active,state,'data/title/discovery-index.json');
  const report={id:active.id,scope:active.scope,checkedAt:state.updatedAt,coverage:M.publicCoverage(state.coverage),investigation:state.investigation,
   legalApplicabilityEstablished:false,documents:state.documents.map(d=>({sha256:d.sha256,urls:d.urls.filter(M.stableUrl),pages:d.pages,unreadPages:d.unreadPages||[],applicability:'unverified'}))};
  reports.push(report);console.log(JSON.stringify({profile:active.id,jobs,pending:state.coverage.pending,documents:state.documents.length}));
  if(Date.now()>=deadline)break;
 }
 const target='data/title/discovery-production.json';
 const old=fs.existsSync(target)?JSON.parse(fs.readFileSync(target)).profiles:[];
 const ids=new Set(reports.map(p=>p.id));
 fs.writeFileSync(target,JSON.stringify({version:1,updatedAt:new Date().toISOString(),runUrl:process.env.GITHUB_RUN_ID?`https://github.com/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`:null,profiles:[...old.filter(p=>!ids.has(p.id)),...reports]},null,2)+'\n');
 return reports;
}
if(require.main===module)run({minutes:Number(process.env.DISCOVERY_MINUTES||15),profileId:process.env.DISCOVERY_PROFILE||''}).catch(e=>{console.error(e);process.exitCode=1;});
module.exports={run,extendProfile};
