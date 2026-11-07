const {cors,send}=require('../lib/respond');
const {run}=require('../lib/public-research');
module.exports=async(req,res)=>{
 if(cors(req,res))return;
 if(req.method!=='POST')return send(res,405,{error:'POST required'});
 try{let body=req.body;if(!body){let raw='';for await(const c of req){raw+=c;if(raw.length>250000)return send(res,413,{error:'Request too large'});}body=JSON.parse(raw);}else if(typeof body==='string')body=JSON.parse(body);
  send(res,200,await run(body));
 }catch(e){send(res,400,{error:e.message});}
};
