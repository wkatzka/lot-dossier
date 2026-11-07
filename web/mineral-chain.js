/* Reviewed, source-linked fractional transfers. No ownership inferred from GIS absence. */
(function(root){
'use strict';
function reconcile(events,{scope,asOf,rootEstablished=false,searchComplete=false}={}){
 const gaps=[],holdings={},history=[];
 if(!rootEstablished)gaps.push('Original ownership root not established');if(!searchComplete)gaps.push('Dated conveyance/reservation search incomplete');
 if(!scope?.commodity||!scope?.depth||!scope?.propertyKey)gaps.push('Commodity, depth and property scope required');
 const ordered=events.slice().sort((a,b)=>String(a.effectiveDate).localeCompare(String(b.effectiveDate))),seen=new Set();
 for(const e of ordered){
  if(!e.id||seen.has(e.id)){gaps.push('Duplicate or missing instrument event');continue;}seen.add(e.id);
  if(!e.reviewed||!e.source?.url||!e.source?.page||!e.source?.hash||e.propertyKey!==scope?.propertyKey||e.commodity!==scope?.commodity||e.depth!==scope?.depth){gaps.push('Unreviewed or incompatible event '+e.id);continue;}
  if(!/^\d{4}-\d{2}-\d{2}$/.test(e.effectiveDate)||e.effectiveDate>asOf){gaps.push('Event outside dated scope '+e.id);continue;}
  const share=e.numerator/e.denominator;if(!Number.isSafeInteger(e.numerator)||!Number.isSafeInteger(e.denominator)||e.denominator<=0||share<=0||share>1){gaps.push('Invalid fractional interest '+e.id);continue;}
  if(!e.to){gaps.push('Missing grantee '+e.id);continue;}
  if(e.type==='root'){
   if(history.length||Object.keys(holdings).length){gaps.push('Conflicting root '+e.id);continue;}holdings[e.to]=share;
  }else if(e.type==='transfer'){
   if(!e.from||(holdings[e.from]||0)+1e-10<share){gaps.push('Grantor interest insufficient or untraced '+e.id);continue;}
   holdings[e.from]-=share;holdings[e.to]=(holdings[e.to]||0)+share;
  }else{gaps.push('Unsupported legal interest event '+e.id);continue;}
  history.push(e.id);
 }
 if(Math.abs(Object.values(holdings).reduce((a,b)=>a+b,0)-1)>1e-10)gaps.push('Interests do not reconcile to the entire defined estate');
 return {scope,asOf,status:gaps.length?'unresolved':'reviewed_chain',ownershipDetermined:!gaps.length,holdings,gaps,history,limitation:'Conclusion is limited to the reviewed instruments, commodity/depth/property scope and dated search; no title insurance or guarantee.'};
}
const api={reconcile};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.MineralChain=api;
})(typeof window!=='undefined'?window:globalThis);
