const assert=require('node:assert/strict'),H=require('../lib/historic-abstracts');
(async()=>{
 const pages=['LOCATED IN THE WEST HALF OF SECTION 12, AND THE EAST HALF OF SECTION 13 TOWNSHIP 6 NORTH, RANGE 2 WEST, SALT LAKE BASE AND MERIDIAN.'];
 const loc=H.locations(pages);assert.equal(loc.length,2);assert.equal(loc[1].section,13);assert.equal(H.locations(['Basis of bearing SECTION 12 TOWNSHIP 6 NORTH, RANGE 2 WEST']).length,0);
 assert.equal(H.locations(['LOCATED IN SECTION 12, IN ACCORDANCE WITH SECTION 17-73-504 TOWNSHIP 6 NORTH, RANGE 2 WEST']).length,1);
 const prefix='https://webercountyutah.gov/mounts/recorder/Published%20Data/Abstract/Sec land/t6n r2w/Sec 12/';
 const html='<a href="'+prefix+'001.tif">001.tif</a><a href="https://evil.test/mounts/001.tif">bad</a><a href="'+prefix+'001.tif">duplicate</a>';
 assert.equal(H.parse(html,loc[0]).length,1);assert.equal(H.parse(html,loc[1]).length,0);
 const d=await H.discover(pages,async()=>html);assert.equal(d.chainComplete,false);assert.equal(d.sections[0].documents[0].originalInstrument,false);assert.equal(d.sections[1].status,'unresolved');
 const fail=await H.discover(pages,async()=>{throw Error('Unavailable');});assert.equal(fail.sections[0].error,'Unavailable');
 console.log('Historical abstract discovery: explicit geography, allowlist, deduplication and incomplete-chain tests passed');
})();
