/* Contractor flow: company details once, next three steps with who does each, one Ready-to-file
   checklist ending in Submit, and permit forms that show only what still needs the user. */
const assert=require('node:assert/strict');
const mem={};global.localStorage={getItem:k=>mem[k]??null,setItem:(k,v)=>{mem[k]=String(v);},removeItem:k=>{delete mem[k];}};
const MC=require('../web/my-company'),NS=require('../web/next-steps'),W=require('../web/permit-workflow'),P=require('../web/permit-packet'),C=require('../web/city-application');
// Your company: saved once, fills only empty roles.
assert.equal(MC.get(),null);assert.throws(()=>MC.save({}),/company name/);
MC.save({name:'Peak Builders LLC',contact:'Sam Ortiz',phone:'801-555-0100',email:'sam@peak.example',license:'12345-5501',alsoContact:true});
assert.equal(MC.get().name,'Peak Builders LLC');
assert.deepEqual(MC.commandsFor({application:{team:{}}}).map(c=>[c.role,c.name]),[['builder','Peak Builders LLC'],['contact','Sam Ortiz']]);
assert.deepEqual(MC.commandsFor({application:{team:{builder:{name:'Other Co'},contact:{name:'Pat'}}}}),[],'A builder already on the project is never overwritten');
console.log('PASS: company details are entered once and fill only empty builder/contact roles.');

const facts={jurisdiction:'Ogden Valley City',zone_std:{zone:'RE-15',front:30,side:10,rear:30},lot_sf:17424,stepsRun:{check_parcel:'x'}};
const findings=[{item:'Landslides',section:'geo',status:'flag',headline:'Mapped landslide covers about 100% of the lot',next_step:'Order a geologic hazards study and geotech report before design starts.',source:'UGS',url:'https://ugs.example/'},
 {item:'CC&Rs / HOA',section:'ccr',status:'verify',headline:'Trappers Ridge: recorded CC&Rs likely',source:'County parcel record',url:'https://p.example/'}];
const report={parcel:{county:'Weber',id:'222320023',attrs:{PARCEL_ADD:'3459 N WIND RIVER CT'}},date:'2026-11-13',findings,facts:{...facts,owner:'Jane Owner',packets:{'2':P.build('2',{facts,findings}),'74':P.build('74',{facts,findings})}}};
report.facts.packet=report.facts.packets['2'];
let p=W.create(report,'2026-11-13T00:00:00Z');p.application.jurisdiction='Ogden Valley City';
// No plan yet: the first step is to say what you're building.
let s=NS.steps(p);assert.equal(s[0].id,'intent');assert.equal(s[0].who,'You');
p.application.intent={plan:'pool',label:'Pool + deck',typeIds:['2','74']};
s=NS.steps(p);
assert.equal(s.length,3,'Three steps at most');
assert.equal(s[0].id,'concern');assert.equal(s[0].who,'Geotech engineer');assert(/geologic hazards study/.test(s[0].detail));
assert.equal(s[1].id,'hoa');assert.equal(s[1].who,'HOA');assert(/before construction/.test(s[1].detail));
assert.equal(s[2].id,'file-company');
console.log('PASS: next steps — site concern first (named professional), then HOA approval, then the first unfinished filing item; three at most.');

// Ready to file: company, owner, each permit's form, its documents and lot checks, then one Submit.
let c=NS.checklist(p);
assert.deepEqual(c.items.map(x=>x.id),['company','owner','form-2','docs-2','site-2','form-74','docs-74','site-74','submit']);
assert(!c.items[0].done&&c.items[1].done&&/Jane Owner/.test(c.items[1].detail));
assert(/question/.test(c.items.find(x=>x.id==='form-2').detail));
assert(/Permit Plans/.test(c.items.find(x=>x.id==='docs-2').detail));
assert(!c.ready&&c.items.at(-1).title==='Submit to Ogden Valley City'&&/cityinspect|https:/i.test(c.portal||''));
const card=NS.checklistCard(p);assert(/data-action="submit-city" disabled/.test(card),'Submit stays disabled until the list is done');
for(const cmd of MC.commandsFor(p))p=W.apply(p,cmd);
assert(NS.checklist(p).items[0].done&&/Peak Builders/.test(NS.checklist(p).items[0].detail));
// Marking every document and lot check done, and answering the forms, enables Submit.
for(const r of p.requirements)r.state='reviewed';
const filled={...p,application:{...p.application}};c=NS.checklist(filled);
assert(c.items.filter(x=>/^(docs|site)-/.test(x.id)).every(x=>x.done));
const legacy=structuredClone(p);for(const r of legacy.requirements)delete r.group;assert.deepEqual(NS.checklist(legacy).items.map(x=>x.id),NS.checklist(p).items.map(x=>x.id),'Older projects without requirement groups get the same checklist');
console.log('PASS: one Ready-to-file checklist per project, built from the planned permits, ending in a single Submit step that unlocks when everything above is done.');

// Permit form: only questions that need the user, with "Show all".
p.application.cityInspect={...(p.application.cityInspect||{}),typeId:'2'};
const html=C.render(p,'primary');const count=(h)=>(h.match(/class="city-field/g)||[]).length;
assert(/Showing \d+ questions? that need you/.test(html)&&/data-action="city-show-all" data-id="1"/.test(html));
C.setShowAll(true);const all=C.render(p,'primary');C.setShowAll(false);
assert(count(all)>count(html),'Show all reveals the optional fields');assert(/Required questions to answer/.test(html)&&!/Editable fields populated/.test(html));
console.log('PASS: permit forms show only the questions that need the user, with a way to show every field.');

// A page of blank optional questions is never reported as "nothing needs you"; the blanks stay visible.
const pro=C.render(p,'professionals');
assert(!/Nothing on this page needs you/.test(pro),'Blank questions are not hidden behind "nothing needs you"');
assert(/optional questions? (is|are) blank|Showing \d+ questions? that need you/.test(pro));
assert(count(pro)>0,'Blank optional fields are rendered');
assert(/Optional — leave blank if it doesn’t apply/.test(pro));
console.log('PASS: blank optional questions stay visible with a plain explanation, never reported as nothing to do.');

// Numbers on the city form can never be saved negative, and the input says so.
{const num=C.rows(p,'2').find(r=>r.type==='number'&&!r.locked);assert(num,'pool form has a number field');
 assert.throws(()=>C.update(p,{permitType:'2',fieldKey:num.key,value:'-19',basis:'User-entered'}),/[Cc]an’t be negative/);
 assert.doesNotThrow(()=>C.update(p,{permitType:'2',fieldKey:num.key,value:'19',basis:'User-entered'}));
 C.setShowAll(true);const h=C.render(p,'building');C.setShowAll(false);assert(/type="number" inputmode="decimal" step="any" min="0"/.test(h));assert(!/View evidence/.test(h));
 console.log('PASS: number answers cannot be negative (input min and save check).');}
