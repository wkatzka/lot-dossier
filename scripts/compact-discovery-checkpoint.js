/* Write a separate allowlisted metadata checkpoint. Never upload extracted text or source bytes. */
const fs=require('node:fs'),path=require('node:path');
const root=process.argv[2],out='.discovery-metadata';if(!root||!fs.existsSync(root))process.exit(0);
const pick=(o,keys)=>Object.fromEntries(keys.filter(k=>o[k]!==undefined).map(k=>[k,o[k]]));
const {safeUrl}=require('../lib/discovery-metadata');
fs.mkdirSync(out,{recursive:true});
for(const name of fs.readdirSync(root)){
 const dir=path.join(root,name),file=path.join(dir,'manifest.json');if(!fs.existsSync(file))continue;
 const s=JSON.parse(fs.readFileSync(file)),clean=pick(s,['version','profileId','profileHash','startedAt','updatedAt','runStartedAt','scope','contactFallbackEligible']);
 clean.profileRevisions=(s.profileRevisions||[]).map(r=>pick(r,['previousHash','nextHash','checkedAt']));
 clean.reviewedPages=(s.reviewedPages||[]).map(r=>pick(r,['sha256','page','checkedAt','reviewKind']));
 clean.jobs=s.jobs.map(j=>({...pick(j,['id','key','kind','term','resource','requestId','route','page','startDate','endDate','status','depth','maxDepth','mode','documentHash','sha256','checkedAt','retrievedAt','bytes','httpStatus']),key:j.key.split('|').map(part=>/^https?:\/\//.test(part)?safeUrl(part):part).join('|'),discoveredFrom:(j.discoveredFrom||[]).map(safeUrl).filter(Boolean),url:safeUrl(j.url),originalUrl:safeUrl(j.originalUrl),libraryPrefix:safeUrl(j.libraryPrefix),...(j.error?{error:'Source task remains unresolved; retry or review original source'}:{})}));
 clean.documents=s.documents.map(d=>({...pick(d,['sha256','kind','file','route','retrievedAt','pages','unreadPages','blankPages','applicability','disposition','ocrReviewRequired','pdfLinkScanVersion']),urls:d.urls.map(safeUrl).filter(Boolean),sourcePages:(d.sourcePages||[]).map(safeUrl).filter(Boolean),matches:(d.matches||[]).map(m=>pick(m,['page','terms'])),...(d.readError?{readError:'Document reading remains unresolved'}:{})}));
 clean.externalLeads=s.externalLeads.map(l=>({url:safeUrl(l.url),route:l.route,status:l.status}));
 clean.sourceRestrictions=s.sourceRestrictions.map(r=>({...pick(r,['route','status','httpStatus','retryAfter','checkedAt']),url:safeUrl(r.url)}));
 // Preserve search evidence and pagination identities, never response bodies or request text.
 clean.queries=(s.queries||[]).filter(q=>q.url).map(q=>({...pick(q,['route','kind','term','page','requestId','total','count']),url:safeUrl(q.url),...(Array.isArray(q.rows)?{count:q.rows.length,rows:q.rows.map(r=>pick(r,['id','timeline_id']))}:{})}));clean.discarded=[];require('../lib/record-discovery-engine').summarize(clean,JSON.parse(fs.readFileSync(path.join(dir,'profile.json'))));
 const target=path.join(out,name);fs.mkdirSync(target,{recursive:true});fs.writeFileSync(path.join(target,'manifest.json'),JSON.stringify(clean));
 if(fs.existsSync(path.join(dir,'profile.json')))fs.copyFileSync(path.join(dir,'profile.json'),path.join(target,'profile.json'));
}
