const fs=require('node:fs'),D=require('../lib/record-discovery-engine'),P=require('../lib/discovery-publish');
const [profilePath,manifestPath,output]=process.argv.slice(2);
if(!output)throw Error('Usage: node scripts/export-discovery-index.js profile manifest output');
const p=JSON.parse(fs.readFileSync(profilePath)),s=JSON.parse(fs.readFileSync(manifestPath));
if(s.profileId!==p.id)throw Error('Profile identity mismatch');
D.summarize(s,p);const r=P.publish(p,s,output);console.log('Exported '+r.documents.length+' source records; completeness: '+r.coverage.publicRouteChecksComplete);
