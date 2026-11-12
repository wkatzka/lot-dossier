/* Cached background discovery: exact jurisdiction + parcel identity only. */
const index=require('../data/title/discovery-index.json');
function lookup(county,parcelId,now=Date.now()){
 const record=index.records.find(r=>r.county===county&&r.parcelId===String(parcelId));
 if(!record)return null;
 const stale=now-Date.parse(record.checkedAt)>7*86400000;
 return {...record,stale,contactFallbackEligible:!stale&&record.contactFallbackEligible,
  status:stale?'refresh_due':record.coverage.publicRouteChecksComplete?'configured_sources_checked':'research_incomplete',
  limitation:'Search coverage is limited to the listed public sources. A retrieved document is a candidate, not an established requirement for this parcel.'};
}
module.exports={lookup};
