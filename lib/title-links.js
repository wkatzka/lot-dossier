/* Source-backed instrument relationships; names never establish a title link. */
'use strict';
const reference=r=>r&&r.county&&r.book&&r.page?[r.county,r.book,r.page].map(x=>String(x).trim().toLowerCase()).join(':'):null;
const sourceValid=s=>/^https:\/\//.test(s?.url||'')&&/^[a-f0-9]{64}$/i.test(s?.sha256||'')&&!!s?.pages;
function trace(documents,{county,locations=[],asOf}={}){
 const key=l=>[l.township,l.northSouth,l.range,l.eastWest,l.section].join(':').toLowerCase();
 const inScope=d=>d.county===county&&locations.some(l=>key(l)===key(d.location)&&(d.aliquots||[]).includes(l.aliquot));
 const nodes=documents.filter(d=>inScope(d)&&sourceValid(d.source)).map(d=>({...d,disposition:'unresolved'}));
 const edges=[],issues=[];const byRef=new Map();
 for(const d of nodes){const k=reference(d.reference);if(!k)continue;if(byRef.has(k)){byRef.set(k,null);issues.push('Duplicate instrument reference: '+k);}else byRef.set(k,d);}
 for(const d of nodes)for(const rel of d.references||[]){
  const k=reference(rel.target),target=byRef.get(k);
  const edge={from:d.id,to:target?.id||null,target:rel.target,relation:rel.relation,basis:rel.basis,status:target?(rel.basis==='explicit_record_reference'?'linked_reference':'candidate_link'):'missing_target'};
  // An index "release" can discharge debt, concern different land, or release only part.
  // No automatic extinguishment from title, surnames, proximity, or silence.
  if(rel.relation==='release'){
   const effective=d.effectiveDate;
   const validDate=typeof effective==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(effective)&&Number.isFinite(Date.parse(effective))&&new Date(effective).toISOString().slice(0,10)===effective;
   const cutoff=typeof asOf==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(asOf)&&Number.isFinite(Date.parse(asOf))&&new Date(asOf).toISOString().slice(0,10)===asOf;
   const eligible=target&&d.evidenceLevel==='original'&&target.evidenceLevel==='original'&&d.reviewed===true&&target.reviewed===true&&rel.basis==='explicit_record_reference'&&rel.scope==='entire_interest'&&rel.interest===target.interest&&rel.authorityVerified===true&&validDate&&cutoff&&effective<=asOf;
   edge.status=eligible?'reviewed_release':'release_unresolved';
   if(eligible)target.disposition='released_in_reviewed_instruments';
  }
  edges.push(edge);
 }
 return {schemaVersion:1,nodes,edges,issues,searchComplete:false,ownershipDetermined:false,limitation:'Relationships are limited to cited records and mapped geographic scope. A reviewed release concerns its referenced interest only; it does not establish complete title or absence of other restrictions.'};
}
module.exports={trace,reference,sourceValid};
