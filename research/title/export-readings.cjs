/* Package public archive readings, never customer addresses or parcel selections. No OCR runs here. */
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const A=require('../../lib/abstract-reading');
const [dir,destination]=process.argv.slice(2);
if(!dir||!destination)throw Error('Usage: node research/title/export-readings.cjs reading-directory destination.json');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const manifest=JSON.parse(fs.readFileSync(path.join(dir,'manifest.json'))),sheets=[];
for(const item of manifest){
 const id=sha(item.url).slice(0,20),base=path.join(dir,id),m=/\/t(\d+)([ns]) r(\d+)([ew])\/Sec (\d+)\//i.exec(decodeURIComponent(item.url));
 if(!m)throw Error('Unsupported archive geography');
 const location={township:+m[1],northSouth:m[2],range:+m[3],eastWest:m[4],section:+m[5]};
 const bytes=fs.readFileSync(base+'.tif'),native=base+'.vision.json';let observations,engine;
 if(fs.existsSync(native)){observations=JSON.parse(fs.readFileSync(native));engine='Apple Vision accurate';}
 else if(fs.existsSync(base+'.json')){const d=JSON.parse(fs.readFileSync(base+'.json'));observations=d.words.map(w=>({text:w.text,bbox:[w.bbox.x0/d.width,1-w.bbox.y1/d.height,(w.bbox.x1-w.bbox.x0)/d.width,(w.bbox.y1-w.bbox.y0)/d.height]}));engine='Tesseract';}
 else {sheets.push({url:item.url,name:item.name,location,sha256:sha(bytes),status:'not_read'});continue;}
 const result=A.index({url:item.url,sha256:sha(bytes),location,observations,engine});
 sheets.push({...result,name:item.name,text:observations.map(o=>o.text).join('\n'),readAt:fs.statSync(fs.existsSync(native)?native:base+'.json').mtime.toISOString()});
}
fs.mkdirSync(path.dirname(destination),{recursive:true});
fs.writeFileSync(destination,JSON.stringify({schemaVersion:1,generatedAt:new Date().toISOString(),scope:'Public county archive images; no customer parcel selection',sheets}));
console.log('Packaged',sheets.length,'public sheets without rerunning OCR');
