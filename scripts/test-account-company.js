/* Company is part of the account: the signed-in account panel offers "Add company details" (optional),
   saves through the same profile as Permit Preparation, and a new account gets an optional, skippable step. */
const assert=require('node:assert/strict'),fs=require('fs'),{JSDOM}=require('jsdom');
(async()=>{
 const dom=new JSDOM('<button id="go"></button><button data-account>Sign in</button>',{url:'https://example.test',runScripts:'outside-only'}),w=dom.window,d=w.document;
 w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;};
 let user={id:'u1',email:'sam@peak.example',user_metadata:{}},saved=[],session=true;
 w.CloudSync={init:async()=>{},config:async()=>({emailReady:false,pilotSignup:true}),user:()=>session?user:null,signedIn:()=>session,
  signup:async()=>{session=true;return {session:{}};},login:async()=>{},logout:async()=>{session=false;},company:{save:async v=>{saved.push(v);return true;}}};
 w.eval(fs.readFileSync('web/input-rules.js','utf8'));w.eval(fs.readFileSync('web/my-company.js','utf8'));w.eval(fs.readFileSync('web/account.js','utf8'));
 const tick=()=>new Promise(r=>setTimeout(r,20));
 await w.CornerpinAccount.open();const dlg=d.querySelector('.account-dialog');
 assert(/Your company/.test(dlg.textContent)&&/Optional/.test(dlg.textContent),'Signed-in account panel offers the optional company section');
 d.querySelector('[data-account-mode=company]').click();await tick();
 const f=dlg.querySelector('form[data-account-company]');assert(f,'Add company details opens the company form');
 f.querySelector('[name=name]').value='Peak Builders LLC';f.querySelector('[name=phone]').value='801-555-0100';
 f.dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));await tick();await tick();
 assert.equal(saved.at(-1)?.name,'Peak Builders LLC','Saved to the account');assert(/Company saved to your account/.test(dlg.textContent));
 assert(/Peak Builders LLC · Sam|Peak Builders LLC · 801-555-0100/.test(dlg.textContent),'Account panel shows the saved company');
 assert(/Edit company details/.test(dlg.textContent));
 // Bad phone is refused with a plain message.
 d.querySelector('[data-account-mode=company]').click();await tick();const f2=dlg.querySelector('form[data-account-company]');f2.querySelector('[name=phone]').value='555-01';f2.dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));await tick();
 assert(/10-digit phone/.test(dlg.querySelector('.account-message').textContent));
 // New account: optional step with Skip.
 w.localStorage.clear();dlg.querySelector('[data-account-mode=account]').click();await tick();
 session=false;await w.CornerpinAccount.open();await tick();d.querySelector('[data-account-mode=signup]').click();await tick();
 const sf=dlg.querySelector('form:not([data-account-company])');sf.querySelector('[name=email]').value='new@peak.example';sf.querySelector('[name=password]').value='long-enough-password';sf.dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));await tick();await tick();
 assert(dlg.querySelector('form[data-account-company]')&&/Skip for now/.test(dlg.textContent)&&/One optional step/.test(dlg.textContent),'New accounts get an optional, skippable company step');
 dlg.querySelector('[data-account-mode=account]').click();await tick();assert(/Add company details/.test(dlg.textContent),'Skipping returns to the account panel');
 console.log('PASS: company setup lives in the account (optional), with a skippable step right after sign-up.');
})().catch(e=>{console.error(e);process.exit(1);});
