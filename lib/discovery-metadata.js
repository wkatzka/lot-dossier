/* Public status must never include response bodies or signed query secrets. */
function safeUrl(value){try{const u=new URL(value);if(!['https:','http:'].includes(u.protocol)||u.username||u.password)return undefined;for(const key of [...u.searchParams.keys()])if(/token|signature|credential|X-Amz-/i.test(key))u.searchParams.delete(key);u.hash='';return u.href;}catch{return undefined;}}
function stableUrl(value){return typeof value==='string'&&safeUrl(value)===value;}
function publicCoverage(value){return {...value,routes:(value.routes||[]).map(r=>({...r,unresolved:(r.unresolved||[]).map(j=>({id:j.id,status:j.status,url:safeUrl(j.url),...(j.error?{error:'Source retrieval or reading remains unresolved; retry or inspect the original source.'}:{})}))}))};}
module.exports={safeUrl,stableUrl,publicCoverage};
