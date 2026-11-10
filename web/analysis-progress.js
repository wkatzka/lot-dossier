/* Indeterminate analysis feedback: phrases describe search scope, not verified milestones. */
(function(root){'use strict';
const phrases={
 plans:[[0,'Reading the uploaded plans'],[12,'Looking for dimensions and area schedules'],[30,'Looking for construction notes and specifications'],[52,'Looking for details relevant to the permit'],[80,'Reading drawings and source references']],
 geometry:[[0,'Reading the drawing geometry'],[12,'Looking for printed dimensions and scale'],[30,'Looking for floor boundaries and exclusions'],[55,'Looking for property lines and building placement'],[85,'Reading geometry and source references']],
 local:[[0,'Reading printed plan text'],[10,'Looking for labeled quantities and schedules'],[30,'Reading explicit facts and source references']]
};
function phrase(kind,seconds){const rows=phrases[kind]||phrases.plans;return rows.filter(r=>r[0]<=seconds).at(-1)[1];}
function create(doc,clock=()=>Date.now(),schedule=setInterval,cancel=clearInterval){let timer=null,started=0,kind='plans',target='';
 function paint(){const el=doc.getElementById(target);if(!el)return;const secs=Math.floor((clock()-started)/1000);if(!el.querySelector('.analysis-progress')){el.classList.add('is-analyzing');el.removeAttribute('role');el.removeAttribute('aria-live');el.innerHTML='<div class="analysis-progress"><span class="analysis-icon" aria-hidden="true"><img class="analysis-frame-art" src="assets/cornerpin-analysis.svg?v=3" alt=""><svg class="analysis-static-art" viewBox="0 0 1024 1024"><path d="M64 880V64H880 M960 144V960H144" fill="none" stroke="#dbdbdb" stroke-width="4"/><circle cx="64" cy="64" r="21" fill="#fb7136"/></svg></span><div class="analysis-copy"><span class="analysis-eyebrow">Plan analysis</span><div class="analysis-line"><span class="analysis-phrase" role="status" aria-live="polite"></span><span class="analysis-dots" aria-hidden="true"><i>.</i><i>.</i><i>.</i></span></div><p>Reading your document for potential answers. Findings will be ready to review when analysis finishes.</p></div><span class="analysis-time" aria-hidden="true"></span></div>';}
 const text=el.querySelector('.analysis-phrase'),value=phrase(kind,secs);if(text.textContent!==value)text.textContent=value;el.querySelector('.analysis-time').textContent=Math.floor(secs/60)+':'+String(secs%60).padStart(2,'0')+' elapsed';
 }
 function stop(){if(timer!==null)cancel(timer);timer=null;const el=doc.getElementById(target);if(el){el.classList.remove('is-analyzing');if(el.querySelector('.analysis-progress'))el.textContent='';el.setAttribute('role','status');el.setAttribute('aria-live','polite');}}
 return{start(id,type='plans'){stop();target=id;kind=type;started=clock();paint();timer=schedule(paint,1000);},stop,paint};
}
if(typeof module!=='undefined'&&module.exports)module.exports={phrase,create};else{root.AnalysisProgress=create(document);root.addEventListener('cornerpin:account-changed',()=>root.AnalysisProgress.stop());}
})(typeof window!=='undefined'?window:globalThis);
