const D=require('./record-discovery-engine'),W=require('./weber');
const GIS='https://services1.arcgis.com/99lidPhWCzftIe9K/arcgis/rest/services';
const DIRECTORY='https://wolfcreekresortmasterhoa.com/neighborhood-hoas/';
const HOSTS=['services1.arcgis.com','webercountyutah.gov','www.webercountyutah.gov','maps.webercountyutah.gov','www.utah.gov','ogdenvalley.gov','frontier.co.weber.ut.us','webercountyut.nextrequest.com','wolfcreekresortmasterhoa.com','trappersridgehoa.com','www.trappersridgehoa.com','highlandsedenut.com','www.highlandsedenut.com','retreatwolfcreek.com','www.retreatwolfcreek.com'];
async function json(url,request=fetch){const r=await request(url,{signal:AbortSignal.timeout(20000)});if(!r.ok)throw Error('Public identity source unavailable ('+r.status+')');const d=await r.json();if(d.error)throw Error('Public identity query failed');return d;}
async function identity(county,parcelId,{request=fetch,record=W.parcelRecord}={}){
 if(county!=='Weber'||!/^\d{9}$/.test(parcelId))throw Error('Automatic investigations currently cover Weber County parcels');
 const source=GIS+'/Parcels_Weber_LIR/FeatureServer/0/query?'+new URLSearchParams({f:'json',where:"PARCEL_ID='"+parcelId+"'",outFields:'PARCEL_ID,PARCEL_ADD,PARCEL_CITY,SUBDIV_NAME',returnGeometry:'true',outSR:'4326'});
 const d=await json(source,request);if(d.features?.length!==1||d.exceededTransferLimit)throw Error('Parcel identity must resolve to exactly one county record');
 const f=d.features[0],ring=f.geometry?.rings?.[0];if(!ring?.length)throw Error('Parcel geometry missing');
 const point={x:ring.reduce((s,p)=>s+p[0],0)/ring.length,y:ring.reduce((s,p)=>s+p[1],0)/ring.length,spatialReference:{wkid:4326}};
 const municipalities=await json(GIS+'/UtahMunicipalBoundaries/FeatureServer/0/query?'+new URLSearchParams({f:'json',geometry:JSON.stringify(point),geometryType:'esriGeometryPoint',inSR:'4326',spatialRel:'esriSpatialRelIntersects',outFields:'NAME',returnGeometry:'false'}),request);
 if(municipalities.exceededTransferLimit)throw Error('Municipal boundary result is incomplete');
 const countyRecord=await record(parcelId);
 const {ownerRecord,...publicRecord}=countyRecord;
 return {county,parcelId,address:f.attributes.PARCEL_ADD,subdivision:countyRecord.subdivision||f.attributes.SUBDIV_NAME||'',legal:countyRecord.legal||'',lot:countyRecord.lot,municipality:municipalities.features?.map(x=>x.attributes.NAME).join(', ')||'Unincorporated Weber County',source,countyRecord:publicRecord,checkedAt:new Date().toISOString()};
}
function significant(text){return String(text).toLowerCase().replace(/\b(at|the|wolf|creek|phase|pr[u]?d|subdivision|amended|amendment|first|second|plat|no|ranch)\b/g,' ').match(/[a-z]{4,}/g)||[];}
async function profile(target,{request=fetch}={}){
 const seeds=[{route:'parcel_and_parent_records',url:target.countyRecord.url,mode:'attachments',maxDepth:1},
  {route:'recorder_index',url:'https://www.webercountyutah.gov/Recorder_Surveyor/abstract_title_reg.php',maxDepth:0},
  {route:'association_libraries',url:DIRECTORY,maxDepth:0}];
 for(const p of target.countyRecord.plats||[])seeds.push({route:'parcel_and_parent_records',url:p.url,maxDepth:0});
 for(const id of target.countyRecord.priorParcels||[])seeds.push({route:'parcel_and_parent_records',url:'https://webercountyutah.gov/parcelsearch/ownership-info.php?id='+id,mode:'attachments',maxDepth:1});
 if(/ogden valley/i.test(target.municipality))seeds.push({route:'planning_requirements',url:'https://ogdenvalley.gov/planning/',mode:'attachments',maxDepth:1});
 const references=[{label:'Weber County Recorder',url:'https://www.webercountyutah.gov/Recorder_Surveyor/',purpose:'Identify the recorded declaration, development agreements and amendments for this parcel.'}];
 const leads=[];
 try{const r=await D.request(DIRECTORY,{hosts:HOSTS},{request});if(r.status!==200)throw Error('Directory unavailable');
  const candidates=D.links(r.bytes.toString(),DIRECTORY).links.filter(l=>significant(target.subdivision).some(t=>(l.label+' '+l.url).toLowerCase().includes(t)));
  for(const link of candidates){if(D.permitted(link.url,{hosts:HOSTS})){seeds.push({route:'association_libraries',url:link.url,mode:'library',maxDepth:2});references.push({label:link.label||new URL(link.url).hostname,url:link.url,purpose:'Directory-matched neighborhood source; establish parcel membership from its original governing documents.',verification:{url:DIRECTORY,checkedAt:r.retrievedAt}});}else leads.push({...link,route:'association_libraries',status:'requires_source_review'});}
 }catch(e){leads.push({url:DIRECTORY,route:'association_libraries',status:'source_error',reason:e.message});}
 const terms=[target.parcelId,...significant(target.subdivision),...(target.countyRecord.references||[]).map(r=>r.entry),'architectural','design review','declaration','covenant','amendment','guideline','approval','permit','documents'];
 const name=target.subdivision.replace(/\b(?:at wolf creek|pr[u]?d|phase).*$/i,'').trim();
 return {id:'auto-weber-'+target.parcelId,county:target.county,parcelId:target.parcelId,scope:'Property-specific public investigation derived from county parcel identity. Original applicability and later amendments remain independently evaluated.',hosts:HOSTS,terms:[...new Set(terms.filter(Boolean))],identityTerms:[target.parcelId,...significant(target.subdivision)],seeds,routes:[...new Set(seeds.map(s=>s.route).concat('public_notice_attachments','released_records_archive'))],noticeTerms:name?[name]:[],archiveTerms:[target.parcelId,...(name?[name]:[])],releasedArchives:['https://webercountyut.nextrequest.com'],startDate:'2000-01-01',endDate:new Date().toISOString().slice(0,10),references,initialLeads:leads};
}
module.exports={identity,profile,significant,HOSTS};
