const C=require('../lib/cloud-projects');
const {send,query}=require('../lib/respond');
module.exports=async(req,res)=>{
 if(['permit-extraction','plan-measurements'].includes(query(req).action))return require('../lib/permit-extraction-handler')(req,res);
 if(query(req).action==='recorded-comparison')return require('../lib/recorded-comparison-handler')(req,res);
 const c=C.config();res.setHeader('Cache-Control','no-store');
 if(req.method==='GET'&&query(req).action==='config')return send(res,200,c);
 if(!c.configured)return send(res,503,{error:'Private cloud storage is not configured. Local projects remain available.'});
 const token=String(req.headers.authorization||'').replace(/^Bearer /,'');
 try{
  const u=await C.user(token,c);
  if(req.method==='GET'&&query(req).action==='license-lookup')return send(res,200,await require('../lib/contractor-registry').lookup(String(query(req).license||'')));
  if(req.method==='GET'){
   const r=await fetch(c.url+'/rest/v1/cornerpin_projects?owner_id=eq.'+u.id+'&select=record',{headers:{apikey:c.key,Authorization:'Bearer '+token},signal:AbortSignal.timeout(15000)});if(!r.ok)throw Error('Cloud read failed');return send(res,200,{projects:(await r.json()).map(x=>x.record)});
  }
  if(req.method!=='POST')return send(res,405,{error:'Unsupported method'});
  let body=req.body;if(!body){let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>5e6)return send(res,413,{error:'Project record exceeds 5 MB'});}body=JSON.parse(raw);}else if(typeof body==='string')body=JSON.parse(body);
  send(res,200,{project:await C.save(token,body.project,body.expectedRevision,c)});
 }catch(e){send(res,/Authentication|identity/.test(e.message)?401:409,{error:e.message});}
};
