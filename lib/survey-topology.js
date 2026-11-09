/* Recover CAD stroke centre lines; retain unmatched geometry as an explicit gap. */
const T=require('@turf/turf');
const distance=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
const area=ring=>Math.abs(ring.reduce((s,a,i)=>{const b=ring[(i+1)%ring.length];return s+a[0]*b[1]-b[0]*a[1];},0))/2;
function subpaths(commands){
 const out=[];let points=[];
 for(const c of commands){
  if(c[0]==='M'){if(points.length)out.push(points);points=[c.slice(1)];}
  else if(c[0]==='L')points.push(c.slice(1));
  else if(c[0]==='Z'){if(points.length){points.closed=true;out.push(points);}points=[];}
  else return null; // Do not replace Bezier curves with endpoint chords.
 }
 if(points.length)out.push(points);return out;
}
function shortest(triangle){return triangle.map((a,i)=>({a,b:triangle[(i+1)%3],length:distance(a,triangle[(i+1)%3])})).sort((a,b)=>a.length-b.length)[0];}
function centreline(a,b){
 if(a?.length!==3||b?.length!==3||a.filter(x=>b.some(y=>distance(x,y)<1e-6)).length!==2)return null;
 const x=shortest(a),y=shortest(b),mid=e=>e.a.map((n,i)=>(n+e.b[i])/2),p=mid(x),q=mid(y),length=distance(p,q);
 // Endcaps must be disjoint, thin PDF strokes. Quantized curves can rotate or vary
 // cap widths substantially; this remains candidate topology, never surveyed precision.
 if(x.length<=0||y.length<=0||Math.max(x.length,y.length)>2||length<.01)return null;
 if([x.a,x.b].some(v=>[y.a,y.b].some(w=>distance(v,w)<1e-6)))return null;
 return [p,q];
}
function recover(page,{snapPoints=.15}={}){
 if(!Number.isFinite(snapPoints)||snapPoints<=0||snapPoints>.5)throw Error('PDF snapping must be greater than zero and at most 0.5 points');
 const segments=[],unresolved=[];
 for(const [index,path] of (page.paths||[]).entries()){
  if(!['S-LOT','S-BOUNDARY'].includes(path.layer))continue;
  const ss=subpaths(path.commands);
  if(!ss){unresolved.push({path:index,reason:'Curve commands require curve-aware topology'});continue;}
  if(path.fill){for(let i=0;i<ss.length;i+=2){const line=centreline(ss[i],ss[i+1]);if(line)segments.push(line);else unresolved.push({path:index,subpath:i,reason:'Filled path is not a validated thin triangle pair'});}}
  else if(path.stroke){for(const points of ss){for(let i=1;i<points.length;i++)segments.push([points[i-1],points[i]]);if(points.closed&&points.length>2)segments.push([points.at(-1),points[0]]);}}
  if(segments.length>8000){unresolved.push({reason:'Topology segment processing limit reached'});break;}
 }
 const nodes=[],seen=new Set(),lines=[];let maxSnapPoints=0;
 const snap=p=>{let best=null,d=snapPoints;for(const n of nodes){const v=distance(n,p);if(v<d){best=n;d=v;}}if(best){maxSnapPoints=Math.max(maxSnapPoints,d);return best;}nodes.push(p);return p;};
 for(const line of segments){const ends=line.map(snap);if(distance(...ends)<1e-6)continue;const key=ends.map(p=>p.join(',')).sort().join('|');if(!seen.has(key)){seen.add(key);lines.push(T.lineString(ends));}}
 let polygons=[];
 try{polygons=T.polygonize(T.featureCollection(lines)).features;}catch(e){unresolved.push({reason:'Polygonization failed: '+e.message});}
 const candidates=[],keys=new Set();
 for(const label of page.labels||[]){const match=/^LOT\s+(\d+)\s*$/i.exec(label.text.trim());if(!match)continue;
  const containing=polygons.filter(p=>T.booleanPointInPolygon(T.point(label.position),p)).sort((a,b)=>area(a.geometry.coordinates[0])-area(b.geometry.coordinates[0]));
  if(!containing.length)continue;
  const selected=containing[0],ring=selected.geometry.coordinates[0],key=match[1]+'|'+ring.map(p=>p.join(',')).sort().join('|');if(keys.has(key))continue;keys.add(key);
  const otherLots=(page.labels||[]).filter(l=>/^LOT\s+\d+\s*$/i.test(l.text.trim())&&l.text.trim().toUpperCase()!==label.text.trim().toUpperCase()&&T.booleanPointInPolygon(T.point(l.position),selected)).map(l=>l.text);
  if(otherLots.length){unresolved.push({lot:match[1],reason:'Closed face includes other lot labels',otherLots});continue;}
  candidates.push({lot:match[1],page:page.page,geometry:selected.geometry,areaSquarePoints:area(ring),status:'candidate',reviewed:false});
 }
 return {method:'Validated paired-triangle stroke centre lines, endpoint snapping and smallest lot-label face',coordinateSystem:'PDF page points',snapPoints,maxSnapPoints,segments:lines.length,candidates,unresolved,complete:false,limitation:'Closed drawing faces are candidates, not legal parcel boundaries. Unmatched paths, clipping, survey applicability, control accuracy and recorded restrictions require reconciliation.'};
}
module.exports={recover,centreline,area};
