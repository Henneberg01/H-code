#!/usr/bin/env node
// M19 full proof for unchanged canonical task 10: typed sum/map/filter for
// compatible Number, String, Bool, structural records and nested lists.
// Existing M14 3-pair sources & median are SHA-pinned and never replaced.
import {readFileSync,writeFileSync,mkdtempSync,rmSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {join,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {execute} from '../prototype/src/hcode.mjs';
import {compareM14} from './m14-compare.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
export const LOCK=Object.freeze({
 registry:['compact/canonical20/workloads.json','46653ef90ffb3e420fba4ddfbfac3c4cfd57f3b3'],
 m14:['compact/benchmarks/m14/manifest.json','03a8fbd02f106a0014f576ee250e5531a76177be'],
 cases:['compact/canonical20/cases/10-generic-collection-transforms.json','c4242e7414dc7dde17e151c71b3a4f46d23d8047'],
 hc:['compact/canonical20/programs/10-generic-collection-transforms.hc','8620b434b846714e10484f607f67bc37f393fe43'],
 ts:['compact/canonical20/programs/10-generic-collection-transforms.ts','f6e36cd493b5ac5897ab39f8a9ffe87b6ea8a820']
});
const gitBlob=bytes=>createHash('sha1').update('blob '+bytes.length+'\0').update(bytes).digest('hex');
const sha256=bytes=>createHash('sha256').update(bytes).digest('hex');
const pct=(a,b)=>Number(((1-a/b)*100).toFixed(2));
function locked(key) {
  const [path,expected]=LOCK[key],bytes=readFileSync(join(root,path));
  if(gitBlob(bytes)!==expected)throw Error('Canonical collections SHA source changed: '+path);
  return {path,source:bytes.toString('utf8'),utf8Bytes:bytes.length,
    unicodeCodepoints:[...bytes.toString('utf8')].length,gitBlobSha:expected};
}
function invoke(cmd,args,{cwd=root,timeout=30000}={}) {
  const r=spawnSync(cmd,args,{cwd,timeout,encoding:'utf8',windowsHide:true});
  if(r.error)throw Error('Cannot invoke '+cmd+': '+r.error.message);
  return {...r,stdout:r.stdout.replace(/\r\n/g,'\n'),stderr:r.stderr.replace(/\r\n/g,'\n')};
}
function success(r,tag) {
  if(r.status!==0)throw Error(tag+' exit '+r.status+': '+r.stderr.slice(0,1000));
  return r.stdout;
}
function reference(src){
  const out=[];execute(src,{stdout:value=>out.push(String(value)),maxSteps:200000});
  return out.join('\n')+'\n';
}
function build(src,dest){
  success(invoke('cargo',['run','--quiet','--manifest-path','compiler/Cargo.toml','--',
    'build',src,'--out',dest],{timeout:180000}),'Rust H-Code compiler');
  const b=readFileSync(dest);
  return {utf8Bytes:b.length,sha256:sha256(b)};
}
function ensureOriginalManifest(lock,registry){
  const manifest=JSON.parse(lock.m14.source);
  if(registry.workloads.length!==20||registry.workloads[9]?.id!=='10-generic-collection-transforms'||
     registry.workloads[9].acceptance!=='typed sum, map and filter of arbitrary compatible values with stable outputs'||
     !['sum','map','filter','typed-sequences'].every(x=>
       registry.workloads[9].requiredCapabilities.includes(x)))
    throw Error('Canonical 10 acceptance changed');
  if(manifest.id!=='M14-SAME-M11-M13-TASKS-2026-10-18-v1'||
     manifest.cases.length!==3)throw Error('M14 three-case original benchmark missing');
  const ids=['sum-typed-sequence','map-typed-sequence','filter-typed-sequence'];
  if(manifest.cases.map(x=>x.id).join(',')!==ids.join(','))
    throw Error('Original M14 three-pair order changed');
  for(const item of manifest.cases){
    for(const key of ['m11','m13','m14','typescript']){
      const p=item[key],bytes=readFileSync(join(root,p.path));
      if(gitBlob(bytes)!==p.sha)throw Error('M14 previously source-frozen '+key+' file changed: '+p.path);
    }
  }
  return manifest;
}
function ensureFixedCases(cases,registry){
  if(cases.id!=='10-generic-collection-transforms'||cases.acceptance!==registry.workloads[9].acceptance||
     cases.origin!=='M14-SAME-M11-M13-TASKS-2026-10-18-v1'||
     cases.coverage.length!==11||new Set(cases.coverage).size!==11||
     cases.requiredStaticRejections.length!==6)
    throw Error('Full generic collection acceptance/test contract was modified');
  if(cases.fixedMultitypeExpectedStdout.split('\n').filter(Boolean).length!==11 ||
     !cases.fixedMultitypeExpectedStdout.endsWith('\n'))
    throw Error('Invalid multi-type expected stdout');
  if(new Set(cases.requiredStaticRejections.map(x=>x.id)).size!==6)
    throw Error('Duplicate static rejection ID');
}
function generalizedCases(){
  // Not substituted for the frozen authored source. Vary arrays of several
  // element types and callback results to detect narrow/hardcoded operations.
  const piecesHc=[],piecesTs=[],expect=[];
  for(let i=0;i<9;i++){
    const values=Array.from({length:i},(_,k)=>(i*3+k*5)%15-7);
    const input=JSON.stringify(values),h='x'+i;
    piecesHc.push('≔'+h+':⟦Number⟧←⟦'+values.join(',')+'⟧;'+
      'print(∑'+h+');print(⤒('+h+'⇢(*3)));print(⤒('+h+'⌕(>0)));');
    piecesTs.push('const '+h+':number[]='+input+';'+
      'console.log('+h+'.reduce((a,b)=>a+b,0));'+
      'console.log(JSON.stringify('+h+'.map(n=>n*3)));'+
      'console.log(JSON.stringify('+h+'.filter(n=>n>0)));');
    expect.push(String(values.reduce((a,b)=>a+b,0)),
      JSON.stringify(values.map(n=>n*3)),JSON.stringify(values.filter(n=>n>0)));
  }
  for(let i=0;i<4;i++){
    const values=[['skip','a'],['Ø','skip','你好'],[],['a','a','skip','z']][i];
    const a='s'+i,input=JSON.stringify(values);
    piecesHc.push('≔'+a+':⟦String⟧←⟦'+values.map(JSON.stringify).join(',')+'⟧;'+
      'print(⤒('+a+'⇢λv:v+"!"));print(⤒('+a+'⌕λv:v!="skip"));');
    piecesTs.push('const '+a+':string[]='+input+';'+
      'console.log(JSON.stringify('+a+'.map(v=>v+"!")));'+
      'console.log(JSON.stringify('+a+'.filter(v=>v!=="skip")));');
    expect.push(JSON.stringify(values.map(v=>v+'!')),JSON.stringify(values.filter(v=>v!=='skip')));
  }
  for(let i=0;i<3;i++){
    const values=[[],[true,false],[false,true,true,false]][i],a='b'+i;
    piecesHc.push('≔'+a+':⟦Bool⟧←⟦'+values.map(v=>v?'⊤':'⊥').join(',')+'⟧;'+
      'print(⤒('+a+'⌕λv:v));print(⤒('+a+'⇢λv:¬v));');
    piecesTs.push('const '+a+':boolean[]='+JSON.stringify(values)+';'+
      'console.log(JSON.stringify('+a+'.filter(v=>v)));'+
      'console.log(JSON.stringify('+a+'.map(v=>!v)));');
    expect.push(JSON.stringify(values.filter(Boolean)),JSON.stringify(values.map(v=>!v)));
  }
  const hRecordFns='ƒ keep(p:⦃name:String,score:Number⦄)→Bool ↩ p·score>0;'+
    'ƒ label(p:⦃name:String,score:Number⦄)→String ↩ p·name;';
  const tRecordType='type Person={name:string;score:number};';
  for(let i=0;i<3;i++){
    const people=Array.from({length:i+1},(_,k)=>({name:'P'+i+'-'+k,score:k-i+1}));
    const a='r'+i;
    piecesHc.push('≔'+a+':⟦⦃name:String,score:Number⦄⟧←⟦'+
      people.map(x=>'⦃name:'+JSON.stringify(x.name)+',score:'+x.score+'⦄').join(',')+'⟧;'+
      'print(⤒('+a+'⌕keep));print(⤒('+a+'⇢label));');
    piecesTs.push('const '+a+':Person[]='+JSON.stringify(people)+';'+
      'console.log(JSON.stringify('+a+'.filter(p=>p.score>0)));'+
      'console.log(JSON.stringify('+a+'.map(p=>p.name)));');
    expect.push(JSON.stringify(people.filter(x=>x.score>0)),
      JSON.stringify(people.map(x=>x.name)));
  }
  return {hc:hRecordFns+piecesHc.join('\n')+'\n',
    ts:tRecordType+piecesTs.join('\n')+'\n',expected:expect.join('\n')+'\n',
    cases:9+4+3+3,assertions:expect.length};
}

let cached=null;
export function verifyCanonical10(){
  const src=Object.fromEntries(Object.keys(LOCK).map(k=>[k,locked(k)]));
  const registry=JSON.parse(src.registry.source),manifest=ensureOriginalManifest(src,registry);
  const cases=JSON.parse(src.cases.source);
  ensureFixedCases(cases,registry);
  if(cached)return cached;
  if(Number(process.versions.node.split('.')[0])<22)throw Error('Node 22+ required for TypeScript');

  const m14=compareM14(); // existing independent hash/JS/TS checks retained untouched
  if(m14.medianCodepointReductionVsTypeScript!==68.46||
     m14.benchmarkCount!==3||!m14.cases.every(x=>x.outputVerified))
    throw Error('Historical M14 three-case evidence changed');

  const temp=mkdtempSync(join(tmpdir(),'hcode-canonical10-'));
  try {
    const oldPrograms=[];
    for(const item of manifest.cases) {
      const original=join(root,item.m14.path),generated=join(temp,item.id+'.mjs');
      const stats=build(original,generated);
      const output=success(invoke(process.execPath,[generated]),'Rust compiled M14 '+item.id);
      if(output!==item.expected)throw Error('Original M14 source did not actually compile/execute: '+item.id);
      oldPrograms.push({id:item.id,sourceSha:item.m14.sha,generated:stats,
        stdoutValidated:true});
    }
    const built=join(temp,'collections.mjs');
    const generated=build(join(root,src.hc.path),built);
    const expected=cases.fixedMultitypeExpectedStdout;
    if(reference(src.hc.source)!==expected ||
       success(invoke(process.execPath,[built]),'Rust compiled collection multi-type')!==expected||
       success(invoke(process.execPath,['--experimental-strip-types',join(root,src.ts.path)]),
         'TypeScript collection multi-type')!==expected)
      throw Error('Full multi-type map/filter/sum output parity failed');

    const other=generalizedCases();
    const hPath=join(temp,'varied.hc'),tPath=join(temp,'varied.ts'),jsPath=join(temp,'varied.mjs');
    writeFileSync(hPath,other.hc);writeFileSync(tPath,other.ts);
    build(hPath,jsPath);
    if(reference(other.hc)!==other.expected||
       success(invoke(process.execPath,[jsPath]),'Rust compiled parametric variations')!==other.expected||
       success(invoke(process.execPath,['--experimental-strip-types',tPath]),
         'TypeScript parametric variations')!==other.expected)
      throw Error('Generalized sequences, String, Bool or records disagree between runtimes');

    for(const [index,bad] of cases.requiredStaticRejections.entries()){
      const inPath=join(temp,'illtyped-'+index+'.hc');
      writeFileSync(inPath,bad.source+'\n');
      const failure=invoke('cargo',['run','--quiet','--manifest-path','compiler/Cargo.toml',
        '--','build',inPath,'--out',join(temp,'illtyped-'+index+'.mjs')],{timeout:180000});
      if(failure.status===0||!failure.stderr.includes(bad.errorContains))
        throw Error('Rust checker did not reject '+bad.id+': '+failure.stderr.slice(0,650));
    }
    cached={
      workloadId:'10-generic-collection-transforms',
      kind:'full-compiler-evidence',
      acceptance:cases.acceptance,
      frozenM14ProgramsCompiledAndExecuted:oldPrograms,
      historicalM14MedianCodepointReductionPct:m14.medianCodepointReductionVsTypeScript,
      existingM14CorpusIsNotGlobalStudy:true,
      independentFixedPositiveOutputCases:cases.coverage.length,
      generatedVariableInputSets:other.cases,
      generatedOutputAssertions:other.assertions,
      compilerRejectedIllTypedPrograms:cases.requiredStaticRejections.length,
      testedCompatibleTypes:['Number','String','Bool','Record','Sequence<Sequence<Number>>','Sequence<Number> empty'],
      successfulSameOutputInRustJsAndTs:true,
      sourceGitBlobs:Object.fromEntries(Object.entries(src).map(([k,v])=>[k,{path:v.path,sha:v.gitBlobSha}])),
      hcodeDeveloperAuthored:{unicodeCodepoints:src.hc.unicodeCodepoints,utf8Bytes:src.hc.utf8Bytes},
      typescriptDeveloperAuthored:{unicodeCodepoints:src.ts.unicodeCodepoints,utf8Bytes:src.ts.utf8Bytes},
      unicodeCodepointReductionPct:pct(src.hc.unicodeCodepoints,src.ts.unicodeCodepoints),
      utf8ByteReductionPct:pct(src.hc.utf8Bytes,src.ts.utf8Bytes),
      generatedJsNotAuthored:generated,
      externalLibrariesUsed:false,
      compilerTimeMeasured:false,performanceMeasured:false,
      fullTwentyMedian:null,global70GoalReached:false
    };
    return cached;
  }finally{rmSync(temp,{recursive:true,force:true});}
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))
  console.log(JSON.stringify(verifyCanonical10(),null,2));
