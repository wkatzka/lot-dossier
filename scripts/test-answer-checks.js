/* Regression checks: incorrect answers must be rejected for the specific contradiction they
   contain, and the corrected statement must pass. Synthetic originals mirror the failure modes
   seen in production (recorded identifiers, recording vs execution dates, unsigned copies,
   stage conflation, role erasure, mis-classified next actions). */
const assert=require('node:assert/strict'),S=require('../lib/investigation-synthesis'),AC=require('../lib/answer-checks'),R=require('../lib/recording-stamp');
const h=c=>c.repeat(64);
const decl={sha256:h('d'),source:'https://example.org/ridge-declaration.pdf',documentTitle:'Amended and Restated Declaration for Example Ridge Homeowners Association',documentStatus:'not_established',
 requirements:[{sha256:h('d'),source:'https://example.org/ridge-declaration.pdf',page:31,quote:'construction of any new Dwelling may not be commenced unless and until the builder has first obtained the Board’s written approval of the plans',authority:'Board',stage:'construction'}],
 supportingEvidence:[{kind:'execution_status',sha256:h('d'),source:'https://example.org/ridge-declaration.pdf',page:78,quote:'executed by its duly authorized officers on the ____day of'}]};
const first={sha256:h('f'),source:'https://example.org/2022-first-amendment.pdf',documentTitle:'First Amendment to Amended and Restated Declaration for Example Ridge Homeowners Association',documentStatus:'recording_or_adoption_identified',requirements:[],
 supportingEvidence:[{kind:'property_scope',sha256:h('f'),source:'https://example.org/2022-first-amendment.pdf',page:6,quote:'All of Lots 46 through 68'},{kind:'execution_status',sha256:h('f'),source:'https://example.org/2022-first-amendment.pdf',page:8,quote:'this 15 day of March 2023'}]};
const term={sha256:h('t'),source:'https://example.org/termination.pdf',documentTitle:'Termination of Declarant Rights Under Master Declaration for Wolf Creek Resort',documentStatus:'not_established',requirements:[],
 authorityChanges:[{sha256:h('t'),source:'https://example.org/termination.pdf',page:2,quote:'Declarant hereby voluntarily and irrevocably terminates',kind:'termination'}]};
const guide={sha256:h('g'),source:'https://example.org/guidelines.pdf',documentTitle:'Master Design Review Board Guidelines',documentStatus:'not_established',
 requirements:[{sha256:h('g'),source:'https://example.org/guidelines.pdf',page:7,quote:'plans must be approved by the DRB prior to submittal to the County',authority:'Design Review Board',stage:'submission'}]};
const interpretations=[decl,first,term,guide];
const inventories={[h('d')]:{entries:[],recording:null},[h('f')]:{entries:[],recording:{entry:'3277834',page:1,quote:'E# 3277834 PG 1 OF 8',recordedOn:'2023-03-28',dateQuote:'28-MAR-23',dateMethod:'stamp_region_ocr'}},
 [h('t')]:{entries:[],recording:{entry:'2628422',page:1,quote:'E# 2628422 PG 1 OF 15',recordedOn:'2013-04-03',dateQuote:'03-Apr-13',dateMethod:'stamp_region_ocr'}},[h('g')]:{entries:[],recording:null}};
const items=S.evidence(interpretations,inventories),ctx=AC.context(items,interpretations,inventories,[]);
const id=(sha,type,page)=>items.find(x=>x.sha256===sha&&x.type===type&&(page==null||x.page===page)).id;
const board=id(h('d'),'requirement'),drb=id(h('g'),'requirement'),faDate=id(h('f'),'recording_date'),tDate=id(h('t'),'recording_date'),exec=id(h('d'),'execution_status');
assert(items.some(x=>x.type==='recording_receipt'&&x.entry==='2628422'),'Recorded identifiers are citable evidence');
const good=()=>({answer:{approver:'The unsigned online Example Ridge declaration says the association Board approves plans for a new dwelling.',when:'Before construction starts; the copy does not tie it to permit submission.',uncertainty:'Whether the recorded declaration matches the unsigned copy.',nextActionIndex:0,evidenceIds:[board]},
 findings:[{text:'The unsigned online copy of the Example Ridge declaration says the Board must approve plans before construction of a new dwelling is commenced. If the master guidelines apply, the DRB reviews plans before submittal to the County.',limitations:'The copy has a blank execution date and no recording stamp. No current ACC appointees are shown.',evidenceIds:[board,drb,exec]},
  {text:'The First Amendment was recorded March 28, 2023 as Entry 3277834 and refers to the Declaration recorded December 17, 2018. The Termination of Declarant Rights was recorded April 3, 2013 as Entry 2628422.',limitations:'A cited entry number does not prove the online copy matches the recorded declaration.',evidenceIds:[faDate,tDate]}],
 missingEvidence:[{document:'Recorded Example Ridge declaration, Entry 2957404',question:'Does the recorded instrument contain the same Board approval clause as the unsigned copy?',dependency:'copy_recovered_equivalence_unverified',action:'Pull Entry 2957404 from the county recorder and compare section 6.4.',evidenceIds:[board,exec]},
  {document:'Master DRB appointment resolution',question:'Who currently serves on the master DRB after the 2013 termination?',dependency:'current_appointment_or_amendment_unverified',action:'Ask the master association for its DRB appointment record.',evidenceIds:[drb]}]});
