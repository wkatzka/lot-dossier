/* Previously published source leads, shared by every address. Never evidence of membership. */
const originals={
 'trappersridgehoa.com':['https://trappersridgehoa.com/wp-content/uploads/2019/01/FINAL-Trappers-Ridge-CCRs-Bylaws-10-16-18-3.pdf'],
 'highlandsedenut.com':['https://www.highlandsedenut.com/editor_upload/File/Building%20a%20House/1%20-%202026-08-24%20%20Building%20Guidelines.pdf']
};
function seeds(profile){
 const matched=(profile.seeds||[]).filter(s=>s.route==='association_libraries'&&new URL(s.url).hostname!=='wolfcreekresortmasterhoa.com');
 if(!matched.length)return [];
 return [
  {url:'https://wolfcreekresortmasterhoa.com/building-home-wolf-creek-resort/',mode:'library',maxDepth:2},
  {url:'https://wolfcreekresortmasterhoa.com/hoa-documents/',mode:'library',maxDepth:2},
  ...matched.flatMap(s=>(originals[new URL(s.url).hostname.replace(/^www\./,'')]||[]).map(url=>({url,maxDepth:0,from:s.url})))
 ].map(s=>({kind:'page',route:'association_libraries',depth:0,label:'Published source lead; applicability unverified',...s}));
}
module.exports={seeds};
