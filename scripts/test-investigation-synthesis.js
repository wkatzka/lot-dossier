const assert=require('node:assert/strict'),S=require('../lib/investigation-synthesis');
const doc={documentTitle:'Synthetic original',source:'https://example.org/original.pdf',requirements:[{source:'https://example.org/original.pdf',sha256:'a'.repeat(64),page:2,quote:'The committee must approve the plans before construction.',authority:'committee'}],authorityChanges:[]};
const items=S.evidence([doc]);assert.equal(items.length,1);assert.equal(S.evidence([doc])[0].id,items[0].id);
const valid={findings:[{text:'The source describes approval before construction.',limitations:'Lot membership is unestablished.',evidenceIds:[items[0].id]}],missingEvidence:[{document:'Applicable declaration exhibit',action:'Check the recorded property coverage.',evidenceIds:[items[0].id]}]};
const result=S.validate(valid,items);assert.equal(result.findings[0].status,'conditional_source_synthesis');assert.equal(result.findings[0].citations[0].page,2);assert.equal(result.missingEvidence[0].citations[0].source,doc.source);
assert.throws(()=>S.validate({...valid,findings:[{...valid.findings[0],evidenceIds:['invented']}]},items));
assert.throws(()=>S.validate({...valid,missingEvidence:[{...valid.missingEvidence[0],evidenceIds:[]}]},items));
assert(!JSON.stringify(result).includes('approval_obtained'));
console.log('PASS: cross-document explanations require existing original evidence and retain conditional status; unsupported citations and ungrounded document directions are rejected.');
