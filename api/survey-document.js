const survey=require('../lib/survey-document');
const {cors,query,send}=require('../lib/respond');
module.exports=async(req,res)=>{
  if(cors(req,res))return;const record=String(query(req).record||'');
  if(!/^\d{1,8}$/.test(record))return send(res,400,{error:'Valid survey record number required.'});
  try{if(query(req).format==='original'){const {buf}=await survey.original(record);if(buf.length>4*1024*1024)return send(res,413,{error:'Original exceeds the transfer limit. Use the cited public source link; this file has not been retained.'});res.setHeader('Content-Type','application/pdf');res.setHeader('Cache-Control','private, no-store');res.end(buf);return;}send(res,200,await survey.read(record),3600);}catch(e){send(res,502,{error:String(e.message||e)});}
};
