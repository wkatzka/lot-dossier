const assert=require('node:assert/strict'),H=require('../lib/http');
(async()=>{
 const original=global.fetch;let aborted=false,guard;
 global.fetch=async(url,options)=>new Response(new ReadableStream({start(controller){controller.enqueue(new TextEncoder().encode('partial body'));options.signal.addEventListener('abort',()=>{aborted=true;controller.error(options.signal.reason);});}}));
 try{
 await assert.rejects(Promise.race([H.text('https://example.org/slow',{timeout:20}),new Promise((_,reject)=>{guard=setTimeout(()=>reject(Error('Body deadline was lost after headers')),300);})]),e=>e.name==='TimeoutError');assert(aborted);
 console.log('PASS: HTTP deadlines remain active while reading a stalled response body.');
 }finally{clearTimeout(guard);global.fetch=original;}
})().catch(e=>{console.error(e);process.exitCode=1});
