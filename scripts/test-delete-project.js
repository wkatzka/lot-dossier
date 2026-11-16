/* Deleting a project from My projects: asks first, in place; Cancel keeps it; a guest delete removes the
   project and its files from this device only; an account project is removed from the account first, and if the
   account refuses, nothing is deleted anywhere. Fake account server, isolated storage, no network. */
const assert=require('node:assert/strict'),fs=require('node:fs'),{JSDOM}=require('jsdom'),{IDBFactory}=require('fake-indexeddb');
const pause=()=>new Promise(r=>setTimeout(r,5));async function until(f,label){for(let i=0;i<400;i++){if(await f())return;await pause();}throw Error('Timed out: '+label);}
const report=(id,addr)=>({date:'2026-11-07T12:00:00Z',parcel:{county:'Weber',id,attrs:{PARCEL_ADD:addr,PARCEL_ACRES:1}},facts:{},findings:[]});
function device({signedIn,allowDelete}){
 const records=new Map(),files=new Map(),calls=[];
 const dom=new JSDOM('<div id="home"><span class="wordmark">Cornerpin</span></div><button id="home-projects">My projects</button><button id="rv-workflow"></button><div id="rv-body"></div>',{url:'https://cornerpin.example',runScripts:'outside-only'}),w=dom.window;
 w.LR_DATA={cityInspect:require('../data/permits/ogden-valley-cityinspect.json')};w.indexedDB=new IDBFactory();w.structuredClone=structuredClone;w.Blob=Blob;w.AbortSignal=AbortSignal;Object.defineProperty(w,'crypto',{value:crypto});w.scrollTo=()=>{};w.HTMLElement.prototype.scrollIntoView=()=>{};
 const session=signedIn?{user:{id:'owner-a'},access_token:'a'}:null;w.CornerpinSupabase={createClient:()=>({auth:{onAuthStateChange:()=>{},getSession:async()=>({data:{session}})}})};
 w.fetch=async(url,opt={})=>{calls.push({url,method:opt.method||'GET'});
  if(url==='/api/projects?action=config')return Response.json({configured:true,url:'https://db.supabase.co',key:'sb_publishable_test'});
  if(url.startsWith('https://db.supabase.co/rest/v1/cornerpin_projects')){
   if(opt.method==='DELETE'){if(!allowDelete)return Response.json({message:'permission denied for table cornerpin_projects'},{status:403});const id=new URL(url).searchParams.get('id').slice(3),r=records.get(id);records.delete(id);return Response.json(r?[{id}]:[]);}
   if(['POST','PATCH'].includes(opt.method)){const {record}=JSON.parse(opt.body);records.set(record.id,structuredClone(record));return Response.json([{id:record.id,revision:record.revision}]);}
   return Response.json([...records.values()].map(record=>({record})));}
  if(url.startsWith('https://db.supabase.co/storage/')){if(opt.method==='POST'){files.set(url,opt.body);return Response.json({});}if(opt.method==='DELETE'){files.delete(url);return Response.json({});}return files.has(url)?new Response(files.get(url)):new Response('',{status:404});}
  throw Error('Unexpected request: '+url);};
 for(const file of ['evidence-ledger','site-decisions','permit-workflow','project-backup','project-store','cloud-sync','project-sync','analysis-progress','permit-facts','permit-assistant','answer-reviews','city-application','project-overview','project-card'])w.eval(fs.readFileSync('web/'+file+'.js','utf8'));
 w.CornerpinAccount={ready:w.CloudSync.init()};w.CornerpinReportViews={packet:()=>''};w.ResearchWorkspace={render:()=>''};w.eval(fs.readFileSync('web/project-workspace.js','utf8'));
 return {w,d:w.document,records,files,calls};
}
async function seed(t,parcels){const W=t.w.PermitWorkflow,ids=[];for(const [pid,addr,withFile] of parcels){let p=W.create(report(pid,addr));
  if(withFile){const blob=new t.w.Blob(['plan pdf '+pid]),hash=await t.w.ProjectBackup.hash(await blob.arrayBuffer());p=W.apply(p,{type:'document',document:{id:'doc-'+pid,name:'plan-'+pid+'.pdf',size:blob.size,hash,role:'plan',family:'doc-'+pid}});await t.w.ProjectStore.save(p,null,{id:'doc-'+pid,blob});}
  else await t.w.ProjectStore.save(p,null);ids.push(p.id);}
 return ids;}
