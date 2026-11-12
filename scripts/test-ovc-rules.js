const assert=require('node:assert/strict'),O=require('../web/ovc-rules'),A=require('../web/area-rules'),W=require('../web/permit-workflow');
const polygon={rings:[[[-111.83,41.30],[-111.829,41.30],[-111.829,41.301],[-111.83,41.301],[-111.83,41.30]]]};
function project(){return {schemaVersion:1,propertyKey:'Weber|example',property:{county:'Weber',parcelId:'example'},siteVersion:1,planVersion:1,report:{parcel:{geometry:polygon,attrs:{SUBDIV_NAME:'EXAMPLE'}},facts:{}},application:{ruleScope:{work:'new-home',disturbance:'under-acre',commonPlan:'no'},areaMap:{version:A.version,siteVersion:1,geometryScope:'',at:'test',layers:[{id:'municipal',state:'checked',features:[{name:'OGDEN VALLEY CITY'}]},{id:'ov-zoning',state:'checked',features:[{name:'AV-3',attributes:{ZONE_NAME:'AV-3'}}]}]}},documents:[],packages:[],events:[]};}
const get=(p,id)=>A.rules(p).find(r=>r.id===id);
let p=project();assert.match(get(p,'ov-zone-AV-3').trigger,/130680/);assert.match(get(p,'ov-zone-AV-3').trigger,/24 ft/);assert.equal(get(p,'ov-hillside').applicability,'verify');
p=W.apply(p,{type:'rule_scope',...p.application.ruleScope,lotArea:'10000',frontSetback:'12',buildingHeight:'42',slope25:'yes',highwayChange:'yes',streamWork:'yes'});
assert.equal(get(p,'ov-dimensions-AV-3').applicability,'required');assert.match(get(p,'ov-dimensions-AV-3').trigger,/height exceeds/);assert.equal(get(p,'ov-hillside').applicability,'required');assert.equal(get(p,'highway').applicability,'required');assert.equal(get(p,'stream').applicability,'required');assert.equal(A.rules(p).filter(r=>r.id==='stream').length,1);
assert.equal(O.near(polygon,{paths:[[[-111.831,41.3005],[-111.828,41.3005]]]}),0);
const d=O.near(polygon,{paths:[[[-111.828,41.30],[-111.828,41.301]]]});assert(d>250&&d<300);
const q=project();q.application.areaMap.layers[1].features=[{name:'F-5'}];assert.match(get(q,'ov-zone-F-5').trigger,/3525/);assert(!O.zones['F-5'].height);
q.application.areaMap.layers[1].features=[{name:'CV-2'}];assert.match(get(q,'ov-zone-CV-2').trigger,/two stories 20 ft/);
q.application.areaMap.layers[1].state='unavailable';q.application.areaMap.layers[1].features=[];assert.match(get(q,'ov-zone-match').trigger,/unavailable/);
assert.throws(()=>W.apply(project(),{type:'rule_scope',work:'new-home',disturbance:'',commonPlan:'',workGeometry:'{"rings":[]}'}),/valid work/);
p=W.apply(project(),{type:'rule_scope',work:'new-home',disturbance:'',commonPlan:'',workGeometry:JSON.stringify(polygon)});assert.match(A.blockers(p)[0],/work\/access changed/);
p.application.areaMap.geometryScope=JSON.stringify(polygon);p=W.apply(p,{type:'rule_review',id:'ov-zone-AV-3',state:'approved',reviewer:'Example reviewer',note:'Synthetic test only',url:'https://example.org/evidence'});assert(A.reviewCurrent(p,get(p,'ov-zone-AV-3')));p.planVersion++;assert(!A.reviewCurrent(p,get(p,'ov-zone-AV-3')));
for(const key of ['104-2','104-3','104-8','104-9','104-10','104-11','104-14','104-19','104-20','104-21','104-26','104-28','108-18','108-22'])assert(O.sources[key]?.sha256.length===64,key);
console.log('PASS: OVC zone standards, dimensions, source ambiguity, slope/highway/stream triggers, spatial crossing and distance, unavailable zoning, drawing validation, stale maps and evidence.');
