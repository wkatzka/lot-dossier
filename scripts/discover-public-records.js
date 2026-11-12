const fs=require('node:fs'),path=require('node:path'),D=require('../lib/record-discovery-engine');
(async()=>{
 const [profileFile,output,limit]=process.argv.slice(2).filter(v=>v!=='--retry');
 if(!profileFile||!output)throw Error('Usage: node scripts/discover-public-records.js <profile.json> <output-directory> [jobs-this-run]');
 const profile=JSON.parse(fs.readFileSync(profileFile));
 const maxJobs=limit===undefined?Infinity:Number(limit);if(!(maxJobs>0))throw Error('Positive job limit required');
 const result=await D.run(profile,path.resolve(output),{maxJobs,retry:process.argv.includes('--retry'),ocr:require('../lib/discovery-ocr').read,onProgress:(j,s)=>console.log(JSON.stringify({route:j.route,kind:j.kind,url:j.url||j.term,status:j.status,remaining:s.coverage.pending,documents:s.documents.length,error:j.error}))});
 console.log(JSON.stringify(result.coverage));
 if(process.env.CORNERPIN_DISCOVERY_INDEX)require('../lib/discovery-publish').publish(profile,result,path.resolve(process.env.CORNERPIN_DISCOVERY_INDEX));
 if(!result.coverage.publicRouteChecksComplete)process.exitCode=2;
})().catch(e=>{console.error(e);process.exitCode=1;});
