/* Cached background discovery: exact jurisdiction + parcel identity only. */
const index=require('../data/title/discovery-index.json');
function lookup(county,parcelId,now=Date.now()){
 const record=index.records.find(r=>r.county===county&&r.parcelId===String(parcelId));
 if(!record)return {county,parcelId:String(parcelId),status:'investigation_not_started',checkedAt:null,documents:[],coverage:{routes:[],documents:0,unreadDocuments:0},investigation:require('./research-outcomes').evaluate(require('./research-plans').unconfigured(county,String(parcelId)),{},now),contactFallbackEligible:false,limitation:'No background investigation has been configured for this parcel. An empty cache is not a completed search.'};
 const stale=!Number.isFinite(Date.parse(record.checkedAt))||now-Date.parse(record.checkedAt)>7*86400000;
 const investigation=record.investigation?JSON.parse(JSON.stringify(record.investigation)):require('./research-outcomes').evaluate(require('./research-plans').unconfigured(county,String(parcelId)),{},now);
 for(const q of investigation.questions){
  q.references=q.references.filter(r=>now<=Date.parse(r.validUntil||new Date(Date.parse(r.verifiedAt)+30*86400000).toISOString()));
  if(stale){q.status='investigation_incomplete';q.fallbackEligible=false;q.coverageComplete=false;delete q.answer;q.nextAction='Refresh the dated source searches before relying on this outcome.';}
  if(!q.references.length)q.fallbackEligible=false;
 }
 investigation.contactFallbackEligible=investigation.questions.some(q=>q.fallbackEligible);
 return {...record,stale,investigation,contactFallbackEligible:investigation.contactFallbackEligible,
  status:stale?'refresh_due':record.coverage.publicRouteChecksComplete?'configured_sources_checked':'research_incomplete',
  limitation:'Search coverage is limited to the listed public sources. A retrieved document is a candidate, not an established requirement for this parcel.'};
}
module.exports={lookup};
