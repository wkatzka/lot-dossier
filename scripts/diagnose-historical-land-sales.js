// A deliberately separate, retrospective gross-acre sanity check.
// Does NOT run or validate the production usable-acre valuation model.
const fs = require('node:fs');
const {metrics} = require('../lib/valuation-backtest');
const median = values => {
  const a = values.slice().sort((a,b)=>a-b), i = Math.floor(a.length/2);
  return a.length % 2 ? a[i] : (a[i-1]+a[i])/2;
};
function diagnose(seed) {
  const excluded = [], rows = [], seen = new Set();
  for (const r of seed.records || []) {
    const reasons = [];
    if (!r.mls || seen.has(r.mls)) reasons.push('missing_or_duplicate_id');
    seen.add(r.mls);
    if (r.sourceFeatures?.improvements) reasons.push('includes_buildings');
    if (!(r.soldPrice > 0) || !(r.grossAcres > 0)) reasons.push('missing_price_or_area');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(r.soldDate || '') || !Number.isFinite(Date.parse(r.soldDate))) reasons.push('missing_sale_date');
    if (!r.source || !r.page || !r.parcelIds?.length) reasons.push('missing_source_or_identity');
    if (reasons.length) excluded.push({id:r.mls,reasons}); else rows.push(r);
  }
  rows.sort((a,b)=>a.soldDate.localeCompare(b.soldDate));
  const predictions = [], abstentions = [];
  for (const target of rows) {
    const prior = rows.filter(r=>r.soldDate < target.soldDate &&
      !r.parcelIds.some(p=>target.parcelIds.includes(p)));
    // Two earlier observations is enough for a warning diagnostic, NOT validation.
    if (prior.length < 2) { abstentions.push({id:target.mls,reason:'fewer_than_two_prior_sales'}); continue; }
    const predicted = median(prior.map(r=>r.soldPrice/r.grossAcres))*target.grossAcres;
    predictions.push({id:target.mls,address:target.address,saleDate:target.soldDate,
      grossAcres:target.grossAcres,actual:target.soldPrice,predicted,
      error:predicted-target.soldPrice,absolutePercentageError:Math.abs(predicted-target.soldPrice)/target.soldPrice*100,
      simplePriceBaseline:median(prior.map(r=>r.soldPrice)),comparableIds:prior.map(r=>r.mls),
      source:target.source,page:target.page});
  }
  return {status:'retrospective_sanity_check_only',method:'median price per gross acre; no adjustments; at least two earlier sales',
    productionModelTested:false,marketAccuracyEstablished:false,publicInformationReplay:false,
    screenedRecords:seed.records.length,includedRecords:rows.length,excluded,abstentions,predictions,
    descriptiveMetrics:metrics(predictions),
    simplePriceBaselineMetrics:metrics(predictions.map(r=>({...r,predicted:r.simplePriceBaseline}))),
    limitations:[
      'Only three source-selected land observations, not a representative sample. One scored target is not an accuracy estimate.',
      'Source reports were published after these transactions; this cannot establish what a public-data product could predict at the time.',
      'Gross acreage is used explicitly, not substituted for usable acreage in the production model.',
      'Historical parcel scope, transaction conditions, entitlements and services are not independently reconciled.',
      'No adjustments for time, size, location, water rights or development status; no interval calibration.',
      'These large agricultural/development tracts do not establish accuracy for finished residential lots.'
    ]};
}
if (require.main === module) {
  const [input,output] = process.argv.slice(2);
  if (!input || !output) throw Error('Usage: node scripts/diagnose-historical-land-sales.js seed.json output.json');
  const result = diagnose(JSON.parse(fs.readFileSync(input,'utf8')));
  fs.writeFileSync(output,JSON.stringify(result,null,2)+'\n');
  console.log(JSON.stringify({status:result.status,predictions:result.predictions,metrics:result.descriptiveMetrics}));
}
module.exports = {diagnose};
