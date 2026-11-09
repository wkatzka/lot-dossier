const assert=require('node:assert/strict'),crypto=require('node:crypto'),{PDFDocument}=require('pdf-lib'),handler=require('../api/projects');
(async()=>{
 const pdf=await PDFDocument.create();pdf.addPage().drawText('MAIN FLOOR: 1850 SF\nProposed actual front setback: 35 FT',{x:50,y:700});const bytes=Buffer.from(await pdf.save()),hash=crypto.createHash('sha256').update(bytes).digest('hex');
 const owner='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',doc={id:'cp-test-doc',hash,name:'Synthetic.pdf',family:'plan',version:1},record={id:'cp-test-project',documents:[doc]},objects=new Map();let modelCalls=0,owns=true;
 const oldFetch=global.fetch,oldKey=process.env.ANTHROPIC_API_KEY;process.env.ANTHROPIC_API_KEY='test-only';
 global.fetch=async(url,options={})=>{
  if(url.endsWith('/auth/v1/user'))return options.headers.Authorization==='Bearer valid'?Response.json({id:owner}):Response.json({},{status:401});
  if(url.includes('/rest/v1/cornerpin_projects'))return Response.json(owns?[{record}]:[]);
  if(url==='https://api.anthropic.com/v1/messages'){modelCalls++;const input=JSON.parse(options.body);assert.equal(input.model,'claude-sonnet-5-5');assert(input.output_config.format.schema);assert.equal(input.messages[0].content[0].type,'document');assert.equal(input.messages[0].content[0].source.media_type,'application/pdf');assert.equal(Buffer.from(input.messages[0].content[0].source.data,'base64').compare(bytes),0);return Response.json({stop_reason:'end_turn',usage:{input_tokens:100,output_tokens:40},content:[{type:'text',text:JSON.stringify({facts:[{field:'front_set_back_default',value:'35',unit:'ft',page:1,quote:'Proposed actual front setback: 35 FT'},{field:'bedrooms',value:'8',unit:'count',page:1,quote:'BEDROOMS: 8'}]})}]});}
  assert(url.includes('/storage/v1/object/cornerpin-private/'+owner+'/'));assert.equal(options.headers.Authorization,'Bearer valid');
  if(url.endsWith('/'+doc.id+'/'+hash))return new Response(bytes);
  if(options.method==='POST'){if(objects.has(url))return Response.json({error:'Duplicate'},{status:409});objects.set(url,options.body);return Response.json({});}
  return objects.has(url)?new Response(objects.get(url)):Response.json({error:'not found'},{status:404});
 };
 async function call(token='valid',action='permit-extraction'){let status,body;await handler({method:'POST',query:{action},headers:{authorization:'Bearer '+token},body:{projectId:record.id,documentId:doc.id}},{setHeader(){},set statusCode(v){status=v;},end(v){body=JSON.parse(v);}});return {status,body};}
 try{
  assert.equal((await call('bad')).status,401);assert.equal(modelCalls,0);owns=false;assert.equal((await call()).status,404);owns=true;
  const first=await call();assert.equal(first.status,200,JSON.stringify(first.body));assert.equal(modelCalls,1);assert.equal(first.body.facts.length,2);assert.equal(first.body.rejected.length,1);
  const second=await call();assert.equal(second.body.cacheHit,true);assert.equal(modelCalls,1);assert.deepEqual(second.body.facts,first.body.facts);
  const G=require('../lib/plan-measurement-reader'),oldRun=G.run;let geometryCalls=0;G.run=async()=>{geometryCalls++;return{version:G.VERSION,documentId:doc.id,documentHash:doc.hash,measurements:[],issues:['No placement geometry'],reviewedPages:[1],usage:{}};};try{assert.equal((await call('bad','plan-measurements')).status,401);const geometry=await call('valid','plan-measurements');assert.equal(geometry.status,200);assert.equal(geometryCalls,1);assert.equal((await call('valid','plan-measurements')).body.cacheHit,true);assert.equal(geometryCalls,1);}finally{G.run=oldRun;}
  const base=[...objects.keys()].find(x=>x.includes('_claude-budget/')).replace(/0\.json$/,'');for(let i=0;i<20;i++)objects.set(base+i+'.json','{}');for(const k of [...objects.keys()])if(k.includes('_claude-results'))objects.delete(k);
  assert.equal((await call()).status,429);assert.equal(modelCalls,1);
  console.log('PASS: authenticated PDF-to-field API, owner isolation, direct-first parsing, citation rejection, persistent cache and distributed budget cap.');
 }finally{global.fetch=oldFetch;if(oldKey===undefined)delete process.env.ANTHROPIC_API_KEY;else process.env.ANTHROPIC_API_KEY=oldKey;}
})().catch(e=>{console.error(e);process.exitCode=1;});
