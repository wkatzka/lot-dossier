/* The project answer leads with distilled bits (sources as citations); falls back to the most
   relevant originals when nothing was distilled, and to organisations/websites when nothing was
   found. Details are folded only beneath a distilled answer. Overview shows the same card. */
const assert=require('node:assert/strict'),{JSDOM}=require('jsdom');
const dom=new JSDOM('<!doctype html><body></body>',{url:'https://lot-dossier-assistant.vercel.app/platform.html'});global.window=dom.window;global.document=dom.window.document;
const V=require('../web/title-research-view');
const strip=h=>h.replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim();
const refs=[{url:'https://county.example/recorder',label:'County Recorder',purpose:'Recorded declarations for this parcel.',verifiedAt:'2026-11-13T01:37:02Z',verificationUrl:'https://county.example/recorder'},{url:'https://hoa.example/',label:'Click here for Example Ridge HOA website',purpose:'Neighborhood governing documents.',verifiedAt:'2026-11-13T01:37:02Z',verificationUrl:'https://hoa.example/'}];
const base={county:'Weber',parcelId:'222320023',automation:{status:'complete_with_gaps',updatedAt:'2026-11-13T16:22:00Z'},investigation:{questions:[{question:'Who must approve the plans?',status:'investigation_incomplete',instrument:'Declaration',nextAction:'x',references:refs,routes:[],pendingChecks:0,unreadDocuments:0,openLeads:0,unresolvedCandidates:0}],limitation:'L'},interpretations:[],coverage:{routes:[]}};
const distilled={...base,interpretations:[{source:'https://e.org/decl.pdf',documentTitle:'Example Declaration (pages 20-40)',requirements:[{page:31,source:'https://e.org/decl.pdf',quote:'q',authority:'Board',authorityQuote:'Board',stage:'construction'}]}],
 synthesis:{answer:{approver:'The unsigned copy names the Board.',when:'Before construction starts.',uncertainty:'Recorded copy not compared.',nextActionIndex:1,citations:[{source:'https://e.org/decl.pdf',page:31,title:'Example Declaration (pages 20-40)'},{source:'https://e.org/decl.pdf',page:30,title:'Example Declaration'},{source:'https://e.org/amend.pdf',page:1,title:'First Amendment'}]},findings:[{text:'Detail finding.',limitations:'Limit.',citations:[{source:'https://e.org/decl.pdf',page:31,title:'Example Declaration'}]}],missingEvidence:[{document:'A',action:'Do A.',citations:[]},{document:'B',action:'Compare the recorded copy.',citations:[]}],limitation:'L'}};
