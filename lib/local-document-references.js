/* Resolve a bare internal article reference only against a substantive heading
   in the same original. A TOC, another PDF, or an external document name is not proof. */
function resolve(result,pages){
 const remaining=[];
 for(const ref of result.missingDocuments||[]){
  const match=/^Article\s+(\d+|[IVXLCDM]+)$/i.exec(ref.identifier.trim());
  const heading=match&&new RegExp('^\\s*ARTICLE\\s+'+match[1]+'\\s*[-–—:]\\s*[^\\n]+','im');
  const page=heading&&pages.find(p=>!p.needsOCR&&!/table\s+of\s+contents/i.test(p.text)&&p.text.length>700&&heading.test(p.text));
  if(!page){remaining.push(ref);continue;}
  (result.resolvedReferences||=[]).push({...ref,resolution:'located_in_same_original',resolvedPage:page.page,resolutionQuote:page.text.match(heading)[0].trim(),sha256:result.sha256});
 }
 result.missingDocuments=remaining;return result;
}
module.exports={resolve};
