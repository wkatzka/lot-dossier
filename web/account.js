/* Account controls. The official SDK owns token refresh; tokens are never exported. */
(function(root){
'use strict';
const C=root.CloudSync,dialog=document.createElement('dialog');dialog.className='account-dialog';document.body.appendChild(dialog);
let mode='login',busy=false,emailReady=false;
const esc=v=>String(v||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function draw(note=''){
 const u=C.user(),titles={login:'Welcome back',signup:'Create your account',recover:'Reset your password',password:'Choose a new password'};
 dialog.innerHTML='<button class="account-close" type="button" aria-label="Close account panel">×</button><p class="eyebrow">Cornerpin account</p><h2>'+ (u&&mode!=='password'?'Your account':titles[mode])+'</h2>'+(u&&mode!=='password'?'<p>'+esc(u.email)+'</p><p>Your private cloud copies are available under Projects. Working changes stay on this device until you choose Save to account.</p><button type="button" data-account-action="logout">Sign out</button>':'<form><label>'+(mode==='password'?'New password':'Email address')+'<input name="'+(mode==='password'?'password':'email')+'" type="'+(mode==='password'?'password':'email')+'" autocomplete="'+(mode==='password'?'new-password':'email')+'" required '+(mode==='password'?'minlength="12"':'')+'></label>'+(['login','signup'].includes(mode)?'<label>Password<input name="password" type="password" autocomplete="'+(mode==='signup'?'new-password':'current-password')+'" required '+(mode==='signup'?'minlength="12"':'')+'></label>':'')+'<button type="submit"'+(!emailReady&&['signup','recover'].includes(mode)?' disabled':'')+'>'+ ({login:'Sign in',signup:'Create account',recover:'Send reset link',password:'Save password'})[mode]+'</button></form><div class="account-links"><button type="button" data-account-mode="'+(mode==='login'?'signup':'login')+'">'+(mode==='login'?'Create an account':'Back to sign in')+'</button>'+(mode==='login'?'<button type="button" data-account-mode="recover">Forgot password?</button>':'')+'</div>')+'<p class="account-message" role="status">'+esc(note)+'</p><p class="account-note">Guest projects remain on their original device. To move one into your account, download a complete backup as a guest, then restore it while signed in.</p>';
}
async function open(){if(document.getElementById('go').disabled||root.CornerpinWorkspaceBusy?.()){draw('Finish the current save or report before changing accounts.');if(!dialog.open)dialog.showModal();dialog.querySelectorAll('form button,[data-account-action]').forEach(b=>b.disabled=true);return;}try{await C.init();emailReady=(await C.config()).emailReady===true;mode='login';draw();if(!dialog.open)dialog.showModal();}catch(e){draw(e.message);if(!dialog.open)dialog.showModal();}}
document.addEventListener('click',e=>{if(e.target.closest('[data-account]'))open();});
dialog.addEventListener('click',async e=>{
 if(e.target.closest('.account-close')){dialog.close();return;}
 const m=e.target.closest('[data-account-mode]');if(m&&!busy){mode=m.dataset.accountMode;const cfg=await C.config();emailReady=cfg.emailReady===true;draw(!cfg.emailReady&&mode!=='login'?'Email delivery is not connected yet. New accounts and reset emails are not available.':'');}
 if(e.target.closest('[data-account-action="logout"]')&&!busy){busy=true;try{await C.logout();mode='login';draw('Signed out.');}catch(err){draw(err.message);}finally{busy=false;}}
});
dialog.addEventListener('submit',async e=>{e.preventDefault();if(busy)return;if(document.getElementById('go').disabled||root.CornerpinWorkspaceBusy?.()){dialog.querySelector('.account-message').textContent='Wait for the current operation to finish.';return;}busy=true;const f=e.target,b=f.querySelector('button[type=submit]'),d=new FormData(f);b.disabled=true;
 try{if(mode==='login'){await C.login(d.get('email'),d.get('password'));draw('Signed in. Open Projects to access your account.');}
 else if(mode==='signup'){await C.signup(d.get('email'),d.get('password'));draw('Check your email for a confirmation link.');}
 else if(mode==='recover'){await C.recover(d.get('email'));draw('If an account exists for that address, a reset link will be sent.');}
 else {await C.password(d.get('password'));mode='login';draw('Password updated.');}
 }catch(err){dialog.querySelector('.account-message').textContent=err.message;b.disabled=false;}finally{busy=false;}
});
root.addEventListener('cornerpin:auth',e=>{document.querySelectorAll('[data-account]').forEach(b=>b.textContent=e.detail.user?'Account':'Sign in');if(e.detail.event==='PASSWORD_RECOVERY'){mode='password';draw();if(!dialog.open)dialog.showModal();}});
root.CornerpinAccount={open,ready:C.init()};root.CornerpinAccount.ready.catch(()=>{});
})(window);
