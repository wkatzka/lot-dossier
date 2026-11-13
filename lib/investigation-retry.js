const D=require('./record-discovery-engine');
const kinds=new Set(['source_error','search_incomplete','rate_limited','deferred_rate_limit']);
function schedule(state,now=Date.now()){
 const jobs=state.jobs.filter(j=>kinds.has(j.status)&&(j.autoRetries||0)<3);if(!jobs.length)return {pending:false};
 let earliest=Infinity,queued=0;
 for(const j of jobs){
  const host=j.url&&new URL(j.url).hostname;
  const restrictions=(state.sourceRestrictions||[]).filter(r=>r.status==='rate_limited'&&new URL(r.url).hostname===host);
  const cooldown=Math.max(0,...restrictions.map(D.retryUntil));
  const after=Math.max(cooldown,(Date.parse(j.checkedAt)||0)+(['rate_limited','deferred_rate_limit'].includes(j.status)?0:60000));
  if(after>now){earliest=Math.min(earliest,after);continue;}
  // A source-wide cooldown deferral did not attempt the record and consumes no retry.
  if(j.status!=='deferred_rate_limit')j.autoRetries=(j.autoRetries||0)+1;
  (j.retryHistory||=[]).push({previousStatus:j.status,checkedAt:j.checkedAt,rescheduledAt:new Date(now).toISOString(),error:j.error});j.status='queued';queued++;
 }
 return {pending:true,queued,delaySeconds:queued?0:Math.max(1,Math.ceil((earliest-now)/1000))};
}
module.exports={schedule};
