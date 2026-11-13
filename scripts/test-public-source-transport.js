const assert=require('node:assert/strict'),T=require('../lib/public-source-transport');
for(const ip of ['127.0.0.1','10.1.2.3','169.254.169.254','172.16.2.1','192.168.1.1','::1','fc00::1','fe80::1','::ffff:127.0.0.1'])assert.equal(T.publicAddress(ip),false,ip);
assert(T.publicAddress('8.8.8.8'));assert(T.publicAddress('2606:4700:4700::1111'));
for(const url of ['http://example.org','https://127.0.0.1','https://[::1]','https://a.local','https://user:pass@example.org','https://example.org:444'])assert(!T.publicHost(url),url);
assert(T.publicHost('https://new-neighborhood.org/documents'));
(async()=>{
 const lookup=T.makeLookup((host,options,cb)=>cb(null,[{address:'127.0.0.1',family:4}]));
 await assert.rejects(()=>new Promise((resolve,reject)=>lookup('public-looking.example.org',{},e=>e?reject(e):resolve())),/restricted network/);
 const safe=T.makeLookup((host,options,cb)=>cb(null,[{address:'8.8.8.8',family:4}]));
 const result=await new Promise((resolve,reject)=>safe('example.org',{all:true},(e,a)=>e?reject(e):resolve(a)));assert.equal(result[0].address,'8.8.8.8');
 console.log('PASS: dynamically discovered public hosts use connection-time DNS checks; private, loopback and metadata destinations are rejected.');
})().catch(e=>{console.error(e);process.exitCode=1});
