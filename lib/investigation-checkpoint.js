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
module.exports={compact};
