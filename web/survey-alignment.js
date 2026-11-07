/* Conservative candidate alignment: printed section-corner labels to public monument records. */
(function(root){
'use strict';const R=typeof module!=='undefined'&&module.exports?require('./survey-registration'):root.SurveyRegistration;
function align(document,control){
 const page=document.vectors?.pages?.[0],features=control?.features||[];if(!page)return {status:'unavailable',reason:'No first-page CAD vectors'};
 const direction={WEST:'W',EAST:'E',NORTH:'N',SOUTH:'S',SOUTHWEST:'SW',SOUTHEAST:'SE',NORTHWEST:'NW',NORTHEAST:'NE'};
 const legends=page.labels.filter(t=>/MONUMENT AS NOTED|MONUMENT TO BE SET/.test(t.text)),symbols=[];
 for(const path of page.paths.filter(p=>p.layer==='S-MONUMENT')){
  const pts=path.commands.flatMap(c=>{const out=[];for(let i=1;i<c.length-1;i+=2)out.push([c[i],c[i+1]]);return out;});if(!pts.length)continue;
  const xs=pts.map(p=>p[0]),ys=pts.map(p=>p[1]),w=Math.max(...xs)-Math.min(...xs),h=Math.max(...ys)-Math.min(...ys),pos=[(Math.max(...xs)+Math.min(...xs))/2,(Math.max(...ys)+Math.min(...ys))/2];
  // A bounded symbol-shape heuristic generates candidates only, never verified control.
  if(w<5||w>20||h<8||h>20||legends.some(l=>Math.hypot(l.position[0]-pos[0],l.position[1]-pos[1])<40))continue;
  if(!symbols.some(s=>Math.hypot(s[0]-pos[0],s[1]-pos[1])<2))symbols.push(pos);
 }
 const pairs=[],gaps=[];
 for(const label of page.labels){const m=/\b(SOUTHWEST|SOUTHEAST|NORTHWEST|NORTHEAST|WEST|EAST|NORTH|SOUTH)\s+(QUARTER\s+)?CORNER\s+SEC(?:TION)?\.?\s*(\d+)/i.exec(label.text);if(!m)continue;
  const name=direction[m[1].toUpperCase()]+(m[2]?'1/4':'')+' '+Number(m[3]),matches=features.filter(f=>String(f.attributes.NAME2||'').trim().startsWith(name)&&Number(f.attributes.UTM83EAST)>0&&Number(f.attributes.UTM83NORTH)>0);
  if(matches.length!==1){gaps.push(name+': public control match is missing or ambiguous');continue;}
  const ranked=symbols.map(s=>({s,d:Math.hypot(s[0]-label.position[0],s[1]-label.position[1])})).sort((a,b)=>a.d-b.d);
  if(!ranked.length||(ranked[1]&&ranked[1].d-ranked[0].d<20)){gaps.push(name+': drawing symbol match ambiguous');continue;}
  const f=matches[0];pairs.push({id:String(f.attributes.OBJECTID_12??f.attributes.OBJECTID),name,from:ranked[0].s,to:[f.attributes.UTM83EAST,f.attributes.UTM83NORTH],source:control.source,sourceQuality:f.attributes.QLTY,sourceDate:f.attributes.DATE_CH||null});
 }
 if(pairs.length<3||new Set(pairs.map(p=>p.from.join(','))).size!==pairs.length)return {status:'unresolved',pairs,gaps:gaps.concat('At least three distinct drawing-to-monument pairs required'),reviewed:false};
 try{const registration=R.register(pairs.slice(0,2),pairs.slice(2),{units:'metres',crs:'EPSG:26912',source:document.url,toleranceM:1});return {status:'candidate',pairs,gaps,registration,reviewed:false,sourceAccuracyEstablished:false,limitation:'Symbol association is heuristic. The check residual is not survey accuracy. Review monument condition, source coordinate quality, datum, legal applicability and linework before using a registered boundary.'};}
 catch(e){return {status:'unresolved',pairs,gaps:gaps.concat(e.message),reviewed:false};}
}
const api={align};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.SurveyAlignment=api;
})(typeof window!=='undefined'?window:globalThis);
