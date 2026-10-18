#!/usr/bin/env node
// M16.3 two-function microcase only; NOT a canonical 20-workload claim.
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';

const root=fileURLToPath(new URL('../',import.meta.url));
const paths={
  signs:'packages/poly.auto/signs.hcs',
  program:'packages/poly.auto/demo.hc',
  typescript:'compact/benchmarks/m16-3/poly-equivalent.ts',
  generatedSource:'packages/poly.auto/lib.hc',
  manifest:'packages/poly.auto/manifest.json',
  lock:'hcode.m16.3.lock.json'
};
const frozen={
  signs:'8b3b52e52dd45a705bd0d3d42f9224e7cad7a06d5ef97e111fc8eaa325866775',
  program:'1fdf7f21ba072645609b38d9b56cc4c4d76ec824993a59e3aebea9362566f9dd',
  typescript:'a3fe1e5b1e3ca5e71f6f1d6d2eb184f465794649017fb54bff78585c18f97ab6'
};
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const data={};
for(const [key,path] of Object.entries(paths)){
  data[key]=readFileSync(resolve(root,path));
  if(frozen[key]&&hash(data[key])!==frozen[key])throw Error('Frozen M16.3 fixture changed: '+path);
}
const counted=bytes=>({unicodeCodepoints:[...bytes.toString('utf8')].length,utf8Bytes:bytes.length,sha256:hash(bytes)});
const hcode=[data.signs,data.program].reduce((x,b)=>x+b.toString('utf8').length,0);
const hcodeBytes=data.signs.length+data.program.length;
const ts=counted(data.typescript);
const lock=JSON.parse(data.lock.toString('utf8'));
if(lock.packages?.length!==1||lock.packages[0].name!=='poly.auto')throw Error('Unexpected generated lock package');
if(lock.packages[0].manifestSha256!==hash(data.manifest)||lock.packages[0].sourceSha256!==hash(data.generatedSource))
  throw Error('Generated package SHA-256 verification failed');
const hcodeCodepoints=[...data.signs.toString('utf8')].length+[...data.program.toString('utf8')].length;
const report={
  status:'microcase_only_not_20_program_benchmark',
  method:'two typed generic functions and four matching nonempty calls; authored package source plus import/demo counted',
  frozenFixtures:Object.fromEntries(Object.entries(frozen).map(([k,v])=>[paths[k],v])),
  developerAuthored:{
    hcode:{unicodeCodepoints:hcodeCodepoints,utf8Bytes:hcodeBytes,
      files:[paths.signs,paths.program]},
    typescript:{unicodeCodepoints:ts.unicodeCodepoints,utf8Bytes:ts.utf8Bytes,
      files:[paths.typescript]},
    unicodeCodepointSavingsPercent:Number(((ts.unicodeCodepoints-hcodeCodepoints)/ts.unicodeCodepoints*100).toFixed(2)),
    utf8ByteSavingsPercent:Number(((ts.utf8Bytes-hcodeBytes)/ts.utf8Bytes*100).toFixed(2))
  },
  generatedNotAuthored:{
    source:{path:paths.generatedSource,...counted(data.generatedSource)},
    manifest:{path:paths.manifest,...counted(data.manifest)},
    lock:{path:paths.lock,...counted(data.lock)}
  },
  externalDependencies:'Not measured: toolchains, package caches, and Node/Rust runtimes. No 70% conclusion possible.'
};
console.log(JSON.stringify(report,null,2));
