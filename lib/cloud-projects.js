function config(env=process.env){
 const url=env.CORNERPIN_SUPABASE_URL,key=env.CORNERPIN_SUPABASE_ANON_KEY;
 if(!url||!key)return {configured:false};
 if(!/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(url))throw Error('Invalid configured storage origin');
 if(!key.startsWith('sb_publishable_')){let payload;try{payload=JSON.parse(Buffer.from(key.split('.')[1]||'', 'base64url').toString());}catch(e){}if(payload?.role!=='anon')throw Error('Only a public anonymous/publishable key may be configured');}
 return {configured:true,url,key};
}
async function user(token,c,request=fetch){
 if(!token||token.length>16000)throw Error('Authentication required');
 const r=await request(c.url+'/auth/v1/user',{headers:{apikey:c.key,Authorization:'Bearer '+token},signal:AbortSignal.timeout(10000)});
 if(!r.ok)throw Error('Authentication required');const u=await r.json();if(!/^[a-f0-9-]{36}$/i.test(u.id||''))throw Error('Invalid authenticated identity');return u;
}
async function save(token,record,expectedRevision,c,request=fetch){
 const owner=await user(token,c,request);
 if(record.schemaVersion!==1||!/^cp-[a-z0-9-]+$/i.test(record.id)||!Number.isInteger(record.revision)||record.revision<0)throw Error('Invalid project record');
 if(expectedRevision!==null&&(!Number.isInteger(expectedRevision)||record.revision<=expectedRevision))throw Error('Revision must advance');
 const filter='?id=eq.'+encodeURIComponent(record.id)+'&owner_id=eq.'+owner.id+(expectedRevision===null?'':'&revision=eq.'+expectedRevision);
 const r=await request(c.url+'/rest/v1/cornerpin_projects'+(expectedRevision===null?'':filter),{method:expectedRevision===null?'POST':'PATCH',headers:{apikey:c.key,Authorization:'Bearer '+token,'Content-Type':'application/json',Prefer:'return=representation'},body:JSON.stringify({id:record.id,owner_id:owner.id,revision:record.revision,record,updated_at:new Date().toISOString()}),signal:AbortSignal.timeout(15000)});
 if(!r.ok)throw Error(r.status===409?'Project conflict; reload before saving':'Cloud save failed');const rows=await r.json();if(rows.length!==1)throw Error('Project conflict or access denied');return rows[0].record;
}
module.exports={config,user,save};