const problems=d=>AC.check(d,ctx);
assert.deepEqual(problems(good()),[],'The corrected answer passes');
function rejects(mutate,pattern,label){const d=good();mutate(d);const p=problems(d);assert(p.some(x=>pattern.test(x)),label+' should be rejected; got '+JSON.stringify(p));}
// Recovered recording identifiers.
rejects(d=>d.findings[1].limitations="The Termination's recording entry is not shown in the excerpts.",/Entry 2628422\b.*on the retrieved original/,'Calling a recovered entry number missing');
rejects(d=>d.missingEvidence.push({document:'Recorded copy of the 2013 Termination of Declarant Rights',question:'When was it recorded?',dependency:'not_retrieved',action:'Obtain the termination with its recording stamp and entry number from the recorder.',evidenceIds:[tDate]}),/already recovered/,'Requesting an identifier already recovered');
rejects(d=>d.missingEvidence.push({document:'Termination Entry 2628422',question:'Is it recorded?',dependency:'not_retrieved',action:'Search for Entry 2628422.',evidenceIds:[tDate]}),/not retrieved, but that recorded original/,'Classifying a retrieved recorded original as not retrieved');
rejects(d=>d.findings[1].limitations='The First Amendment recording date is unclear.',/Entry 3277834.*on the retrieved original/,'Calling a recovered recording date unclear');
// Recording versus execution or filename dates.
rejects(d=>d.findings[1].text='The First Amendment was recorded on March 15, 2023 as Entry 3277834.',/recording date.*28-MAR-23/,'Using the acknowledgment date as the recording date');
rejects(d=>d.findings[1].text='The First Amendment was recorded in 2022.',/recording date.*28-MAR-23/,'Using the filename year as the recording date');
rejects(d=>d.findings[1].text='The Termination of Declarant Rights was recorded as of March 2013.',/recording date.*03-Apr-13/,'Using the "made as of" date as the recording date');
// Unsigned-copy limitations and enforceability.
rejects(d=>{d.findings[0].limitations='No current ACC appointees are shown.';d.findings[0].text='The Example Ridge declaration requires Board approval before construction of a new dwelling is commenced.';},/does not say so/,'Omitting the unsigned-copy limitation');
rejects(d=>d.findings[0].text+=' The Example Ridge declaration is enforceable against the lot.',/not shown to be executed or recorded/,'Presenting current enforceability as settled');
// Submission, issuance and construction stay distinct.
rejects(d=>d.findings[0].text='The unsigned online copy says the Board must approve plans before the building permit application.',/construction-commencement gate/,'Restating a construction gate as a submission gate');
rejects(d=>d.answer.when='The Board must approve before the permit is issued.',/construction-commencement gate/,'Restating a construction gate as an issuance gate in the short answer');
// Missing names must not erase an institutional role; the qualification stays proportionate.
rejects(d=>d.findings[0].limitations+=' The approver is unknown because no committee members are listed.',/approving body by role/,'Erasing the Board role because members are not named');
// Next-action dependency classification.
rejects(d=>d.missingEvidence[0].dependency='retrieved_unread',/retrieved but unread/,'Claiming an unread original when all were read');
rejects(d=>{d.missingEvidence[1].dependency='copy_recovered_equivalence_unverified';d.missingEvidence[1].evidenceIds=[tDate];},/every cited original bears a recorder stamp/,'Equivalence doubt about a recorded original');
rejects(d=>d.missingEvidence[0].question='',/specific question/,'A next action without its question');
rejects(d=>d.answer.nextActionIndex=7,/select one of the listed next actions/,'A short answer without a real next action');
console.log('PASS: answers that misstate recovered recording identifiers/dates, conflate execution or filename dates, drop unsigned-copy limits, conflate stages, erase institutional roles, or mis-classify next actions are rejected; the corrected answer passes.');
// Recorder-stamp parsing never guesses.
assert.equal(R.strictDate('28-MAR-23 302 PM').iso,'2023-03-28');assert.equal(R.strictDate('26-4AR-23 302 PM'),null,'OCR-garbled months are not repaired by guessing');assert.equal(R.strictDate('31-FEB-23'),null);
const stored=R.detect([{page:1,text:'E# 2628422 PG 10F 15 Work Proper REC FOR: RAY QUINNEY ELECTRONICALLY RECORDED'}]);assert.equal(stored.entry,'2628422');assert.equal(stored.recordedOn,null);
assert.equal(R.confirm(stored,'Ef 2628422 PG 1 OF 15\nERNEST D ROWLEY, WEBER COUNTY RECORDER\n03-Apr-13 0431 PM',85).recordedOn,'2013-04-03');
assert.equal(R.confirm(stored,'E# 2999999 PG 1 OF 3\nWEBER COUNTY RECORDER\n03-Apr-13',85).recordedOn,undefined??null,'A date on a different stamp is not accepted');
assert.equal(R.confirm(stored,'E# 2999999 PG 1 OF 3 03-Apr-13',85).dateStatus,'stamp_date_unreadable');
assert.equal(R.detect([{page:1,text:'When recorded return to: Example Ridge Homeowners Association For recorder\'s use only'}]),null,'A blank recorder box is not a recording');
console.log('PASS: recording dates are accepted only from a strict stamp date on the same stamp as the stored entry number; garbled or mismatched stamps assert nothing.');
