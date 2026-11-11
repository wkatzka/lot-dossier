const assert=require('node:assert/strict'),fs=require('node:fs'),{JSDOM}=require('jsdom'),{IDBFactory}=require('fake-indexeddb');
const pause=()=>new Promise(r=>setTimeout(r,5));async function until(f,label){for(let i=0;i<400;i++){if(await f())return;await pause();}throw Error('Timed out: '+label);}
(async()=>{
const records=new Map(),files=new Map(),calls=[];let offline=false;
function device(){
 const dom=new JSDOM('<div id="home"><span class="wordmark">Cornerpin</span></div><button id="home-projects">My projects</button><button id="rv-workflow"></button><div id="rv-body"></div>',{url:'https://cornerpin.example',runScripts:'outside-only'}),w=dom.window;
 w.LR_DATA={cityInspect:require('../data/permits/ogden-valley-cityinspect.json')};w.indexedDB=new IDBFactory();w.structuredClone=structuredClone;w.Blob=Blob;w.AbortSignal=AbortSignal;Object.defineProperty(w,'crypto',{value:crypto});w.scrollTo=()=>{};
 const session={user:{id:'owner-a'},access_token:'a'};w.CornerpinSupabase={createClient:()=>({auth:{onAuthStateChange:()=>{},getSession:async()=>({data:{session}})}})};
 w.fetch=async(url,opt={})=>{calls.push({url,method:opt.method||'GET'});if(offline)throw Error('Offline test');
  if(url==='/api/projects?action=config')return Response.json({configured:true,url:'https://db.supabase.co',key:'sb_publishable_test'});
  if(url==='/api/projects'){if(opt.method==='POST'){const {project,expectedRevision}=JSON.parse(opt.body),old=records.get(project.id);if((old?old.revision:null)!==expectedRevision)return Response.json({error:'Conflict'},{status:409});records.set(project.id,structuredClone(project));return Response.json({project});}return Response.json({projects:[...records.values()]});}
  if(url.startsWith('https://db.supabase.co/storage/')){if(opt.method==='POST'){files.set(url,opt.body);return Response.json({});}return files.has(url)?new Response(files.get(url)):new Response('',{status:404});}
  throw Error('Unexpected public research request: '+url);
 };
 for(const file of ['evidence-ledger','permit-workflow','project-backup','project-store','cloud-sync','project-sync','analysis-progress','permit-facts','permit-assistant','city-application','project-overview'])w.eval(fs.readFileSync('web/'+file+'.js','utf8'));
 w.CornerpinAccount={ready:w.CloudSync.init()};w.CornerpinReportViews={packet:()=>''};w.ResearchWorkspace={render:()=>''};w.eval(fs.readFileSync('web/project-workspace.js','utf8'));
 return {w,dom};
}
const {w,dom}=device();await w.CornerpinAccount.ready;
const report={date:'2026-11-07T12:00:00Z',parcel:{county:'Example',id:'test-parcel',attrs:{PARCEL_ADD:'Synthetic saved site',PARCEL_ACRES:1}},facts:{},findings:[{section:'land',item:'Saved constraint',status:'verify',detail:'Original result'}]};
w.dispatchEvent(new w.CustomEvent('cornerpin:report',{detail:report}));w.dispatchEvent(new w.CustomEvent('cornerpin:open-workflow',{detail:{tab:'overview'}}));
await until(()=>records.size===1,'automatic account save').catch(async e=>{console.error({calls,rows:await w.ProjectStore.list(),title:w.document.getElementById('rv-workflow').title,message:w.document.getElementById('pw-message')?.textContent});throw e;});await until(()=>w.document.querySelectorAll('.cp-pipeline>li').length===3,'three-stage landing');
const id=[...records.keys()][0],original=await w.ProjectStore.get(id);assert.equal(records.get(id).report.findings[0].detail,'Original result');
w.document.getElementById('home-projects').click();await until(()=>w.document.querySelector('.pw-project-grid [data-action="open"]'),'My projects card');assert.equal(w.document.querySelector('#project-workspace h1').textContent,'My projects');assert.equal(w.document.querySelectorAll('.pw-project-grid>.pw-card').length,2);assert(w.document.querySelector('.pw-project-grid>.pw-card:last-child form[data-command=restore-backup]'));
const before=calls.length;w.document.querySelector('.pw-project-grid [data-action="open"]').click();await until(()=>w.document.querySelectorAll('.cp-pipeline>li').length===3,'open saved overview');assert(calls.slice(before).every(c=>c.url==='/api/projects'));assert.equal(records.get(id).siteVersion,1);
let restored;w.addEventListener('cornerpin:restore-report',e=>restored=e.detail);w.document.querySelector('[data-action="site"]').click();await until(()=>restored,'open stored report');assert.equal(restored.findings[0].detail,'Original result');
// Save a file and edit while offline. Both must survive and sync on reconnection.
offline=true;const blob=new Blob(['saved plan bytes']),hash=await w.ProjectBackup.hash(await blob.arrayBuffer());const next=w.PermitWorkflow.apply(original,{type:'document',document:{id:'file-test',name:'test.txt',size:blob.size,hash,role:'plan',family:'file-test'}});next.application.documentExtractions=[{documentId:'file-test',documentHash:hash,permitType:'project',method:'Claude',facts:[{field:'bedrooms',value:4,page:2,quote:'4 BEDROOMS'}]}];next.report.facts.publicSurveys={documents:[{recordNumber:'synthetic-unretained-source',sha256:'not-downloaded'}]};await w.ProjectStore.save(next,original.revision,{id:'file-test',blob});await until(()=>w.ProjectSync.status(next).state==='pending','offline save state');assert.equal((await w.ProjectStore.get(id)).documents.length,1);assert.equal(records.get(id).revision,original.revision);
offline=false;w.dispatchEvent(new w.Event('online'));await until(()=>records.get(id).revision===next.revision,'reconnect retry');await until(()=>w.ProjectSync.status(next).state==='saved','saved state');
// Fresh device: list and reopen the stored snapshot and file without any research calls.
const second=device();await second.w.CornerpinAccount.ready;second.w.document.getElementById('home-projects').click();await until(()=>second.w.document.querySelector('.pw-project-grid [data-action="open"]'),'second device list');const secondBefore=calls.length;second.w.document.querySelector('[data-action="open"]').click();await until(()=>second.w.document.querySelectorAll('.cp-pipeline>li').length===3,'second device open');assert.equal(await (await second.w.ProjectStore.file('file-test')).text(),'saved plan bytes');assert(calls.slice(secondBefore).every(c=>c.url==='/api/projects'||c.url.startsWith('https://db.supabase.co/storage/')));
second.w.document.getElementById('home-projects').click();await until(()=>second.w.document.querySelector('.pw-project-grid [data-action="open"]'),'reopen list');second.w.document.querySelector('[data-action="open"]').click();await until(()=>second.w.document.querySelectorAll('.cp-pipeline>li').length===3,'reopen cached project without retrying missing survey');
assert.equal((await second.w.ProjectStore.get(id)).application.documentExtractions[0].facts[0].value,4);assert.equal((await second.w.ProjectStore.get(id)).application.documentExtractions[0].facts[0].quote,'4 BEDROOMS');
// Refresh is dispatched only when the user clicks it.
let refresh=0;second.w.addEventListener('cornerpin:refresh',()=>refresh++);assert.equal(refresh,0);second.w.document.querySelector('[data-action="refresh-evidence"]').click();await until(()=>refresh===1,'explicit refresh');
// Newer cloud snapshots replace a clean cached copy, never unsynced local work.
const newer={...records.get(id),revision:next.revision+1,report:{...report,findings:[{detail:'Newer saved snapshot'}]}};records.set(id,newer);await w.CloudSync.pull(id,newer);assert.equal((await w.ProjectStore.get(id)).revision,newer.revision);
offline=true;const dirty={...newer,revision:newer.revision+1};await w.ProjectStore.save(dirty,newer.revision);await until(()=>w.ProjectSync.status(dirty).state==='pending','dirty pending');offline=false;await assert.rejects(()=>w.CloudSync.pull(id,{...newer,revision:dirty.revision+1}),/unsynced/);
assert(calls.every(c=>c.url.startsWith('/api/projects')||c.url.startsWith('https://db.supabase.co/storage/')));
console.log('PASS: report autosave; one My projects card; three-stage reopen; cached findings; offline recovery; file restoration on second device; explicit refresh only; safe newer-cloud restore and local-conflict protection.');dom.window.close();second.dom.window.close();
})().catch(e=>{console.error(e);process.exitCode=1;});
