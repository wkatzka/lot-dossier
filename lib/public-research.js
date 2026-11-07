const {parcelRecord}=require('./weber');
const {polygon}=require('../web/mineral-screen');
const FEDERAL='https://gis.blm.gov/utarcgis/rest/services/Lands/BLM_UT_Federal_Minerals/MapServer/0';
const SURVEY='https://maps.webercountyutah.gov/arcgis/rest/services/surveyor/surveyor_data/MapServer';
async function query(url,params){
 const ctl=new AbortController(),timer=setTimeout(()=>ctl.abort(),20000);
 try{const r=await fetch(url+'/query',{method:'POST',body:new URLSearchParams({f:'json',...params}),signal:ctl.signal});if(!r.ok)throw Error('Source HTTP '+r.status);const d=await r.json();if(d.error)throw Error(d.error.message);return d;}finally{clearTimeout(timer);}
}
async function spatial(url,rings,{geometry=false,fields='*',limit=500}={},request=query){
 const shape=polygon(rings),p={where:'1=1',geometry:JSON.stringify(shape),geometryType:'esriGeometryPolygon',inSR:4326,spatialRel:'esriSpatialRelIntersects'};
 const d=await request(url,{...p,returnIdsOnly:true});
 if(d.objectIds===null){const n=await request(url,{...p,returnCountOnly:true});if(n.count===0&&!n.error)d.objectIds=[];}
 if(d.error||d.exceededTransferLimit||!Array.isArray(d.objectIds))throw Error('Incomplete source inventory');
 const ids=[...new Set(d.objectIds)];if(ids.length>limit||ids.some(n=>!Number.isSafeInteger(n)))throw Error('Source inventory exceeds limit or is invalid');
 const features=[];
 for(let i=0;i<ids.length;i+=100){const batch=ids.slice(i,i+100),r=await request(url,{objectIds:batch.join(','),outFields:fields,returnGeometry:geometry,outSR:4326});
  if(r.error||r.exceededTransferLimit||!Array.isArray(r.features))throw Error('Incomplete source records');
  const seen=new Set();for(const f of r.features){const a=f.attributes||{},id=a[d.objectIdFieldName]??a.OBJECTID??a.objectid;if(!batch.includes(id)||seen.has(id))throw Error('Source IDs do not reconcile');seen.add(id);features.push(f);}if(seen.size!==batch.length)throw Error('Source records missing');
 }
 return {source:url,retrievedAt:new Date().toISOString(),status:'retrieved',features,coverage:'Intersects mapped parcel, including possible boundary touches; source coverage is not title completeness.'};
}
async function safe(fn,source){try{return await fn();}catch(e){return {source,status:'unavailable',error:e.message,attemptedAt:new Date().toISOString()};}}
async function history(id,load=parcelRecord){
 if(!/^\d{9}$/.test(id))throw Error('Nine-digit Weber parcel required');
 const queue=[{id,depth:0}],seen=new Set(),records=[],gaps=[];
 while(queue.length&&seen.size<12){const next=queue.shift();if(seen.has(next.id))continue;seen.add(next.id);
  try{const r=await load(next.id);records.push({parcelId:next.id,depth:next.depth,...r});for(const parent of r.priorParcels||[]){if(next.depth<3)queue.push({id:parent,depth:next.depth+1});else gaps.push({parcelId:parent,reason:'Depth limit'});}}
  catch(e){gaps.push({parcelId:next.id,reason:e.message});}
 }
 gaps.push(...queue.filter(x=>!seen.has(x.id)).map(x=>({parcelId:x.id,reason:'Record limit'})));
 return {status:gaps.length?'partial':'retrieved',retrievedAt:new Date().toISOString(),records,gaps,chainComplete:false,limitation:'Public parcel references are not a complete grantor/grantee abstract. Original instruments, releases and unindexed interests remain unresolved.'};
}
async function run({rings,county,parcelId}){
 polygon(rings);
 const coords=rings.flat(),xs=coords.map(p=>p[0]),ys=coords.map(p=>p[1]),cx=(Math.min(...xs)+Math.max(...xs))/2,cy=(Math.min(...ys)+Math.max(...ys))/2,dx=2000/(111320*Math.cos(cy*Math.PI/180)),dy=2000/111320;
 const nearby=[[[cx-dx,cy-dy],[cx+dx,cy-dy],[cx+dx,cy+dy],[cx-dx,cy+dy],[cx-dx,cy-dy]]];
 const [federal,historyResult,property,utilities,control]=await Promise.all([
  safe(()=>spatial(FEDERAL,rings),FEDERAL),
  county==='Weber'?safe(()=>history(String(parcelId)),'Weber parcel history'):Promise.resolve({status:'unsupported',records:[]}),
  county==='Weber'?safe(()=>spatial(SURVEY+'/6',rings,{geometry:true}),SURVEY+'/6'):Promise.resolve({status:'unsupported'}),
  county==='Weber'?safe(()=>spatial(SURVEY+'/8',rings,{geometry:true}),SURVEY+'/8'):Promise.resolve({status:'unsupported'}),
  county==='Weber'?safe(()=>spatial(SURVEY+'/2',nearby,{geometry:true}),SURVEY+'/2'):Promise.resolve({status:'unsupported'})
 ]);
 return {schemaVersion:1,federal,history:historyResult,surveyProperty:property,surveyUtilities:utilities,surveyControl:control,controlSearch:'Approximate 4 km wide bounding box centered on mapped parcel; monument condition and coordinate quality require review',ownershipDetermined:false,geometryRegistered:false};
}
module.exports={FEDERAL,SURVEY,spatial,history,run};
