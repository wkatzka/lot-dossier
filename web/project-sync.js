/* Serialize account saves; store writes remain usable offline. No public-source fetches here. */
(function(root){
'use strict';
const S=root.ProjectStore,C=root.CloudSync,jobs=new Map(),states=new Map();
const key=(owner,id)=>owner+':'+id;
function emit(owner,id,state,error){if(S.owner()!==owner)return;states.set(key(owner,id),{state,error});root.dispatchEvent(new CustomEvent('cornerpin:sync-state',{detail:{id,owner,state,error}}));}
function status(p){const owner=S.owner();if(!owner)return {state:'guest'};const state=states.get(key(owner,p.id));if(state?.state==='saving')return state;if(C.baseRevision(p.id)===p.revision)return {state:'saved'};return state?.state==='pending'?state:{state:'pending'};}
function enqueue(id,owner=S.owner()){
 if(!owner||owner!==C.user()?.id)return Promise.resolve();
 const k=key(owner,id),active=jobs.get(k);if(active){active.again=true;return active.promise;}
 const job={again:true};jobs.set(k,job);
 job.promise=Promise.resolve().then(async()=>{
  try{while(job.again){job.again=false;if(S.owner()!==owner)break;emit(owner,id,'saving');const p=await S.get(id);if(!p)break;if(S.owner()!==owner)break;await C.push(p);if(S.owner()!==owner)break;const latest=await S.get(id);if(latest&&latest.revision!==p.revision)job.again=true;}
   emit(owner,id,'saved');
  }catch(e){emit(owner,id,'pending',e.message);}finally{jobs.delete(k);}
 });return job.promise;
}
async function retryPending(){const owner=S.owner();if(!owner||owner!==C.user()?.id)return;const rows=await S.list();if(S.owner()!==owner)return;await Promise.all(rows.filter(p=>p.revision!==C.baseRevision(p.id)).map(p=>enqueue(p.id,owner)));}
root.addEventListener('cornerpin:project-saved',e=>enqueue(e.detail.id,e.detail.owner));
root.addEventListener('cornerpin:auth',e=>{if(e.detail.user&&['SIGNED_IN','INITIAL_SESSION'].includes(e.detail.event))setTimeout(()=>retryPending().catch(()=>{}),0);});
root.addEventListener('online',()=>retryPending().catch(()=>{}));
root.ProjectSync={enqueue,status,retryPending};
})(window);
