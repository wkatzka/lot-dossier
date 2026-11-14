/* "Your company": the contractor enters their details once; every project's permit forms reuse them.
   Saved in this browser and, when signed in, on the account, so it follows the contractor to every device.
   Newest copy wins; an account's copy is cleared from the browser on sign-out. Applying
   only fills an empty Builder role (and, if chosen, an empty Applicant/contact role); it never
   overwrites a team member set on the project. */
(function(root){'use strict';
const KEY='cornerpin.myCompany.v1',FIELDS=['name','contact','phone','email','license','address','city','state','zip'];
const store=()=>{try{return root.localStorage||null;}catch{return null;}};
function get(){try{const v=JSON.parse(store()?.getItem(KEY)||'null');return v&&v.name?v:null;}catch{return null;}}
function clean(o){const out={};for(const k of FIELDS)out[k]=String(o?.[k]??'').trim().slice(0,500);out.alsoContact=!!o?.alsoContact;return out;}
const meta=v=>v?{savedAt:v.savedAt||'',owner:v.owner||null}:{};
const cloud=()=>root.CloudSync&&root.CloudSync.company?root.CloudSync:null;
function write(v){try{store()?.setItem(KEY,JSON.stringify(v));}catch{}}
function save(o){const v=clean(o);if(!v.name)throw Error('Enter your company name.');const IR=typeof module!=='undefined'&&module.exports?require('./input-rules'):root.InputRules;if(IR)for(const [k,label] of [['email','Email'],['phone','Phone']]){const e=IR.check(v[k],IR.rule(label));if(e)throw Error(e);}else if(v.email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.email))throw Error('Enter a valid email.');write({...v,savedAt:new Date().toISOString(),owner:cloud()?.user()?.id||null});return v;}
// Save here and, when signed in, on the account. Returns where it was saved.
async function saveEverywhere(o){const v=save(o);const c=cloud();if(!c||!c.signedIn())return {profile:v,account:false};await c.company.save({...v,savedAt:get().savedAt});return {profile:v,account:true};}
// On sign-in: newest copy wins between this browser and the account. On sign-out: forget an account's copy.
async function syncAccount(user){
 const local=(()=>{try{return JSON.parse(store()?.getItem(KEY)||'null');}catch{return null;}})(),c=cloud();
 if(!user){if(local?.owner){try{store()?.removeItem(KEY);}catch{}}return 'cleared';}
 const remote=user.user_metadata?.cornerpin_company||null;
 if(local&&local.owner&&local.owner!==user.id){if(remote?.name){write({...clean(remote),savedAt:remote.savedAt||'',owner:user.id});return 'pulled';}try{store()?.removeItem(KEY);}catch{}return 'cleared';}
 if(remote?.name&&(!local?.name||String(remote.savedAt||'')>=String(local.savedAt||''))){write({...clean(remote),savedAt:remote.savedAt||'',owner:user.id});return 'pulled';}
 if(local?.name&&c){const v={...clean(local),savedAt:local.savedAt||new Date().toISOString()};write({...v,owner:user.id});try{await c.company.save(v);return 'pushed';}catch{return 'local';}}
 return 'none';
}
if(root.addEventListener&&root.document)root.addEventListener('cornerpin:account-changed',e=>{syncAccount(e.detail?.user||null).then(r=>{if(r==='pulled'||r==='cleared')root.dispatchEvent(new CustomEvent('cornerpin:company-changed'));}).catch(()=>{});});
// Commands that fill the project's empty roles from the saved profile.
function commandsFor(project,profile=get()){
 if(!profile)return [];const team=project?.application?.team||{},out=[],base={...Object.fromEntries(FIELDS.map(k=>[k,profile[k]||''])),type:'team_profile',confirmed:true};
 if(!team.builder?.name)out.push({...base,role:'builder'});
 if(profile.alsoContact&&!team.contact?.name)out.push({...base,role:'contact',name:profile.contact||profile.name,license:''});
 return out;
}
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function form(profile=get()){
 const v=profile||{},f=(k,label,type='text')=>'<label>'+label+'<input name="'+k+'" type="'+type+'" value="'+esc(v[k]||'')+'"'+(k==='name'?' required':'')+'></label>';
 return '<section class="pw-card" id="my-company"><h2>Your company</h2><p>Enter this once. Cornerpin fills it into the builder section of every permit form, on every project. When you’re signed in it’s saved to your account, so it’s there on your phone too.</p><form data-my-company><div class="pw-grid">'+f('name','Company name')+f('contact','Your name')+f('phone','Phone','tel')+f('email','Email','email')+f('license','Contractor license #')+f('address','Street address')+f('city','City')+f('state','State')+f('zip','ZIP')+'</div><label><input type="checkbox" name="alsoContact"'+(v.alsoContact!==false?' checked':'')+'> I\'m also the contact person on applications</label><button type="submit">'+(profile?'Save changes':'Save my company')+'</button></form>'+(profile?'<p class="pw-muted">Saved in this browser. Projects that already list a builder keep theirs.</p>':'')+'</section>';
}
const api={KEY,FIELDS,get,save,saveEverywhere,syncAccount,clean,commandsFor,form};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.MyCompany=api;
})(typeof window!=='undefined'?window:globalThis);
