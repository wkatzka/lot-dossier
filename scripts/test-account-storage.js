const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),{indexedDB}=require('fake-indexeddb');
(async()=>{
const window={},ctx={window,indexedDB,console,Blob};vm.runInNewContext(fs.readFileSync('web/project-store.js','utf8'),ctx);const S=window.ProjectStore;
await S.save({id:'cp-guest',revision:0},null,{id:'file',blob:new Blob(['guest'])});
S.setOwner('a');assert.equal((await S.list()).length,0);assert.equal(await S.file('file'),undefined);
await S.save({id:'cp-a',revision:0},null,{id:'file',blob:new Blob(['A'])});
S.setOwner('b');assert.equal((await S.list()).length,0);assert.equal(await S.file('file'),undefined);
await S.save({id:'cp-b',revision:0},null,{id:'file',blob:new Blob(['B'])});
S.setOwner('a');assert.equal((await S.list())[0].id,'cp-a');assert.equal(await (await S.file('file')).text(),'A');
await assert.rejects(()=>S.save({id:'cp-a',revision:2},1),/another tab/);
S.setOwner(null);assert.equal((await S.list())[0].id,'cp-guest');assert.equal(await (await S.file('file')).text(),'guest');
console.log('Guest / account A / account B project and file isolation, sign-out recovery, and stale writes passed.');
})();
