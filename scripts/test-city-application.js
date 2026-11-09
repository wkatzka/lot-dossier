const assert=require('node:assert/strict'),fs=require('node:fs'),{JSDOM}=require('jsdom');
const C=require('../web/city-application'),W=require('../web/permit-workflow');
const report={date:'2026-11-09',parcel:{county:'Weber',id:'synthetic',cx:-111.9,cy:41.2,attrs:{PARCEL_ADD:'Synthetic parcel',SUBDIV_NAME:'Example',PARCEL_ACRES:1}},plan:{residence_sf:3000,garage_sf:800,bedrooms:4,stories:2},facts:{jurisdiction:'Ogden Valley City',lot_sf:43560,zone:'Example zone',parcelDoc:{lot:2},zone_std:{front:30,side:10,rear:30},valuation:{estimate:700000}},findings:[]};
let p=W.create(report);const change=a=>p=W.apply(p,{type:'city_application',...a});
const row=(name,id='1')=>C.rows(p,id).find(r=>r.name===name);
assert.equal(C.catalog.types.length,38);
for(const t of C.catalog.types){assert(C.rows(p,t.value).length>0);for(const keys of Object.values(t.sections))for(const k of keys)assert(C.catalog.fields[k]);}
assert.equal(row('main_floor').value,'');assert.equal(row('builder_valuation').value,'');assert.equal(row('garage_footage').value,'800');assert.equal(row('lot_footage').value,'43560');
assert.equal(row('front_set_back_default').value,'');assert.equal(row('front_set_back','2').value,'');assert.equal(row('garage_footage','3').value,'');
assert.equal(C.rows({...p,report:{...report,facts:{jurisdiction:'Other City'}}},'1').length,0);
change({permitType:'1'});const key=row('builder_valuation').key;
assert.throws(()=>change({permitType:'1',fieldKey:key,value:'500000',basis:''}),/basis/);
change({permitType:'1',fieldKey:key,value:'500000',basis:'Scope-specific contractor estimate, dated today'});assert.equal(row('builder_valuation').value,'500000');assert.equal(row('builder_valuation','2').value,'');
change({permitType:'2'});change({permitType:'1'});assert.equal(row('builder_valuation').value,'500000');
const ack=row('other167');assert(ack.locked);assert.throws(()=>change({permitType:'1',fieldKey:ack.key,value:'XX',basis:'user'}),/portal/);
const option=row('notify_contact');assert.throws(()=>change({permitType:'1',fieldKey:option.key,value:'made-up',basis:'user'}),/option/);
p=W.apply(p,{type:'sync_report',report});assert.match(row('builder_valuation').status,/review saved answer/);
const saved=JSON.parse(JSON.stringify(p));assert.equal(C.sheet(saved),C.sheet(p));assert.match(C.sheet(p),/NOT SUBMITTED/);assert.match(C.sheet(p),/500000/);
change({permitType:'1',fieldKey:key,reset:'yes'});assert.equal(row('builder_valuation').value,'');
change({permitType:'1',fieldKey:row('description').key,value:'<img src=x onerror=alert(1)>',basis:'User scope'});assert(!C.render(p).includes('<img'));
// Render every actual type and exercise the same FormData -> workflow path used by the workspace.
for(const t of C.catalog.types){change({permitType:t.value});const dom=new JSDOM(C.render(p));const form=dom.window.document.querySelector('form[data-command]');assert.equal(new dom.window.FormData(form).get('permitType'),t.value);assert.equal(dom.window.document.querySelectorAll('details').length,4);dom.window.close();}
change({permitType:'1'});let dom=new JSDOM(C.render(p));let form=[...dom.window.document.forms].find(f=>f.querySelector('[name=fieldKey]')?.value===row('nickname').key);form.querySelector('[name=value]').value='New dwelling';form.querySelector('[name=basis]').value='Owner scope';p=W.apply(p,{type:'city_application',...Object.fromEntries(new dom.window.FormData(form))});dom.window.close();dom=new JSDOM(C.render(JSON.parse(JSON.stringify(p))));assert([...dom.window.document.querySelectorAll('textarea[name=value]')].some(e=>e.value==='New dwelling'));dom.window.close();
console.log('PASS: 38 mapped types; field safety, scope isolation, persistence, refresh review, rendered form edits and export.');
