/* Staged research. A quick first read of the lot (map and local checks, seconds) is enough to
   suggest which permits fit; the slow, detailed research then runs only for the permits the user
   chooses. Choosing different permits later runs only the steps not already done. Step ids are the
   report steps in web/lotreport.js (STEPS); ORDER must match it. */
(function(root){'use strict';
const ORDER=['check_parcel','weber_assessor','check_jurisdiction','check_contacts','check_zoning','check_historic','check_water','check_landslides','check_faults','check_liquefaction_groundwater','check_flood','check_districts','check_seismic','check_boreholes','check_soils_septic','check_slope','check_utilities','check_access_fire','check_ccr_permits','check_snow','check_performance','check_documents','check_ugs_archive','check_public_surveys','check_public_research','check_minerals','check_pool','check_plan_fit','check_permit_packet'];
// What the first read needs to judge fit: is there a house, zoning setbacks, hazards, HOA, pool screen.
const QUICK=['check_parcel','weber_assessor','check_jurisdiction','check_contacts','check_zoning','check_landslides','check_liquefaction_groundwater','check_flood','check_slope','check_ccr_permits','check_pool'];
const FOOTPRINT=['check_historic','check_faults','check_seismic','check_boreholes','check_soils_septic','check_snow','check_access_fire','check_documents','check_ugs_archive','check_public_surveys','check_utilities'];
// City Inspect permit type → the detailed research it needs (beyond the quick read).
const STEPS_FOR={
 '1':ORDER,'104':ORDER,
 '3':[...FOOTPRINT,'check_performance','check_plan_fit'],
 '96':[...FOOTPRINT,'check_plan_fit'],
 '102':['check_water','check_districts','check_soils_septic','check_utilities','check_access_fire','check_performance','check_documents','check_snow','check_plan_fit'],
 '2':['check_soils_septic','check_boreholes','check_documents','check_utilities','check_public_surveys','check_plan_fit'],
 '74':['check_documents','check_soils_septic','check_snow','check_public_surveys','check_plan_fit'],
 '6':['check_documents','check_soils_septic','check_boreholes','check_public_surveys','check_plan_fit'],
 '8':['check_utilities','check_snow','check_plan_fit'],
 '4':['check_performance','check_snow','check_plan_fit'],
 '70':['check_performance','check_soils_septic','check_plan_fit'],
 '*':ORDER
};
// A step's inputs must have run first.
const DEPS={check_documents:['check_jurisdiction','check_contacts'],check_public_research:['check_public_surveys','check_documents'],check_permit_packet:['check_jurisdiction','check_zoning','check_slope','check_ccr_permits','check_documents','check_water','check_utilities','check_soils_septic'],
 check_pool:['check_zoning','check_slope','check_flood','check_liquefaction_groundwater'],check_ccr_permits:['check_jurisdiction'],check_zoning:['check_jurisdiction'],check_contacts:['check_jurisdiction'],check_plan_fit:['check_zoning','check_slope']};
// Permits that change the outside of the house or the lot need the plan-approval (HOA/design review) research.
const EXTERIOR=new Set(['1','104','3','96','102','2','74','6','8','*']);
function close(ids){const out=new Set(ids),stack=[...ids];while(stack.length){for(const d of DEPS[stack.pop()]||[])if(!out.has(d)){out.add(d);stack.push(d);}}return out;}
function stepsFor(typeIds,alreadyRun=[]){
 const done=new Set(alreadyRun),want=close([...new Set((typeIds||[]).flatMap(t=>STEPS_FOR[String(t)]||[]))]);
 return ORDER.filter(id=>want.has(id)&&!done.has(id));
}
function needsApprovalResearch(typeIds){return (typeIds||[]).some(t=>EXTERIOR.has(String(t)));}
// Reports saved before staging have no step record: treat them as fully researched.
function stepsRun(report){const s=report?.facts?.stepsRun;return s?Object.keys(s):(report?.findings?.length?ORDER.slice():[]);}
function notRun(report){const done=new Set(stepsRun(report));return ORDER.filter(id=>!done.has(id));}
const api={ORDER,QUICK,STEPS_FOR,DEPS,stepsFor,needsApprovalResearch,stepsRun,notRun};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.ResearchPlan=api;
})(typeof window!=='undefined'?window:globalThis);
