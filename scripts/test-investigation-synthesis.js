const assert=require('node:assert/strict'),S=require('../lib/investigation-synthesis');
const doc={documentTitle:'Synthetic original',source:'https://example.org/original.pdf',requirements:[{source:'https://example.org/original.pdf',sha256:'a'.repeat(64),page:2,quote:'The committee must approve the plans before construction.',authority:'committee'}],authorityChanges:[]};
const items=S.evidence([doc]);assert.equal(items.length,1);assert.equal(S.evidence([doc])[0].id,items[0].id);
const valid={findings:[{text:'The source describes approval before construction.',limitations:'Lot membership is unestablished; this copy is unsigned and not shown to be recorded.',evidenceIds:[items[0].id]}],missingEvidence:[{document:'Applicable declaration exhibit',question:'Does the exhibit cover this lot?',dependency:'not_retrieved',action:'Check the recorded property coverage.',evidenceIds:[items[0].id]}],answer:{approver:'The committee approves plans.',when:'Before construction.',uncertainty:'Lot membership.',nextActionIndex:0,evidenceIds:[items[0].id]}};
const result=S.validate(valid,items);assert.equal(result.findings[0].status,'conditional_source_synthesis');assert.equal(result.findings[0].citations[0].page,2);assert.equal(result.missingEvidence[0].citations[0].source,doc.source);
assert.throws(()=>S.validate({...valid,findings:[{...valid.findings[0],evidenceIds:['invented']}]},items));
assert.throws(()=>S.validate({...valid,missingEvidence:[{...valid.missingEvidence[0],evidenceIds:[]}]},items));
assert(!JSON.stringify(result).includes('approval_obtained'));
console.log('PASS: cross-document explanations require existing original evidence and retain conditional status; unsupported citations and ungrounded document directions are rejected.');
(async()=>{
 let called=false;
 const output=await S.synthesize([doc],{address:'Synthetic address',parcelId:'000000001',subdivision:'Example',lot:'1',municipality:'Example City',ownerRecord:'must not be sent'}, {key:'test',request:async(url,options)=>{
  called=true;const body=JSON.parse(options.body);assert.equal(body.max_tokens,5000);assert(!body.messages[0].content.includes('must not be sent'));assert(body.system.includes('untrusted data'));return {ok:true,json:async()=>({stop_reason:'end_turn',content:[{type:'text',text:JSON.stringify(valid)}]})};
 }});assert(called);assert.equal(output.findings[0].citations[0].source,doc.source);
 await assert.rejects(S.synthesize([doc],{}, {key:'test',request:async()=>({ok:true,json:async()=>({stop_reason:'max_tokens'})})}),/did not finish/);
 const html=require('../web/title-research-view').investigationPanel({automation:{status:'complete_with_gaps'},synthesis:output,interpretations:[doc],investigation:{questions:[]}});
 assert(html.includes('Approvals for this lot')&&html.includes('Who approves')&&html.indexOf('Approvals for this lot')<html.indexOf('Sources and research details'),'The distilled answer leads; details are folded below it');assert(html.includes('Specific evidence still needed'));assert(html.includes('original.pdf#page=2'));
 console.log('PASS: bounded synthesis response, private-field exclusion, original links in live UI, and rejection of truncated model output.');
})().catch(e=>{console.error(e);process.exitCode=1});

const scoped=structuredClone(doc);scoped.requirements[0].applicability='subdivision_identified';scoped.requirements[0].applicabilityPage=9;scoped.requirements[0].applicabilityBasis='All lots in Example Ridge are described in this exhibit.';
scoped.supportingEvidence=[{kind:'execution_status',source:doc.source,sha256:'a'.repeat(64),page:8,quote:'Executed on the ____ day of __________, 2018.'}];
const scopedItems=S.evidence([scoped,scoped]);assert.equal(scopedItems.length,3);const coverage=scopedItems.find(x=>x.type==='property_scope');assert.equal(coverage.page,9);const linked=S.validate({findings:[{text:'The exhibit describes the subdivision.',limitations:'Current effect is unverified.',evidenceIds:[coverage.id]}],missingEvidence:[]},scopedItems);assert.equal(linked.findings[0].citations[0].page,9);
scoped.requirements[0].applicability='unresolved';assert(!S.evidence([scoped]).some(x=>x.type==='property_scope'));
