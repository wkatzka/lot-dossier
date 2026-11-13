const fs=require('node:fs'),crypto=require('node:crypto'),S=require('./investigation-store');
async function read(file,{rpc=S.rpc,nativeRead=require('./discovery-native-reader').read}={}){
 const hash=crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
 const cached=await rpc('reading_get',{sha256:hash,version:1});
 if(cached?.sha256===hash&&cached.pages?.length&&cached.pages.every((p,i)=>p.page===i+1&&p.needsOCR===false&&(p.text?.trim()||p.blank)))return cached.pages;
 return nativeRead(file);
}
module.exports={read};
