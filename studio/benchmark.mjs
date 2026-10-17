import {performance} from 'node:perf_hooks';import {spawnSync} from 'node:child_process';import path from 'node:path';import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));const samples=['examples/fibonacci.hc','m5/invoice/main.hc','m5/inventory/main.hc','m5/savings/main.hc'];const repeat=Number(process.argv[2]||5);if(!Number.isInteger(repeat)||repeat<1||repeat>30)throw Error('Repeat must be 1-30');
const exe=path.join(root,'compiler','target','debug','hcodec.exe');const results=[];
for(const sample of samples){const timings=[];
 for(let i=0;i<repeat;i++){const start=performance.now();const run=spawnSync(exe,['check',sample],{cwd:root,encoding:'utf8',timeout:10000});if(run.status!==0)throw Error(sample+': '+(run.stderr||run.error?.message));timings.push(performance.now()-start);}
 timings.sort((a,b)=>a-b);results.push({file:sample,n:repeat,medianMs:Number(timings[Math.floor(repeat/2)].toFixed(2)),minMs:Number(timings[0].toFixed(2)),maxMs:Number(timings.at(-1).toFixed(2))});}
console.log(JSON.stringify({platform:process.platform,node:process.version,kind:'Rust CLI parse+typecheck startup wall-time',results},null,2));