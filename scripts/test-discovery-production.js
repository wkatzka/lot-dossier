const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const D=require('../lib/record-discovery-engine'),{run}=require('./run-discovery-production');
(async()=>{
 const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'cornerpin-production-test-')),cwd=process.cwd(),originalRun=D.run,originalNow=Date.now;let time=1000000,calls=[];
 try{
  fs.mkdirSync(path.join(tmp,'config/discovery'),{recursive:true});fs.mkdirSync(path.join(tmp,'data/title'),{recursive:true});
  for(const id of ['a','b'])fs.writeFileSync(path.join(tmp,'config/discovery',id+'.json'),JSON.stringify({id,county:'Weber',scope:'Synthetic fixture',routes:['public'],hosts:['example.org'],terms:['rule'],seeds:[],...(id==='b'?{parcelId:'000000001'}:{})}));
  fs.writeFileSync(path.join(tmp,'data/title/discovery-production.json'),JSON.stringify({profiles:[{id:'prior-profile',checkedAt:'retained'}]}));
  process.chdir(tmp);Date.now=()=>time;
  D.run=async(profile,dir)=>{calls.push(profile.id);time+=profile.id==='a'?5000:10000;const state=D.create(profile);state.jobs=[{id:'fixture',kind:'page',route:'public',status:profile.id==='a'?'complete':'queued'}];D.summarize(state,profile);fs.writeFileSync(path.join(dir,'manifest.json'),JSON.stringify(state));return state;};
  await assert.rejects(()=>run({minutes:1,profileId:'../../unreviewed'}),/Unknown reviewed/);assert.equal(calls.length,0);
  await run({minutes:1,profileId:'a'});assert.deepEqual(calls,['a']);let published=JSON.parse(fs.readFileSync('data/title/discovery-production.json'));assert(published.profiles.some(p=>p.id==='prior-profile'&&p.checkedAt==='retained'));
  calls=[];time=1000000;await run({minutes:1});assert.equal(calls.filter(id=>id==='a').length,1);assert.equal(calls.filter(id=>id==='b').length,6,'Unused first-profile time must reach the unfinished profile');
  published=JSON.parse(fs.readFileSync('data/title/discovery-production.json'));assert.equal(published.profiles.find(p=>p.id==='b').coverage.pending,1);assert(published.profiles.some(p=>p.id==='prior-profile'));assert.equal(JSON.parse(fs.readFileSync('data/title/discovery-index.json')).records[0].parcelId,'000000001');
  console.log('PASS: focused reviewed-profile execution, rejection of unknown profiles, preserved prior reports, exact-parcel publication, and redistribution of unused worker time.');
 }finally{D.run=originalRun;Date.now=originalNow;process.chdir(cwd);fs.rmSync(tmp,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1;});
