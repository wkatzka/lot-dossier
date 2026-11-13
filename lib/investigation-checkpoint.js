/* Drop only repeated cumulative snapshots from the same notice pagination run. */
function compact(state){
 const latest=new Map(),remove=new Set();let removed=0;
 (state.queries||[]).forEach((q,i)=>{
  if(!q.keyword||!Array.isArray(q.checks)||!Array.isArray(q.results))return;
  const key=JSON.stringify([q.route,q.keyword,q.startDate,q.endDate]),previous=latest.get(key);
  if(previous){const p=previous.value,ids=new Set(q.results.map(r=>r.id));
   const prefix=p.checks.length<=q.checks.length&&p.checks.every((c,n)=>c.startDate===q.checks[n].startDate&&c.endDate===q.checks[n].endDate&&c.count===q.checks[n].count);
   if(prefix&&p.results.every(r=>ids.has(r.id))){remove.add(previous.index);removed++;}
  }
  latest.set(key,{index:i,value:q});
 });
 if(removed){state.queries=state.queries.filter((_,i)=>!remove.has(i));state.queryCompaction={version:1,cumulativeSnapshotsRemoved:(state.queryCompaction?.cumulativeSnapshotsRemoved||0)+removed,basis:'Later cumulative snapshot preserves every earlier checked range/count and result identifier; separate retries and other query receipts are retained.'};}
 return removed;
}
function publicLog(state){
 const safe=require('./discovery-metadata').safeUrl,receipt=require('./research-outcomes').receipt;
 return {operations:(state.jobs||[]).map(j=>({...receipt(j),...(j.refinement?{refinement:j.refinement}:{}),...(j.scopeReview?{scopeReview:{reason:j.scopeReview.reason,source:safe(j.scopeReview.source),checkedAt:j.scopeReview.checkedAt}}:{})})),queries:(state.queries||[]).filter(q=>q.term||q.keyword||q.rows).map(q=>{
  const rows=q.results||q.rows||[],header=Array.isArray(rows[0])?rows[0]:null;
  const results=header?rows.slice(1).map(r=>({url:safe(r[header.indexOf('original')]),timestamp:r[header.indexOf('timestamp')]})):rows.map(r=>({id:r.id,title:r.title||r.name||r.file_name,url:safe(r.url||r.document_url||r.download_url)}));
  return {route:q.route,term:q.term||q.keyword,url:safe(q.url),page:q.page,total:q.total,count:q.count,startDate:q.startDate,endDate:q.endDate,complete:q.complete,checks:q.checks,results};
 })};
}
module.exports={compact,publicLog};
