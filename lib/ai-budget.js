const crypto=require('node:crypto');
const cloud=require('./cloud-projects');
const error=(message,status=503)=>Object.assign(new Error(message),{status});
// Published Sonnet 5.5 standard rates: $2/M input, $10/M output.
// Reserve the FULL context upper bound, not token-count estimates. This can stop
// requests before $5 is spent, but keeps uncertain/in-flight calls inside the cap.
const INPUT_BOUND=1048576;
function resetAt(now=new Date()){
 const parts=Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now).map(p=>[p.type,p.value]));
 const tomorrow=new Date(Date.UTC(+parts.year,+parts.month-1,+parts.day+1));
 const offset=new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',timeZoneName:'shortOffset'}).formatToParts(new Date(tomorrow.getTime()+12*3600000)).find(p=>p.type==='timeZoneName').value.match(/GMT([+-]\d+)/);
 return new Date(tomorrow.getTime()-Number(offset?.[1]||0)*3600000).toISOString();
}
function reservation(body){
 if(body.model!=='claude-sonnet-5-5'||!Number.isInteger(body.max_tokens)||body.max_tokens<1||body.max_tokens>16000||body.stream||body.tools||body.service_tier==='priority'||body.inference_geo)throw error('CornerpinAI budget does not support this request configuration.');
 if(JSON.stringify(body).includes('"cache_control"'))throw error('Prompt caching requires a separate budget rate configuration.');
 return INPUT_BOUND*2+body.max_tokens*10;
}
function usageCost(u){
 if(!u||!Number.isSafeInteger(u.input_tokens)||!Number.isSafeInteger(u.output_tokens)||u.input_tokens<0||u.output_tokens<0)throw error('No reliable API usage returned; budget reservation retained.');
 const write=u.cache_creation_input_tokens||0,read=u.cache_read_input_tokens||0;
 if(!Number.isSafeInteger(write)||!Number.isSafeInteger(read)||write<0||read<0)throw error('Invalid API cache usage; budget reservation retained.');
 return Math.ceil(u.input_tokens*2+u.output_tokens*10+write*4+read*0.1);
}
async function ledger(action,id,amount,{request=fetch}={}){
 const c=cloud.config(),key=process.env.ANTHROPIC_API_KEY;
 if(!key)throw error('CornerpinAI budget is not configured.');
 const secret=crypto.createHash('sha256').update('cornerpin-budget-v1:'+key).digest('hex');
 let r;try{r=await request(c.url+'/rest/v1/rpc/cornerpin_ai_budget',{method:'POST',headers:{apikey:c.key,Authorization:'Bearer '+c.key,'Content-Type':'application/json'},body:JSON.stringify({p_secret:secret,p_action:action,p_id:id,p_amount:amount}),signal:AbortSignal.timeout(15000)});}catch{throw error('CornerpinAI budget is unavailable. No additional paid calls can start.');}
 if(!r.ok)throw error('CornerpinAI budget is unavailable. No additional paid calls can start.');
 return r.json();
}
function budgetedRequest({request=fetch,account=ledger}={}){
 return async(url,options)=>{
  if(url!=='https://api.anthropic.com/v1/messages')throw error('Unsupported paid API endpoint.');
  const body=JSON.parse(options.body),amount=reservation(body),id=crypto.randomUUID();
  const held=await account('reserve',id,amount);
  if(!held.allowed)throw Object.assign(error('CornerpinAI’s $5 daily budget has insufficient room for another analysis. It resets at midnight Eastern time. Saved results and non-AI tools remain available.',429),{code:'AI_BUDGET_PAUSED',retryAt:resetAt()});
  // Network failures and ambiguous server errors retain the full reservation.
  const response=await request(url,options);
  if(response.ok){
   try{const data=await response.clone().json();await account('settle',id,usageCost(data.usage));}
   catch{console.warn('CornerpinAI usage settlement unavailable; full reservation retained.');}
  }else if(response.status>=400&&response.status<500&&response.status!==408){
   try{await account('settle',id,0);}catch{console.warn('CornerpinAI rejected-request reservation retained.');}
  }
  return response;
 };
}
module.exports={budgetedRequest,reservation,usageCost,ledger,resetAt};
