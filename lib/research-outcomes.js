/* Deterministic question-level search decisions. Queue completion is not evidence. */
const {safeUrl}=require('./discovery-metadata');
const ageOK=(date,now,days)=>Number.isFinite(Date.parse(date))&&Date.parse(date)<=now&&now-Date.parse(date)<=days*86400000;
const url=value=>{const u=safeUrl(value);return u?.startsWith('https:')?u:undefined;};
function receipt(job){
 const s=job.searchReceipt;
 return {id:job.id,route:job.route,kind:job.kind,status:job.status,url:url(s?.url||job.url),
  checkedAt:job.checkedAt||job.retrievedAt,term:job.term||s?.term,
  ...(s?{scope:s.scope,count:s.count,paginationComplete:s.paginationComplete===true,
   identifiers:s.identifiers||[],startDate:s.startDate,endDate:s.endDate}:{}),
  sourceHash:job.sha256};
}
function evaluate(plan={},state={},now=Date.now()){
 const jobs=state.jobs||[],docs=state.documents||[],leads=state.externalLeads||[];
 const receipts=jobs.map(receipt),maxAgeDays=plan.maxAgeDays||7;
 const questions=(plan.questions||[]).map(q=>{
  const requirements=q.routes||[],relevant=jobs.filter(j=>requirements.some(r=>r.route===j.route));
  const pending=relevant.filter(j=>!['complete','reviewed_not_relevant','access_restricted','not_found'].includes(j.status));
  const barriers=relevant.filter(j=>j.status==='access_restricted');
  const unread=docs.filter(d=>requirements.some(r=>r.route===d.route)&&d.disposition!=='reviewed_not_relevant'&&(d.readError||d.unreadPages?.length));
  const openLeads=leads.filter(l=>requirements.some(r=>r.route===l.route)&&!['reviewed_not_relevant','followed'].includes(l.status));
  const routes=requirements.map(r=>{
   const rr=receipts.filter(j=>j.route===r.route&&url(r.source)&&j.url?.startsWith(r.source));
   // A completed query must cover each planned identifier. A visited home page is insufficient.
   const covered=(r.identifiers||[]).filter(id=>rr.some(j=>j.status==='complete'&&j.paginationComplete&&j.scope===r.scope&&j.identifiers?.includes(id)&&ageOK(j.checkedAt,now,maxAgeDays)&&
    (!r.startDate||(j.startDate&&j.startDate<=r.startDate))&&(!r.endDate||(j.endDate&&j.endDate>=r.endDate))));
   const complete=!!(r.custodian&&r.basis&&r.scope&&r.identifiers?.length&&covered.length===r.identifiers.length);
   return {route:r.route,source:url(r.source),custodian:r.custodian,basis:r.basis,scope:r.scope,complete,missingIdentifiers:(r.identifiers||[]).filter(id=>!covered.includes(id)),receipts:rr.map(j=>({...j,outcome:j.status!=='complete'?'source_check_unfinished':j.paginationComplete&&j.count===0?'no_matching_record_in_this_source':'source_results_require_reconciliation'}))};
  });
  const references=(q.references||[]).filter(r=>r.label&&r.purpose&&url(r.url)&&url(r.verification?.url)&&ageOK(r.verification.checkedAt,now,r.maxAgeDays||30))
   .map(r=>({label:r.label,url:url(r.url),purpose:r.purpose,verifiedAt:r.verification.checkedAt,validUntil:new Date(Date.parse(r.verification.checkedAt)+(r.maxAgeDays||30)*86400000).toISOString(),verificationUrl:url(r.verification.url),
    holdingsEstablished:!!(r.holdingsEvidence?.instrumentId===q.instrumentId&&r.holdingsEvidence.locator&&url(r.holdingsEvidence.url)),
    ...(r.holdingsEvidence?.instrumentId===q.instrumentId&&r.holdingsEvidence.locator&&url(r.holdingsEvidence.url)?{holdingsEvidence:{url:url(r.holdingsEvidence.url),locator:r.holdingsEvidence.locator}}:{})}));
  const candidates=docs.filter(d=>requirements.some(r=>r.route===d.route)&&d.disposition!=='reviewed_not_relevant');
  const decisions=state.instrumentDecisions||[];
  const unresolvedSearchResults=relevant.filter(j=>j.searchReceipt?.count>0&&!(j.searchReview?.disposition==='no_target'&&j.searchReview.basis&&j.searchReview.sourceHash===j.sha256&&j.sha256&&ageOK(j.searchReview.checkedAt,now,maxAgeDays)));
  const unresolvedCandidates=candidates.filter(d=>!decisions.some(x=>x.questionId===q.id&&x.sha256===d.sha256&&x.disposition==='not_target'&&x.basis&&url(x.sourceUrl)&&x.checkedAt));
  // Positive answers must be reviewed original evidence, never keyword hits or an empty search.
  const a=(state.answers||[]).find(a=>a.questionId===q.id);
  const answerValid=!!(a&&a.county===plan.county&&a.parcelId===plan.parcelId&&a.text&&a.reviewedBy&&ageOK(a.checkedAt,now,maxAgeDays)&&
   a.applicabilityBasis&&a.authorityBasis&&a.chronologyBasis&&['submission','issuance','construction','not_required'].includes(a.stage)&&
   a.citations?.length&&a.citations.every(c=>url(c.url)&&c.page>0&&c.excerpt&&docs.some(d=>d.sha256===c.sha256&&d.urls?.includes(c.url)&&d.pages>=c.page&&!d.unreadPages?.length&&!d.readError))&&!(a.conflicts||[]).length);
  let status='investigation_incomplete';
  const coverageComplete=!!(plan.county&&plan.parcelId&&q.instrumentId&&q.scopeBasis&&requirements.length&&routes.every(r=>r.complete));
  if(answerValid)status='answered';
  else if(!pending.length&&!unread.length&&!openLeads.length&&!unresolvedCandidates.length&&!unresolvedSearchResults.length&&barriers.length&&routes.length&&routes.every(r=>r.complete||barriers.some(j=>j.route===r.route&&r.source&&j.url?.startsWith(r.source))))status='access_prevented_completion';
  else if(coverageComplete&&!pending.length&&!unread.length&&!openLeads.length&&!barriers.length&&!unresolvedCandidates.length&&!unresolvedSearchResults.length&&!relevant.some(j=>j.status==='not_found'))status='public_routes_checked_instrument_not_recovered';
  const fallbackEligible=references.length>0&&['access_prevented_completion','public_routes_checked_instrument_not_recovered'].includes(status);
  const nextAction=status==='answered'?'Read the cited requirement and its approval stage.':status==='access_prevented_completion'?
   'Open the blocked source or use an available verified reference to ask for '+q.instrument+'. A blocked portal does not prove it holds this document.':status==='public_routes_checked_instrument_not_recovered'?
   'Locate '+q.instrument+'. The listed public searches did not recover it.':
   unread.length?'Finish reading the retrieved originals before deciding whether the instrument is missing.':openLeads.length?'Follow the remaining source leads before assigning document retrieval to the user.':(unresolvedCandidates.length||unresolvedSearchResults.length)?'Reconcile the retrieved candidates with the requested instrument, property and amendments.':
   'Complete the missing source searches for '+q.instrument+'. Verified references below are available while research continues.';
  return {id:q.id,question:q.question,instrument:q.instrument,instrumentId:q.instrumentId,status,scopeBasis:q.scopeBasis,routes,references,nextAction,
   fallbackEligible,coverageComplete,pendingChecks:pending.length,unreadDocuments:unread.length,openLeads:openLeads.length,unresolvedCandidates:unresolvedCandidates.length,unreconciledSearches:unresolvedSearchResults.length,
   barriers:barriers.map(receipt),...(answerValid?{answer:{text:a.text,stage:a.stage,citations:a.citations.map(c=>({...c,url:url(c.url)}))}}:{})};
 });
 return {schemaVersion:1,evaluatedAt:new Date(now).toISOString(),questions,contactFallbackEligible:questions.some(q=>q.fallbackEligible),
  limitation:'These decisions cover the named questions, sources, identifiers and dates. They do not establish absence of a requirement or exhaustive internet coverage.'};
}
module.exports={evaluate,receipt};
