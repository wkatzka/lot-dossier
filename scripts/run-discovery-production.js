/* Bounded, restartable worker. State is restored/persisted by the Actions artifact workflow. */
const fs=require('node:fs'),path=require('node:path');
const D=require('../lib/record-discovery-engine'),P=require('../lib/discovery-publish');
async function run({root='.discovery-state',minutes=15}={}){
 const deadline=Date.now()+minutes*60000, reports=[];
 fs.mkdirSync(root,{recursive:true});
 const profiles=fs.readdirSync('config/discovery').filter(f=>f.endsWith('.json')).sort();
 for(const filename of profiles){
  const profile=JSON.parse(fs.readFileSync(path.join('config/discovery',filename))),dir=path.join(root,profile.id);
  const profileDeadline=Math.min(deadline,Date.now()+minutes*60000/profiles.length);
  const manifest=path.join(dir,'manifest.json');
  let state=fs.existsSync(manifest)?JSON.parse(fs.readFileSync(manifest)):null;
  // Keep a fixed query interval throughout a resumed run. Refresh only after the previous queue drains.
  const persisted=path.join(dir,'profile.json');
  let active=fs.existsSync(persisted)?JSON.parse(fs.readFileSync(persisted)):profile;
  if(state&&state.coverage.pending===0&&Date.now()-Date.parse(state.startedAt)>7*86400000){
   fs.renameSync(dir,dir+'-previous-'+Date.now());state=null;active=profile;
  }
  if(!state)active={...active,endDate:new Date().toISOString().slice(0,10)};
  fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(persisted,JSON.stringify(active,null,2));
  // One job per checkpoint, with round-robin runs bounded by wall clock. No serverless timeout loses a queue.
  let jobs=0;
  do {
   state=await D.run(active,dir,{maxJobs:1,retry:jobs===0,ocr:require('../lib/discovery-ocr').read});jobs++;
  }while(state.coverage.pending&&Date.now()<profileDeadline);
  if(active.parcelId)P.publish(active,state,'data/title/discovery-index.json');
  const report={id:active.id,scope:active.scope,checkedAt:state.updatedAt,coverage:state.coverage,
   legalApplicabilityEstablished:false,documents:state.documents.map(d=>({sha256:d.sha256,urls:d.urls.filter(u=>!/[?&](?:token|X-Amz-)/i.test(u)),pages:d.pages,unreadPages:d.unreadPages||[],applicability:'unverified'}))};
  reports.push(report);console.log(JSON.stringify({profile:active.id,jobs,pending:state.coverage.pending,documents:state.documents.length}));
  if(Date.now()>=deadline)break;
 }
 const target='data/title/discovery-production.json';
 const old=fs.existsSync(target)?JSON.parse(fs.readFileSync(target)).profiles:[];
 const ids=new Set(reports.map(p=>p.id));
 fs.writeFileSync(target,JSON.stringify({version:1,updatedAt:new Date().toISOString(),runUrl:process.env.GITHUB_RUN_ID?`https://github.com/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`:null,profiles:[...old.filter(p=>!ids.has(p.id)),...reports]},null,2)+'\n');
 return reports;
}
if(require.main===module)run({minutes:Number(process.env.DISCOVERY_MINUTES||15)}).catch(e=>{console.error(e);process.exitCode=1;});
module.exports={run};