const card=(d,addr)=>[...d.querySelectorAll('.pw-project-grid>.pw-card')].find(c=>c.querySelector('h2')?.textContent.toUpperCase()===addr);
const idle=t=>until(()=>!t.w.CornerpinWorkspaceBusy(),'idle');
(async()=>{
 // 1. Guest: confirm in place, Cancel keeps it, Delete permanently removes the project and its file from this device.
 {const t=device({signedIn:false});await t.w.CornerpinAccount.ready;const [a,b]=await seed(t,[['p1','1 TEST ST',true],['p2','2 TEST ST',false]]);
  t.d.getElementById('home-projects').click();await until(()=>card(t.d,'1 TEST ST'),'list');
  const c=card(t.d,'1 TEST ST'),box=c.querySelector('.pw-delete-confirm');assert(box.hidden,'nothing asks until you click Delete');
  c.querySelector('[data-action=delete-project]').click();await idle(t);assert(!box.hidden);
  assert.match(box.textContent,/Delete 1 Test St\? This permanently removes the project, its permit answers and 1 uploaded file from this device\. It can’t be undone\./);
  assert(box.querySelector('[data-action=backup-project]'),'offers a backup first');
  box.querySelector('[data-action=cancel-delete]').click();await idle(t);assert(box.hidden);assert(await t.w.ProjectStore.get(a),'Cancel keeps it');
  c.querySelector('[data-action=delete-project]').click();await idle(t);box.querySelector('[data-action=confirm-delete]').click();
  await until(()=>!card(t.d,'1 TEST ST'),'card gone');
  assert.equal(await t.w.ProjectStore.get(a),undefined);assert.equal(await t.w.ProjectStore.file('doc-p1'),undefined,'its uploaded file is removed too');
  assert(await t.w.ProjectStore.get(b)&&card(t.d,'2 TEST ST'),'other projects untouched');
  assert.match(t.d.getElementById('pw-message').textContent,/Deleted 1 Test St\./);
  assert(!t.calls.some(x=>x.method==='DELETE'),'a guest delete never touches an account');t.w.close();}
 // 2. Signed in, account not yet allowing deletes: nothing is deleted anywhere and the message says so.
 {const t=device({signedIn:true,allowDelete:false});await t.w.CornerpinAccount.ready;const [a]=await seed(t,[['p3','3 TEST ST',true]]);await until(()=>t.records.has(a),'saved to account');await t.w.ProjectSync.settle(a);
  t.d.getElementById('home-projects').click();await until(()=>card(t.d,'3 TEST ST'),'list');const c=card(t.d,'3 TEST ST');
  c.querySelector('[data-action=delete-project]').click();await idle(t);assert.match(c.querySelector('.pw-delete-confirm').textContent,/from this device and your account/);
  c.querySelector('[data-action=confirm-delete]').click();await idle(t);
  assert.match(t.d.getElementById('pw-message').textContent,/doesn’t allow deleting projects yet\. Nothing was deleted\./);
  assert(await t.w.ProjectStore.get(a)&&t.records.has(a),'kept on the device and in the account');assert(!c.querySelector('[data-action=confirm-delete]').disabled,'can try again');t.w.close();}
 // 3. Signed in, deletes allowed: removed from the account (row and its file) and from this device.
 {const t=device({signedIn:true,allowDelete:true});await t.w.CornerpinAccount.ready;const [a]=await seed(t,[['p4','4 TEST ST',true]]);await until(()=>t.records.has(a)&&t.files.size===1,'saved to account');await t.w.ProjectSync.settle(a);
  t.d.getElementById('home-projects').click();await until(()=>card(t.d,'4 TEST ST'),'list');const c=card(t.d,'4 TEST ST');
  c.querySelector('[data-action=delete-project]').click();await idle(t);c.querySelector('[data-action=confirm-delete]').click();await until(()=>!card(t.d,'4 TEST ST'),'card gone');
  assert(!t.records.has(a),'gone from the account');assert.equal(t.files.size,0,'its uploaded file is gone from the account');assert.equal(await t.w.ProjectStore.get(a),undefined,'gone from this device');
  assert(t.calls.some(x=>x.method==='DELETE'&&/cornerpin_projects\?id=eq\.[^&]+&owner_id=eq\.owner-a/.test(x.url)),'only deletes the signed-in owner’s row');
  await new Promise(r=>setTimeout(r,60));assert(!t.records.has(a),'no pending save brings it back');t.w.close();}
 console.log('PASS: Delete asks in place (what, from where, can’t be undone, backup first); Cancel keeps the project.');
 console.log('PASS: guest delete removes the project and its files from this device; an account delete removes the row and files from the account too, and if the account refuses nothing is deleted.');
})().catch(e=>{console.error(e);process.exit(1);});
