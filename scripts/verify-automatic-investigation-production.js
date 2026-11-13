/* Acceptance check against the deployed service, not a seeded fixture. */
const assert=require('node:assert/strict'),fs=require('node:fs'),crypto=require('node:crypto');
const BASE='https://lot-dossier-assistant.vercel.app';
async function main(){
 const r=await fetch(BASE+'/api/public-research?format=investigation&county=Weber&parcelId=222320023');assert.equal(r.status,200);
 const d=await r.json();assert.equal(d.target.address,'3459 N WIND RIVER CT');assert.equal(d.target.lot,'68');assert.equal(d.target.municipality,'Ogden Valley City');
 assert.equal(d.automation.id,'ca12cf9a-c654-479a-a158-94be612b1523');
 assert.equal(d.status,'complete_with_gaps','The acceptance investigation must finish; queued/running is not a passing result');
 assert.equal(d.coverage.pending,0);
 assert(d.synthesis?.findings?.length,'Completed investigation must explain the evidence across documents');
 assert(d.synthesis.findings.every(f=>f.citations?.length&&f.status==='conditional_source_synthesis')); 
 const requirements=d.interpretations.flatMap(x=>x.requirements);
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
 const proof={verifiedAt:new Date().toISOString(),base:BASE,automation:d.automation,target:d.target,status:d.status,coverage:d.coverage,questionOutcomes:d.investigation.questions,interpretations:d.interpretations,synthesis:d.synthesis,errors:d.errors,assetSha256:crypto.createHash('sha256').update(html).digest('hex'),workerRejectsAnonymous:true,limits:'A finished bounded automated investigation is not exhaustive public search or proof of current lot-specific private approval authority. Original quotations are independently checked separately.'};
 if(process.argv[2])fs.writeFileSync(process.argv[2],JSON.stringify(proof,null,2)+'\n');
 console.log(JSON.stringify({status:'PASS',job:d.automation.id,address:d.target.address,requirements:requirements.length,documents:d.coverage.documents,unread:d.coverage.unreadDocuments,questionStatus:d.investigation.questions.map(q=>q.status)}));
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
