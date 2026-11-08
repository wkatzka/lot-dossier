/* Explicit private-cloud sync. SDK sessions use tab-scoped sessionStorage, never exports. */
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
async function signup(email,password){await init();if(!cfg.emailReady)throw Error('Signup email delivery is being configured. Please try again after setup.');const {data,error}=await client.auth.signUp({email:email.trim(),password,options:{emailRedirectTo:location.origin+'/'}});if(error)throw Error(error.message);return data;}
async function recover(email){await init();if(!cfg.emailReady)throw Error('Password-reset email delivery is being configured.');const {error}=await client.auth.resetPasswordForEmail(email.trim(),{redirectTo:location.origin+'/'});if(error)throw Error(error.message);}
async function password(value){await init();const {error}=await client.auth.updateUser({password:value});if(error)throw Error(error.message);}
async function logout(){await init();if(client){const {error}=await client.auth.signOut({scope:'local'});if(error)throw Error('Could not sign out; please retry.');}changed(null,'SIGNED_OUT');}
function auth(){if(!session)throw Error('Sign in to your Cornerpin account first');return {Authorization:'Bearer '+session.access_token};}
function assertOwner(owner){if(!owner||session?.user?.id!==owner||root.ProjectStore.owner()!==owner)throw Error('Account changed during transfer; retry.');}
function baseKey(id){return 'cornerpin-cloud-base:'+session.user.id+':'+id;}
async function list(){const r=await fetch('/api/projects',{headers:auth()});if(!r.ok)throw Error('Cloud session expired or read failed');return (await r.json()).projects;}
async function fileRequest(document,method,blob){const c=await config(),path=session.user.id+'/'+document.id+'/'+document.hash;const r=await fetch(c.url+'/storage/v1/object/cornerpin-private/'+path,{method,headers:{apikey:c.key,...auth(),...(method==='POST'?{'Content-Type':'application/octet-stream'}:{})},...(blob?{body:blob}:{})});return r;}
async function push(project){
 if(!session||root.ProjectStore.owner()!==session.user.id)throw Error("Sign in and open a project in your account before saving.");
 const owner=session?.user?.id, key=baseKey(project.id), remote=(await list()).find(p=>p.id===project.id), base=localStorage.getItem(key);
 if(remote && (base===null || remote.revision!==Number(base)))throw Error('Cloud project changed on another device. Download a backup before reconciling versions.');
 if(remote&&remote.revision===project.revision)return remote;
 for(const d of project.documents){assertOwner(owner);const blob=await root.ProjectStore.file(d.id);if(!blob||await root.ProjectBackup.hash(await blob.arrayBuffer())!==d.hash)throw Error('Local document missing or changed: '+d.name);
  assertOwner(owner);const existing=await fileRequest(d,'GET');if(existing.ok){if(await root.ProjectBackup.hash(await existing.arrayBuffer())!==d.hash)throw Error('Cloud document checksum conflict');}else if(existing.status===400||existing.status===404){assertOwner(owner);const saved=await fileRequest(d,'POST',blob);if(!saved.ok)throw Error('Cloud document upload failed');}else throw Error('Cloud document access failed');
 }
 if(session?.user?.id!==owner)throw Error('Account changed during save; retry.');
 const r=await fetch('/api/projects',{method:'POST',headers:{...auth(),'Content-Type':'application/json'},body:JSON.stringify({project,expectedRevision:remote?remote.revision:null})});const d=await r.json();if(!r.ok)throw Error(d.error||'Cloud save failed');localStorage.setItem(key,String(d.project.revision));return d.project;
}
async function pull(id){const owner=session?.user?.id;assertOwner(owner);const p=(await list()).find(p=>p.id===id);if(!p)throw Error('Cloud project not found');const files=[];
 for(const d of p.documents){assertOwner(owner);const r=await fileRequest(d,'GET');if(!r.ok)throw Error('Cloud file unavailable');const blob=await r.blob();if(await root.ProjectBackup.hash(await blob.arrayBuffer())!==d.hash)throw Error('Cloud file checksum mismatch');files.push({id:d.id,blob});}
 assertOwner(owner);const restored=await root.ProjectStore.restore(p,files);localStorage.setItem(baseKey(p.id),String(p.revision));return restored;
}
root.CloudSync={config,init,login,signup,recover,password,list,push,pull,logout,user:()=>session?.user||null,signedIn:()=>!!session};
})(window);
