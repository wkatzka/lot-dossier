/* "Your company" follows the contractor: saved to the account when signed in, pulled down on another
   device, newest copy wins, and an account's copy is cleared from a shared browser on sign-out. */
const assert=require('node:assert/strict');
const mem={};global.localStorage={getItem:k=>mem[k]??null,setItem:(k,v)=>{mem[k]=String(v);},removeItem:k=>{delete mem[k];}};
let user=null,remoteSaves=[];
global.CloudSync={company:{save:async v=>{remoteSaves.push(v);if(user)user.user_metadata={...user.user_metadata,cornerpin_company:v};return true;}},user:()=>user,signedIn:()=>!!user};
const MC=require('../web/my-company');
(async()=>{
 // Guest: saved on this device only.
 let r=await MC.saveEverywhere({name:'Peak Builders LLC',phone:'801-555-0100'});assert.equal(r.account,false);assert.equal(remoteSaves.length,0);assert.equal(MC.get().owner,null);
 // Signing in with an empty account attaches the device copy to the account.
 user={id:'u1',user_metadata:{}};assert.equal(await MC.syncAccount(user),'pushed');assert.equal(remoteSaves.at(-1).name,'Peak Builders LLC');assert.equal(MC.get().owner,'u1');
 // Signed-in saves go to the account.
 r=await MC.saveEverywhere({name:'Peak Builders LLC',phone:'801-555-0199'});assert.equal(r.account,true);assert.equal(remoteSaves.at(-1).phone,'801-555-0199');
 // Sign-out clears the account's copy from this browser.
 assert.equal(await MC.syncAccount(null),'cleared');assert.equal(MC.get(),null);
 // A new device (empty browser) signing in pulls the account copy.
 assert.equal(await MC.syncAccount(user),'pulled');assert.equal(MC.get().phone,'801-555-0199');
 // Newest wins: an older device copy does not overwrite a newer account copy.
 localStorage.setItem(MC.KEY,JSON.stringify({name:'Old Name LLC',savedAt:'2020-01-01T00:00:00Z',owner:'u1'}));
 assert.equal(await MC.syncAccount(user),'pulled');assert.equal(MC.get().name,'Peak Builders LLC');
 // A different account signing in on a shared browser never sees the first account's company.
 const other={id:'u2',user_metadata:{}};assert.equal(await MC.syncAccount(other),'cleared');assert.equal(MC.get(),null);
 console.log('PASS: company details sync to the account, pull down on new devices, newest wins, and never leak between accounts.');
})().catch(e=>{console.error(e);process.exit(1);});
