const assert=require('node:assert/strict');
const A=require('../lib/public-record-access'),D=require('../lib/original-discovery'),R=require('../lib/original-reader');
const copy=A.find('Weber','1882728');
assert(copy);assert.equal(A.find('Other','1882728'),null);
assert(D.allowed(copy.url));assert(!D.allowed(copy.url+'?redirect=evil'));
const input={title:{originalRequests:[{entry:'1882728',source:'https://example.org/plat'},{entry:'2624950',source:'https://example.org/plat'},{entry:'3372687',source:'https://example.org/plat'}]}};
const m=D.inventory(input,[]);
assert.equal(m.documents.length,2);assert.equal(m.documents[0].url,copy.url);
assert.equal(m.documents[1].sourceCoverage.completeCopy,false);
assert.equal(m.requests[1].state,'incomplete_public_copy');
assert.equal(m.requests[2].discovery.contactFallbackEligible,false);
assert(!m.requests[2].orderUrl);assert.equal(m.inventoryComplete,false);
const checks=A.ROUTES.map(route=>({route,url:'https://example.org/index',checkedAt:'2026-11-12',basis:'All indexed results reviewed for the exact recording and aliases',status:'searched_no_match',coverageComplete:true}));
assert.equal(A.assessment(checks).contactFallbackEligible,false); // no evidence of a locked door
checks[0].status='access_restricted';
assert.equal(A.assessment(checks).contactFallbackEligible,true);
checks[1].status='error';assert.equal(A.assessment(checks).contactFallbackEligible,false);
checks[1].status='searched_no_match';checks[1].coverageComplete=false;
assert.equal(A.assessment(checks).contactFallbackEligible,false); // pagination/unfinished leads
checks[1].coverageComplete=true;delete checks[0].basis;
assert.equal(A.assessment(checks).contactFallbackEligible,false); // unsupported access claim
(async()=>{
 const {drain}=require('../web/original-documents');
 const linked={documents:[{id:'plat',url:'https://example.org/plat',label:'Recorded plat',state:'queued'}],requests:[]};
 await drain(linked,async url=>({sha256:'a'.repeat(64),totalPages:1,nextPage:null,pages:[{page:1,references:url.endsWith('/plat')?[{entry:'1882728',publicOriginal:{url:copy.url,label:copy.label,sourceCoverage:{completeCopy:true,availablePages:87,recordedPages:87},catalogueSha256:copy.sha256}}]:[]}]}));
 assert.equal(linked.documents.length,2);assert.equal(linked.documents[1].state,'pages_processed');
 assert.equal(linked.requests[0].publicUrl,copy.url);assert.equal(linked.requests[0].orderUrl,undefined);
 assert.equal(linked.inventoryComplete,false); // following an original never establishes complete legal coverage
 await assert.rejects(()=>R.download(copy.url,async()=>new Response('<html>Sign in</html>')),/login/);
 await assert.rejects(()=>R.download(copy.url,async()=>new Response(null,{status:302,headers:{location:'https://example.org/private'}})),/redirect/);
 console.log('Public-record access passed: exact county identity, public covenant discovery, incomplete exhibits, retained unknowns, and no premature contact fallback.');
})().catch(e=>{console.error(e);process.exitCode=1;});
