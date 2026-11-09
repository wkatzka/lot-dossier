const assert=require('node:assert/strict'),M=require('../web/plan-measurements'),W=require('../web/permit-workflow'),C=require('../web/city-application');
const base={id:'m1',page:1,pageSize:[1000,500],field:'main_floor',polygon:[[100,100],[500,100],[500,500],[100,500]],holes:[],controls:[{a:[0,0],b:[1000,0],feet:100,quote:'100 ft'},{a:[0,0],b:[0,1000],feet:50,quote:'50 ft'}],basis:'Exterior boundary; void excluded',documentId:'cp-plan',documentHash:'a'.repeat(64),filename:'Synthetic.pdf'};
assert.equal(M.calculate(base).value,800);assert.equal(M.calculate({...base,holes:[[[200,200],[300,200],[300,300],[200,300]]]}).value,750);
assert.equal(M.parseFeet(`12' - 6 1/2"`),12+6.5/12);assert.throws(()=>M.parseFeet(`12' - 13"`));
assert.throws(()=>M.calculate({...base,polygon:[[0,0],[500,500],[0,500],[500,0]]}),/crosses/);
assert.throws(()=>M.calculate({...base,holes:[[[0,0],[200,0],[200,200],[0,200]]]}),/inside/);
assert.throws(()=>M.calculate({...base,controls:[base.controls[0],base.controls[0]]}),/independent/);
assert.throws(()=>M.calculate({...base,controls:[base.controls[0],{...base.controls[1],feet:60}]}),/disagree/);
const setback={...base,field:'front_set_back_default',parcel:[[0,0],[1000,0],[1000,1000],[0,1000]],boundary:[[0,1000],[1000,1000]],orientation:'Front is south, road label on source',distanceBasis:'Shortest horizontal distance to line'};
assert.equal(M.calculate(setback).value,25);assert.throws(()=>M.calculate({...setback,boundary:[[0,800],[1000,800]]}),/parcel edge/);assert.throws(()=>M.calculate({...setback,orientation:''}),/orientation/);
// Rotated orthogonal layout and metric aspect ratio do not depend on screen pixels.
const rotate=([x,y])=>[1000-y,x],square={...base,pageSize:[1000,1000],controls:[{...base.controls[0],feet:100},{...base.controls[1],feet:100}]};assert.equal(M.calculate({...square,polygon:square.polygon.map(rotate)}).value,M.calculate(square).value);
let p=W.create({parcel:{id:'test',county:'Weber',attrs:{}},facts:{jurisdiction:'Ogden Valley City'},findings:[]});p=W.apply(p,{type:'document',document:{id:base.documentId,name:base.filename,hash:base.documentHash,role:'plan',family:'plans',size:1}});
assert.throws(()=>W.apply(p,{type:'plan_measurement',measurement:base,reviewer:'Test',confirmed:false}),/Confirm/);
p=W.apply(p,{type:'plan_measurement',measurement:base,reviewer:'Test',confirmed:true,permitType:'1'});assert.equal(C.rows(p,'1').find(r=>r.name==='main_floor').value,'800');assert.match(C.sheet(p),/calibrated_polygon/);assert.equal(require('../web/permit-assistant').valuationDefaults(p,'1').find(x=>x.label==='Main floor').quantity,'800');
p=W.apply(p,{type:'document',document:{id:'cp-plan-v2',name:'New.pdf',hash:'b'.repeat(64),role:'plan',family:'plans',size:1}});assert.equal(M.current(p,base),false);assert.match(C.rows(p,'1').find(r=>r.name==='main_floor').status,/changed/);assert.throws(()=>W.apply(p,{type:'plan_measurement',measurement:base,reviewer:'Test',confirmed:true}),/superseded/);
p=W.apply(p,{type:'setback_rule',side:'left',classification:'street-side',confirmed:true,orientation:'East road is frontage',source:'Controlling plat section 3',reviewer:'Test',feet:20,permitType:'1'});assert.equal(C.rows(p,'1').find(r=>r.name==='left_set_back').value,'20');
console.log('PASS: calibrated irregular polygons, holes, rotated/aspect-correct geometry, independent dimension checks, invalid geometry rejection, setback distances, permit integration and supersession.');

assert.equal(M.parseFeet('3048 mm'),10);assert.equal(M.parseFeet('3.048 m'),10);
const calibration=require('../lib/plan-calibration');assert(calibration.discover([{text:"1/4\" = 1'",x:0,y:0},{text:'20 ft',x:200,y:110},{text:'30 ft',x:410,y:250}],[[[20,100],[380,100]],[[400,0],[400,540]]],[1000,1000]));
assert.equal(M.calculate({...base,parts:[{polygon:[[600,100],[700,100],[700,200],[600,200]],holes:[]}]}).value,850);
assert.throws(()=>M.calculate({...base,parts:[{polygon:base.polygon,holes:[]}]}),/overlap/);

// Independent public sample: diagram is not consistently scaled; refuse distances.
// https://www.cityofboise.org/media/18948/sample-siteplan_rev-07032024.pdf
const normal=([x,y])=>[x/1237*1000,y/1600*1000];
assert.throws(()=>M.calibration({pageSize:[612,792],controls:[{a:normal([468,393]),b:normal([997,393]),feet:52,quote:"52.0'"},{a:normal([1087,393]),b:normal([1087,848]),feet:51,quote:"51'"}]}),/disagree/);

// Selecting a short portion identifies the entire parcel edge, never inflates setback.
assert.equal(M.calculate({...setback,boundary:[[800,1000],[900,1000]]}).value,25);
assert.throws(()=>M.calculate({...setback,boundary:[[800,1000],[800,1000]]}),/distinct/);
