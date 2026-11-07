const fs=require('node:fs');const {run}=require('../lib/valuation-backtest');
const input=process.argv[2],output=process.argv[3];
if(!input)throw Error('Usage: node scripts/backtest-valuations.js input.json [output.json]');
const result=run(JSON.parse(fs.readFileSync(input,'utf8'))),text=JSON.stringify(result,null,2)+'\n';
if(output)fs.writeFileSync(output,text);else process.stdout.write(text);
console.error(JSON.stringify({status:result.status,screened:result.screenedRecords,eligible:result.eligibleRecords,scored:result.predictions.length,metrics:result.metrics}));
