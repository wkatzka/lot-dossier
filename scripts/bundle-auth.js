const esbuild=require('esbuild');
const result=esbuild.buildSync({stdin:{contents:"export { createClient } from '@supabase/supabase-js';",resolveDir:process.cwd()},bundle:true,write:false,format:'iife',globalName:'CornerpinSupabase',platform:'browser',supported:{'template-literal':false},minify:true,legalComments:'none'});
process.stdout.write(result.outputFiles[0].text);
