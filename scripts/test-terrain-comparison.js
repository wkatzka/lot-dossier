'use strict';
const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict');
const c={console,setTimeout,clearTimeout,fetch,AbortController,URLSearchParams,URL};vm.createContext(c);vm.runInContext(fs.readFileSync('web/lotreport.js','utf8').replace('root.LotReport = {','root.checkTerrain=C.check_slope;root.LotReport = {'),c);
const points=[[-111.8,41.2,5000],[-111.7998,41.2,5001],[-111.8,41.2002,5002],[-111.7998,41.2002,5003]];
async function run(a,b){const ctx={grid:points.map(p=>p.slice(0,2)),lat0:41.2,elevation:Promise.resolve(a),elevationComparison:Promise.resolve(b),facts:{},cost:()=>null};return {rows:await c.checkTerrain(ctx),facts:ctx.facts};}
(async()=>{
let r=await run(points,points.map(p=>[p[0],p[1],p[2]+10]));assert.equal(r.facts.terrainSources.length,2);assert.match(r.rows.find(r=>r.item==='Terrain source comparison').detail,/10.00 ft/);assert.match(r.rows[0].detail,/share USGS/);assert.doesNotMatch(r.rows[0].source,/1 m|LiDAR/);
r=await run([],points);assert.match(r.rows[0].headline,/unavailable/);assert.equal(r.facts.terrainSources[0].source,'USGS Elevation Point Query Service');assert.equal(r.rows.filter(r=>r.item==='Terrain source comparison').length,0);
r=await run([],[]);assert.equal(r.facts.slope,undefined);assert.equal(r.facts.terrainSources.length,0);
r=await run(points,points);assert.match(r.rows.find(r=>r.item==='Terrain source comparison').detail,/0.00 ft/);
if(process.argv.includes('--live')){const ctx={grid:points.map(p=>p.slice(0,2)),lat0:41.2,facts:{},cost:()=>null};const live=await c.checkTerrain(ctx);console.log(JSON.stringify(live.map(r=>({item:r.item,headline:r.headline})),null,2));assert.equal(ctx.facts.terrainSources.length,2,'Both GIS services must return usable terrain');}
console.log('Terrain comparison: conflicting and matching elevations, accurate provenance, fallback and total failure passed.');
})().catch(e=>{console.error(e);process.exitCode=1;});
