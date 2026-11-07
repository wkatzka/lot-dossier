/* Transparent land economics. A scenario is not a validated market valuation. */
(function(root){
'use strict';
const finite=(x,k)=>{if(!Number.isFinite(x)||x<0)throw Error(k+' must be a nonnegative number');return x;};
const required=['finishedSale','vertical','sitework','fees','design','overhead','contingency','finance','carry','sellingRate','profitRate','acquisitionRate'];
function residual(inputs){
 const missing=required.filter(k=>!inputs[k]||!Number.isFinite(inputs[k].value)||!inputs[k].basis);
 if(missing.length)return {status:'inputs_required',missing,marketValue:false};
 const n=Object.fromEntries(required.map(k=>[k,finite(inputs[k].value,k)]));
 for(const k of ['sellingRate','profitRate','acquisitionRate'])if(n[k]>=1)throw Error(k+' must be a fraction below 1');
 if(n.sellingRate+n.profitRate>=1)throw Error('Selling costs plus profit consume sale proceeds');
 const costs=['vertical','sitework','fees','design','overhead','contingency','finance','carry'].reduce((s,k)=>s+n[k],0);
 // Acquisition costs are a proportion of the land purchase price, solved algebraically.
 const available=n.finishedSale*(1-n.sellingRate-n.profitRate)-costs;
 const landBudget=available/(1+n.acquisitionRate);
 return {status:'scenario',modelVersion:'residual-v2',method:'Residual development budget',marketValue:false,landBudget,nonLandCosts:costs,sellingCosts:n.finishedSale*n.sellingRate,targetProfit:n.finishedSale*n.profitRate,acquisitionCosts:landBudget>0?landBudget*n.acquisitionRate:0,
  feasible:landBudget>=0,inputs:JSON.parse(JSON.stringify(inputs)),sensitivity:[-0.1,0,0.1].flatMap(saleChange=>[-0.1,0,0.1].map(costChange=>({saleChange,costChange,landBudget:(n.finishedSale*(1+saleChange)*(1-n.sellingRate-n.profitRate)-costs*(1+costChange))/(1+n.acquisitionRate)}))),
  limitation:'Illustrative builder budget using stated inputs; not an appraisal, market-price estimate or validated local cost forecast. Finance/carry inputs must include their full duration; land-finance costs require iteration if purchase-dependent.'};
}
function comparableRange(subject,records,asOf,validation){
 const cutoff=Date.parse(asOf);if(!Number.isFinite(cutoff)||!Number.isFinite(subject.usableAcres)||subject.usableAcres<=0)throw Error('Valuation date and positive usable acreage required');
 const included=[],excluded=[],seen=new Set();
 for(const c of records){
  const reasons=[];
  if(!c.id||seen.has(c.id))reasons.push('Duplicate or missing transaction ID');seen.add(c.id);
  if(c.kind!=='closed_sale')reasons.push('Not a closed sale');
  if(!/^https:\/\//.test(c.source||'')||c.verified!==true)reasons.push('Unverified source');
  if(c.armLength!==true)reasons.push('Arm’s-length status unverified');
  const date=Date.parse(c.saleDate);if(!Number.isFinite(date)||date>cutoff||cutoff-date>730*86400000)reasons.push('Outside dated comparison window');
  if(c.submarket!==subject.submarket)reasons.push('Different submarket');
  if(!Number.isFinite(c.price)||c.price<=0||!Number.isFinite(c.usableAcres)||c.usableAcres<=0)reasons.push('Missing positive price or usable area');
  if(!c.adjustments||!c.adjustments.every(a=>Number.isFinite(a.amount)&&a.basis&&/^https:\/\//.test(a.source||'')))reasons.push('Adjustments lack support');
  if(reasons.length){excluded.push({id:c.id,reasons});continue;}
  const adjusted=c.price+c.adjustments.reduce((s,a)=>s+a.amount,0);if(adjusted<=0){excluded.push({id:c.id,reasons:['Nonpositive adjusted price']});continue;}
  included.push({...c,adjustedPrice:adjusted,subjectIndication:adjusted/c.usableAcres*subject.usableAcres});
 }
 const coverage=validation&&validation.reviewed===true&&/^https:\/\//.test(validation.source||'')&&validation.submarket===subject.submarket&&validation.methodVersion==='unit-comparison-v1'&&validation.holdoutCount>=20&&validation.trainingEnd<validation.holdoutStart&&validation.holdoutEnd<=asOf&&Number.isFinite(validation.absoluteError90)&&validation.absoluteError90>0;
 if(included.length<3||!coverage)return {status:'insufficient_evidence',included,excluded,missing:[...(included.length<3?['At least three supported comparable closed sales']:[]),...(!coverage?['Independent local holdout validation for this method']:[])],marketValue:false};
 const values=included.map(c=>c.subjectIndication).sort((a,b)=>a-b),mid=Math.floor(values.length/2),estimate=values.length%2?values[mid]:(values[mid-1]+values[mid])/2;
 return {status:'estimated',method:'unit-comparison-v1',estimate,range:[Math.max(0,estimate-validation.absoluteError90),estimate+validation.absoluteError90],included,excluded,validation,asOf,marketValue:true};
}
function evaluateHoldout(rows){
 if(!rows.length)throw Error('Holdout observations required');
 const e=rows.map(r=>{if(!Number.isFinite(r.actual)||r.actual<=0||!Number.isFinite(r.predicted)||r.trainingEnd>=r.saleDate)throw Error('Invalid or temporally leaked holdout');return {absolute:Math.abs(r.actual-r.predicted),relative:Math.abs(r.actual-r.predicted)/r.actual};});
 const a=e.map(x=>x.absolute).sort((a,b)=>a-b);return {holdoutCount:e.length,meanAbsoluteError:e.reduce((s,x)=>s+x.absolute,0)/e.length,meanAbsolutePercentageError:e.reduce((s,x)=>s+x.relative,0)/e.length,absoluteError90:a[Math.min(a.length-1,Math.ceil(.9*a.length)-1)]};
}
const api={required,residual,comparableRange,evaluateHoldout};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.LandValue=api;
})(typeof window!=='undefined'?window:globalThis);
