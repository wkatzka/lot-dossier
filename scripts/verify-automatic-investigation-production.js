/* Acceptance check against the deployed service, not a seeded fixture. */
const assert=require('node:assert/strict'),fs=require('node:fs'),crypto=require('node:crypto');
const BASE='https://lot-dossier-assistant.vercel.app';
async function main(){
 const r=await fetch(BASE+'/api/public-research?format=investigation&county=Weber&parcelId=222320023');assert.equal(r.status,200);
 const d=await r.json();assert.equal(d.target.address,'3459 N WIND RIVER CT');assert.equal(d.target.lot,'68');assert.equal(d.target.municipality,'Ogden Valley City');
 assert.equal(d.automation.id,'ca12cf9a-c654-479a-a158-94be612b1523');
 assert.equal(d.status,'complete_with_gaps','The acceptance investigation must finish; queued/running is not a passing result');
 assert.equal(d.coverage.pending,0);
 assert.equal(d.coverage.unreadDocuments,0,'All recovered originals in this acceptance run must be read');
 assert(d.searchLog?.operations?.length,'Search receipts must be accessible independently of the crawler queue');
 assert(d.synthesis?.findings?.length,'Completed investigation must explain the evidence across documents');
 assert(d.synthesis.findings.every(f=>f.citations?.length&&f.status==='conditional_source_synthesis')); 

 const declaration='c0d1021ce27731e086545cade74b9177382b8fabfc427fabb464397d83f1c054',termination='55418659da0baa2968531c30a4965c1c5f55988f1378e18369a22d62c7c70b0d';
 assert(d.interpretations.some(x=>x.sha256===declaration&&x.authorityChanges?.some(e=>e.kind==='succession'&&e.page===10)),'The succession clause must survive original quotation validation');
 assert(d.interpretations.some(x=>x.sha256===termination&&x.authorityChanges?.some(e=>e.kind==='termination'&&e.page===2)),'The operative termination must be interpreted, not merely downloaded');
 const chainCitations=d.synthesis.findings.flatMap(f=>f.citations);
 for(const hash of [declaration,termination])assert(chainCitations.some(c=>c.sha256===hash),'Cross-document explanation must cite both succession and termination originals');
 const requirements=d.interpretations.flatMap(x=>x.requirements);
 const neighborhoodHash='10389c0d73cc30d408b13fc76bb216a252e53dac5ea9bc22b5c9fa79baa7f7c7';
 const neighborhood=d.interpretations.filter(x=>x.sha256===neighborhoodHash);
 assert(neighborhood.length,'The archived neighborhood declaration must be interpreted');
 assert(neighborhood.some(x=>x.requirements.some(r=>r.page===31&&r.stage==='construction'&&/board/i.test(r.authority))),'The neighborhood Board construction gate must survive quotation validation');
 assert(neighborhood.every(x=>x.documentStatus!=='recording_or_adoption_identified'),'The recovered unsigned neighborhood copy must not be presented as a proven executed/recorded instrument');
 assert(chainCitations.some(c=>c.sha256===neighborhoodHash),'The final answer must consider the recovered neighborhood original, not only the master documents');
 const amendmentHash='b8967517c1e638a8074a4cbf91679bb7a6265a512e23d829ba857b15eed45bda';
 const amendment=d.interpretations.find(x=>x.sha256===amendmentHash);assert(amendment&&amendment.documentStatus==='recording_or_adoption_identified');
 assert(amendment.supportingEvidence.some(x=>x.page===1&&x.quote.includes('3277834')),'The actual recording stamp must be retained');
 assert(amendment.supportingEvidence.some(x=>x.page===6&&/Lots 46 through 68/i.test(x.quote)),'The recovered lot-range exhibit must be retained');
 assert(amendment.missingDocuments.some(x=>x.identifier.includes('2957404')),'The exact underlying declaration reference must survive validation');
 assert(chainCitations.some(c=>c.sha256===amendmentHash),'The final answer must use the recorded amendment, not ignore it');
 assert(JSON.stringify(d.synthesis).includes('2957404'),'The user must receive the exact recorded-declaration target');
 const second=d.interpretations.find(x=>x.sha256==='a21765e8967b91addfca64365686a82cb46905dc07d43927f86a128d9afe2e9c');
 assert(second&&['proposal_or_draft','not_established'].includes(second.documentStatus));assert.equal(second.requirements.length,0,'Unsigned fee provisions must not become a plan-approval prerequisite');
 const city=requirements.filter(x=>x.source.includes('OgdenValley_PermitSubmissionRequirements.pdf'));
 for(const authority of ['Water Company','Sewer Company'])assert(city.some(x=>x.authority===authority&&x.stage==='submission'&&x.page===2&&x.stagePage===1));
 const guidelines=requirements.filter(x=>x.source.includes('Wolf_Creek_Design_Guidelines_Revised_12-21-10.pdf'));
 assert(guidelines.some(x=>x.authority==='Design Review Board'&&x.stage==='submission'&&x.page===7));
 assert(guidelines.some(x=>x.stage==='construction'&&x.page===42));
 assert(guidelines.some(x=>x.stage==='other_submission'&&x.page===7));
 assert(guidelines.every(x=>x.applicability!=='parcel_identified'),'Directory association is not proof of recorded lot membership');
 for(const x of requirements){assert(x.quote&&x.authorityQuote&&x.sha256&&x.page>0);assert.equal(x.reviewState,'source_supported_interpretation');}
 const anonymous=await fetch(BASE+'/api/public-research?action=worker',{method:'POST'});assert.equal(anonymous.status,401);
 const asset=await fetch(BASE+'/platform.html');assert.equal(asset.status,200);const html=await asset.text();assert(html.includes('Statements withheld because source validation failed'));assert(html.includes('Authority changes and amendments'));
 const proof={verifiedAt:new Date().toISOString(),base:BASE,automation:d.automation,target:d.target,status:d.status,coverage:d.coverage,questionOutcomes:d.investigation.questions,searchLog:d.searchLog,documents:d.documents,interpretations:d.interpretations,synthesis:d.synthesis,errors:d.errors,assetSha256:crypto.createHash('sha256').update(html).digest('hex'),workerRejectsAnonymous:true,limits:'A finished bounded automated investigation is not exhaustive public search or proof of current lot-specific private approval authority. Original quotations are independently checked separately.'};
 if(process.argv[2])fs.writeFileSync(process.argv[2],JSON.stringify(proof,null,2)+'\n');
 console.log(JSON.stringify({status:'PASS',job:d.automation.id,address:d.target.address,requirements:requirements.length,documents:d.coverage.documents,unread:d.coverage.unreadDocuments,questionStatus:d.investigation.questions.map(q=>q.status)}));
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
