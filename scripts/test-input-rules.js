/* Every input has a sensible rule, inferred from its label: no negative money or areas, real emails, phones,
   ZIPs and dates, whole-number counts. Values Cornerpin pre-fills must pass the same rules. */
const assert=require('node:assert/strict');
const IR=require('../web/input-rules'),C=require('../web/city-application'),W=require('../web/permit-workflow'),P=require('../web/permit-packet');
const ok=(label,v,type)=>assert.equal(IR.check(v,IR.rule(label,'',type)),'',label+' should accept '+v);
const bad=(label,v,type)=>assert.notEqual(IR.check(v,IR.rule(label,'',type)),'',label+' should reject '+v);
ok('Builder Valuation:','250000','number');ok('Builder Valuation:','$250,000');bad('Builder Valuation:','-19','number');bad('Builder Valuation:','abc','number');
ok('Lot Footage:','135091','number');bad('Lot Footage:','-5','number');
ok('Main Floor:','1800','number');bad('Main Floor:','-1','number');bad('Garage:','5000000','number');
ok('Builder Email:','sam@peak.example.com');bad('Builder Email:','sam@peak');bad('Owner Email:','not an email');
ok('Builder Phone #:','801-555-0100');ok('Contact Phone #:','(801) 555 0100');ok('Owner Phone:','+1 801 555 0100');bad('Builder Phone #:','555-0100');bad('Owner Phone:','call me');
ok('Builder Zip:','84310');ok('Owner Zip:','84310-1234');bad('Plumbing Zip:','8431');bad('Builder Zip:','UT');
ok('Builder State:','UT');ok('Owner State:','Utah');bad('Owner State:','8');
ok('Application Date:','2026-11-13');ok('Date:','11/13/2026');bad('Application Date:','2026-02-30');bad('Date:','tomorrow');
ok('Bedrooms:','4');bad('Bedrooms:','3.5');bad('Bedrooms:','-1');ok('Bathrooms:','2.5');bad('Bathrooms:','2.3');ok('Stories:','2');bad('Stories:','40');
ok('# of Units:','1','number');bad('# of Units:','1.5','number');ok('Number of Buildings:','2','number');
ok('Min. Front Setback:','30');ok('Actual Front Set Back:','30 ft');bad('Actual Rear Set Back:','-10');
ok('Latitude:','41.28');bad('Latitude:','141');ok('Longitude:','-111.8');
ok('Centre east of parcel centre (ft)','-12','number');ok('Rotation (degrees)','-45','number');bad('Pool width (ft)','-12','number');
ok('Power AMPS:','200');bad('Power VOLTS:','-240');ok('Installed kW Capacity:','7.2');
ok('Lot #:','4');ok('Account #:','R123');ok('Description:','Pool and deck');ok('Subdivision:','Trappers Ridge');
assert.equal(IR.rule('Some unknown number field','','number').min,0,'Unknown numeric fields still default to 0 or more');
console.log('PASS: input rules accept real answers and reject negative money/areas, bad emails, phones, ZIPs, dates and fractional counts.');

// The city form refuses a bad answer at save time with a plain message.
const facts={jurisdiction:'Ogden Valley City',zone_std:{zone:'RE-15',front:30,side:10,rear:30},lot_sf:17424,stepsRun:{check_parcel:'x'}};
const report={parcel:{county:'Weber',id:'222320023',attrs:{PARCEL_ADD:'3459 N WIND RIVER CT',PARCEL_ACRES:0.4}},date:'2026-11-13',findings:[],facts:{...facts,owner:'Jane Owner',packets:{'1':P.build('1',{facts,findings:[]}),'2':P.build('2',{facts,findings:[]})}}};
let p=W.create(report,'2026-11-13T00:00:00Z');p.application.jurisdiction='Ogden Valley City';
const types=[...new Set(require('../data/permits/ogden-valley-cityinspect.json').types.map(t=>t.value))];
const field=(id,re)=>C.rows(p,id).find(r=>re.test(r.label)&&!r.locked);
const email=field('1',/Builder Email/);assert.throws(()=>C.update(p,{permitType:'1',fieldKey:email.key,value:'sam@',basis:'User'}),/Builder Email: Enter an email/);
const zip=field('1',/Owner Zip/);if(zip)assert.throws(()=>C.update(p,{permitType:'1',fieldKey:zip.key,value:'843',basis:'User'}),/ZIP/);
console.log('PASS: the city form rejects a bad answer at save time with a plain message naming the field.');

// Nothing Cornerpin pre-fills may break its own rule (otherwise the page could never be saved).
const broken=[];for(const id of types)for(const r of C.rows(p,id)){if(r.locked||r.options||!String(r.value??'').trim())continue;const e=IR.check(r.value,IR.rule(r.label,r.name,r.type));if(e)broken.push(id+' · '+r.label+' = '+JSON.stringify(r.value)+' → '+e);}
assert.deepEqual(broken,[],'Pre-filled answers that break their rule:\n'+broken.join('\n'));
console.log('PASS: every answer Cornerpin pre-fills, on every permit type, passes its input rule.');
// Setback answers say where the number comes from: a recorded plat note is not the base zoning, and they can differ.
{const C2=require('../web/city-application');const q={property:{address:'5241 E COBABE RANCH RD'},documents:[],application:{},report:{parcel:{county:'Weber',id:'x',attrs:{}},facts:{jurisdiction:'Ogden Valley City',zone:'AV-3',zone_std:{zone:'plat',front:20,rear:20}},findings:[{item:'Zoning',headline:"AV-3 Agricultural Valley: 30' front, 10' side (24' both sides), 30' rear, 35' max height"}]}};
 const front=C2.rows(q,'1').find(r=>/Min\. Front/.test(r.label));assert.equal(String(front.value),'20');
 assert(/Recorded plat setback note/.test(front.basis)&&/base AV-3 zoning sets 30 ft/.test(front.basis)&&/not confirmed/.test(front.basis),front.basis);
 console.log('PASS: plat-based setbacks name their source and flag a conflict with base zoning.');}
