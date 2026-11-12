(() => {
 const video=document.getElementById('build-film');
 const reduced=matchMedia('(prefers-reduced-motion: reduce)');
 const saveData=!!navigator.connection?.saveData;
 // 0.85× speed gives the approved 15-second film a roughly 17.6-second loop.
 video.defaultPlaybackRate=0.85;
 video.playbackRate=0.85;
 async function play(){
  if(reduced.matches||saveData||document.hidden)return;
  if(!video.getAttribute('src'))video.src=video.dataset.src;
  try{await video.play();}catch(_){/* Keep the finished-house poster if autoplay is unavailable. */}
 }
 document.addEventListener('visibilitychange',()=>{if(document.hidden)video.pause();else play();});
 reduced.addEventListener('change',()=>{if(reduced.matches)video.pause();else play();});
 play();
})();
