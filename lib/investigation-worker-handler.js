const {send}=require('../lib/respond'),S=require('../lib/investigation-store');
module.exports=async(req,res)=>{
 if(req.method!=='POST')return send(res,405,{error:'POST required'});
 try{if(!await S.authorized(req.headers.authorization))return send(res,401,{error:'Worker authentication required'});return send(res,200,await require('../lib/automatic-investigation').tick());}
 catch(e){return send(res,503,{error:e.message});}
};
