const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{execFileSync}=require('node:child_process');
const D=require('../lib/record-discovery-engine'),M=require('../lib/discovery-metadata');
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'cornerpin-checkpoint-test-'));
try{
 const profile={id:'public-fixture',scope:'Synthetic public fixture',routes:['library'],hosts:['example.org'],terms:['rule'],seeds:[]};
 const state=D.create(profile),dir=path.join(tmp,'state',profile.id);fs.mkdirSync(dir,{recursive:true});
 const url='https://example.org/public.pdf?signature=SECRET_SIGNATURE&credential=SECRET_CREDENTIAL&token=SECRET_TOKEN&edition=2';
 assert.equal(M.stableUrl(url),false);assert(!/SECRET_|RAW_/.test(JSON.stringify(M.publicCoverage({routes:[{unresolved:[{id:'x',url,status:'source_error',error:'RAW_ERROR_BODY'}]}]}))));
 const job=D.add(state,{kind:'page',url,route:'library'});Object.assign(job,{status:'source_error',textExcerpt:'RAW_EXTRACT',error:'RAW_ERROR_BODY'});
 state.documents=[{sha256:'a'.repeat(64),kind:'pdf',file:'blobs/'+'a'.repeat(64)+'.pdf',route:'library',urls:[url],pages:1,unreadPages:[],matches:[{page:1,terms:['rule'],snippets:['RAW_EXTRACT']}]}];
 state.queries=[{raw:'RAW_QUERY_BODY'}];state.discarded=[{text:'RAW_DISCARDED_BODY'}];
 fs.writeFileSync(path.join(dir,'profile.json'),JSON.stringify(profile));fs.writeFileSync(path.join(dir,'manifest.json'),JSON.stringify(state));fs.mkdirSync(path.join(dir,'blobs'));fs.writeFileSync(path.join(dir,'blobs','private-byte-fixture'),'RAW_BLOB');
 execFileSync(process.execPath,[path.resolve(__dirname,'compact-discovery-checkpoint.js'),path.join(tmp,'state')],{cwd:tmp});
 const published=fs.readFileSync(path.join(tmp,'.discovery-metadata',profile.id,'manifest.json'),'utf8'),result=JSON.parse(published);
 assert(!/RAW_|SECRET_/.test(published));assert.equal(result.documents[0].urls[0],'https://example.org/public.pdf?edition=2');assert.equal(result.documents[0].sha256,'a'.repeat(64));assert.equal(result.coverage.publicRouteChecksComplete,false);assert.equal(result.jobs[0].status,'source_error');assert(!fs.existsSync(path.join(tmp,'.discovery-metadata',profile.id,'blobs')));
 console.log('PASS: hosted checkpoint retains hashes and unresolved work but excludes bytes, extracted text, response bodies and signed-query secrets, including task keys.');
 const {restore}=require('./restore-discovery-baseline'),baseline=path.join(tmp,'.discovery-metadata'),restored=path.join(tmp,'restore');
 assert.deepEqual(restore(restored,baseline),[profile.id]);
 const file=path.join(restored,profile.id,'manifest.json'),latest=JSON.parse(fs.readFileSync(file));latest.updatedAt='2099-01-01T00:00:00Z';fs.writeFileSync(file,JSON.stringify(latest));
 assert.deepEqual(restore(restored,baseline),[],'A baseline cannot overwrite newer scheduled progress');
}finally{fs.rmSync(tmp,{recursive:true,force:true});}
