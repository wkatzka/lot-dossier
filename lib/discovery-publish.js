/* Small exact-parcel search index; raw record content stays in the acquisition store. */
const fs=require('node:fs');
const {stableUrl,publicCoverage}=require('./discovery-metadata');
function record(profile,state){
 const identity=profile.identityTerms||[...(profile.noticeTerms||[]),...(profile.archiveTerms||[])];
 const stable=stableUrl;
 const documents=state.documents.filter(d=>d.disposition!=='reviewed_not_relevant'&&!d.urls.every(u=>/\/(?:taxnotice|valnotice)\//i.test(u))&&(d.matches||[]).some(m=>m.terms.some(t=>identity.includes(t)))).map(d=>({sha256:d.sha256,urls:[...new Set([...d.urls,...(d.sourcePages||[])])].filter(stable),pages:d.pages,unreadPages:d.unreadPages||[],applicability:'unverified',matchingPages:[...new Set(d.matches.filter(m=>m.terms.some(t=>identity.includes(t))).map(m=>m.page))],route:d.route})).filter(d=>d.urls.length);
 const checkedAt=state.jobs.map(j=>j.checkedAt||j.retrievedAt).filter(Boolean).sort().at(-1)||state.startedAt;
 return {county:profile.county,parcelId:profile.parcelId,profileId:profile.id,scope:profile.scope,checkedAt,coverage:publicCoverage(state.coverage),contactFallbackEligible:state.contactFallbackEligible,documents,legalApplicabilityEstablished:false,submissionPrerequisiteEstablished:false};
}
function publish(profile,state,output){
 if(!profile.county||!profile.parcelId||!state.coverage)throw Error('Publication requires exact county, parcel and coverage');
 const index=fs.existsSync(output)?JSON.parse(fs.readFileSync(output)):{schemaVersion:1,records:[]};
 const value=record(profile,state),prior=index.records.find(r=>r.county===value.county&&r.parcelId===value.parcelId);
 const hashes=new Set(value.documents.map(d=>d.sha256));
 value.documents.push(...(prior?.documents||[]).filter(d=>!hashes.has(d.sha256)).map(d=>({...d,fromPreviousPass:true,previousCheckedAt:d.previousCheckedAt||prior.checkedAt})));
 index.records=index.records.filter(r=>r.county!==value.county||r.parcelId!==value.parcelId);index.records.push(value);index.generatedAt=new Date().toISOString();
 fs.writeFileSync(output+'.tmp',JSON.stringify(index,null,2)+'\n');fs.renameSync(output+'.tmp',output);return value;
}
module.exports={record,publish};
