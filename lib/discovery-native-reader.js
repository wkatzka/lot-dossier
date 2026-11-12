/* Bound native extraction independently of the hosted job and persist its failure for retry. */
const {Worker,isMainThread,parentPort,workerData}=require('node:worker_threads');
if(!isMainThread){require('./record-discovery-engine').readPdf(workerData.file).then(pages=>parentPort.postMessage({pages}),e=>parentPort.postMessage({error:e.message}));}
function read(file){return new Promise((resolve,reject)=>{
 const worker=new Worker(__filename,{workerData:{file},resourceLimits:{maxOldGenerationSizeMb:512}});let settled=false;
 const finish=(error,pages)=>{if(settled)return;settled=true;clearTimeout(timer);worker.terminate().finally(()=>error?reject(error):resolve(pages));};
 const timer=setTimeout(()=>finish(Error('Native document reading exceeded 120 seconds; retained for retry')),120000);
 worker.once('message',r=>finish(r.error?Error(r.error):null,r.pages));worker.once('error',e=>finish(e));worker.once('exit',code=>{if(!settled)finish(Error('Native reader exited before returning pages ('+code+')'));});
});}
module.exports={read};
