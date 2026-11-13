/* Whole-document reconciliation: stale chunk-level "not supplied" statements must not survive
   when the same original contains the item, and retrieval must not become applicability. */
const assert=require('node:assert/strict'),INV=require('../lib/document-inventory'),S=require('../lib/investigation-synthesis'),A=require('../lib/automatic-investigation');
const filler=' Owners shall comply with the Governing Documents and all applicable law.'.repeat(12);
const neighborhood={sha256:'n'.repeat(64),pages:[
 {page:1,text:'TABLE OF CONTENTS\nArticle 6 – Aesthetics . . . . . . . . . . . 23\nExhibit “A” . . . . . . . . . . . 70'},
 {page:2,text:'Owner improvements may not be built unless approved as provided under Article 6.\n'+filler},
 {page:3,text:'ARTICLE 6   –   AESTHETICS AND ARCHITECTURAL STANDARDS\n6 .2   Design and Construction   Guidelines\nGuidelines drafted by the Association’s   Architectural Control Committee   (“ ACC ”)   and approved by the Board.\n6 .3   Architectural Control Committee\nThe ACC shall consist of three (3) members appointed by the Board.\n'+filler},
 {page:4,text:'6 .4   Dwellings / Owner Improvements/Amenities\nconstruction of any new Dwelling may not be commenced unless and until the builder has first obtained the Board’s written approval of the plans.\n6 .8   Enforcement/ Fines\nThe Design and Construction Guidelines shall be solely enforced by the Board. The Board may seek recommendations from the ACC.\n'+filler},
 {page:5,text:'As more particularly set forth under\nArticle   8   of this Declaration.\n'+filler},
 {page:6,text:'Exhibit “A”\nAll of Lots 1 through 30, Example Ridge Phase 2, according to the official plat.\n'+filler}]};
const master={sha256:'m'.repeat(64),pages:[
 {page:1,text:'The real property described in Exhibit A is subject to this Declaration.\n'+filler},
 {page:2,text:'Article IV\nArchitecture and Landscaping\nNo activity shall commence until approved by the DRB.\n'+filler},
 {page:3,text:'EXHIBIT A\nLAND INITIALLY SUBMITTED\nPARCEL 1   22-006-0004\nBEGINNING AT A POINT WHICH IS ON THE SOUTH LINE OF SECTION 16; THENCE NORTH 89°27\'02" WEST 1316.85 FEET.\n'+filler},
 {page:4,text:'PARCEL 2   22-006-0015\nTHENCE SOUTH 00°20\'34" WEST ALONG THE SECTION LINE.\n'+filler},
 {page:5,text:'EXHIBIT B\nINITIAL RESTRICTIONS AND RULES\n'+filler},
 {page:6,text:'BY-LAWS\nARTICLE I\nNAME, PRINCIPAL OFFICE\nARTICLE II\nASSOCIATION: MEMBERSHIP\n'+filler},
 {page:7,text:'ARTICLE IV\nOFFICERS\nOfficers of the Association shall be a President.\n'+filler}]};
