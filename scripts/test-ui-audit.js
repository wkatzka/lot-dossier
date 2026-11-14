/* Automated UI text audit: opens every workspace tab and permit-form page for several kinds of project
   (prepared house, pool + deck, new home on a vacant lot, nothing chosen yet) with the real modules,
   then fails on anything a user would notice: leaked null/undefined/NaN, raw machine codes, broken
   punctuation, the same line repeated, empty buttons or links, bare URLs as text, duplicate sentences,
   giant unclamped paragraphs. Read-only: no network, isolated storage. */
const assert=require('node:assert/strict'),fs=require('fs'),{JSDOM}=require('jsdom'),{IDBFactory}=require('fake-indexeddb');
const W=require('../web/permit-workflow'),C=require('../web/city-application'),P=require('../web/permit-packet');
const clone=x=>JSON.parse(JSON.stringify(x));
const MODULES=['icons','input-rules','evidence-ledger','permit-facts','permit-assistant','site-decisions','answer-reviews','city-application','ovc-code-sources','accessory-rules','permit-packet','approval-evidence','ovc-rules','area-rules','permit-workflow','project-store','site-answer','project-intent','my-company','next-steps','title-research-view','placement-engine','land-value','weber-value','pool-screen','original-documents','site-document-ui','research-workspace','permit-prep-ui','measurement-workbench','analysis-progress','project-overview','area-rules-ui','project-workspace'];
// Findings we accept on purpose (each with a reason). Keep this list short.
const ALLOW=[
 [/^machine-code$/,/sha-?256/i,'Document hashes are shown deliberately as audit evidence'],
];
async function until(w,f,label){for(let i=0;i<400;i++){if(await f())return;await new Promise(r=>setTimeout(r,5));}throw Error('UI did not reach expected state: '+label);}

function projects(){
 const base=clone(require('../docs/ux-audit/phase-3/validation/synthetic-backup.json').project);base.report.parcel.county=base.property.county='Weber';base.propertyKey='Weber|'+base.report.parcel.id;
 const facts={jurisdiction:'Ogden Valley City',zone_std:{zone:'RE-15',front:30,side:10,rear:30},lot_sf:17424,stepsRun:{check_parcel:'x'}};
 const findings=[{item:'Landslides',section:'geo',status:'flag',headline:'Mapped landslide covers about 100% of the lot',next_step:'Order a geologic hazards study and geotech report before design starts.',source:'UGS',url:'https://ugs.example/'},
  {item:'CC&Rs / HOA',section:'ccr',status:'verify',headline:'Trappers Ridge: recorded CC&Rs likely',source:'County parcel record',url:'https://p.example/'},
  // A finding saved before the wording fix: its empty "Plat: ." must be cleaned when shown.
  {item:'County assessor',section:'land',status:'ok',headline:'Assessed value $412,000',detail:'Owner of record: SDC INVESTMENTS LLC. Property type: OUTBUILDINGS. Plat: . Assessed value lags the market.',source:'Weber County Assessor',url:'https://a.example/'}];
 const mk=(id,attrs,typeIds,intent)=>{const packets=Object.fromEntries(typeIds.map(t=>[t,P.build(t,{facts,findings})]));
  const report={parcel:{county:'Weber',id,attrs:{PARCEL_ADD:attrs.addr,PARCEL_ACRES:attrs.acres,PROP_CLASS:attrs.cls},rings:[]},date:'2026-11-13',findings,facts:{...facts,owner:'Jane Owner',packets,packet:packets[typeIds[0]]}};
  const p=W.create(report,'2026-11-13T00:00:00Z');p.application.jurisdiction='Ogden Valley City';if(intent)p.application.intent=intent;p.propertyKey='Weber|'+id;return p;};
 return {
  'prepared house (fixture)':base,
  'pool + deck':mk('222320023',{addr:'3459 N WIND RIVER CT',acres:0.4,cls:'Residential'},['2','74'],{plan:'pool',label:'Pool + deck',typeIds:['2','74']}),
  'new home, vacant lot':mk('224410004',{addr:'5241 E COBABE RANCH RD',acres:3.1,cls:'Vacant - Agricultural'},['1'],{plan:'new-home',label:'New single-family home',typeIds:['1']}),
  'nothing chosen yet':mk('222320099',{addr:'3443 N WIND RIVER CT',acres:0.3,cls:'Vacant'},['1'],null)
 };
}

