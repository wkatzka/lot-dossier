const {cors,query,send}=require('../lib/respond');
const {read}=require('../lib/original-reader');
module.exports=async(req,res)=>{
 if(cors(req,res))return;if(req.method!=='GET')return send(res,405,{error:'GET required'});
 const q=query(req);try{send(res,200,await read(String(q.url||''),Number(q.page||1)),86400);}catch(e){if(e.status===429)res.setHeader('Retry-After','5');send(res,e.status||502,{error:e.message,retryPage:Number(q.page||1)});}
};