const target={parcelId:'222320023',subdivision:'Example Ridge At Wolf Creek Prud Ph 02',lot:'68',address:'1 Example Ct',municipality:'Example City'};
const n=INV.build(neighborhood,{target}),m=INV.build(master,{target});
const find=(inv,kind,number)=>inv.entries.find(e=>e.kind===kind&&e.number===number);
assert.equal(find(n,'article','6').page,3,'Substantive Article 6 heading, not the table of contents');
assert(!find(n,'article','8'),'A prose cross-reference such as "Article 8 of this Declaration." is not a heading');
assert.equal(find(n,'section','6.3').acronym,'ACC','Defined committee acronym attaches to its section');
assert.equal(find(n,'exhibit','A').page,6);assert(find(n,'exhibit','A').namesTargetSubdivision);assert(!find(n,'exhibit','A').namesTargetLot,'Lots 1 through 30 does not name lot 68');
const mA=find(m,'exhibit','A');assert.equal(mA.page,3);assert.equal(mA.endPage,4);assert(mA.metesAndBounds);assert.equal(mA.parcelNumbers,2);assert(!mA.namesTargetParcel&&!mA.namesTargetSubdivision,'A recovered master exhibit that does not name the parcel must say so');
assert.equal(find(m,'article','4').title,'Architecture and Landscaping','A bare mixed-case Article heading with a title line is recognized and Roman numerals normalize');
assert.equal(find(m,'article','4').page,2);assert.equal(m.parts.length,2,'Bundled bylaws restart article numbering as a separate part');
assert.equal(INV.locate('Article IV',m,1).page,2,'A declaration reference resolves to the declaration article, not the bylaws article');
assert.equal(INV.locate('Article IV',m,7).page,7,'A bylaws reference resolves within the bylaws');
assert.equal(INV.locate('Article IV',{...m,parts:[]},1),null,'Ambiguous references without part scope stay unresolved');
assert(find(n,'section','6.4').excerpt.includes('Board’s written approval'),'Approval section text is retained for role reconciliation after page text is released');
console.log('PASS: inventory finds substantive articles, sections, defined committees and exhibits; ignores TOC and prose cross-references; records exhibit coverage facts.');

const interpretations=[
 {sha256:master.sha256,source:'https://example.org/master.pdf',documentTitle:'Master Declaration for Wolf Creek Resort',requirements:[{source:'https://example.org/master.pdf',sha256:master.sha256,page:2,quote:'No activity shall commence until approved by the DRB.',authority:'DRB'}],missingDocuments:[{identifier:'Exhibit A',source:'https://example.org/master.pdf',page:1,quote:'The real property described in Exhibit A',description:'Legal description; not supplied.'},{identifier:'Supplemental Declarations',source:'https://example.org/master.pdf',page:1,description:'Not supplied.'}]},
 {sha256:neighborhood.sha256,source:'https://example.org/ridge.pdf',documentTitle:'Declaration for Example Ridge Homeowners Association',requirements:[{source:'https://example.org/ridge.pdf',sha256:neighborhood.sha256,page:4,quote:'construction of any new Dwelling may not be commenced unless and until the builder has first obtained the Board’s written approval of the plans.',authority:'Board'}],missingDocuments:[{identifier:'Design and Construction Guidelines',source:'https://example.org/ridge.pdf',page:3,description:'Not supplied.'}]}];
const inventories={[master.sha256]:m,[neighborhood.sha256]:n};
const recovered=INV.reconcile(structuredClone(interpretations),inventories);
assert.deepEqual(recovered.map(r=>[r.identifier,r.resolvedPage]),[['Exhibit A',3]],'Only the recovered exhibit is reconciled; separate instruments remain missing');
{const twice=structuredClone(interpretations);INV.reconcile(twice,inventories);const wrong=structuredClone(m);wrong.entries=wrong.entries.filter(e=>e.kind!=='exhibit');const again=INV.reconcile(twice,{[master.sha256]:wrong,[neighborhood.sha256]:n});
 assert.equal(again.length,0);assert(twice[0].missingDocuments.some(r=>r.identifier==='Exhibit A'&&r.description==='Legal description; not supplied.'),'Re-running reconciliation with a corrected inventory restores unresolved references');}
const titles={[master.sha256]:[interpretations[0].documentTitle],[neighborhood.sha256]:[interpretations[1].documentTitle]};
const stale=INV.staleClaims({findings:[{text:'The Board approves plans.',limitations:'The Design and Construction Guidelines and ACC provisions are not supplied.'},{text:'Master authority.',limitations:"The master Declaration's Exhibit A and any Supplemental Declaration are not supplied."}],missingEvidence:[{document:'Wolf Creek Master Declaration Exhibit A and recorded Supplemental Declarations',action:'Check.'}]},inventories,titles);
assert.deepEqual(stale.map(c=>[c.where,c.recovered]),[['finding 1 limitations','Section 6.3'],['finding 2 limitations','Exhibit A'],['direction 1 document','Exhibit A']]);
assert.equal(stale[1].sha256,master.sha256,'An ambiguous exhibit label is scoped to the instrument the clause names');
const fine=INV.staleClaims({findings:[{text:"The master Declaration's Exhibit A was recovered but describes land by metes and bounds and does not name the lot, and recorded Supplemental Declarations are not supplied.",limitations:'Separate Design and Construction Guidelines are not supplied. No current ACC appointees are shown.'}],missingEvidence:[{document:'Recorded Supplemental Declaration annexing Phase 2',action:'Search the recorder.'}]},inventories,titles);
assert.deepEqual(fine,[],'Genuine remaining gaps and accurate recovered-but-unresolved statements are allowed');
console.log('PASS: stale "not supplied" claims about recovered exhibits and committee provisions are detected per instrument; genuine gaps are preserved.');

