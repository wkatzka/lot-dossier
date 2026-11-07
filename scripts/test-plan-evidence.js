const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const context = { console, setTimeout, clearTimeout };
vm.createContext(context);
// Expose the existing check inside this isolated test only; no test hooks ship to the browser.
vm.runInContext(fs.readFileSync('web/lotreport.js', 'utf8').replace('root.LotReport = {', 'root.planCheckForTest = C.check_plan_fit; root.LotReport = {'), context);
async function check(foundation, facts) {
  const rows = await context.planCheckForTest({plan:{foundation}, facts, parcel:{attrs:{}}, cost:()=>null});
  return rows.find(r=>r.item==='Foundation vs. groundwater');
}
(async()=>{
  const basement = await check('basement',{water_table_in:12});
  assert.equal(basement.status,'flag');
  assert.match(basement.detail,/Mapped soil-survey estimate/);
  assert.match(basement.detail,/not a groundwater measurement at the proposed foundation/);
  assert.doesNotMatch(basement.detail,/would sit in groundwater/);
  const slab = await check('slab',{water_table_in:12});
  assert.equal(slab.status,'verify');
  const boring = await check('basement',{water_table_in:60,boreholes:{gwMin:2,nearestKm:.2}});
  assert.match(boring.detail,/Nearby boring archive/);
  assert.doesNotMatch(boring.detail,/Mapped soil-survey estimate/);
  const none = await check('basement',{});
  assert.equal(none,undefined);
  console.log('Plan evidence: mapped/nearby source distinction, conditional groundwater risk and no slab all-clear passed.');
})().catch(e=>{console.error(e);process.exit(1)});
