const assert=require('node:assert/strict'),C=require('../lib/cloud-projects');
(async()=>{
 assert.equal(C.config({}).configured,false);assert.throws(()=>C.config({CORNERPIN_SUPABASE_URL:'http://localhost',CORNERPIN_SUPABASE_ANON_KEY:'x'}));
 const c={url:'https://example.supabase.co',key:'public'},uid='11111111-1111-1111-1111-111111111111',record={schemaVersion:1,id:'cp-example',revision:2};let seen;
 const mock=async(url,opt)=>url.endsWith('/user')?{ok:true,json:async()=>({id:uid})}:(seen={url,opt},{ok:true,json:async()=>[{record}]});
 await C.save('token',record,1,c,mock);assert(seen.url.includes('owner_id=eq.'+uid));assert(seen.url.includes('revision=eq.1'));assert.equal(JSON.parse(seen.opt.body).owner_id,uid);
 await assert.rejects(()=>C.save('',record,1,c,mock),/Authentication/);
 await assert.rejects(()=>C.save('token',record,1,c,async(url)=>url.endsWith('/user')?{ok:true,json:async()=>({id:uid})}:{ok:true,json:async()=>[]}),/conflict/);
 console.log('Cloud adapter tests passed: configured fail-closed, authenticated ownership, revision conflict and unauthorized request. Live RLS verification requires provisioned storage.');
})();
