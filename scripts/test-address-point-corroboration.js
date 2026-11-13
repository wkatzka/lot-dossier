const assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const code=fs.readFileSync(require('node:path').join(__dirname,'../web/lotreport.js'),'utf8');
function setup(exact=true){const ring=[[[-111.8,41.3],[-111.7,41.3],[-111.7,41.4],[-111.8,41.3]]];const c={console,AbortController,setTimeout,clearTimeout,fetch:async(url,o)=>{const q=new URLSearchParams(o.body||'');let features=[];
if(url.includes('UtahAddressPoints'))features=[{attributes:{FullAdd:'3459 N WIND RIVER CT',StreetName:'WIND RIVER',City:'EDEN',ZipCode:'84310',CountyID:'49057'},geometry:{x:-111.75,y:41.35}}];
if(url.includes('Parcels_Weber')){if(q.get('geometry'))features=[{attributes:{PARCEL_ID:'222320024',PARCEL_ADD:'',PARCEL_ACRES:5.55},geometry:{rings:ring}}];else if(exact)features=[{attributes:{PARCEL_ID:'222320023',PARCEL_ADD:'3459 N WIND RIVER CT'},geometry:{rings:ring}}];}
return {ok:true,json:async()=>({features,candidates:[]})};}};vm.createContext(c);vm.runInContext(code,c);return c.LotReport;}
(async()=>{assert.equal((await setup().locate('3459 N Wind River Ct, Eden, UT')).id,'222320023');await assert.rejects(setup(false).locate('3459 N Wind River Ct, Eden, UT'));console.log('PASS: a road/common-area address point cannot override the exact county situs record or silently become the selected parcel.');})().catch(e=>{console.error(e);process.exitCode=1});
