/* Restore reviewed, metadata-only progress when it is newer than the Actions artifact. */
const fs=require('node:fs'),path=require('node:path');
function restore(root,baseline='data/discovery-checkpoints'){
 if(!fs.existsSync(baseline))return [];
 const restored=[];
 for(const name of fs.readdirSync(baseline)){
  const source=path.join(baseline,name),file=path.join(source,'manifest.json');
  if(!fs.existsSync(file))continue;
  const next=JSON.parse(fs.readFileSync(file)),target=path.join(root,name),current=path.join(target,'manifest.json');
  if(fs.existsSync(current)&&Date.parse(JSON.parse(fs.readFileSync(current)).updatedAt)>=Date.parse(next.updatedAt))continue;
  fs.mkdirSync(target,{recursive:true});
  for(const f of ['manifest.json','profile.json'])fs.copyFileSync(path.join(source,f),path.join(target,f));
  restored.push(name);
 }
 return restored;
}
if(require.main===module)console.log(JSON.stringify({restored:restore(process.argv[2]||'.discovery-state')}));
module.exports={restore};
