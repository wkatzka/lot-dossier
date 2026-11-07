/* Explicit private-cloud sync. Access token stays in memory, never in exports/localStorage. */
(function(root){
'use strict';let session=null,cfg=null;
async function config(){if(location.protocol==='file:')return {configured:false};if(!cfg){const r=await fetch('/api/projects?action=config');cfg=await r.json();}return cfg;}
async function login(email,password){const c=await config();if(!c.configured)throw Error('Cloud storage is not provisioned');const r=await fetch(c.url+'/auth/v1/token?grant_type=password',{method:'POST',headers:{apikey:c.key,'Content-Type':'application/json'},body:JSON.stringify({email,password})});const d=await r.json();if(!r.ok||!d.access_token)throw Error('Sign-in failed');session=d;return d.user;}
function auth(){if(!session)throw Error('Sign in to private cloud storage first');return {Authorization:'Bearer '+session.access_token};}
async function list(){const r=await fetch('/api/projects',{headers:auth()});if(!r.ok)throw Error('Cloud session expired or read failed');return (await r.json()).projects;}
async function fileRequest(document,method,blob){const c=await config(),path=session.user.id+'/'+document.id+'/'+document.hash;const r=await fetch(c.url+'/storage/v1/object/cornerpin-private/'+path,{method,headers:{apikey:c.key,...auth(),...(method==='POST'?{'Content-Type':'application/octet-stream'}:{})},...(blob?{body:blob}:{})});return r;}
async function push(project){
 const remote=(await list()).find(p=>p.id===project.id);if(remote&&remote.revision>=project.revision)throw Error('Cloud project is the same revision or newer. Download a backup before resolving differences.');
 for(const d of project.documents){const blob=await root.ProjectStore.file(d.id);if(!blob||await root.ProjectBackup.hash(await blob.arrayBuffer())!==d.hash)throw Error('Local document missing or changed: '+d.name);
  const existing=await fileRequest(d,'GET');if(existing.ok){if(await root.ProjectBackup.hash(await existing.arrayBuffer())!==d.hash)throw Error('Cloud document checksum conflict');}else if(existing.status===400||existing.status===404){const saved=await fileRequest(d,'POST',blob);if(!saved.ok)throw Error('Cloud document upload failed');}else throw Error('Cloud document access failed');
 }
 const r=await fetch('/api/projects',{method:'POST',headers:{...auth(),'Content-Type':'application/json'},body:JSON.stringify({project,expectedRevision:remote?remote.revision:null})});const d=await r.json();if(!r.ok)throw Error(d.error||'Cloud save failed');return d.project;
}
async function pull(id){const p=(await list()).find(p=>p.id===id);if(!p)throw Error('Cloud project not found');const files=[];
 for(const d of p.documents){const r=await fileRequest(d,'GET');if(!r.ok)throw Error('Cloud file unavailable');const blob=await r.blob();if(await root.ProjectBackup.hash(await blob.arrayBuffer())!==d.hash)throw Error('Cloud file checksum mismatch');files.push({id:d.id,blob});}
 return root.ProjectStore.restore(p,files);
}
root.CloudSync={config,login,list,push,pull,logout:()=>{session=null;},signedIn:()=>!!session};
})(window);