(async()=>{
 const Audit=require('./ui-audit');const all=[];let audited=0;
 // The audit must catch planted problems, or a clean result means nothing.
 {const t=new JSDOM('<main><p>Lot size: null sq ft</p><p>Fee · · Source</p><ul><li>Cobabe Ranch Phase 1</li><li>Cobabe Ranch Phase 1</li><li>Cobabe Ranch Phase 1</li></ul><button></button><p>Status: needs_review_pending</p></main>');const kinds=Audit.run(t.window.document.body,{layout:false}).map(f=>f.kind.split(' ')[0]);for(const k of ['leaked-value','punctuation','repeated-line','empty-button','machine-code'])assert(kinds.includes(k),'audit misses '+k+' (found '+kinds+')');t.window.close();}
 for(const [name,proj] of Object.entries(projects())){
  const dom=new JSDOM('<div id="home"><span class="wordmark">Cornerpin</span><button id="go">Check this lot</button></div><button id="home-projects">My projects</button><button id="rv-workflow">Workflow</button><div id="rv"><div id="rv-body"></div></div>',{url:'https://example.test',runScripts:'outside-only'}),w=dom.window,d=w.document;
  w.indexedDB=new IDBFactory();w.structuredClone=structuredClone;w.scrollTo=()=>{};w.HTMLElement.prototype.scrollIntoView=()=>{};w.LR_DATA={cityInspect:C.catalog};w.matchMedia=()=>({matches:false,addEventListener(){}});
  w.fetch=()=>Promise.reject(Error('offline test'));w.CloudSync={signedIn:()=>false};w.CornerpinAccount={ready:Promise.resolve()};w.ProjectSync={status:()=>({state:'guest'})};w.CornerpinReportViews={packet:()=>''};
  const mem={};w.localStorage.clear();
  for(const m of MODULES){try{w.eval(fs.readFileSync('web/'+m+'.js','utf8'));}catch(e){throw Error('Loading '+m+': '+e.message);}}
  await w.ProjectStore.save(proj,null);
  const audit=(where)=>{{const n=d.body.querySelectorAll('p,li,h2,h3,button,a').length;audited+=n;if(process.env.AUDIT_DEBUG)console.log(name,'›',where,n,[...d.querySelectorAll('#project-workspace h2')].map(h=>h.textContent).join(' | ').slice(0,200));}for(const f of Audit.run(d.body,{layout:false})){if(ALLOW.some(([k,t])=>k.test(f.kind)&&t.test(f.text)))continue;all.push({project:name,where,...f});}};
  d.getElementById('home-projects').click();await until(w,()=>d.querySelector('[data-action=open]'),'project list');audit('My projects');
  d.querySelector('[data-action=open]').click();await until(w,()=>d.querySelector('.cp-overview'),'overview');
  const tabs=[...new Set([...d.querySelectorAll('[data-frame]')].map(b=>b.dataset.frame))].filter(t=>!['site','download','navigation'].includes(t));
  const go=async t=>{const b=d.querySelector('[data-frame="'+t+'"]');if(!b)return false;b.click();await new Promise(r=>setTimeout(r,40));await until(w,()=>!w.CornerpinWorkspaceBusy||!w.CornerpinWorkspaceBusy(),'tab '+t);return true;};
  for(const t of tabs)if(await go(t))audit('tab: '+t);
  // Every permit form, every page, with all fields shown.
  if(await go('filing')){
   const ids=[...new Set([...d.querySelectorAll('[data-action=prepare-permit]')].map(b=>b.dataset.id))];
   for(const id of ids){await go('filing');const b=d.querySelector('[data-action=prepare-permit][data-id="'+id+'"]');if(!b)continue;b.click();await until(w,()=>d.querySelector('.city-application'),'form '+id);
    for(const page of ['primary','professionals','building','attachments']){const pb=d.querySelector('[data-action=city-page][data-id='+page+']');if(!pb)continue;pb.click();await new Promise(r=>setTimeout(r,30));await until(w,()=>!w.CornerpinWorkspaceBusy||!w.CornerpinWorkspaceBusy(),'page');audit('form '+id+' · '+page);}}}
  w.close();
 }
 // The Site Review report (live and downloaded versions) for each project's research.
 {const vm=require('node:vm'),c={console,setTimeout,clearTimeout};vm.createContext(c);vm.runInContext(fs.readFileSync('web/lotreport.js','utf8'),c);
  const dom=new JSDOM(fs.readFileSync('public/platform.html','utf8'),{runScripts:'outside-only',url:'https://example.org'});const w=dom.window;w.LotReport=c.LotReport;w.LR_DATA={};w.PlatEvidence=require('../web/plat-evidence');w.CpIcons=require('../web/icons');
  w.eval(fs.readFileSync('web/app.js','utf8').replace(/\}\)\(\);\s*$/,'window.auditRender=function(r,s){last=r;return reportHTML(r,{},s);};})();'));
  for(const [name,proj] of Object.entries(projects()))for(const saved of [false,true]){const r={...proj.report,date:new Date(proj.report.date||'2026-11-13')};const page=new JSDOM('<main>'+w.auditRender(r,saved)+'</main>');const n=page.window.document.querySelectorAll('p,li,h2,h3,h4,button,a').length;audited+=n;
   for(const f of Audit.run(page.window.document.body,{layout:false})){if(ALLOW.some(([k,t])=>k.test(f.kind)&&t.test(f.text)))continue;all.push({project:name,where:'Site Review report'+(saved?' (download)':''),...f});}page.window.close();}
  w.close();}
 assert(audited>2000,'audit covered too little text: '+audited);
 const seen=new Map();for(const f of all){const k=f.kind+'|'+f.text;if(!seen.has(k))seen.set(k,{...f,places:[]});seen.get(k).places.push(f.project+' › '+f.where);}
 const report=[...seen.values()].map(f=>'['+f.kind+'] '+f.text+'\n    at '+[...new Set(f.places)].slice(0,3).join('; ')+(f.places.length>3?' (+'+(f.places.length-3)+' more)':''));
 if(process.argv.includes('--list')){console.log(report.join('\n'));console.log(report.length+' distinct findings');return;}
 assert.deepEqual(report,[],'UI text problems a user would see:\n'+report.join('\n'));
 console.log('PASS: audit catches planted problems; '+audited+' text blocks checked.');console.log('PASS: every workspace tab, permit-form page and the Site Review report, across 4 kinds of project, is free of leaked values, machine codes, broken punctuation, repeats and empty controls.');
})().catch(e=>{console.error(e.message||e);process.exit(1);});
