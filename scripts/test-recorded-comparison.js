/* Upload-and-compare: a supplied recorded copy is checked for its recorder stamp and compared with
   the retrieved copy section by section. OCR spacing and dropped section-number dots must not cause
   false differences; a single material word change must. Nothing records an approval. */
const assert=require('node:assert/strict'),K=require('../lib/recorded-comparison');
const filler=' The Owner shall keep the Lot in good repair and comply with the Governing Documents.'.repeat(4);
// Retrieved copy: native text with broken words and spaced section numbers, as public PDFs often have.
const retrieved=[{page:1,text:'TABLE OF CONTENTS\n6 .4 Dwellings . . . . . . . . . . 24'},
 {page:30,text:'6 .3   Architectural Control Committee\nThe ACC shall consist of three (3) members appointed by the Board.'+filler+'\nPage 23 of 71'},
 {page:31,text:'Page 24 of 71\n6 .4   Dwellings / Owner Improvements/Amenities\nconstruction of a ny new Dwelling may not be commenced unless and until the builder has first obtained the Board’s written approval of the plans and specifications.'+filler+'\n6 .5   Common Area / Common Improvements\nNo changes may be made to the Common Area without the Board’s prior written approval.'}];
// Supplied recorded scan: OCR drops the section-number dot, different page numbers, recorder footer.
const scan=t=>[{page:1,text:'E# 2957404 PG 1 OF 103\nWEBER COUNTY RECORDER\n17-DEC-18 1015 AM'},
 {page:33,text:'63 Architectural Control Committee\nThe ACC shall consist of three (3) members appointed by the Board.'+filler+'\nE# 2957404 PG 33 OF 103'},
 {page:34,text:'64 Dwellings / Owner Improvements/Amenities\n'+t+filler+'\n65 Common Area / Common Improvements\nNo changes may be made to the Common Area without the Board’s prior written approval.'}];
const clause='construction of any new Dwelling may not be commenced unless and until the builder has first obtained the Board’s written approval of the plans and specifications.';
const stamp={entry:'2957404',quote:'E# 2957404 PG 1 OF 103',recordedOn:'2018-12-17'};
let r=K.result({reference:retrieved,uploadPages:scan(clause),sections:['6.3','6.4'],entry:'2957404',stamp});
assert.equal(r.overall,'recorded_copy_matches',JSON.stringify(r.sections));assert.deepEqual(r.sections.map(s=>[s.retrievedPage,s.suppliedPage]),[[30,33],[31,34]],'Sections are found by number and title, not by page, and the TOC is skipped');
assert(!r.sections[1].differences.length,'Spacing, broken words, page headers and recorder footers are not differences');
r=K.result({reference:retrieved,uploadPages:scan(clause.replace('the Board’s','the ACC’s')),sections:['6.4'],entry:'2957404',stamp});
assert.equal(r.overall,'recorded_copy_needs_review','A one-word change of approving body is flagged despite near-identical text');
assert(r.sections[0].ratio>0.97&&r.sections[0].material.some(m=>m.term==='board'));assert(/Board’s written/.test(r.sections[0].differences[0].retrieved)&&/ACC’s written/.test(r.sections[0].differences[0].supplied),'The differing wording is shown');
r=K.result({reference:retrieved,uploadPages:scan(clause.replace('may not be','may be')),sections:['6.4'],entry:'2957404',stamp});assert.equal(r.overall,'recorded_copy_needs_review','A dropped negation is flagged');
r=K.result({reference:retrieved,uploadPages:scan('This section is reserved.'),sections:['6.4'],entry:'2957404',stamp});assert.equal(r.overall,'recorded_copy_differs');
assert.equal(K.result({reference:retrieved,uploadPages:scan(clause),sections:['6.4'],entry:'2957404',stamp:{...stamp,entry:'3277834'}}).overall,'different_entry','A different recording is not the requested instrument');
assert.equal(K.result({reference:retrieved,uploadPages:scan(clause),sections:['6.4'],entry:'2957404',stamp:null}).overall,'no_recorder_stamp','An unstamped copy is not shown to be recorded');
assert.equal(K.result({reference:retrieved,uploadPages:[{page:1,text:'E# 2957404 PG 1 OF 3'}],sections:['6.4'],entry:'2957404',stamp}).overall,'sections_not_found');
assert(/does not establish/.test(r.limitation),'Every result states its limits');
console.log('PASS: section comparison tolerates OCR spacing, dropped section dots, page furniture and repagination, and flags changed approving bodies, dropped negations, wrong entries and unstamped copies.');

