'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const {JSDOM}=require('jsdom');
let scenario={};
const c={console,setTimeout,clearTimeout};vm.createContext(c);
vm.runInContext(fs.readFileSync('web/lotreport.js','utf8').replace('root.LotReport = {',
  'root.utilityTest={check:C.check_utilities,plan:C.check_plan_fit,documents:C.check_documents,setQueries:function(q,a){arcgisQuery=q;area=a;}};root.LotReport = {'),c);
c.utilityTest.setQueries(async url=>{
  if(scenario.failAll)throw Error('timeout');
  if(url.includes('Electric'))return scenario.empty?[]:[{attributes:{PROVIDER:'Example Electric'}}];
  if(url.includes('NaturalGas')){if(scenario.gasFailure)throw Error('timeout');return scenario.empty?[]:[{attributes:{PROVIDER:'Example Gas'}}];}
  if(url.includes('Telecom'))return [];
  return Array.from({length:33},()=>({attributes:{BUILT_YR:2023}}));
},async()=>{
  if(scenario.failAll)throw Error('timeout');
  return scenario.empty?[]:[{attributes:{brand_name:'Example Fiber',common_tech:'Fiber',category:'wired',max_advertised_download_speed:8000,max_advertised_upload_speed:8000}}];
});
const ctx=()=>({parcel:{point:{},geometry:{},county:'Weber',cx:-111.8,cy:41.3,attrs:{SUBDIV_NAME:'Synthetic subdivision'}},facts:{},cost:key=>({key})});
(async()=>{
  let x=ctx(),rows=await c.utilityTest.check(x);
  assert(rows.every(r=>r.status==='verify'));
  assert.match(rows.find(r=>r.item==='Power').detail,/33 recorded homes/);
  assert.match(rows.find(r=>r.item==='Power').detail,/do not establish/);
  assert.equal(rows.find(r=>r.item==='Power').cost,null);
  assert.match(rows.find(r=>r.item==='Internet').headline,/8 Gbps/,'Keep the source observation');
  assert.equal(x.facts.gas,true,'Map coverage remains available as an observation');
  let gas=await c.utilityTest.plan({...x,plan:{fuel:'gas'}});
  assert.equal(gas.find(r=>r.item==='Gas appliances').status,'verify');
  scenario={gasFailure:true};x=ctx();rows=await c.utilityTest.check(x);
  assert.equal(x.facts.gas,null);assert.match(rows.find(r=>r.item==='Natural gas').headline,/lookup unavailable/);
  assert.match(rows.find(r=>r.item==='Power').headline,/Example Electric/,'A failed gas source does not discard electric evidence');
  scenario={empty:true};x=ctx();rows=await c.utilityTest.check(x);
  assert(rows.every(r=>r.status==='verify'));assert.equal(x.facts.gas,false);
  assert.match(rows.find(r=>r.item==='Natural gas').detail,/does not require propane/);
  scenario={failAll:true};x=ctx();rows=await c.utilityTest.check(x);
  assert.equal(rows.length,3);assert.equal(x.facts.homes_nearby.n,null);
  assert(rows.every(r=>r.status==='verify'));assert.match(rows[0].headline,/lookup unavailable/);
  x=ctx();x.findings=[];
  x.docs=Promise.resolve({record:{plat:{approvals:['EXAMPLE SEWER']}},notices:{documents:[]}});
  await c.utilityTest.documents(x);
  assert.equal(x.facts.septic.required,null,'A plat approval block must not establish that septic is unnecessary');
  assert.match(x.findings.find(r=>r.item==='Sewer vs. septic').headline,/lot connection unverified/);
  assert.match(x.findings.find(r=>r.item==='Sewer vs. septic').detail,/subdivision-level service lead/);
  const old=[
    {item:'Power',status:'ok',headline:'Example Electric; 33 homes within 400 m',detail:'The remaining cost is the service lateral.',source:'UGRC electric service areas + county parcels',url:'https://example.org/power',cost:{key:'power_extension'}},
    {item:'Natural gas',status:'watch',headline:'No natural gas service mapped',detail:'Plan for propane or all-electric heat.',source:'UGRC natural gas service areas',cost:{key:'propane'}},
    {item:'Internet',status:'ok',headline:'Fiber reported nearby: Example 8 Gbps',detail:'Providers report area coverage.',source:'Utah Broadband Center (FCC filings)'},
    {item:'Sewer vs. septic',status:'watch',headline:'Sewered: Example Sewer serves the subdivision',detail:'The septic soil limits do not apply; budget the sewer connection and impact fee instead.',url:'https://example.org/original'},
    {item:'Gas appliances',status:'ok',headline:'Plan uses gas appliances; lot is in a natural gas service area',detail:'Confirm the main.'}
  ];
  const before=JSON.stringify(old),corrected=c.LotReport.reviewFindings(old);
  assert.equal(JSON.stringify(old),before,'Do not mutate saved/frozen snapshots');
  assert(corrected.filter(r=>r.item!=='Sewer vs. septic').every(r=>r.status==='verify'));
  assert.equal(corrected[0].cost,null);assert.equal(corrected[0].url,old[0].url);
  assert.equal(corrected[0].priorInterpretation.detail,old[0].detail);
  assert.match(corrected[3].headline,/connection unverified/);assert.doesNotMatch(corrected[3].detail,/limits do not apply/);
  assert.equal(JSON.stringify(c.LotReport.reviewFindings(corrected)),JSON.stringify(corrected),'Repeated display/export correction is stable');
  const dom=new JSDOM(fs.readFileSync('public/platform.html','utf8'),{runScripts:'outside-only',url:'https://example.org/'});
  dom.window.PlatEvidence=require('../web/plat-evidence');dom.window.LotReport=c.LotReport;dom.window.LR_DATA={costs:{}};
  const app=fs.readFileSync('web/app.js','utf8').replace(/\}\)\(\);\s*$/, 'window.renderUtilityAudit=function(r,saved){last=r;return reportHTML(r,{},saved);};})();');
  dom.window.eval(app);
  const report={parcel:{county:'Example',id:'synthetic',attrs:{PARCEL_ADD:'Synthetic parcel'},rings:[]},date:new Date('2026-11-12'),facts:{},findings:old.map(f=>({...f,section:f.item==='Sewer vs. septic'?'septic':f.item==='Gas appliances'?'plan':'utilities'}))};
  for(const saved of [false,true]){
    const html=dom.window.renderUtilityAudit(report,saved);
    assert.match(html,/Electric service to this lot is unverified/);
    assert.match(html,/lot connection unverified/);
    assert.doesNotMatch(html,/remaining cost is the service lateral|septic soil limits do not apply|Plan for propane/);
  }
  dom.window.close();
  console.log('PASS: dense neighborhood, mapped fiber/gas, empty results, independent source failure, total outage, plan gas dependency, and immutable/idempotent saved-report corrections.');
})().catch(e=>{console.error(e);process.exitCode=1;});
