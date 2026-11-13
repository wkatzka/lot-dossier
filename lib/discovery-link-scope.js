/* A matching host identifies a possible custodian, not every link on that host. */
function pathText(url){try{const u=new URL(url);return decodeURIComponent(u.pathname+' '+u.search);}catch{return '';}}
function nonDocumentMedia(url,label=''){
 let target=url;try{const u=new URL(url);if(u.hostname==='web.archive.org'&&u.pathname.startsWith('/cdx/'))target=u.searchParams.get('url')||url;else if(u.hostname==='web.archive.org')target=u.pathname.replace(/^\/web\/\d+(?:id_)?\//,'');}catch{}
 if(!/\.(?:jpe?g|png|gif|webp|svg|mp4|mov|mp3|woff2?)(?:\?|$)/i.test(target))return false;
 return !/declaration|covenant|\bcc[&_-]?r|bylaw|architect|design.?review|approval|permit|ordinance|plat|survey|agreement|amendment|recording|instrument|document|guideline/i.test(label+' '+pathText(target));
}
module.exports={pathText,nonDocumentMedia};
