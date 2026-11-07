const surveys=require('../lib/surveys');
const {cors,query,send}=require('../lib/respond');
module.exports=async(req,res)=>{
  if(cors(req,res))return;
  const q=query(req),name=String(q.q||'').trim();
  if(q.county!=='Weber')return send(res,400,{error:'Filed-survey discovery currently supports Weber County only.'});
  if(name.length<4||name.length>160)return send(res,400,{error:'Provide a subdivision name between 4 and 160 characters.'});
  try{send(res,200,await surveys.find(name),3600);}catch(e){send(res,502,{error:String(e.message||e)});}
};
