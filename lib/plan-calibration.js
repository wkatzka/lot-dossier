(function(root){
const M=typeof module!=='undefined'&&module.exports?require('../web/plan-measurements'):root.PlanMeasurements;
// Printed scale is only a hypothesis. Two orthogonal printed dimensions must
// independently match actual PDF line lengths before a calibration is proposed.
function discover(labels,segments,pageSize){
 const scales=[];for(const l of labels){const ratio=l.text.match(/\b1\s*:\s*(\d+(?:\.\d+)?)/);if(ratio&&Number(ratio[1])>0)scales.push(864/Number(ratio[1]));const match=l.text.match(/(?:(\d+)\s+)?(\d+)(?:\/(\d+))?\s*["″]\s*=\s*(\d+(?:\.\d+)?)\s*['′]/);if(match){const inches=Number(match[1]||0)+Number(match[2])/Number(match[3]||1),feet=Number(match[4]);if(inches>0&&feet>0)scales.push(72*inches/feet);}}
 const found=[];for(const pointsPerFoot of [...new Set(scales)])for(const l of labels){let feet;try{feet=M.parseFeet(l.text);}catch{continue;}if(feet<8||feet>500)continue;const x=l.x*pageSize[0]/1000,y=l.y*pageSize[1]/1000;let best;
 for(const [a,b]of segments){const pa=[a[0]*pageSize[0]/1000,a[1]*pageSize[1]/1000],pb=[b[0]*pageSize[0]/1000,b[1]*pageSize[1]/1000],dx=pb[0]-pa[0],dy=pb[1]-pa[1],length=Math.hypot(dx,dy);if(Math.abs(length/(feet*pointsPerFoot)-1)>0.008)continue;const horizontal=Math.abs(dy)<0.1,vertical=Math.abs(dx)<0.1;if(!horizontal&&!vertical)continue;const perpendicular=horizontal?Math.abs(y-pa[1]):Math.abs(x-pa[0]),along=horizontal?Math.abs(x-(pa[0]+pb[0])/2):Math.abs(y-(pa[1]+pb[1])/2);if(perpendicular>22||along>100)continue;const score=perpendicular+along/5;if(!best||score<best.score)best={a,b,feet,quote:l.text,axis:horizontal?'horizontal':'vertical',score};}
 if(best)found.push(best);}
 found.sort((a,b)=>b.feet-a.feet||a.score-b.score);for(const a of found)for(const b of found){if(a.axis===b.axis)continue;try{const controls=[a,b];M.calibration({pageSize,controls});return{controls,method:'Printed scale cross-checked against two orthogonal PDF dimension spans',candidates:found.length};}catch{}}
 return null;
}
if(typeof module!=='undefined'&&module.exports)module.exports={discover};else root.PlanCalibration={discover};
})(typeof window!=='undefined'?window:globalThis);