// Tier 1: distilled answer first, one next step (the selected one), citations grouped per original.
const t1=V.answerCard(distilled);
assert(/Who approves.*When.*Still uncertain.*Next step You: Compare the recorded copy\. Cornerpin: /.test(strip(t1)),'Distilled answer with the selected next step, split into who does what');
assert(!/Do A\./.test(strip(t1)),'Only the single most useful next step is shown in the card');
assert.equal((t1.match(/decl\.pdf#page=/g)||[]).length,2);assert(/Example Declaration — /.test(strip(t1))&&!/pages 20-40/.test(t1),'Citations grouped per document with document-level titles');
const panel1=V.investigationPanel(distilled);assert(panel1.indexOf('Approvals for this lot')<panel1.indexOf('<details'),'Details fold beneath the distilled answer');assert(/<details[^>]*>[\s\S]*Detail finding/.test(panel1),'Detailed findings remain available');
// Tier 2: nothing distilled → the relevant originals are the finding, and nothing is folded away.
const t2={...distilled,synthesis:null};const c2=V.answerCard(t2);
assert(/Approval documents found/.test(strip(c2))&&/decl\.pdf#page=31/.test(c2)&&!/Who approves/.test(c2),'Originals become the main finding');
assert(!V.investigationPanel(t2).includes('<details'),'Without a distilled answer the details are not hidden');
// Tier 3: nothing found → organisations and websites, never invented phone numbers.
const c3=V.answerCard(base);assert(/Who to ask/.test(strip(c3))&&/county\.example\/recorder/.test(c3)&&/Example Ridge HOA website/.test(strip(c3))&&!/Click here/.test(c3),'Organisations and websites are the fallback');
assert(!/\(\d{3}\)\s?\d{3}-\d{4}|@/.test(strip(c3)),'No contact details are invented');
assert(/still running/.test(strip(V.answerCard({...base,automation:{status:'running'}}))),'In-progress research is labelled');
console.log('PASS: answer card tiers — distilled answer with grouped citations and one next step; originals as the finding when nothing is distilled; organisations and websites when nothing is found; details folded only beneath a distilled answer.');
(async()=>{
 const mount=async(data,{rule=true,parcel='222320023'}={})=>{document.body.innerHTML='<div id="overview-answer">Loading</div><section class="cp-next">'+(rule?'<button data-action="open-rule-task">Open</button>':'<button data-action="site">Site</button>')+'</section>';
  global.fetch=async url=>{assert(url.includes('parcelId=222320023'));return {ok:true,json:async()=>data};};
  await V.mountOverviewAnswer({property:{county:'Weber',parcelId:parcel},report:{},receipts:[]});return document.body;};
 let b=await mount(distilled);assert(/Approvals for this lot/.test(b.textContent)&&b.querySelector('[data-action="tab"][data-id="rules"]'),'Overview shows the card with a link to the sources');assert(!b.querySelector('.cp-next'),'The planner approval suggestion is replaced by the distilled answer');
 b=await mount(distilled,{rule:false});assert(b.querySelector('.cp-next'),'Non-approval planner suggestions remain');
 b=await mount({...base,synthesis:null});assert(/Who to ask/.test(b.textContent)&&b.querySelector('.cp-next'),'Fallback tiers do not hide the planner suggestion');
 b=await mount({...distilled,parcelId:'999999999'});assert(!b.querySelector('#overview-answer'),'An answer for a different parcel is never shown');
 console.log('PASS: Overview shows the same tiered answer front and centre, replaces only the approval suggestion it answers, and drops answers for another parcel.');
 // Who does what, and upload-and-compare for "is this the recorded version?" steps.
 const ref='d'.repeat(64),rec={...base,interpretations:[{sha256:ref,source:'https://e.org/decl.pdf',documentTitle:'Example Declaration',documentStatus:'not_established',requirements:[{page:31,source:'https://e.org/decl.pdf'}]}],
  investigation:{...base.investigation,questions:[{...base.investigation.questions[0],references:[{url:'https://county.example/recorder',label:'County Recorder',purpose:'p',verifiedAt:'2026-11-13T00:00:00Z',verificationUrl:'x'},{url:'https://ridge.example/',label:'Click here for Example Ridge neighborhood HOA website',purpose:'p',verifiedAt:'2026-11-13T00:00:00Z',verificationUrl:'x'}]}]},
  synthesis:{answer:{approver:'Board',when:'Before construction',uncertainty:'Recorded copy not compared.',nextActionIndex:0,citations:[]},findings:[],limitation:'L',missingEvidence:[
   {document:'Recorded declaration, Entry No. 2957404',question:'Does §6.4 match?',dependency:'copy_recovered_equivalence_unverified',action:'Compare Sections 6.4 and 5.7.4 with the unsigned copy.',citations:[{sha256:ref,page:31}]},
   {document:'Example Ridge Design Guidelines',question:'What procedure?',dependency:'not_retrieved',action:'Locate the Guidelines.',citations:[{sha256:ref,page:30}]},
   {document:'Master DRB appointments',question:'Who serves on the master DRB?',dependency:'current_appointment_or_amendment_unverified',action:'Ask.',citations:[]}]}};
 const roles=rec.synthesis.missingEvidence.map(m=>strip(V.roles(rec,m,{}).you+' | '+V.roles(rec,m,{}).cornerpin));
 assert(/^Get a copy of .*from County Recorder ?, then upload it here\. \| Checks the recorder stamp/.test(roles[0]),roles[0]);
 assert(/from Example Ridge neighborhood HOA ?and add it under Documents\. \| Keeps it with this project\. It does not yet read/.test(roles[1])&&!/Recorder/.test(roles[1]),'Guidelines come from the named association, not the recorder; Cornerpin does not overclaim');
 assert(/^Ask the association named here/.test(roles[2]),'An unnamed master association is not replaced by the neighborhood HOA');
 assert.deepEqual(V.compareTarget(rec,rec.synthesis.missingEvidence[0]),{entry:'2957404',sections:['6.4','5.7.4'],referenceSha:ref});
 // Upload flow: document saved, synced, compared, result recorded through the workspace commit.
 document.body.innerHTML=V.answerCard(rec,{project:{application:{}}});const input=document.querySelector('input[data-recorded-upload]');assert(input,'Upload offered on the recorded-copy step');
 const commits=[];let proj={id:'cp-p1',documents:[],application:{}};
 window.ProjectWorkspace={project:()=>proj,commit:async(c,f)=>{commits.push([c.type,f?.id||null]);if(c.type==='document')proj={...proj,documents:[...proj.documents,{...c.document}]};}};
 window.PermitWorkflow={id:()=>'cp-doc1'};window.ProjectBackup={hash:async()=>'f'.repeat(64)};window.ProjectSync={enqueue:async()=>commits.push(['sync'])};window.CloudSync={signedIn:()=>true,auth:()=>({Authorization:'Bearer t'})};
 let posted;global.fetch=async(url,o)=>{posted=[url,JSON.parse(o.body)];return {ok:true,json:async()=>({version:'recorded-comparison-1',overall:'recorded_copy_matches',entry:'2957404',referenceSha:ref,documentId:'cp-doc1',documentHash:'f'.repeat(64),sections:[]})};};
 const file=new window.File(['%PDF-1.7'],'Entry-2957404.pdf',{type:'application/pdf'});Object.defineProperty(input,'files',{value:[file]});Object.defineProperty(file,'arrayBuffer',{value:async()=>new ArrayBuffer(8)});
 input.dispatchEvent(new window.Event('change',{bubbles:true}));for(let i=0;i<20&&commits.length<4;i++)await new Promise(r=>setTimeout(r,5));
 assert.deepEqual(commits.map(c=>c[0]),['document','sync','recorded_comparison'],JSON.stringify(commits));assert(/action=recorded-comparison/.test(posted[0])&&posted[1].entry==='2957404'&&posted[1].referenceSha===ref&&posted[1].sections.join()==='6.4,5.7.4');
 // After a match the uncertainty is resolved and the next open step is shown; a material difference is surfaced instead.
 const matched=strip(V.answerCard(rec,{project:{application:{recordedComparisons:[{entry:'2957404',referenceSha:ref,overall:'recorded_copy_matches',filename:'Entry-2957404.pdf',stamp:{entry:'2957404',recordedOn:'2018-12-17'},sections:[],limitation:'Text comparison only.'}]}}}));
 assert(/Recorded copy Your copy Entry-2957404\.pdf matches the retrieved copy/.test(matched)&&/Resolved for the compared sections/.test(matched)&&/Next step You: Get Example Ridge Design Guidelines/.test(matched),matched);
 const differs=strip(V.answerCard(rec,{project:{application:{recordedComparisons:[{entry:'2957404',referenceSha:ref,overall:'recorded_copy_needs_review',filename:'E.pdf',stamp:{entry:'2957404'},sections:[{number:'6.4',status:'review_needed',material:[{term:'board',retrieved:4,supplied:3}],differences:[{retrieved:'the Board’s written',supplied:'the ACC’s written'}]}],limitation:'L'}]}}}));
 assert(/may differ .* material word/.test(differs)&&/Retrieved: “the Board’s written” · Yours: “the ACC’s written”/.test(differs)&&/Still uncertain Recorded copy not compared/.test(differs)&&/Next step You: Get a copy/.test(differs),'A difference keeps the step open and shows the wording');
 console.log('PASS: next steps say what the user does and what Cornerpin does; the recorded-copy upload saves, syncs, compares and records the result, resolving the step on a match and surfacing differing wording otherwise.');
})().catch(e=>{console.error(e);process.exitCode=1;});
