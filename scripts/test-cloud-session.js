const assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
(async()=>{
let event,remote=null,owner=null,session=null,requests=[],authOptions;const values=new Map(),events=[];
const sdk={auth:{onAuthStateChange:f=>{event=f;},getSession:async()=>({data:{session}}),signInWithPassword:async()=>{session={access_token:'test-token',user:{id:'user-a',email:'test@example.invalid'}};return {data:{session,user:session.user}};},signOut:async()=>({}),signUp:async()=>{throw Error('must not call signup before email configured');}}};
const window={CornerpinSupabase:{createClient:(_u,_k,o)=>{authOptions=o;return sdk;}},ProjectStore:{setOwner:id=>owner=id,owner:()=>owner},dispatchEvent:e=>events.push(e)};
const fetch=async(url,opt={})=>{requests.push({url,opt});if(url.includes('action=config'))return {ok:true,json:async()=>({configured:true,url:'https://example.supabase.co',key:'sb_publishable_test',emailReady:false})};if(['POST','PATCH'].includes(opt.method)){remote=JSON.parse(opt.body).record;return {ok:true,json:async()=>[{id:remote.id,revision:remote.revision}]};}return {ok:true,json:async()=>remote?[{record:remote}]:[]};};
const ctx={window,fetch,AbortSignal,location:{protocol:'https:',origin:'https://example.test'},sessionStorage:{},localStorage:{getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v)},CustomEvent:class{constructor(type,init){this.type=type;this.detail=init.detail;}}};
vm.runInNewContext(fs.readFileSync('web/cloud-sync.js','utf8'),ctx);const C=window.CloudSync;
await C.init();assert.equal(C.signedIn(),false);await C.login('test@example.invalid','not-a-real-password');assert.equal(owner,'user-a');assert.equal(C.signedIn(),true);assert.equal(authOptions.auth.storage,ctx.sessionStorage);
await assert.rejects(()=>C.signup('x@example.invalid','irrelevant'),/delivery/);await assert.rejects(()=>C.recover('x@example.invalid'),/delivery/);
const p={schemaVersion:1,id:'cp-test',revision:1,documents:[]};await C.push(p);assert.equal(remote.revision,1);assert(requests.at(-1).url.startsWith('https://example.supabase.co/rest/v1/cornerpin_projects'));assert.equal(JSON.parse(requests.at(-1).opt.body).owner_id,'user-a');await C.push(p);remote={...p,revision:2};await assert.rejects(()=>C.push({...p,revision:3}),/another device/);
event('TOKEN_REFRESHED',{...session,access_token:'refreshed-token'});await C.list();assert.equal(requests.at(-1).opt.headers.Authorization,'Bearer refreshed-token');
await C.logout();assert.equal(owner,null);assert.equal(C.signedIn(),false);await assert.rejects(()=>C.list(),/Sign in/);assert(events.some(e=>e.type==='cornerpin:account-changed'));
(await C.config()).pilotSignup=true;sdk.auth.signUp=async()=>({data:{session,user:session.user}});await C.signup('pilot@example.invalid','synthetic-password');assert.equal(C.signedIn(),true);await assert.rejects(()=>C.recover('pilot@example.invalid'),/delivery/);await C.logout();
console.log('Pilot signup, session refresh, account ownership, sign-out, email readiness, initial cloud save and stale-device rejection passed.');
})();
