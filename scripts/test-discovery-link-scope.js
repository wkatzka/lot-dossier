const assert=require('node:assert/strict'),D=require('../lib/record-discovery-engine'),S=require('../lib/discovery-link-scope'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
(async()=>{
 assert.equal(S.nonDocumentMedia('https://example-ridge.org/photos/Buck.jpg'),true);
 assert.equal(S.nonDocumentMedia('https://example-ridge.org/scans/declaration-p1.jpg'),false);
 assert.equal(S.nonDocumentMedia('https://example-ridge.org/scan.jpg','Architectural guidelines original'),false);
 assert.equal(S.nonDocumentMedia('https://web.archive.org/cdx/search/cdx?url=https%3A%2F%2Fexample-ridge.org%2Fphotos%2FBuck.jpg'),true);
 const profile={id:'scope',terms:['example','ridge','document'],hosts:['example-ridge.org'],routes:['association_libraries'],seeds:[]},state=D.create(profile),dir=fs.mkdtempSync(path.join(os.tmpdir(),'cp-scope-'));
 try{
 const job=D.add(state,{kind:'page',url:'https://example-ridge.org/',route:'association_libraries',mode:'library',depth:0,maxDepth:2});
 await D.processJob(state,profile,job,dir,{fetch:async url=>({url,status:200,type:'text/html',bytes:Buffer.from('<html><body><a href="/photo-gallery">Photos</a><a href="/photos/Buck.jpg">Neighborhood buck</a><a href="/governing-documents">Governing documents</a><a href="/homeowners-association">Homeowners association</a><a href="/covenants.pdf">CCRs</a></body></html>'),retrievedAt:new Date().toISOString(),response:{url}})});
 assert(!state.jobs.some(j=>j.url.endsWith('/photo-gallery')));assert(!state.jobs.some(j=>j.url.endsWith('/Buck.jpg')));assert(state.jobs.some(j=>j.url.endsWith('/governing-documents')));assert(state.jobs.some(j=>j.url.endsWith('/homeowners-association')));assert(state.jobs.some(j=>j.url.endsWith('/covenants.pdf')));assert(state.discarded.some(x=>x.url.endsWith('/Buck.jpg')));
 console.log('PASS: domain-name matches do not follow arbitrary gallery links; governing documents, HOA navigation and labelled record images remain candidates.');
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1});
