/* "Your company": the contractor enters their details once; every project's permit forms reuse them.
   Saved in this browser (and in each project it is applied to, which syncs when signed in). Applying
   only fills an empty Builder role (and, if chosen, an empty Applicant/contact role); it never
   overwrites a team member set on the project. */
(function(root){'use strict';
const KEY='cornerpin.myCompany.v1',FIELDS=['name','contact','phone','email','license','address','city','state','zip'];
const store=()=>{try{return root.localStorage||null;}catch{return null;}};
function get(){try{const v=JSON.parse(store()?.getItem(KEY)||'null');return v&&v.name?v:null;}catch{return null;}}
function clean(o){const out={};for(const k of FIELDS)out[k]=String(o?.[k]??'').trim().slice(0,500);out.alsoContact=!!o?.alsoContact;return out;}
function save(o){const v=clean(o);if(!v.name)throw Error('Enter your company name.');if(v.email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.email))throw Error('Enter a valid email.');try{store()?.setItem(KEY,JSON.stringify({...v,savedAt:new Date().toISOString()}));}catch{}return v;}
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
 return '<section class="pw-card" id="my-company"><h2>Your company</h2><p>Enter this once. Cornerpin fills it into the builder section of every permit form, on every project.</p><form data-my-company><div class="pw-grid">'+f('name','Company name')+f('contact','Your name')+f('phone','Phone','tel')+f('email','Email','email')+f('license','Contractor license #')+f('address','Street address')+f('city','City')+f('state','State')+f('zip','ZIP')+'</div><label><input type="checkbox" name="alsoContact"'+(v.alsoContact!==false?' checked':'')+'> I\'m also the contact person on applications</label><button type="submit">'+(profile?'Save changes':'Save my company')+'</button></form>'+(profile?'<p class="pw-muted">Saved in this browser. Projects that already list a builder keep theirs.</p>':'')+'</section>';
}
const api={KEY,FIELDS,get,save,clean,commandsFor,form};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.MyCompany=api;
})(typeof window!=='undefined'?window:globalThis);
