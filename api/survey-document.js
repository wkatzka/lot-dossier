const survey=require('../lib/survey-document');
const {cors,query,send}=require('../lib/respond');
module.exports=async(req,res)=>{
  if(cors(req,res))return;const record=String(query(req).record||'');
  if(!/^\d{1,8}$/.test(record))return send(res,400,{error:'Valid survey record number required.'});
  try{send(res,200,await survey.read(record),3600);}catch(e){send(res,502,{error:String(e.message||e)});}
};