// Server handler with fake storage, reading cache and page reader.
(async()=>{
 const H=require('../lib/recorded-comparison-handler'),C=require('../lib/cloud-projects'),crypto=require('node:crypto');
 const bytes=Buffer.from('%PDF-1.7 recorded copy'),hash=crypto.createHash('sha256').update(bytes).digest('hex'),ref='a'.repeat(64);
 const record={property:{parcelId:'222320023'},documents:[{id:'cp-doc1',name:'Entry-2957404.pdf',hash,family:'entry-2957404',version:1}]};
 C.config=()=>({configured:true,url:'https://db.example.supabase.co',key:'k'});C.user=async t=>{if(t!=='good')throw Error('Sign in required');return {id:'owner1'};};
 const calls=[];global.fetch=async(url,o={})=>{calls.push([o.method||'GET',url.replace('https://db.example.supabase.co','')]);
  if(url.includes('/rest/v1/cornerpin_projects'))return {ok:true,json:async()=>[{record}]};
  if(url.includes('_comparisons/'))return o.method==='POST'?{ok:true}:{ok:false,status:404};
  if(url.endsWith('/cp-doc1/'+hash))return {ok:true,arrayBuffer:async()=>bytes};throw Error('unexpected '+url);};
 const pages=Object.fromEntries(scan(clause).map(p=>[p.page,p]));const read=[];
 const execute=async(b,start,n)=>{read.push([start,n]);return {totalPages:103,pages:Array.from({length:n},(_,i)=>pages[start+i]||{page:start+i,text:'Other provisions.'})};};
 const res=()=>{const r={status:0,body:null,setHeader(){},};return r;};const send=require('../lib/respond');
 const reply=async(body,token='good')=>{let out;const fake={statusCode:200,setHeader(){},end(t){out=JSON.parse(t);},writeHead(s){this.statusCode=s;}};
  await H({method:'POST',headers:{authorization:'Bearer '+token},body},fake,{rpc:async(a,p)=>{assert.equal(a,'reading_get');assert.equal(p.sha256,ref);return {pages:retrieved};},execute,reread:async()=>({text:'',confidence:0})});return {status:fake.statusCode,out};};
 const body={projectId:'cp-p1',documentId:'cp-doc1',referenceSha:ref,entry:'2957404',sections:['6.3','6.4']};
 let x=await reply(body);assert.equal(x.status,200,JSON.stringify(x.out));assert.equal(x.out.overall,'recorded_copy_matches');assert.equal(x.out.stamp.entry,'2957404');
 assert(read[0][0]===1&&read.every(([s])=>s<=40),'Reads page 1 then a bounded window, not the whole document');assert(calls.some(([m,u])=>m==='POST'&&u.includes('_comparisons/')),'Result cached in private storage');
 assert.equal((await reply(body,'bad')).status,401,'Requires the signed-in owner');
 assert.equal((await reply({...body,entry:'abc'})).status,400);assert.equal((await reply({...body,documentId:'cp-other'})).status,404,'Only documents in this saved project');
 console.log('PASS: comparison API requires the owner, uses only saved project documents, reads a bounded page window, caches privately and makes no AI call.');

 // Workflow: evidence only, never an approval or decision.
 const W=require('../web/permit-workflow');const p=W.create({parcel:{county:'Weber',id:'222320023',attrs:{PARCEL_ADD:'3459 N WIND RIVER CT'}},date:'2026-11-13',facts:{jurisdiction:'Ogden Valley City',packet:{items:[{title:'Structural plans',status:'ready'}],rows:[]}}});
 if(p){const withDoc=W.apply(p,{type:'document',document:{id:'cp-doc1',name:'Entry-2957404.pdf',hash,family:'entry-2957404',role:'recorded_instrument'}});
  const before=JSON.stringify([withDoc.requirements,withDoc.siteReviews,withDoc.application.ruleReviews||null]);
  const after=W.apply(withDoc,{type:'recorded_comparison',result:{...x.out,documentId:'cp-doc1',documentHash:hash}});
  assert.equal(after.application.recordedComparisons.length,1);assert.equal(JSON.stringify([after.requirements,after.siteReviews,after.application.ruleReviews||null]),before,'No requirement, site decision or rule review changes');
  assert.throws(()=>W.apply(withDoc,{type:'recorded_comparison',result:{...x.out,documentId:'cp-doc1',documentHash:'b'.repeat(64)}}),'A changed document cannot carry an old comparison');
  console.log('PASS: the comparison is stored as evidence on the project and changes no approval, requirement or site decision.');}
 else console.log('NOTE: PermitWorkflow.create unavailable; workflow command covered by test-answer-card.');
})().catch(e=>{console.error(e);process.exitCode=1;});
