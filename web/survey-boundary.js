/* Cross-check reconstructed drawing faces against the independently mapped parcel. */
(function(root){
'use strict';
const node=typeof module!=='undefined'&&module.exports,T=node?require('@turf/turf'):root.turf,P=node?require('proj4'):root.proj4,R=node?require('./survey-registration'):root.SurveyRegistration;
function compare(doc,parcel,{lot,acres}={}){
 acres=acres==null?null:Number(acres);if(!Number.isFinite(acres)||acres<=0)acres=null;
 const reg=doc.alignment?.registration,page=doc.vectors?.pages?.[0];
 if(!reg?.withinTolerance||!page?.topology)return {status:'unavailable',candidates:[],reason:'Candidate registration and reconstructed first-page topology required'};
 P.defs('EPSG:26912','+proj=utm +zone=12 +datum=NAD83 +units=m +no_defs');
 const boundary=T.polygon(parcel.rings),mappedArea=T.area(boundary),candidates=[];
 for(const candidate of page.topology.candidates){
  if(lot!=null&&String(candidate.lot)!==String(lot))continue;
  try{
   const geometry={type:'Polygon',coordinates:candidate.geometry.coordinates.map(r=>R.transform(r,reg).map(x=>P(reg.crs,'EPSG:4326',x)))},feature=T.polygon(geometry.coordinates);
   if(!T.booleanValid(feature)||T.kinks(feature).features.length)continue;
   const intersection=T.intersect(T.featureCollection([feature,boundary])),overlap=intersection?T.area(intersection):0,groundArea=T.area(feature),iou=overlap/(groundArea+mappedArea-overlap);
   if(iou<.5)continue; // Wrong lot/registration candidates are not silently adopted.
   const computedAcres=candidate.areaSquarePoints*reg.scale**2/4046.8564224,areaDifference=Number.isFinite(acres)&&acres>0?Math.abs(computedAcres-acres)/acres:null;
   candidates.push({lot:candidate.lot,page:page.page,geometry,computedAcres,statedAcres:acres??null,areaDifferenceFraction:areaDifference,mappedOverlapFraction:iou,agreement:iou>=.95&&(areaDifference!==null&&areaDifference<=.02),source:doc.url,sha256:doc.sha256,reviewed:false,sourceAccuracyEstablished:false});
  }catch(e){candidates.push({lot:candidate.lot,page:page.page,error:e.message,reviewed:false});}
 }
 return {status:candidates.length?'candidate':'unresolved',candidates,limitation:'Area and map overlap are consistency checks, not legal boundary or absolute accuracy verification. These candidates do not clear easements, utilities or pool placement.'};
}
const api={compare};if(node)module.exports=api;else root.SurveyBoundary=api;
})(typeof window!=='undefined'?window:globalThis);
