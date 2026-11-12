/* Match reviewed public evidence to exact parcel identity; no name-only inheritance. */
(function(root){'use strict';
const data=typeof module!=='undefined'&&module.exports?require('../lib/approval-evidence-data'):root.ApprovalEvidenceData;
const sources=data?.sources||{},version=data?.version||'unavailable';
function parcel(value){return /^\d{2}-\d{3}-\d{4}$/.test(String(value))?String(value).replace(/-/g,''):String(value||'');}
function forProject(p){
 const c=data?.cases?.find(c=>p?.property?.county===c.county&&parcel(p.property.parcelId)===c.parcelId);
 if(!c)return null;
 const reported=p.report?.parcel?.attrs?.PARCEL_ID;
 if(reported&&parcel(reported)!==c.parcelId)return null;
 return JSON.parse(JSON.stringify(c));
}
function rules(p){return forProject(p)?.rules||[];}
const api={forProject,rules,sources,version};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.ApprovalEvidence=api;
})(typeof window!=='undefined'?window:globalThis);
