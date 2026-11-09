/* Historical calls are screening geometry, not a repaired deed or an approved survey. */
const T=require('@turf/turf'),P=require('proj4');
P.defs('EPSG:26912','+proj=utm +zone=12 +datum=NAD83 +units=m +no_defs');
function delta(c){
 if(!['N','S'].includes(c.ns)||!['E','W'].includes(c.ew)||!Number.isFinite(c.degrees)||c.degrees<0||c.degrees>90||!Number.isFinite(c.feet)||c.feet<=0)throw Error('Invalid bearing/distance call');
 const r=c.degrees*Math.PI/180,d=c.feet*.3048;
 return [Math.sin(r)*d*(c.ew==='E'?1:-1),Math.cos(r)*d*(c.ns==='N'?1:-1)];
}
function trace(start,calls){const points=[start.slice()];for(const c of calls){const d=delta(c),p=points.at(-1);points.push([p[0]+d[0],p[1]+d[1]]);}return points;}
const ll=xy=>P('EPSG:26912','EPSG:4326',xy);
function evaluate(def,control,rings){
 const unresolved=reason=>({status:'unresolved',reason,legalApplicability:'unresolved',geometry:null});
 const hits=(control?.features||[]).filter(f=>(f.attributes||{}).GIS_NUM===def.anchorId);
 if(hits.length!==1)return unresolved('Unique public monument anchor unavailable');
 const a=hits[0].attributes,start=[a.UTM83EAST,a.UTM83NORTH];
 if(!start.every(Number.isFinite)||start[0]<200000||start[0]>800000||start[1]<4e6||start[1]>5e6)return unresolved('Anchor coordinates invalid');
 const origin=trace(start,def.tie||[]).at(-1),points=trace(origin,def.calls),parcel=T.polygon(rings);
 let geometry,closureM=null,checkResidualM=null;
 if(def.kind==='tract'){
  closureM=Math.hypot(points.at(-1)[0]-origin[0],points.at(-1)[1]-origin[1]);
  // Never conceal a bad closure by adding a closing line or applying Bowditch adjustment.
  if(closureM>.1)return {...unresolved('Abstract calls do not close; original description required'),closureM,trace:T.lineString(points.map(ll)),anchorId:def.anchorId};
  points[points.length-1]=origin.slice();geometry=T.polygon([points.map(ll)]);
 }else if(def.kind==='corridor'){
  if(!(def.leftFeet>0&&def.rightFeet>0))return unresolved('Corridor widths missing');
  // Use the larger side on both sides: conservative screening, not a claimed exact footprint.
  geometry=T.buffer(T.lineString(points.map(ll)),Math.max(def.leftFeet,def.rightFeet)*.3048,{units:'meters'});
  if(def.endTie){const expected=trace(start,def.endTie).at(-1);checkResidualM=Math.hypot(points.at(-1)[0]-expected[0],points.at(-1)[1]-expected[1]);
   if(checkResidualM>3)return {...unresolved('Independent endpoint tie conflicts with centerline calls'),checkResidualM};}
 }else return unresolved('Unsupported description geometry');
 const overlap=T.intersect(T.featureCollection([parcel,geometry]));
 let separationM=0;
 if(!T.booleanIntersects(parcel,geometry)){
  const pa=parcel.geometry.coordinates.flat(),ga=geometry.geometry.coordinates.flat();
  separationM=Math.min(...pa.map(p=>T.pointToLineDistance(T.point(p),T.lineString(ga),{units:'meters'})),...ga.map(p=>T.pointToLineDistance(T.point(p),T.lineString(pa),{units:'meters'})));
 }
 return {status:overlap?'potential_intersection':'no_intersection_in_assumed_geometry',geometry,overlapSquareMetres:overlap?T.area(overlap):0,separationM,closureM,checkResidualM,
  anchorId:def.anchorId,anchorQuality:a.QLTY||null,anchorSource:control.source,legalApplicability:'unresolved',reviewed:false,
  assumptions:'Historical bearings treated as NAD83 UTM zone 12 grid bearings. Original bearing basis and absolute positional accuracy are unverified. Corridor uses the larger half-width on both sides with rounded ends. No legal exclusion or clearance follows from separation.'};
}
module.exports={delta,trace,evaluate};
