(function(root){
'use strict';
const hash=async b=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',b))).map(x=>x.toString(16).padStart(2,'0')).join('');
async function pack(project,getFile){
 const files=[];let total=0;
 for(const d of project.documents){const blob=await getFile(d.id);if(!blob)throw Error('Missing file '+d.name);const bytes=await blob.arrayBuffer();total+=bytes.byteLength;if(total>100*1024*1024)throw Error('Backup exceeds 100 MB');if(await hash(bytes)!==d.hash)throw Error('File checksum mismatch: '+d.name);let raw='';const u=new Uint8Array(bytes);for(let i=0;i<u.length;i+=8192)raw+=String.fromCharCode(...u.subarray(i,i+8192));files.push({id:d.id,data:btoa(raw)});}
 return {format:'cornerpin-full-backup',version:1,exportedAt:new Date().toISOString(),project,files};
}
async function unpack(data){
 if(data.format!=='cornerpin-full-backup'||data.version!==1||data.project?.schemaVersion!==1||!Array.isArray(data.files)||!Array.isArray(data.project.documents))throw Error('Unsupported complete project backup');
 const p=data.project;if(!p.property||typeof p.property.address!=='string'||!Number.isInteger(p.revision)||p.revision<0||!['requirements','packages','receipts','rounds','corrections','events'].every(k=>Array.isArray(p[k])))throw Error('Incomplete project record');if(!p.id||!p.propertyKey||!p.report||p.propertyKey!==p.report.parcel.county+'|'+p.report.parcel.id)throw Error('Backup property identity does not reconcile');
 const seen=new Set(),files=[];let size=0;
 for(const f of data.files){if(seen.has(f.id))throw Error('Duplicate backup file');seen.add(f.id);const d=p.documents.find(d=>d.id===f.id);if(!d)throw Error('Unknown backup file');const raw=atob(f.data),bytes=Uint8Array.from(raw,c=>c.charCodeAt(0));size+=bytes.length;if(bytes.length>25*1024*1024||size>100*1024*1024)throw Error('Backup exceeds file limits');if(await hash(bytes)!==d.hash)throw Error('Backup checksum mismatch');files.push({id:f.id,blob:new Blob([bytes])});}
 if(files.length!==p.documents.length)throw Error('Backup is missing document contents');return {project:p,files};
}
const api={pack,unpack,hash};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.ProjectBackup=api;
})(typeof window!=='undefined'?window:globalThis);
