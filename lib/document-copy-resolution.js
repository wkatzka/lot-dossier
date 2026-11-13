const crypto=require('node:crypto');
const digest=b=>crypto.createHash('sha256').update(b).digest('hex');
function original(url){return String(url).replace(/^https:\/\/web\.archive\.org\/web\/\d+(?:id_)?\//,'');}
function schedule(state,add){let n=0;
 for(const bad of state.documents.filter(d=>d.readError&&d.disposition!=='superseded_partial_copy')){
  const good=state.documents.find(d=>d.sha256!==bad.sha256&&!d.readError&&d.pages>0&&d.urls.some(u=>bad.urls.some(v=>original(u)===original(v))));if(!good)continue;
  add(state,{kind:'copy-verification',route:bad.route,url:bad.urls[0],documentHash:bad.sha256,candidateHash:good.sha256,key:'copy-verification|'+bad.sha256+'|'+good.sha256});n++;
 }return n;
}
async function verify(state,job,load){
 const bad=state.documents.find(d=>d.sha256===job.documentHash),good=state.documents.find(d=>d.sha256===job.candidateHash);
 if(!bad||!good||good.readError||!good.pages||!bad.urls.some(a=>good.urls.some(b=>original(a)===original(b))))throw Error('Complete-copy candidate does not identify the same original URL');
 const a=await load(bad.urls[0]);if(!a)return;const b=await load(good.urls[0]);if(!b)return;
 if(digest(a.b)!==bad.sha256||digest(b.b)!==good.sha256)throw Error('Original copy changed during comparison; no equivalence inferred');
 if(a.b.length<4096||b.b.length<=a.b.length||!b.b.subarray(0,a.b.length).equals(a.b))throw Error('Copies are not an exact truncated-prefix match; both remain separate evidence');
 const resolution={kind:'exact_truncated_prefix',incompleteSha256:bad.sha256,completeSha256:good.sha256,matchedBytes:a.b.length,completeBytes:b.b.length,completeUrl:good.urls[0],checkedAt:new Date().toISOString(),basis:'Every byte of the damaged copy matches the beginning of the larger, successfully parsed original. The complete copy remains subject to its own reading and interpretation checks.'};
 bad.disposition='superseded_partial_copy';bad.copyResolution=resolution;
 for(const prior of state.jobs.filter(j=>j.kind==='page'&&j.documentHash===bad.sha256)){prior.status='resolved_by_alternative';prior.copyResolution=resolution;}
 job.copyResolution=resolution;job.status='complete';
}
module.exports={schedule,verify,original};
