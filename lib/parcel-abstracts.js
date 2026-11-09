const H=require('./historic-abstracts'),T=require('@turf/turf');
const PLSS='https://services1.arcgis.com/99lidPhWCzftIe9K/ArcGIS/rest/services/UtahPLSSQuarterQuarterSections_GCDB/FeatureServer/0';
function locations(features,rings){
 const parcel=T.polygon(rings),out=[];
 for(const f of features){const a=f.attributes||{},m=/^UT26(\d{3})0([NS])(\d{3})0([EW])0SN(\d{2})0$/.exec(a.FRSTDIVID||'');if(!m||!f.geometry?.rings)continue;
  const intersection=T.intersect(T.featureCollection([parcel,T.polygon(f.geometry.rings)]));if(!intersection||T.area(intersection)<.01)continue;
  const loc={township:Number(m[1]),northSouth:m[2].toLowerCase(),range:Number(m[3]),eastWest:m[4].toLowerCase(),section:Number(m[5]),source:PLSS,aliquot:a.SECDIVNO,overlapSquareMetres:T.area(intersection),sectionId:a.FRSTDIVID};out.push(loc);
 }
 return out;
}
async function discover(rings,county,spatial){
 if(county!=='Weber')return {status:'unsupported',sections:[],reason:'Historic abstract adapter currently covers Weber County only',chainComplete:false};
 const coverage=await spatial(PLSS,rings,{geometry:true}),hits=locations(coverage.features,rings),unique=[...new Map(hits.map(x=>[x.sectionId,x])).values()];
 const gaps=coverage.features.filter(f=>!/^UT26(\d{3})0([NS])(\d{3})0([EW])0SN(\d{2})0$/.test(f.attributes?.FRSTDIVID||'')).map(f=>({id:f.attributes?.FRSTDIVID||null,reason:'Unsupported or missing meridian/township/section identifier'}));
 const inventory=await H.discoverLocations(unique);
 return {...inventory,plss:{source:PLSS,retrievedAt:coverage.retrievedAt,locations:hits,gaps},geographicBasis:'Positive-area intersection of mapped parcel and public PLSS polygons; not subdivision-name inference',lotApplicability:'unresolved'};
}
module.exports={PLSS,locations,discover};
