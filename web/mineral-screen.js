/* Public mineral-interest discovery; never a private mineral title determination. */
(function(root){
  'use strict';
  const SOURCE='https://gis.trustlands.utah.gov/mapping/rest/services/Ownership_Mineral/MapServer/0';
  const LIMIT=500;
  function polygon(rings){
    if(!Array.isArray(rings)||!rings.length)throw new Error('Mapped parcel boundary unavailable.');
    let n=0;
    const copy=rings.map(r=>{
      if(!Array.isArray(r)||r.length<4)throw new Error('Invalid parcel ring.');
      const coords=r.map(p=>{
        n++;if(!Array.isArray(p)||p.length<2||!Number.isFinite(p[0])||!Number.isFinite(p[1])||p[0]<-115||p[0]>-108||p[1]<36||p[1]>43)throw new Error('Parcel coordinates must be Utah longitude/latitude.');
        return [p[0],p[1]];
      });
      if(coords[0][0]!==coords.at(-1)[0]||coords[0][1]!==coords.at(-1)[1])throw new Error('Parcel ring is not closed.');
      return coords;
    });
    if(n>10000)throw new Error('Parcel geometry exceeds the screening limit.');
    return {rings:copy,spatialReference:{wkid:4326}};
  }
  async function request(params){
    const ctl=new AbortController(), timer=setTimeout(()=>ctl.abort(),15000);
    try{
      const r=await fetch(SOURCE+'/query',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({...params,f:'json'}).toString(),signal:ctl.signal});
      if(!r.ok)throw new Error('Mineral source HTTP '+r.status);
      const d=await r.json();if(d.error)throw new Error(d.error.message||'Mineral source query failed.');return d;
    }finally{clearTimeout(timer);}
  }
  async function lookup(rings,query=request){
    const geometry=polygon(rings), attemptedAt=new Date().toISOString();
    const spatial={where:'1=1',geometry:JSON.stringify(geometry),geometryType:'esriGeometryPolygon',inSR:4326,spatialRel:'esriSpatialRelIntersects'};
    const index=await query({...spatial,returnIdsOnly:true});
    // Some ArcGIS services represent an empty ID result as null. Independently
    // confirm a zero count before interpreting that response as no matches.
    if(!index.error&&!index.exceededTransferLimit&&index.objectIds===null){
      const count=await query({...spatial,returnCountOnly:true});
      if(!count.error&&!count.exceededTransferLimit&&count.count===0)index.objectIds=[];
    }
    if(index.error||index.exceededTransferLimit||!Array.isArray(index.objectIds))throw new Error('Mineral source did not return a complete record-ID inventory.');
    const ids=Array.from(new Set(index.objectIds));
    if(ids.some(id=>!Number.isSafeInteger(id)||id<0)||ids.length>LIMIT)throw new Error('Mineral source inventory is invalid or exceeds the screening limit.');
    const records=[];
    for(let i=0;i<ids.length;i+=100){
      const batch=ids.slice(i,i+100), d=await query({objectIds:batch.join(','),outFields:'objectid,oilgasown,coalown,otherown,legalown,countylabel',returnGeometry:false});
      if(d.error||d.exceededTransferLimit||!Array.isArray(d.features))throw new Error('Mineral source returned incomplete record details.');
      const seen=new Set();
      for(const feature of d.features){
        const a=feature.attributes||{};
        if(!batch.includes(a.objectid)||seen.has(a.objectid))throw new Error('Mineral source record IDs do not reconcile.');seen.add(a.objectid);
        const interest=v=>v===1?'mapped interest':v===0?'not indicated by this record':'unknown';
        records.push({sourceId:a.objectid,oilGas:interest(a.oilgasown),coal:interest(a.coalown),other:interest(a.otherown),legalDescription:String(a.legalown||'').trim(),county:String(a.countylabel||'').trim(),sourceUrl:SOURCE+'/query?f=pjson&objectIds='+a.objectid+'&outFields=*&returnGeometry=false'});
      }
      if(seen.size!==batch.length)throw new Error('Mineral source omitted requested records.');
    }
    return {schemaVersion:1,status:'retrieved',source:SOURCE,attemptedAt,retrievedAt:new Date().toISOString(),sourceEffectiveDate:null,
      coverage:'Utah Trust Lands mineral interests only',geometryBasis:'Mapped parcel polygon, not a survey',matchRule:'Intersects, including possible boundary touches',records,
      privateTitleStatus:'not_researched',federalStatus:'not_checked',ownershipDetermined:false};
  }
  function findings(result){
    const base={section:'minerals',source:'Utah Trust Lands mineral ownership',url:SOURCE,status:'verify'};
    if(result.status!=='retrieved')return [{...base,item:'State mineral-interest screen',headline:'Mineral source check unavailable',detail:'No ownership conclusion was made. '+(result.error||'The source could not be verified.'),next_step:'Retry the source check; the mineral-title research remains open.'}];
    const names={oilGas:'oil and gas',coal:'coal',other:'other minerals'};
    const details=result.records.map(r=>'Record '+r.sourceId+': '+Object.keys(names).map(k=>names[k]+' — '+r[k]).join('; ')+(r.legalDescription?'. Source legal description: '+r.legalDescription:'')+'.').join(' ');
    return [{...base,status:result.records.length?'watch':'verify',item:'State mineral-interest screen',headline:result.records.length?result.records.length+' Trust Lands mineral record(s) intersect the mapped parcel':'No intersecting Trust Lands mineral records returned',
      detail:(details?details+' ':'')+'Queried the whole mapped parcel, not just its center. Intersections may include boundary touches and do not establish parcel-wide ownership, fractional interests or surveyed overlap. Retrieved '+result.retrievedAt+'; source effective date not supplied. An empty state-layer result does not establish mineral ownership or exclude federal or private interests.',next_step:'Reconcile any mapped candidates with the applicable source instruments and survey.'},
      {...base,item:'Private and federal mineral title',headline:'Mineral ownership is not determined',detail:'Private mineral reservations, conveyances, fractional interests and subsequent transfers have not been traced. Federal records have not yet been checked. Surface ownership does not establish mineral ownership.',next_step:'Complete the dated mineral-title chain and review applicable surface-use rights before treating ownership as established.'}];
  }
  async function screen(rings,query){
    let result;try{result=await lookup(rings,query);}catch(e){result={schemaVersion:1,status:'unavailable',attemptedAt:new Date().toISOString(),source:SOURCE,error:String(e.message||e),ownershipDetermined:false};}
    return {result,findings:findings(result)};
  }
  const api={SOURCE,polygon,lookup,screen,findings};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.MineralScreen=api;
})(typeof window!=='undefined'?window:globalThis);
