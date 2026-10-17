// CSE-1 preliminary paired-language measurement. No result unless both programs run and agree.
// Requires Node 22+ (strip-types) and installed Rust stable/cargo.
// Do not advertise this eight-task interim corpus as the 70%-on-20 benchmark.
import {spawnSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {sourceMetrics,reduction} from './compact-metrics.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
const normalized=s=>s.replace(/\r\n/g,'\n');
const manifest=JSON.parse(readFileSync(join(root,'compact/benchmarks/paired/manifest.json'),'utf8'));
if(manifest.version!==1||!Array.isArray(manifest.pairs))throw Error('Invalid paired-language manifest');

function run(program,args,label){
  const process=spawnSync(program,args,{cwd:root,encoding:'utf8',timeout:180000,windowsHide:true});
  if(process.error||process.status!==0)throw Error(label+': '+(process.error?.message||process.stderr||'nonzero exit'));
  return normalized(process.stdout);
}

const samples=[];
const median=values=>{
  if(values.length===0)return null;
  const sorted=[...values].sort((a,b)=>a-b);
  const mid=Math.floor(sorted.length/2);
  return Number((sorted.length%2?sorted[mid]:(sorted[mid-1]+sorted[mid])/2).toFixed(2));
};
for(const item of manifest.pairs){
  if(typeof item.id!=='string'||!/^[a-z0-9-]+$/.test(item.id))throw Error('Unsafe sample ID');
  const fileBase=join(root,'compact/benchmarks/paired',item.id);
  const hcodeFile=fileBase+'.hc',typeScriptFile=fileBase+'.ts';
  const tsOutput=run(process.execPath,['--experimental-strip-types',typeScriptFile],item.id+' TS');
  const hcOutput=run('cargo',['run','--quiet','--manifest-path','compiler/Cargo.toml','--','run',hcodeFile],item.id+' H-Code');
  if(tsOutput!==hcOutput||tsOutput!==item.expected)throw Error(item.id+': functional parity mismatch');
  const ts=sourceMetrics(readFileSync(typeScriptFile,'utf8'));
  const hc=sourceMetrics(readFileSync(hcodeFile,'utf8'));
  samples.push({id:item.id,outputVerified:true,hcode:hc,typescript:ts,
    codePointReductionPercent:reduction(hc.codePoints,ts.codePoints),
    utf8ReductionPercent:reduction(hc.utf8Bytes,ts.utf8Bytes)});
}
console.log(JSON.stringify({kind:'PRELIMINARY: eight varied handwritten standalone tasks; NOT 20-program benchmark',
  comparison:'H-Code vs idiomatic TypeScript',sampleCount:samples.length,
  codePointMedianReductionPercent:median(samples.map(p=>p.codePointReductionPercent)),
  utf8MedianReductionPercent:median(samples.map(p=>p.utf8ReductionPercent)),
  hcodeSourceRegressions:samples.filter(p=>p.codePointReductionPercent<0).map(p=>p.id),samples,
  caveats:{independentReview:false,dependencyFootprintMeasured:false,
    compilerRuntimeNodeDependencyIncluded:false,tokenConsumptionMeasured:false}},null,2));
