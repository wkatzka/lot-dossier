// Read a plan-listed firm's own public site; never search for or assign a new project team member.
const https=require('node:https'),dns=require('node:dns').promises,{decode}=require('./http');
const clean=s=>String(s||'').toLowerCase().replace(/[^a-z0-9]/g,'');
function publicIPv4(ip){const a=ip.split('.').map(Number);return a.length===4&&a.every(n=>Number.isInteger(n)&&n>=0&&n<=255)&&![0,10,127].includes(a[0])&&a[0]<224&&!(a[0]===169&&a[1]===254)&&!(a[0]===172&&a[1]>=16&&a[1]<=31)&&!(a[0]===192&&(a[1]===168||a[1]===0||a[1]===2))&&!(a[0]===100&&a[1]>=64&&a[1]<=127)&&!(a[0]===198&&(a[1]===18||a[1]===19||a[1]===51))&&!(a[0]===203&&a[1]===0);}
const host=u=>u.hostname.replace(/^www\./,'').toLowerCase();
async function page(url,origin,redirects=0){
 const u=new URL(url);if(u.protocol!=='https:'||u.username||u.password||u.port||host(u)!==host(new URL(origin))||redirects>3)throw Error('Unsupported company contact URL');
 const addresses=await dns.resolve4(u.hostname);if(!addresses.length||addresses.some(ip=>!publicIPv4(ip)))throw Error('Not a public company host');
 return new Promise((resolve,reject)=>{
  const req=https.get(u,{agent:false,lookup:(_h,options,cb)=>cb(null,options.all?[{address:addresses[0],family:4}]:addresses[0],4),headers:{'User-Agent':'Cornerpin public-contact lookup','Accept':'text/html'}},res=>{
   if([301,302,303,307,308].includes(res.statusCode)){res.resume();return page(new URL(res.headers.location,u).href,origin,redirects+1).then(resolve,reject);}
   if(res.statusCode!==200||!String(res.headers['content-type']).includes('text/html')){res.resume();return reject(Error('Company page unavailable'));}
   let size=0,parts=[];res.on('data',b=>{size+=b.length;if(size>1024*1024){res.destroy();reject(Error('Company page too large'));}else parts.push(b);});res.on('error',reject);res.on('end',()=>resolve({url:u.href,html:Buffer.concat(parts).toString('utf8')}));
  });const timer=setTimeout(()=>req.destroy(Error('Company contact timeout')),8000);req.on('close',()=>clearTimeout(timer));req.on('error',reject);
 });
}
function emails(html,domain){
 const decoded=html.replace(/data-cfemail=["']([a-f0-9]+)["']/gi,(_m,s)=>{const b=Buffer.from(s,'hex');return [...b.subarray(1)].map(x=>String.fromCharCode(x^b[0])).join('');});
 return [...new Set((decoded.match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi)||[]).map(x=>x.toLowerCase()).filter(x=>x.split('@')[1]===domain))];
}
async function enrich(pages,facts,document,{read=page}={}){
 const name=facts.find(f=>f.field==='design_professional'&&!f.conflict),phone=facts.find(f=>f.field==='design_professional_phone'&&!f.conflict);
 if(!name||!phone||facts.some(f=>f.field==='design_professional_email'))return [];
 const source=pages.find(p=>p.n===phone.page);if(!source)return [];
 const domains=[...new Set((source.text.match(/\bwww\.[a-z0-9.-]+\.[a-z]{2,}\b/gi)||[]).map(s=>s.toLowerCase().replace(/^www\./,'')))];if(domains.length!==1)return [];
 const origin='https://'+domains[0]+'/';
 try{
  const home=await read(origin,origin);const links=[...home.html.matchAll(/href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)].filter(m=>/contact/i.test(decode(m[2]))).map(m=>new URL(m[1],home.url)).filter(u=>u.protocol==='https:'&&host(u)===domains[0]);
  const candidates=[home];if(links.length)candidates.push(await read(links[0].href,origin));
  for(const item of candidates){const visible=decode(item.html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi,''));if(!clean(visible).includes(clean(name.value))||!visible.replace(/\D/g,'').includes(String(phone.value).replace(/\D/g,'')))continue;
   const found=emails(item.html,domains[0]);if(found.length!==1)continue;
   return [{field:'design_professional_email',value:found[0],unit:'text',page:name.page,quote:found[0],method:'public_company_contact',sourceURL:item.url,retrievedAt:new Date().toISOString(),matchedName:name.value,matchedPhone:phone.value,documentId:document.id,documentHash:document.hash,filename:document.name,review:'needs_review'}];
  }
 }catch(e){return [];}
 return [];
}
module.exports={enrich,emails,publicIPv4};
