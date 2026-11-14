/* Private-cloud snapshot persistence. SDK sessions use tab-scoped sessionStorage, never exports. */
(function(root){
 'use strict';let session=null,cfg=null,client=null,starting=null;
async function config(){if(location.protocol==='file:')return {configured:false};if(!cfg){const r=await fetch('/api/projects?action=config');if(!r.ok)throw Error('Account service unavailable');cfg=await r.json();}return cfg;}
function changed(next,event){
 const old=session?.user?.id;session=next;
 if(old!==next?.user?.id){root.ProjectStore.setOwner(next?.user?.id||null);root.dispatchEvent(new CustomEvent('cornerpin:account-changed',{detail:{user:next?.user||null}}));}
 root.dispatchEvent(new CustomEvent('cornerpin:auth',{detail:{event,user:next?.user||null}}));
}
async function init(){
 if(!starting)starting=(async()=>{const c=await config();if(!c.configured)return;
 client=root.CornerpinSupabase.createClient(c.url,c.key,{auth:{persistSession:true,storage:sessionStorage,storageKey:'cornerpin-auth',autoRefreshToken:true,detectSessionInUrl:true}});
 client.auth.onAuthStateChange((event,s)=>changed(s,event));
 const {data,error}=await client.auth.getSession();if(error)throw error;changed(data.session,'INITIAL_SESSION');
 })().catch(e=>{starting=null;throw e;});return starting;
}
async function login(email,password){await init();if(!client)throw Error('Accounts are unavailable');const {data,error}=await client.auth.signInWithPassword({email:email.trim(),password});if(error)throw Error(error.message);changed(data.session,'SIGNED_IN');return data.user;}
async function signup(email,password){await init();if(!cfg.emailReady&&!cfg.pilotSignup)throw Error('Signup email delivery is being configured. Please try again after setup.');const {data,error}=await client.auth.signUp({email:email.trim(),password,options:{emailRedirectTo:location.origin+'/'}});if(error)throw Error(error.message);if(data.session)changed(data.session,'SIGNED_IN');return data;}
async function recover(email){await init();if(!cfg.emailReady)throw Error('Password-reset email delivery is being configured.');const {error}=await client.auth.resetPasswordForEmail(email.trim(),{redirectTo:location.origin+'/'});if(error)throw Error(error.message);}
async function password(value){await init();const {error}=await client.auth.updateUser({password:value});if(error)throw Error(error.message);}
async function logout(){await init();if(client){const {error}=await client.auth.signOut({scope:'local'});if(error)throw Error('Could not sign out; please retry.');}changed(null,'SIGNED_OUT');}
function auth(){if(!session)throw Error('Sign in to your Cornerpin account first');return {Authorization:'Bearer '+session.access_token};}
function assertOwner(owner){if(!owner||session?.user?.id!==owner||root.ProjectStore.owner()!==owner)throw Error('Account changed during transfer; retry.');}
function baseKey(id){return 'cornerpin-cloud-base:'+session.user.id+':'+id;}
async function list(){
 const headers=auth(),owner=session.user.id,c=await config();assertOwner(owner);
 // Keep large GIS snapshots on the existing private, RLS-protected storage API.
 const r=await fetch(c.url+'/rest/v1/cornerpin_projects?owner_id=eq.'+encodeURIComponent(owner)+'&select=record',{headers:{apikey:c.key,...headers},signal:AbortSignal.timeout(30000)});
 if(!r.ok)throw Error('Cloud session expired or read failed');const rows=await r.json();assertOwner(owner);return rows.map(x=>x.record);
}
async function fileRequest(document,method,blob){const c=await config(),path=session.user.id+'/'+document.id+'/'+document.hash;const r=await fetch(c.url+'/storage/v1/object/cornerpin-private/'+path,{method,signal:AbortSignal.timeout(60000),headers:{apikey:c.key,...auth(),...(method==='POST'?{'Content-Type':'application/octet-stream'}:{})},...(blob?{body:blob}:{})});return r;}
async function push(project){
 if(!session||root.ProjectStore.owner()!==session.user.id)throw Error("Sign in and open a project in your account before saving.");
 const owner=session?.user?.id, key=baseKey(project.id), remote=(await list()).find(p=>p.id===project.id), base=localStorage.getItem(key);
 if(remote && (base===null || remote.revision!==Number(base)))throw Error('Cloud project changed on another device. Download a backup before reconciling versions.');
 if(remote&&remote.revision===project.revision)return remote;
 for(const d of project.documents){assertOwner(owner);const blob=await root.ProjectStore.file(d.id);if(!blob||await root.ProjectBackup.hash(await blob.arrayBuffer())!==d.hash)throw Error('Local document missing or changed: '+d.name);
  assertOwner(owner);const existing=await fileRequest(d,'GET');if(existing.ok){if(await root.ProjectBackup.hash(await existing.arrayBuffer())!==d.hash)throw Error('Cloud document checksum conflict');}else if(existing.status===400||existing.status===404){assertOwner(owner);const saved=await fileRequest(d,'POST',blob);if(!saved.ok)throw Error('Cloud document upload failed');}else throw Error('Cloud document access failed');
 }
 if(session?.user?.id!==owner)throw Error('Account changed during save; retry.');
 const c=await config();assertOwner(owner);
 if(project.schemaVersion!==1||!/^cp-[a-z0-9-]+$/i.test(project.id)||!Number.isInteger(project.revision)||project.revision<0)throw Error('Invalid project record');
 if(remote&&project.revision<=remote.revision)throw Error('Revision must advance');
 const cloudProject=project.application?.areaMap&&root.OVCRules?{...project,application:{...project.application,areaMap:root.OVCRules.localizeSnapshot(project.application.areaMap,project.report.parcel.geometry||{rings:project.report.parcel.rings})}}:project;
 const filter=remote?'&id=eq.'+encodeURIComponent(project.id)+'&owner_id=eq.'+encodeURIComponent(owner)+'&revision=eq.'+remote.revision:'';
 const r=await fetch(c.url+'/rest/v1/cornerpin_projects?select=id,revision'+filter,{method:remote?'PATCH':'POST',signal:AbortSignal.timeout(60000),headers:{apikey:c.key,...auth(),'Content-Type':'application/json',Prefer:'return=representation'},body:JSON.stringify({id:project.id,owner_id:owner,revision:project.revision,record:cloudProject,updated_at:new Date().toISOString()})});
 if(!r.ok){const error=await r.json().catch(()=>({}));throw Error(r.status===409?'Project conflict; reload before saving':'Cloud save failed (HTTP '+r.status+'): '+(error.message||'Storage service unavailable')+'. Local changes are retained.');}
 const rows=await r.json();if(rows.length!==1||rows[0].id!==project.id||rows[0].revision!==project.revision)throw Error('Project conflict or access denied');assertOwner(owner);
 localStorage.setItem(key,String(project.revision));return project;
}
async function pull(id, supplied){const owner=session?.user?.id;assertOwner(owner);const p=supplied||(await list()).find(p=>p.id===id);if(!p)throw Error('Cloud project not found');const existing=await root.ProjectStore.get(id),base=baseRevision(id);
 if(existing){if(existing.revision!==base)throw Error('This device has unsynced changes. They were kept; retry sync or download a backup before reconciling.');if(existing.revision===p.revision)return existing;if(p.revision<existing.revision)throw Error('Cloud copy is older than this device.');}
 const files=[];
 for(const d of p.documents){assertOwner(owner);const r=await fileRequest(d,'GET');if(!r.ok)throw Error('Cloud file unavailable');const blob=await r.blob();if(await root.ProjectBackup.hash(await blob.arrayBuffer())!==d.hash)throw Error('Cloud file checksum mismatch');files.push({id:d.id,blob});}
 assertOwner(owner);const restored=await root.ProjectStore.restore(p,files,{cloudRestore:true,expectedRevision:existing?.revision});localStorage.setItem(baseKey(p.id),String(p.revision));return restored;
}
function baseRevision(id){if(!session)return null;const v=localStorage.getItem(baseKey(id));return v===null?null:Number(v);}
// "Your company" lives on the account (user metadata), so it follows the contractor to every device.
const company={
 get:()=>session?.user?.user_metadata?.cornerpin_company||null,
 async save(v){await init();if(!client||!session)throw Error('Sign in to save your company to your account.');const {data,error}=await client.auth.updateUser({data:{cornerpin_company:v}});if(error)throw Error('Could not save to your account: '+error.message);if(data?.user)session={...session,user:data.user};return true;}
};
root.CloudSync={auth,baseRevision,config,init,login,signup,recover,password,list,push,pull,logout,company,user:()=>session?.user||null,signedIn:()=>!!session};
})(window);
