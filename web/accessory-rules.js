/* City rules for exterior and accessory permits, Ogden Valley City only. Every standard below is
   transcribed from the Land Use Code with its section and PDF page; anything the code does not settle
   for a zone or structure is returned as "check with the city" with the chapter link, never guessed.
   Sources read 2026-11-13: LUC 104-3 (RE zones, site development standards table) and LUC 108-7
   (supplementary and qualifying regulations). */
(function(root){'use strict';
const S=(typeof module!=='undefined'&&module.exports?require('./ovc-code-sources'):root.OVCCodeSources)||{};
const u=(ch,page)=>(S[ch]?.url||'https://ogdenvalley.gov/land-use/')+(page?'#page='+page:'');
const SRC={
 re:{label:'LUC 104-3, Site Development Standards for RE-15 and RE-20',url:u('104-3')},
 projections:{label:'LUC 108-7-2 Projections (p. 2)',url:u('108-7',2)},
 fences:{label:'LUC 108-7-3 Fencing (p. 3)',url:u('108-7',3)},
 coverage:{label:'LUC 108-7-4 Area of accessory building (p. 3)',url:u('108-7',3)},
 height:{label:'LUC 108-7-5 Height (pp. 4–7)',url:u('108-7',4)},
 roof:{label:'LUC 108-7-5(b) Roof structure height exception (p. 7)',url:u('108-7',7)},
 large:{label:'LUC 108-7-16 Large accessory buildings (pp. 15–16)',url:u('108-7',15)},
 pool:{label:'LUC 108-7-18 Swimming pools (p. 16)',url:u('108-7',16)},
 solar:{label:'LUC 108-7-24 Solar energy systems (p. 23)',url:u('108-7',23)}
};
// Accessory-building yards transcribed from the RE zone table. Other zones: link to their chapter.
const ZONES={'RE-15':{side:10,sideBehindMain:1,behindDistance:6,rear:5,height:25},'RE-20':{side:10,sideBehindMain:1,behindDistance:6,rear:5,height:25}};
const ZONE_CHAPTER=[[/^AV-?3/,'104-2'],[/^RE-/,'104-3'],[/^HR/,'104-8'],[/^F-/,'104-9'],[/^S-1/,'104-10'],[/^CVR/,'104-11'],[/^FV-/,'104-14'],[/^CV-2/,'104-20'],[/^MV-/,'104-21'],[/^O-1/,'104-26']];
function zoneChapter(zone){const m=ZONE_CHAPTER.find(([re])=>re.test(String(zone||'').toUpperCase()));return m?{label:'LUC '+m[1]+' (zone standards)',url:u(m[1])}:{label:'Ogden Valley City Land Use Code',url:'https://ogdenvalley.gov/land-use/'};}
const rule=(id,title,text,source,kind='rule')=>({id,title,text,source,kind});
function accessoryYards(zone,what){
 const z=ZONES[String(zone||'').toUpperCase()];
 if(!z)return [rule('accessory-yards','Accessory setbacks for '+(zone||'this zone'),'Cornerpin has not transcribed accessory-building setbacks for '+(zone||'this zone')+'. Check the zone\'s table before placing the '+what+'.',zoneChapter(zone),'check')];
 return [rule('accessory-yards','Setbacks for the '+what,'In '+zone+', an accessory building needs '+z.side+' ft from a side property line (or '+z.sideBehindMain+' ft if it sits at least '+z.behindDistance+' ft behind the main building), '+z.rear+' ft from the rear property line, and the front setback of the main building; maximum height '+z.height+' ft.',SRC.re)];
}
function coverage(lotSf){const c=lotSf?' On this lot (about '+Math.round(lotSf).toLocaleString('en-US')+' sq ft), 15% is about '+Math.round(lotSf*0.15).toLocaleString('en-US')+' sq ft.':'';
 return rule('accessory-coverage','Total accessory coverage','All accessory buildings together may cover up to 25% of the required rear yard or 15% of the lot, whichever is greater.'+c,SRC.coverage);}
function largeAccessory(zone){const z=String(zone||'').toUpperCase(),behind=/^RE-/.test(z)?6:/^(AV|A-|F-|FV)/.test(z)?10:null;
 return rule('large-accessory','If the garage is 1,000 sq ft or larger','A large accessory building must be '+(behind?'at least '+behind+' ft from the rear of the house in '+zone+', ':'set back from the rear of the house as the zone type requires (6 ft in residential estates zones, 10 ft in agricultural and forest zones), ')+'have at least a 10 ft side setback on an interior lot (40 ft on a corner lot\'s street side), and stay within 25 ft in height.',SRC.large);}
// Rules for one City Inspect permit type. facts: report facts (zone_std, lot_sf, jurisdiction).
function forPermit(typeId,facts){
 const f=facts||{},zone=f.zone_std?.zone||(typeof f.zone==='string'?f.zone:null),t=String(typeId);
 if(f.jurisdiction&&f.jurisdiction!=='Ogden Valley City')return [rule('city-rules','City rules for this permit','Cornerpin has transcribed accessory-structure rules for Ogden Valley City only. Check '+f.jurisdiction+'\'s land use code for this kind of structure.',{label:f.jurisdiction+' land use code',url:null},'check')];
 if(t==='2')return [
  rule('pool-setback','Keep the pool 10 ft from every property line','An in-ground pool and its equipment must be at least 10 ft from any property line (a larger zone setback controls) and sit to the side or rear of the house. A structure enclosing pool equipment follows the accessory-building setbacks.',SRC.pool),
  rule('pool-barrier','Fence or safety cover','The pool must be fully enclosed by a fence at least 6 ft high with a locked gate, or have a power safety cover meeting the building code.',SRC.pool),
  rule('pool-lights','Pool lighting','Pool lights must be aimed away from neighboring properties.',SRC.pool),
  ...accessoryYards(zone,'pool equipment enclosure')];
 if(t==='96')return [...accessoryYards(zone,'garage'),coverage(f.lot_sf),
  largeAccessory(zone)];
 if(t==='74')return [
  rule('deck-projection','How far an attached deck may reach into setbacks','For a house, unwalled porches, terraces, balconies and roof-covered patios may project 5 ft into the front setback, and 10 ft into the rear setback where the required rear setback is 30 ft or more (5 ft otherwise). No projection into side setbacks is listed for them.',SRC.projections),
  rule('deck-detached','A freestanding deck','The code\'s projection allowance is for structures attached to a house. Confirm with the city how a freestanding deck is treated.',SRC.projections,'check')];
 if(t==='6')return [
  rule('wall-fence-height','Wall and fence heights','A wall or fence up to 4 ft high may go anywhere on the lot; up to 6 ft anywhere except the front setback (and a corner lot\'s street-side setback). A retaining wall holding fill counts toward that height, though a protective fence up to 4 ft may sit on top.',SRC.fences),
  rule('wall-fill','Fill limit','Fill may not raise the ground more than 5 ft above natural grade at any point, with limited exceptions.',SRC.height)];
 if(t==='8')return [
  rule('solar-setbacks','Where panels may go','Ground-mounted panels follow the setbacks and height of an accessory building, measured to the panel edge nearest the property line. Roof-mounted panels follow the building\'s own setbacks.',SRC.solar),
  rule('solar-height','Height on a roof','Solar panels may extend above the zone\'s height limit by up to 6 ft.',SRC.roof),...accessoryYards(zone,'ground-mounted panels').map(r=>({...r,id:'solar-ground-yards'}))];
 if(t==='3')return [
  rule('addition-setbacks','The addition meets the house setbacks','An addition is part of the main building, so it must meet the zone\'s main-building setbacks'+(f.zone_std?' ('+f.zone_std.front+' ft front, '+f.zone_std.side+' ft side, '+f.zone_std.rear+' ft rear in '+zone+')':'')+'.',f.zone_std?.source?{label:'Zoning setbacks',url:f.zone_std.source}:zoneChapter(zone)),
  rule('addition-projections','Porches and eaves','Unwalled porches, eaves and similar parts may project into setbacks only as the projections section allows.',SRC.projections)];
 return [];
}
const api={SRC,ZONES,forPermit,zoneChapter};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.AccessoryRules=api;
})(typeof window!=='undefined'?window:globalThis);
