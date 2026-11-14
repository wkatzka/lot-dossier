/* Small inline icon set (24×24, 2px stroke, currentColor). Decorative: aria-hidden. */
(function(root){'use strict';
const P={
 doc:'<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h4"/>',
 user:'<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.6-6 8-6s8 2 8 6"/>',
 users:'<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c0-3.5 3-5.5 6.5-5.5s6.5 2 6.5 5.5"/><circle cx="17" cy="9" r="2.5"/><path d="M16.5 14.6c2.9.2 5 2 5 5.4"/>',
 clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
 phone:'<path d="M5 3h4l2 5-2.5 1.5a11 11 0 0 0 6 6L16 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 5a2 2 0 0 1 2-2z"/>',
 mail:'<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>',
 shield:'<path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z"/><path d="m9 12 2 2 4-4"/>',
 upload:'<path d="M12 16V4M7 9l5-5 5 5"/><path d="M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3"/>',
 check:'<path d="m5 12 5 5 9-10"/>',
 flag:'<path d="M5 21V4h11l-2 4 2 4H5"/>',
 alert:'<path d="M12 3 2 20h20z"/><path d="M12 10v4M12 17h.01"/>',
 home:'<path d="m3 11 9-7 9 7"/><path d="M5 10v10h14V10"/><path d="M10 20v-5h4v5"/>',
 building:'<rect x="4" y="3" width="16" height="18" rx="1"/><path d="M9 7h2M13 7h2M9 11h2M13 11h2M9 15h2M13 15h2M10 21v-3h4v3"/>',
 hardhat:'<path d="M3 17h18v2H3z"/><path d="M5 17a7 7 0 0 1 14 0"/><path d="M10 10V6h4v4"/>',
 briefcase:'<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M3 13h18"/>',
 clipboard:'<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V3h6v1M9 11h6M9 15h4"/>',
 pin:'<path d="M12 21s-7-6.5-7-12a7 7 0 0 1 14 0c0 5.5-7 12-7 12z"/><circle cx="12" cy="9" r="2.5"/>',
 send:'<path d="M21 3 3 10l7 3 3 7z"/><path d="m10 13 4-4"/>',
 search:'<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
 external:'<path d="M14 4h6v6M20 4l-9 9"/><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
 arrow:'<path d="M5 12h14M13 6l6 6-6 6"/>',
 mountain:'<path d="m3 20 6-11 4 6 2-3 6 8z"/>',
 droplet:'<path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z"/>',
 zap:'<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>',
 waves:'<path d="M2 8c2.5-2 4.5-2 7 0s4.5 2 7 0 4.5-2 6 0M2 14c2.5-2 4.5-2 7 0s4.5 2 7 0 4.5-2 6 0M2 20c2.5-2 4.5-2 7 0s4.5 2 7 0 4.5-2 6 0"/>',
 road:'<path d="M8 3 4 21M16 3l4 18M12 5v2M12 11v2M12 17v2"/>',
 ruler:'<path d="M3 17 17 3l4 4L7 21z"/><path d="m7 13 2 2M10 10l2 2M13 7l2 2"/>',
 cash:'<rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="3"/>',
 tree:'<path d="M12 22v-6M7 16h10l-3-4h2l-4-6-4 6h2z"/>'
};
// Blueprint-style illustrations (public/assets/icons/*.webp, 160px) for tiles and cards; line icons stay for buttons.
const ART=new Set(['new-home','replace-home','addition','remodel','basement','adu','garage','deck','pool','retaining-wall','solar','evaluate','slope','landslide','survey','septic','water','power','access','easement','hoa','flood','minerals','permit','setbacks','fees','trees','builder','team','hoa-board','city','geotech','surveyor','designer','phone','email','document','upload','submit','done','concern','warning','timing','approved','search']);
function art(name,fallback){if(!ART.has(name))return fallback?icon(fallback):'';return '<img class="cp-art" src="assets/icons/'+name+'.webp" width="80" height="80" alt="" loading="lazy" decoding="async">';}
function icon(name,cls=''){const d=P[name]||P.doc;return '<svg class="cp-icon'+(cls?' '+cls:'')+'" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">'+d+'</svg>';}
const api={icon,art,artNames:[...ART],names:Object.keys(P)};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.CpIcons=api;
})(typeof window!=='undefined'?window:globalThis);
