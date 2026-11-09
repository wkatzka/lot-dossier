/* Weber adjusted-comparable research model. Historical reference, not current market value. */
(function(root){
'use strict';
const median=a=>{const s=a.slice().sort((a,b)=>a-b),i=Math.floor(s.length/2);return s.length%2?s[i]:(s[i-1]+s[i])/2;};
const key=x=>String(x||'').replace(/[^a-z0-9]/gi,'').toLowerCase();
function predict(rows,target){
 if(target.county!=='Weber'||!Number.isFinite(target.grossAcres)||target.grossAcres<=0)throw Error('A valid Weber parcel area is required');
 const train=rows.filter(r=>r.saleDate<target.saleDate&&!r.parcelIds.some(p=>(target.parcelIds||[]).some(q=>key(p)===key(q))));
 if(train.length<3)throw Error('Fewer than three prior sale records');
 const slopes=[];
 for(let i=0;i<train.length;i++)for(let j=i+1;j<train.length;j++){
  const a=train[i],b=train[j],dx=Math.log(a.grossAcres/b.grossAcres);
  if(a.region===b.region&&a.segment===b.segment&&Math.abs(dx)>.1)slopes.push(Math.log(a.price/b.price)/dx);
 }
 const elasticity=slopes.length?Math.max(0,Math.min(1,median(slopes))):0;
 const local=train.filter(r=>r.region===target.region);
 if(!local.length)throw Error('No comparable sales in this submarket');
 const comps=local.map(r=>({...r,factor:(target.grossAcres/r.grossAcres)**elasticity})).map(r=>({...r,adjustedPrice:r.price*r.factor}));
 return {estimate:Math.exp(median(comps.map(r=>Math.log(r.adjustedPrice)))),elasticity,comps,trainingCount:train.length,
  extrapolated:target.grossAcres<Math.min(...local.map(r=>r.grossAcres))||target.grossAcres>Math.max(...local.map(r=>r.grossAcres)),marketValue:false};
}
function diagnostics(rows,target){
 const base=predict(rows,target),eligible=rows.filter(r=>r.saleDate<target.saleDate&&!r.parcelIds.some(p=>(target.parcelIds||[]).some(q=>key(p)===key(q))));
 const trials=eligible.map((row,i)=>{try{return {excludedId:row.id,estimate:predict(eligible.filter((_,j)=>i!==j),target).estimate};}catch(e){return {excludedId:row.id,error:e.message};}});
 const estimates=trials.filter(r=>Number.isFinite(r.estimate)).map(r=>r.estimate);
 const dates=base.comps.map(c=>c.saleDate).sort();
 return {estimate:base.estimate,leaveOneOut:trials,range:estimates.length?[Math.min(...estimates),Math.max(...estimates)]:null,
  maxChange:estimates.length?Math.max(...estimates.map(v=>Math.abs(v-base.estimate))):null,
  oldestComparable:dates[0],newestComparable:dates.at(-1),
  independentValidation:false,confidenceInterval:false,
  limitation:'Delete-one sensitivity measures dependence on individual sales; it is not a confidence interval or an accuracy test.'};
}
function subject(report){
 const p=report.parcel||{},a=p.attrs||{},city=String(a.PARCEL_CITY||'').trim().toLowerCase(),juris=String(report.facts?.jurisdiction||'').toLowerCase();
 const valley=['eden','liberty','huntsville','ogden valley city'];
 const western=['plain city','west haven','hooper','taylor','marriott-slaterville','marriott slaterville','farr west'];
 const region=valley.some(c=>c===city||c===juris)?'Ogden Valley':western.some(c=>c===city||c===juris)?'Western Weber':null;
 return {county:p.county,grossAcres:Number(a.PARCEL_ACRES),parcelIds:[p.id],region,saleDate:new Date().toISOString().slice(0,10)};
}
const api={predict,diagnostics,subject};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.WeberValue=api;
})(typeof window!=='undefined'?window:globalThis);
