const {cors,send,query}=require('../lib/respond');
const {run}=require('../lib/public-research');
module.exports=async(req,res)=>{
 if(query(req).action==='worker')return require('../lib/investigation-worker-handler')(req,res);
 if(cors(req,res))return;
 if(req.method==='GET'&&query(req).format==='approval-evidence'){
  res.setHeader('Content-Type','application/javascript; charset=utf-8');res.setHeader('Cache-Control','no-store');
  return res.end('window.ApprovalEvidenceData='+JSON.stringify(require('../lib/approval-evidence-data')).replace(/</g,'\\u003c')+';');
 }
 if(req.method==='GET'&&query(req).format==='investigation'){
  const {county,parcelId}=query(req);
  if(typeof county!=='string'||!/^[- A-Za-z]{1,60}$/.test(county)||typeof parcelId!=='string'||!/^[-.A-Za-z0-9]{1,40}$/.test(parcelId))return send(res,400,{error:'Valid county and parcel identifier required'});
  let automatic;try{automatic=await require('../lib/automatic-investigation').status(county,parcelId);}catch(e){return send(res,503,{error:'Current automatic research status is unavailable; no empty-search conclusion can be drawn.'});}
  return send(res,200,automatic||require('../lib/discovery-index').lookup(county,parcelId));
 }
 if(req.method==='GET')return send(res,200,require('../data/title/discovery-production.json'));
 if(req.method!=='POST')return send(res,405,{error:'POST required'});
 try{let body=req.body;if(!body){let raw='';for await(const c of req){raw+=c;if(raw.length>250000)return send(res,413,{error:'Request too large'});}body=JSON.parse(raw);}else if(typeof body==='string')body=JSON.parse(body);
  if(query(req).action==='investigate')return send(res,200,await require('../lib/automatic-investigation').enqueue(String(body.county||''),String(body.parcelId||'')));
  send(res,200,await run(body));
 }catch(e){send(res,400,{error:e.message});}
};
