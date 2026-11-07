/* Similarity registration with independent check points; results require source review. */
(function(root){
'use strict';
function register(control,checks,options){
 if(!Array.isArray(control)||control.length<2||!Array.isArray(checks)||checks.length<1)throw Error('At least two control points and one independent check point required');
 if(options.units!=='metres'||!options.crs||!options.source||!Number.isFinite(options.toleranceM)||options.toleranceM<=0)throw Error('Source, metric CRS and positive tolerance required');
 const ids=new Set();for(const point of [...control,...checks]){if(!point.id||ids.has(point.id)||!point.source||!point.from?.every(Number.isFinite)||!point.to?.every(Number.isFinite)||point.from.length!==2||point.to.length!==2)throw Error('Independent, source-linked finite control pairs required');ids.add(point.id);}
 const mean=(rows,key)=>[0,1].map(i=>rows.reduce((s,p)=>s+p[key][i],0)/rows.length),from=mean(control,'from'),to=mean(control,'to');
 let denom=0,a=0,b=0;
 for(const p of control){const x=p.from[0]-from[0],y=p.from[1]-from[1],u=p.to[0]-to[0],v=p.to[1]-to[1];denom+=x*x+y*y;a+=x*u+y*v;b+=x*v-y*u;}
 if(denom<1e-9)throw Error('Degenerate control geometry');a/=denom;b/=denom;
 // Non-collinearity prevents an apparent fit from underconstrained control.
 let spread=0;for(let i=1;i<control.length-1;i++){const p=control[0].from,q=control[i].from,r=control[i+1].from;spread=Math.max(spread,Math.abs((q[0]-p[0])*(r[1]-p[1])-(q[1]-p[1])*(r[0]-p[0])));}if(control.length>2&&spread<1e-6)throw Error('Collinear control points');
 const tx=to[0]-a*from[0]+b*from[1],ty=to[1]-b*from[0]-a*from[1],apply=p=>[a*p[0]-b*p[1]+tx,b*p[0]+a*p[1]+ty];
 const residual=points=>points.map(p=>{const q=apply(p.from);return {id:p.id,errorM:Math.hypot(q[0]-p.to[0],q[1]-p.to[1]),source:p.source};});
 const fit=residual(control),validation=residual(checks),maxErrorM=Math.max(...fit.concat(validation).map(p=>p.errorM));
 return {method:'2D least-squares similarity transform',parameters:{a,b,tx,ty},scale:Math.hypot(a,b),rotationDegrees:Math.atan2(b,a)*180/Math.PI,controlResiduals:fit,checkResiduals:validation,maxErrorM,withinTolerance:maxErrorM<=options.toleranceM,reviewed:false,source:options.source,crs:options.crs,units:options.units,toleranceM:options.toleranceM,limitation:'Registration residuals do not establish the absolute accuracy of source control or legal boundary interpretation.'};
}
function transform(points,r){const {a,b,tx,ty}=r.parameters;return points.map(p=>[a*p[0]-b*p[1]+tx,b*p[0]+a*p[1]+ty]);}
const api={register,transform};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.SurveyRegistration=api;
})(typeof window!=='undefined'?window:globalThis);
