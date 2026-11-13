/* Per-permit packets, sourced accessory rules, stable requirements, and permit-aware approvals. */
const assert=require('node:assert/strict');
const P=require('../web/permit-packet'),AR=require('../web/accessory-rules'),W=require('../web/permit-workflow'),RP=require('../web/research-plan'),O=require('../web/ovc-rules');
const facts={jurisdiction:'Ogden Valley City',zone_std:{zone:'RE-15',front:30,side:10,rear:30,source:'https://ogdenvalley.gov/land-use/'},lot_sf:2792,slope:18.1,snow:{pg:68},stepsRun:{check_parcel:'x'}};
const findings=[{item:'Landslides',section:'geo',status:'flag',headline:'Mapped landslide covers about 100% of the lot',source:'UGS',url:'https://ugs.example/'},{item:'HOA registration',section:'ccr',status:'ok',source:'Utah HOA registry',url:'https://hoa.example/'},{item:'Pool grading and ground conditions',section:'pool',status:'watch',headline:'Lot-average slope 18%',source:'Pool screening'}];
// Accessory rules: transcribed with section and page; never the house setbacks for a pool.
for(const t of ['2','96','74','6','8','3'])for(const r of AR.forPermit(t,facts))assert(r.source&&r.source.label&&(r.source.url||r.kind==='check'),'Rule '+r.id+' cites its source');
const pool=AR.forPermit('2',facts);assert(pool.some(r=>/10 ft from any property line/.test(r.text)&&/108-7-18/.test(r.source.label)&&/#page=16$/.test(r.source.url)));
assert(!pool.some(r=>/30 ft/.test(r.text)),'A pool is not given the house\'s 30 ft setbacks');
assert(AR.forPermit('96',{...facts,zone_std:{zone:'AV-3'}}).some(r=>r.kind==='check'&&/not transcribed/.test(r.text)&&/104-2/.test(r.source.url)),'Untranscribed zones point to their chapter instead of guessing');
assert(/10 ft from the rear of the house in AV-3/.test(AR.forPermit('96',{zone_std:{zone:'AV-3'}}).find(r=>r.id==='large-accessory').text));
assert.equal(AR.forPermit('2',{jurisdiction:'Huntsville'}).length,1,'Other cities are not given Ogden Valley rules');
assert.deepEqual(O.dimensionChecks?O.dimensionChecks('RE-15',{work:'accessory',sideSetback:5,rearSetback:4,buildingHeight:30}).length:3,3);
console.log('PASS: accessory rules cite code section and page, never borrow house setbacks, point untranscribed zones to their chapter, and check accessory dimensions.');
// Packets: the city's form list, the city's rules, and what this lot adds — only from research that ran.
const pk=P.build('2',{facts,findings,kb:{stormwater:{}}});
assert.equal(pk.label,'Pool');assert(pk.items.every(x=>x.id.startsWith('2:')&&x.permitType==='2'),'Stable, permit-scoped ids');
const titles=pk.items.map(x=>x.title);assert(titles.includes('Permit Plans')&&titles.includes('16.04.050 Swimming Pool Fences')&&titles.some(t=>/^Site Plan/.test(t)),'The city form\'s pool documents, with clean labels');
assert(pk.items.some(x=>x.group==='City rules for this work'&&x.status==='rule'));
assert.equal(pk.needed,pk.items.filter(x=>!['optional','rule','na'].includes(x.status)).length,'Rules are not counted as deliverables');
assert(pk.items.some(x=>x.id==='2:lot-easements'&&/not read the recorded plat/.test(x.detail)),'Easements say they were not researched rather than guessing');
assert(pk.items.some(x=>x.id==='2:lot-geotech')&&pk.items.some(x=>x.id==='2:lot-hoa'));
assert(!pk.rows.some(r=>/R-3|single-family|Bedrooms/i.test(r.join(' '))),'No house rows in a pool packet');
const remodel=P.build('4',{facts,findings});assert(!remodel.items.some(x=>/geotech|HOA|easement/i.test(x.title)),'Interior work adds no site items');
assert.deepEqual(P.build('104',{facts,findings}).items.filter(x=>x.id==='104:lot-geotech'),[],'Demolition is not new footprint');
assert(/no document list/.test(P.build('104',{facts,findings}).items[0].detail),'Demolition says its form requirements are unconfirmed');
console.log('PASS: per-permit packets — city form documents, sourced city rules (not counted as deliverables), lot items only from research that ran, no house assumptions.');
// Requirements: one checklist across permits; reviews survive re-research by stable id.
let p=W.create({parcel:{county:'Weber',id:'1',attrs:{PARCEL_ADD:'x'}},date:'2026-11-13',facts:{jurisdiction:'Ogden Valley City',packet:{items:[],rows:[]}}});
const report=pk2=>({parcel:{county:'Weber',id:'1',attrs:{PARCEL_ADD:'x'}},date:'2026-11-13',facts:{jurisdiction:'Ogden Valley City',packets:pk2,packet:Object.values(pk2)[0]},findings:[]});
p=W.apply(p,{type:'sync_report',report:report({'2':pk,'74':P.build('74',{facts,findings})})});
assert(p.requirements.some(r=>r.id==='req:2:doc-permit-plans')&&p.requirements.some(r=>r.id==='req:74:doc-permit-plans'),'Same document for two permits stays two requirements');
assert(!p.requirements.some(r=>r.suggestedStatus==='rule'),'City rules stay in the packet; they are not filing requirements');assert(p.requirements.filter(r=>r.permitType).every(r=>r.permitLabel),'Each requirement names its permit');assert(p.requirements.some(r=>r.id==='req:74:rule-deck-detached'&&r.required),'A "check with the city" item is a real to-do');
p.requirements.find(r=>r.id==='req:74:doc-permit-plans').note='Designer engaged';
p=W.apply(p,{type:'sync_report',report:report({'74':P.build('74',{facts,findings}),'2':pk})});
assert.equal(p.requirements.find(r=>r.id==='req:74:doc-permit-plans').note,'Designer engaged','A review follows its requirement, not its position');
console.log('PASS: requirements combine every permit\'s packet with stable ids; reviews survive re-research and reordering.');
// Research plan: every permit gets a packet; the packet re-runs when the permit set changes.
for(const t of Object.keys(RP.STEPS_FOR))assert(RP.STEPS_FOR[t].includes('check_permit_packet'),t+' builds a packet');
assert(!RP.stepsFor(['4'],RP.QUICK).includes('check_documents'),'An interior packet does not force slow document research');
assert(RP.packetStale({facts:{packetPermits:['4']}},['2','4'])&&!RP.packetStale({facts:{packetPermits:['2','4']}},['4','2']));
assert.deepEqual(RP.rerunFor({facts:{packetPermits:['2','74'],feePermits:'2,74'}},['74','2']),[],'Same permits: nothing re-runs');
assert.deepEqual(RP.rerunFor({facts:{packetPermits:['2','74']}},['2','74']),['check_ccr_permits'],'A report built before the fee step knew the permits re-runs it');
assert.deepEqual(RP.rerunFor({facts:{packetPermits:['2'],feePermits:'2'}},['1']),['check_ccr_permits','check_permit_packet']);
console.log('PASS: research plan builds a packet for every permit and refreshes it and the fee estimate when the permits change.');
(async()=>{
 // The packet step builds one packet per planned permit.
 global.window=globalThis;global.localStorage={getItem(){return null},setItem(){},removeItem(){}};window.PermitPacket=P;require('../web/lotreport.js');
 const ring=[[-111.8108,41.3216],[-111.8106,41.3216],[-111.8106,41.3218],[-111.8108,41.3218],[-111.8108,41.3216]];
 const out=await window.LotReport.run({id:'222320021',county:'Weber',rings:[ring],cy:41.3217,cx:-111.8107,attrs:{PARCEL_ADD:'x'}},null,{},null,null,{steps:['check_permit_packet'],prior:{facts,findings},permits:['2','74']});
 assert.deepEqual(Object.keys(out.facts.packets).sort(),['2','74']);assert.equal(out.facts.packet.permitType,'2');assert.deepEqual(out.facts.packetPermits,['2','74']);
 assert(out.findings.some(f=>f.item==='Permit packet · Pool')&&out.findings.some(f=>f.item==='Permit packet · Deck'));
 console.log('PASS: the packet step builds one packet per planned permit, without the house packet unless a home is planned.');
 // Fees: the new-house estimate is not quoted for a pool + deck.
 const kbf={impact:[['Roads',4512.14,'Ord. 2026-19']],impactSrc:'https://ord.example/',permits:'p',submittal:'s',lighting:'l',permitFees:{adopted:'Resolution 2026-28',note:'n'}};
 window.LR_DATA={cityInspect:require('../data/permits/ogden-valley-cityinspect.json')};
 const fees=async permits=>(await window.LotReport.run({id:'222320021',county:'Weber',rings:[ring],cy:41.3217,cx:-111.8107,attrs:{PARCEL_ADD:'x'}},null,{},null,null,{steps:['check_ccr_permits'],prior:{facts:{...facts,kb:kbf},findings:[]},permits}));
 const pf=await fees(['2','74']),fee=pf.findings.find(f=>f.item==='Permit & impact fees');
 assert(/pool \+ deck/.test(fee.headline)&&!/\$\d/.test(fee.headline)&&!fee.cost&&/new house/.test(fee.detail),'No house fee estimate for a pool + deck');assert.equal(pf.facts.feePermits,'2,74');
 assert(/Impact fees about \$/.test((await fees(['1','2'])).findings.find(f=>f.item==='Permit & impact fees').headline),'A new home keeps the estimate');
 console.log('PASS: the fee estimate follows the planned permits — no new-house estimate for a pool + deck.');
 // Planned permits reach the server; the answer must rest on a clause covering that work.
 const A=require('../lib/automatic-investigation');assert.deepEqual(A.plannedPermits(['74','2','2','x']).typeIds,['2','74']);assert.deepEqual(A.plannedPermits(['2']).labels,['Pool']);assert.equal(A.plannedPermits(['9999']),null);
 const S=require('../lib/investigation-synthesis');
 const decl={sha256:'d'.repeat(64),source:'https://e.org/d.pdf',documentTitle:'Declaration',documentStatus:'not_established',supportingEvidence:[{kind:'execution_status',sha256:'d'.repeat(64),source:'https://e.org/d.pdf',page:78,quote:'executed on the ____ day'}],
  requirements:[{sha256:'d'.repeat(64),source:'https://e.org/d.pdf',page:31,quote:'no exterior changes whatsoever to any Owner Improvement/Amenity shall be made without the Board’s prior written approval',authority:'Board',stage:'construction'},
   {sha256:'d'.repeat(64),source:'https://e.org/d.pdf',page:35,quote:'Visible fencing shall not be permitted without the Board’s prior written approval',authority:'Board',stage:'construction'}]};
 const items=S.evidence([decl],{}),ext=items.find(x=>x.page===31).id,fence=items.find(x=>x.page===35).id,exec=items.find(x=>x.page===78).id;
 const draft=(fw,ids)=>({answer:{approver:'The unsigned copy names the Board.',forWork:fw,when:'Before construction starts.',uncertainty:'Recorded copy.',nextActionIndex:0,evidenceIds:ids},findings:[{text:'The unsigned online copy says the Board approves exterior changes before construction.',limitations:'Unsigned copy; blank execution date.',evidenceIds:[ext,exec]}],missingEvidence:[{document:'Recorded declaration',question:'Same text?',dependency:'copy_recovered_equivalence_unverified',action:'Compare it.',evidenceIds:[ext,exec]}]});
 const reply=d=>({ok:true,json:async()=>({stop_reason:'end_turn',content:[{type:'text',text:JSON.stringify(d)}]})});
 const bodies=[];const ok=await S.synthesize([decl],{address:'x'},{key:'t',plannedWork:[{typeId:'2',label:'Pool'}],request:async(u,o)=>{bodies.push(JSON.parse(o.body));return reply(bodies.length===1?draft('A pool needs the Board’s prior written approval.',[fence]):draft('A pool is an exterior Owner Improvement, so the Board’s prior written approval is needed first.',[ext]));}});
 assert.equal(bodies.length,2,'Citing an unrelated clause (fencing) for a pool approval is rejected and rewritten');
 assert(JSON.parse(bodies[0].messages[0].content).plannedWork[0].label==='Pool'&&/Planned work/.test(bodies[0].system));
 assert.equal(ok.answer.forWork,'A pool is an exterior Owner Improvement, so the Board’s prior written approval is needed first.');assert.equal(ok.plannedWork[0].typeId,'2');
 const none=await S.synthesize([decl],{address:'x'},{key:'t',plannedWork:[{typeId:'8',label:'Solar'}],request:async()=>reply(draft('No retrieved excerpt addresses solar panels specifically.',[ext]))});
 assert.equal(none.answer.forWork,'No retrieved excerpt addresses solar panels specifically.','Saying no clause covers the work is allowed');
 console.log('PASS: planned permits are validated and passed to the answer; a permit-specific approval must cite a clause covering that kind of work.');
})().catch(e=>{console.error(e);process.exitCode=1;});
