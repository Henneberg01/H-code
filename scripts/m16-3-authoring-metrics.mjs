#!/usr/bin/env node
// M16.3 two-function microcase only; NOT a canonical 20-workload claim.
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';

const root=fileURLToPath(new URL('../',import.meta.url));
const paths={
  signs:'packages/poly.auto/signs.hcs',
  previousSigns:'compact/benchmarks/m16-3/pre-glyph-name-legacy.hcs',
  program:'packages/poly.auto/demo.hc',
  typescript:'compact/benchmarks/m16-3/poly-equivalent.ts',
  generatedSource:'packages/poly.auto/lib.hc',
  manifest:'packages/poly.auto/manifest.json',
  lock:'hcode.m16.3.lock.json'
};
const frozen={
  signs:'faa5355294e6a7c304b39f637bb707dc9254d62db8f68e519f280be26390a00c',
  previousSigns:'8b3b52e52dd45a705bd0d3d42f9224e7cad7a06d5ef97e111fc8eaa325866775',
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
const hcodeBytes=data.signs.length+data.program.length;
const ts=counted(data.typescript);
const lock=JSON.parse(data.lock.toString('utf8'));
if(lock.packages?.length!==1||lock.packages[0].name!=='poly.auto')throw Error('Unexpected generated lock package');
if(lock.packages[0].manifestSha256!==hash(data.manifest)||lock.packages[0].sourceSha256!==hash(data.generatedSource))
  throw Error('Generated package SHA-256 verification failed');
const hcodeCodepoints=[...data.signs.toString('utf8')].length+[...data.program.toString('utf8')].length;
const previousCodepoints=[...data.previousSigns.toString('utf8')].length+[...data.program.toString('utf8')].length;
const previousBytes=data.previousSigns.length+data.program.length;
if(hcodeCodepoints>=previousCodepoints)throw Error('M16.3 glyph-first source must remove redundant authored syntax');
const report={
  status:'microcase_only_not_20_program_benchmark',
  method:'Same two generic functions and four calls, same TypeScript reference. Prior verbose signs.hcs retained as SHA-locked baseline; current glyph replaces function keyword and identifier. Include authored package and import/demo on both H-Code measurements.',
  frozenFixtures:Object.fromEntries(Object.entries(frozen).map(([k,v])=>[paths[k],v])),
  developerAuthored:{
    priorHcode:{unicodeCodepoints:previousCodepoints,utf8Bytes:previousBytes,
      files:[paths.previousSigns,paths.program],
      unicodeCodepointSavingsPercent:Number(((ts.unicodeCodepoints-previousCodepoints)/ts.unicodeCodepoints*100).toFixed(2))},
    hcode:{unicodeCodepoints:hcodeCodepoints,utf8Bytes:hcodeBytes,
      files:[paths.signs,paths.program]},
    typescript:{unicodeCodepoints:ts.unicodeCodepoints,utf8Bytes:ts.utf8Bytes,
      files:[paths.typescript]},
    unicodeCodepointSavingsPercent:Number(((ts.unicodeCodepoints-hcodeCodepoints)/ts.unicodeCodepoints*100).toFixed(2)),
    improvementFromDirectGlyph:Number(((previousCodepoints-hcodeCodepoints)/previousCodepoints*100).toFixed(2)),
    utf8ByteSavingsPercent:Number(((ts.utf8Bytes-hcodeBytes)/ts.utf8Bytes*100).toFixed(2))
  },
  generatedNotAuthored:{
    source:{path:paths.generatedSource,...counted(data.generatedSource)},
    manifest:{path:paths.manifest,...counted(data.manifest)},
    lock:{path:paths.lock,...counted(data.lock)}
  },
  historicalM14:'M14 SHA-frozen three-task median is 68.46% fewer Unicode codepoints (sum/map/filter), separately verified by npm run m14:measure. This microcase does not replace M14.',
  externalDependencies:'Not measured: toolchains, package caches, and Node/Rust runtimes. No 70% conclusion possible for canonical 20.'
};
console.log(JSON.stringify(report,null,2));
