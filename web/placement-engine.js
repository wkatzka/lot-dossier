/* Geometric scenario checks. Public cadastral geometry never becomes a survey by calculation. */
(function(root){
'use strict';
const T=typeof module!=='undefined'&&module.exports?require('@turf/turf'):root.turf;
const P=typeof module!=='undefined'&&module.exports?require('proj4'):root.proj4;
function valid(feature){
 if(!feature||!feature.geometry||feature.geometry.type!=='Polygon')throw Error('A Polygon with explicit holes is required');
 for(const ring of feature.geometry.coordinates){if(ring.length<4||ring.some(p=>p.length<2||!p.every(Number.isFinite)||Math.abs(p[0])>180||Math.abs(p[1])>90)||JSON.stringify(ring[0])!==JSON.stringify(ring.at(-1)))throw Error('Invalid WGS84 polygon ring');}
 if(!T.booleanValid(feature)||T.kinks(feature).features.length||T.area(feature)<=0)throw Error('Invalid or self-intersecting polygon');
 const outer=T.polygon([feature.geometry.coordinates[0]]);
 for(let i=1;i<feature.geometry.coordinates.length;i++){const hole=T.polygon([feature.geometry.coordinates[i]]);if(!T.booleanWithin(hole,outer))throw Error('Hole lies outside outer boundary');for(let j=1;j<i;j++)if(T.booleanIntersects(hole,T.polygon([feature.geometry.coordinates[j]])))throw Error('Overlapping holes');}
 return feature;
}
function projection(origin){if(!origin||origin.length!==2||!origin.every(Number.isFinite))throw Error('Valid origin required');return '+proj=tmerc +k=1 +x_0=0 +y_0=0 +lat_0='+origin[1]+' +lon_0='+origin[0]+' +datum=WGS84 +units=m +no_defs';}
function rectangle(origin,x,y,width,length,rotation=0){
 if([x,y,width,length,rotation].some(n=>!Number.isFinite(n))||width<=0||length<=0||width>1000||length>1000)throw Error('Positive metre dimensions and numeric placement required');
 const rad=rotation*Math.PI/180,cs=Math.cos(rad),sn=Math.sin(rad),pr=projection(origin);
 const ring=[[-width/2,-length/2],[width/2,-length/2],[width/2,length/2],[-width/2,length/2],[-width/2,-length/2]].map(([a,b])=>P(pr,'EPSG:4326',[x+a*cs-b*sn,y+a*sn+b*cs]));return T.polygon([ring]);
}
function transform(geometry,crs,units){
 if(!['EPSG:4326','EPSG:26912'].includes(crs))throw Error('Unsupported or ambiguous coordinate reference system');
 if((crs==='EPSG:4326'&&units!=='degrees')||(crs==='EPSG:26912'&&units!=='metres'))throw Error('Coordinate units do not match CRS');
 P.defs('EPSG:26912','+proj=utm +zone=12 +datum=NAD83 +units=m +no_defs');
 if(geometry.type!=='Polygon')throw Error('Polygon required');
 return valid(T.polygon(geometry.coordinates.map(r=>r.map(p=>P(crs,'EPSG:4326',p)))));
}
function evaluate(input){
 const boundary=valid(input.boundary),tolerance=input.toleranceM;
 if(!Number.isFinite(tolerance)||tolerance<=0)throw Error('Positive placement tolerance required');
 const unknown=[],conflicts=[],checks=[],shapes=[];
 const missing=['surveyRegistration','easements','utilities','septic','drainage','terrain','localRules','access','structures','barrier'].filter(k=>!input.coverage||input.coverage[k]!==true);
 unknown.push(...missing.map(k=>k+' coverage not verified'));
 if(!input.survey||!input.survey.reviewed||!input.survey.source||!Number.isFinite(input.survey.accuracyM))unknown.push('Survey source, review and accuracy not established');
 else if(input.survey.accuracyM>tolerance)unknown.push('Survey uncertainty exceeds selected tolerance');
 for(const component of input.components||[]){
  const shape=valid(component.geometry),setback=component.setbackM;
  if(!Number.isFinite(setback)||setback<0)throw Error('Explicit nonnegative setback required for each component');
  if(!component.ruleSource)unknown.push(component.name+': applicable setback rule not sourced');
  const inset=T.buffer(boundary,-(setback+tolerance),{units:'meters',steps:32});
  const outside=inset?T.difference(T.featureCollection([shape,inset])):shape;
  const inside=!!inset&&!outside;
  checks.push({component:component.name,check:'Boundary and setback',passed:inside,clearanceM:setback+tolerance});
  if(!inside)conflicts.push(component.name+': outside boundary clearance or crosses a hole');
  shapes.push(component);
  for(const obstacle of input.obstacles||[]){
   if(!obstacle.geometry){unknown.push(obstacle.name+': restriction location unresolved');continue;}
   valid(obstacle.geometry);const clearance=obstacle.clearanceM;
   if(!Number.isFinite(clearance)||clearance<0)throw Error('Obstacle clearance must be nonnegative metres');
   const exclusion=T.buffer(obstacle.geometry,clearance+tolerance,{units:'meters',steps:32});
   const hit=T.booleanIntersects(shape,exclusion);checks.push({component:component.name,check:obstacle.name,passed:!hit,source:obstacle.source});if(hit)conflicts.push(component.name+': conflicts with '+obstacle.name);
   if(!obstacle.source||!obstacle.reviewed)unknown.push(obstacle.name+': applicability/geometry review incomplete');
  }
 }
 if(!shapes.length)throw Error('At least one placement component required');
 return {status:conflicts.length?'conflicts':unknown.length?'preliminary':'geometry_checked',precisePlacement:!unknown.length&&!conflicts.length,approval:false,conflicts,unknown:[...new Set(unknown)],checks,components:shapes,method:'Turf topology and geodesic buffers; WGS84 with local transverse-Mercator layout',limitation:'Geometry checks do not establish soil bearing, seasonal groundwater, excavation safety or permit approval.'};
}
const api={valid,rectangle,transform,evaluate,projection};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.PlacementEngine=api;
})(typeof window!=='undefined'?window:globalThis);