(async()=>{
 const items=S.evidence(interpretations,inventories);
 const exhibitId=items.find(x=>x.type==='document_structure'&&x.sha256===master.sha256&&x.label==='Exhibit A').id,boardId=items.find(x=>x.type==='requirement'&&x.page===4).id;
 assert(items.find(x=>x.id===exhibitId).metesAndBounds);
 const staleDraft={findings:[{text:'Practical answer: nothing supplied shows that any approval has been obtained.',limitations:'None.',evidenceIds:[boardId]},{text:'Master coverage.',limitations:"The master Declaration's Exhibit A is not supplied.",evidenceIds:[exhibitId]}],missingEvidence:[]};
 const goodDraft={findings:[{text:'Before construction of a new dwelling starts, the Board must approve the plans in writing.',limitations:'Unsigned copy.',evidenceIds:[boardId]},{text:"The master Declaration's Exhibit A was recovered; it describes land by metes and bounds and historic parcel numbers and does not name the lot, so master coverage needs a plat comparison.",limitations:'Retrieval is not applicability.',evidenceIds:[exhibitId]}],missingEvidence:[]};
 const bodies=[];const reply=draft=>({ok:true,json:async()=>({stop_reason:'end_turn',content:[{type:'text',text:JSON.stringify(draft)}]})});
 const out=await S.synthesize(interpretations,target,{key:'test',inventories,recovered,request:async(url,o)=>{bodies.push(JSON.parse(o.body));return reply(bodies.length===1?staleDraft:goodDraft);}});
 assert.equal(bodies.length,2,'A stale draft is rejected and rewritten once');
 const first=JSON.parse(bodies[0].messages[0].content);assert.equal(first.recoveredReferences[0].identifier,'Exhibit A');assert(first.documentInventory.every(d=>d.allPagesRead));assert(bodies[0].system.includes('Finding 1 must be the practical plan-approval answer'));
 const feedback=bodies[1].messages.at(-1).content;assert(feedback.includes('Exhibit A was recovered')&&feedback.includes('not a plan-approval answer'));
 assert.equal(out.version,2);assert.equal(out.semanticChecks.rejectedDrafts,1);assert.equal(out.findings[1].citations[0].page,3);
 await assert.rejects(S.synthesize(interpretations,target,{key:'test',inventories,recovered,request:async()=>reply(staleDraft)}),e=>e.code==='SYNTHESIS_STALE_GAP');
 console.log('PASS: final synthesis cites recovered headings, rewrites stale or non-answer drafts once, and refuses to publish a draft that still calls recovered material missing.');
 const c={target,interpretations:structuredClone(interpretations),pageTexts:{}};const asked=[];
 const rec=await A.prepareInventories(c,{rpc:async(action,p)=>{asked.push([action,p.sha256]);return p.sha256===master.sha256?master:null;}});
 assert.deepEqual(asked.map(a=>a[0]),['reading_get','reading_get']);assert.equal(rec.length,1);assert(c.documentInventories[master.sha256]&&!c.documentInventories[neighborhood.sha256],'Terminal jobs read durable shared readings by hash; absent readings stay unreconciled rather than guessed');
 console.log('PASS: terminal investigations rebuild inventories from durable readings without re-interpretation.');
})().catch(e=>{console.error(e);process.exitCode=1;});
