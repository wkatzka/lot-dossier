const assert=require('node:assert/strict'),{recover,centreline}=require('../lib/survey-topology');
function stroke(a,b,w=.2){const dx=b[0]-a[0],dy=b[1]-a[1],len=Math.hypot(dx,dy),n=[-dy/len*w/2,dx/len*w/2],p=a.map((v,i)=>v+n[i]),q=a.map((v,i)=>v-n[i]),r=b.map((v,i)=>v+n[i]),s=b.map((v,i)=>v-n[i]);return {layer:'S-LOT',fill:true,stroke:true,commands:[['M',...p],['L',...q],['L',...r],['Z'],['M',...q],['L',...r],['L',...s],['Z']]};}
const ring=[[0,0],[100,0],[100,100],[0,100],[0,0]],paths=ring.slice(1).map((p,i)=>stroke(ring[i],p)),page={page:1,paths,labels:[{text:'LOT 7',position:[50,50]}]};
let result=recover(page);assert.equal(result.candidates.length,1);assert.equal(result.candidates[0].areaSquarePoints,10000);assert.equal(result.complete,false);assert.equal(result.candidates[0].reviewed,false);
assert.equal(recover({...page,paths:paths.slice(1)}).candidates.length,0,'Missing side must not be closed synthetically');
assert.equal(recover({...page,labels:[...page.labels,{text:'LOT 8',position:[60,50]}]}).candidates.length,0,'Multi-lot envelope cannot be a single lot');
assert.equal(centreline([[0,0],[1,0],[0,1]],[[4,4],[4,5],[5,5]]),null);
assert.equal(recover({...page,paths:[{layer:'S-LOT',fill:false,stroke:true,commands:[['M',0,0],['C',1,1,2,2,3,3]]}]}).unresolved.length,1);
assert.throws(()=>recover(page,{snapPoints:10}),/snapping/);
const B=require('../web/survey-boundary'),P=require('proj4');P.defs('EPSG:26912','+proj=utm +zone=12 +datum=NAD83 +units=m +no_defs');
const coords=ring.map(([x,y])=>P('EPSG:26912','EPSG:4326',[430000+x,4573000+y]));
const doc={url:'https://example.org/survey.pdf',sha256:'a'.repeat(64),alignment:{registration:{withinTolerance:true,parameters:{a:1,b:0,tx:430000,ty:4573000},scale:1,crs:'EPSG:26912'}},vectors:{pages:[{...page,topology:result}]}};
const check=B.compare(doc,{rings:[coords]},{lot:'7',acres:10000/4046.8564224});assert.equal(check.candidates[0].agreement,true);assert.equal(check.candidates[0].reviewed,false);assert.equal(B.compare(doc,{rings:[coords]},{lot:'8'}).candidates.length,0);
assert.equal(B.compare({...doc,alignment:null},{rings:[coords]}).status,'unavailable');
const G=require('../web/placement-engine'),o=[-111.8,41.2],wide=G.rectangle(o,0,0,100,100),narrow=G.rectangle(o,0,0,20,100);
const placement=G.evaluate({boundary:wide,toleranceM:.3,components:[{name:'Pool',geometry:G.rectangle(o,20,0,4,8),setbackM:1,ruleSource:'scenario'}],additionalBoundaries:[{name:'Survey candidate',geometry:narrow.geometry,source:'https://example.org',reviewed:false}]});
assert(placement.conflicts.some(c=>c.includes('Survey candidate')));assert.equal(placement.precisePlacement,false);
console.log('Survey topology and independent parcel comparison tests passed');
