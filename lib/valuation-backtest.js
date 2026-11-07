// Research-only rolling historical evaluation. Never manufactures validation metadata.
const V=require('../web/land-value');
const date=x=>typeof x==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(x)&&Number.isFinite(Date.parse(x))&&new Date(x).toISOString().slice(0,10)===x;
const median=a=>{const v=a.slice().sort((a,b)=>a-b),i=Math.floor(v.length/2);return v.length%2?v[i]:(v[i-1]+v[i])/2;};
function metrics(rows){if(!rows.length)return null;const errors=rows.map(r=>r.predicted-r.actual),ape=rows.map((r,i)=>Math.abs(errors[i])/r.actual);return {n:rows.length,meanAbsoluteError:errors.reduce((s,e)=>s+Math.abs(e),0)/rows.length,medianAbsolutePercentageError:median(ape)*100,meanBias:errors.reduce((s,e)=>s+e,0)/rows.length,within10Percent:ape.filter(e=>e<=.1).length/rows.length,within20Percent:ape.filter(e=>e<=.2).length/rows.length};}
function run(data){
 if(!date(data.asOf)||!date(data.testStart)||data.testStart>data.asOf||!data.submarket)throw Error('Dated test window and submarket required');
 const excluded=[],eligible=[],seen=new Set();
 for(const r of data.records||[]){const reasons=[];
  if(!r.id||seen.has(r.id))reasons.push('missing_or_duplicate_transaction_id');seen.add(r.id);
  if(!r.propertyKey)reasons.push('missing_property_identity');
  if(r.submarket!==data.submarket)reasons.push('outside_pilot_submarket');
  if(r.kind!=='closed_sale'||r.priceType!=='closed_price'||!(r.price>0))reasons.push('no_verified_closing_price');
  if(r.verified!==true||!/^https:\/\//.test(r.source||''))reasons.push('unverified_original_source');
  if(r.reusePermitted!==true)reasons.push('reuse_not_established');
  if(r.armLength!==true)reasons.push('transaction_conditions_unverified');
  if(!date(r.saleDate)||r.saleDate>data.asOf)reasons.push('invalid_or_future_sale_date');
  if(!date(r.availableAt)||r.availableAt<r.saleDate||r.availableAt>data.asOf)reasons.push('sale_publication_date_unverified');
  if(!date(r.featuresAsOf)||r.featuresAsOf>=r.saleDate||!/^https:\/\//.test(r.featureSource||''))reasons.push('pre_sale_features_unverified');
  if(!Number.isFinite(r.usableAcres)||r.usableAcres<=0)reasons.push('usable_area_unverified');
  if(!Array.isArray(r.adjustments)||r.adjustments.length)reasons.push('target_specific_adjustments_not_supported_by_this_baseline');
  if(reasons.length)excluded.push({id:r.id,source:r.source,reasons});else eligible.push(r);
 }
 const predictions=[],abstentions=[];
 for(const target of eligible.filter(r=>r.saleDate>=data.testStart).sort((a,b)=>a.saleDate.localeCompare(b.saleDate))){
  // Earlier sales only, and never an earlier transaction of the target parcel.
  const comps=eligible.filter(c=>c.propertyKey!==target.propertyKey&&c.saleDate<target.saleDate&&c.availableAt<target.saleDate);
  const screened=V.comparableRange(target,comps,target.saleDate,null);
  if(screened.included.length<3){abstentions.push({id:target.id,reason:'fewer_than_three_prior_eligible_comparables',comparables:screened.included.length});continue;}
  // Same median adjusted-unit-price point calculation as the current candidate model.
  // Validation gate remains closed: this research computation is not a published valuation.
  predictions.push({id:target.id,saleDate:target.saleDate,actual:target.price,predicted:median(screened.included.map(c=>c.subjectIndication)),simplePriceBaseline:median(screened.included.map(c=>c.price)),comparableIds:screened.included.map(c=>c.id)});
 }
 return {scope:data.submarket,asOf:data.asOf,testStart:data.testStart,method:'unit-comparison-v1; zero-adjustment research baseline',status:predictions.length?'research_only':'blocked_no_scorable_holdout',marketAccuracyEstablished:false,screenedRecords:(data.records||[]).length,eligibleRecords:eligible.length,predictions,abstentions,excluded,metrics:metrics(predictions),simplePriceBaselineMetrics:metrics(predictions.map(r=>({...r,predicted:r.simplePriceBaseline}))),intervalCoverage:null,limitations:['A sparse or selectively public sample cannot establish pilot-wide accuracy.','No independent interval calibration dataset supplied; interval coverage is unmeasured.','No target-specific site or time adjustments calibrated.','Residual development budgets require actual project-cost outcomes, not land sales alone.']};
}
module.exports={run,metrics};
