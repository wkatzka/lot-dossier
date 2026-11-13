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
assert(/Who approves.*When.*Still uncertain.*Next step Compare the recorded copy/.test(strip(t1)),'Distilled answer with the selected next step');
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
})().catch(e=>{console.error(e);process.exitCode=1;});
