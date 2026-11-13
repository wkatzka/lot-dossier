const crypto=require('node:crypto'),C=require('./cloud-projects');
function secret(){if(!process.env.ANTHROPIC_API_KEY)throw Error('Automatic research is not configured');return crypto.createHash('sha256').update('cornerpin-budget-v1:'+process.env.ANTHROPIC_API_KEY).digest('hex');}
async function rpc(action,payload={},request=fetch){const c=C.config();const r=await request(c.url+'/rest/v1/rpc/cornerpin_research',{method:'POST',headers:{apikey:c.key,Authorization:'Bearer '+c.key,'Content-Type':'application/json'},body:JSON.stringify({p_secret:secret(),p_action:action,p_payload:payload}),signal:AbortSignal.timeout(20000)});if(!r.ok)throw Error('Durable research storage unavailable ('+r.status+')');return r.json();}
async function authorized(header){const token=String(header||'').replace(/^Bearer /,'');if(token.length<40||token.length>160)return false;return (await rpc('authorize_dispatch',{token})).allowed===true;}
module.exports={rpc,secret,authorized};
