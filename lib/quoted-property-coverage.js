/* Match only explicit identifiers inside the cited coverage clause, not nearby geography. */
function normalize(s){return String(s||'').normalize('NFKC').replace(/[‐‑‒–—−]/g,'-').replace(/\s+/g,' ').trim().toLowerCase();}
function match(quote,target){
 const q=normalize(quote),sub=normalize(target.subdivision).replace(/\b(?:at wolf creek|pr[u]?d|phase).*$/,'').trim();
 if(target.parcelId&&new RegExp('(^|[^0-9])'+target.parcelId+'([^0-9]|$)').test(q))return 'parcel_identified';
 if(sub.length<=4||!q.includes(sub))return 'unresolved';
 const lot=String(target.lot||''),phase=normalize(target.subdivision).match(/\bphase\s+(\d+|[ivx]+)\b/)?.[1];
 if(/^\d+$/.test(lot))for(const clause of q.split(/(?=\ball of lots?\b)|;\s*/)){
  if(!clause.includes(sub))continue;
  if(!phase&&/\bphase\s+(?:\d+|[ivx]+)\b/.test(clause))continue;
  if(phase&&!new RegExp('\\bphase\\s+'+phase+'\\b').test(clause))continue;
  if(new RegExp('\\blot\\s+'+lot+'\\b').test(clause))return 'parcel_identified';
  for(const m of clause.matchAll(/\blots?\s+(\d+)\s*(?:through|to|-)\s*(\d+)\b/g))if(+m[1]<=+lot&&+lot<=+m[2])return 'parcel_identified';
 }
 return 'subdivision_identified';
}
module.exports={match};
