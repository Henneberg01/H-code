#!/usr/bin/env node
// M19 canonical workload 02: compile the original SHA-frozen M10 recursive
// Fibonacci pair and prove acceptance, generality, and static safety.
// This must never rewrite the 20 preregistered tasks or swap source baselines.
import {readFileSync,mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {execute} from '../prototype/src/hcode.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
export const FROZEN=Object.freeze({
  registry:['compact/canonical20/workloads.json','46653ef90ffb3e420fba4ddfbfac3c4cfd57f3b3'],
  manifest:['compact/benchmarks/paired/manifest.json','3f8902a5936d2b8265711ef2e9b6f100dc03ee7d'],
  m10:['compact/results/frozen-baseline-m10-eight.json','a556d1e08146569515a9a89ec2adc0f2ae62ef6d'],
  fixtures:['compact/canonical20/cases/02-fibonacci-recursion.json','8d17955cbe4672aa1596d68c438d1ff69c8b9d51'],
  hc:['compact/benchmarks/paired/recursive-fibonacci.hc','66f02e2dce678b51f8d02766742d9d24aa5d66f7'],
  ts:['compact/benchmarks/paired/recursive-fibonacci.ts','2a4e6ac1ef469a6e0c64381b79f901ee26085125']
});
const gitBlob=bytes=>createHash('sha1').update('blob '+bytes.length+'\0').update(bytes).digest('hex');
const sha256=bytes=>createHash('sha256').update(bytes).digest('hex');
const percent=(a,b)=>Number(((1-a/b)*100).toFixed(2));
function locked(key){
  const [path,expected]=FROZEN[key],bytes=readFileSync(join(root,path));
  if(gitBlob(bytes)!==expected)throw Error('Original SHA-frozen Fibonacci source or preregistration modified: '+path);
  return {path,source:bytes.toString('utf8'),codepoints:[...bytes.toString('utf8')].length,
    bytes:bytes.length,blobSha:expected};
}
function processRun(command,args,{cwd=root,timeout=30000}={}){
  const r=spawnSync(command,args,{cwd,timeout,encoding:'utf8',windowsHide:true});
  if(r.error)throw Error('Unable to execute '+command+': '+r.error.message);
  return {...r,stdout:r.stdout.replace(/\r\n/g,'\n'),stderr:r.stderr.replace(/\r\n/g,'\n')};
}
function requireSuccess(r,description){
  if(r.status!==0)throw Error(description+' failed: '+r.stderr.slice(0,800));
  return r.stdout;
}
function runReference(source){
  const lines=[];
  execute(source,{stdout:value=>lines.push(String(value)),maxSteps:200000});
  return lines.join('\n')+'\n';
}
function compile(input,output){
  const r=processRun('cargo',['run','--quiet','--manifest-path','compiler/Cargo.toml','--',
    'build',input,'--out',output],{timeout:180000});
  requireSuccess(r,'Rust compiler');
  const compiled=readFileSync(output);
  return {utf8Bytes:compiled.length,sha256:sha256(compiled)};
}
function requireFrozenAcceptances(lockedSources){
  const registry=JSON.parse(lockedSources.registry.source);
  if(registry.workloads.length!==20||registry.workloads[1].id!=='02-fibonacci-recursion'||
     registry.workloads[1].acceptance!=='input n=7; stdout 13; recursion and type equivalence against fixed TypeScript baseline')
    throw Error('Original canonical Fibonacci workload changed');
  const m10=JSON.parse(lockedSources.m10.source);
  const manifest=JSON.parse(lockedSources.manifest.source);
  const fb=m10.pairs.find(x=>x.id==='recursive-fibonacci');
  if(m10.id!=='M10-EIGHT-2026-10-18-v1'||
     fb?.hcodeBlobSha!==FROZEN.hc[1]||fb.tsBlobSha!==FROZEN.ts[1]||
     fb.hcodePath!==FROZEN.hc[0]||fb.tsPath!==FROZEN.ts[0]||
     manifest.pairs.find(x=>x.id==='recursive-fibonacci')?.expected!=='13\n')
    throw Error('M10 original Fibonacci baseline drifted');
  const cases=JSON.parse(lockedSources.fixtures.source);
  if(cases.id!=='02-fibonacci-recursion'||cases.acceptance!==registry.workloads[1].acceptance||
     cases.originalM10PairId!=='recursive-fibonacci'||cases.immutableExpectedAt7!=='13\n'||
     cases.fixedPositive.length!==16||cases.requiredStaticFailures.length!==3)
    throw Error('Canonical-02 fixed test policy was weakened');
  if(!cases.fixedPositive.some(x=>x.n===7&&x.output==='13\n')||
     new Set(cases.fixedPositive.map(x=>x.n)).size!==cases.fixedPositive.length)
    throw Error('Missing or duplicate n=7 acceptance');
  if(cases.fixedPositive.some(x=>!Number.isInteger(x.n)||x.n<0||x.n>17||
     !/^\d+\n$/.test(x.output)))
    throw Error('Invalid Fibonacci positive test fixture');
  // Independent iterative oracle: no dependence on the recursive implementation
  // being proved, and no precomputed handwritten table.
  function iterativeFib(n){let a=0,b=1;for(let i=0;i<n;i++)[a,b]=[b,a+b];return a;}
  for(const x of cases.fixedPositive)
    if(x.output!==iterativeFib(x.n)+'\n')throw Error('Wrong fixed Fibonacci expected result for n='+x.n);
  if(new Set(cases.requiredStaticFailures.map(x=>x.id)).size!==3||
     !cases.requiredStaticFailures.every(x=>typeof x.source==='string'&&typeof x.diagnostic==='string'))
    throw Error('Static type rejection suite changed');
  return cases;
}
function programAtN(frozenSource,n,lang){
  const anchor=lang==='hc'?'print(fib(7));\n':'console.log(fib(7));\n';
  if(!frozenSource.endsWith(anchor)||frozenSource.indexOf(anchor)!==frozenSource.length-anchor.length)
    throw Error('Original Fibonacci source call marker changed');
  return frozenSource.slice(0,-anchor.length)+(lang==='hc'?'print':'console.log')+'(fib('+n+'));\n';
}
function programForMany(frozenSource,numbers,lang){
  const anchor=lang==='hc'?'print(fib(7));\n':'console.log(fib(7));\n';
  if(!frozenSource.endsWith(anchor))throw Error('Original program changed');
  return frozenSource.slice(0,-anchor.length)+numbers.map(n=>
    (lang==='hc'?'print':'console.log')+'(fib('+n+'));').join('\n')+'\n';
}

let cached=null;
export function verifyCanonical02(){
  const original=Object.fromEntries(Object.keys(FROZEN).map(key=>[key,locked(key)]));
  const cases=requireFrozenAcceptances(original);
  if(cached)return cached;
  if(Number(process.versions.node.split('.')[0])<22)
    throw Error('Node 22+ required for equivalent TypeScript source execution');

  const temp=mkdtempSync(join(tmpdir(),'hcode-canonical02-'));
  try {
    const generatedPath=join(temp,'fibonacci.mjs');
    const compiled=compile(join(root,original.hc.path),generatedPath);
    const wanted=cases.immutableExpectedAt7;
    if(runReference(original.hc.source)!==wanted ||
       requireSuccess(processRun(process.execPath,[generatedPath]),'Rust-generated fixed Fibonacci')!==wanted ||
       requireSuccess(processRun(process.execPath,['--experimental-strip-types',join(root,original.ts.path)]),
          'Original TypeScript Fibonacci')!==wanted)
      throw Error('Frozen acceptance at n=7 failed a runtime');

    const numbers=cases.fixedPositive.map(x=>x.n);
    const expected=cases.fixedPositive.map(x=>x.output).join('');
    const hcProgram=programForMany(original.hc.source,numbers,'hc');
    const tsProgram=programForMany(original.ts.source,numbers,'ts');
    const hcPath=join(temp,'multi.hc'),tsPath=join(temp,'multi.ts'),jsPath=join(temp,'multi.mjs');
    writeFileSync(hcPath,hcProgram);writeFileSync(tsPath,tsProgram);
    compile(hcPath,jsPath);
    if(runReference(hcProgram)!==expected ||
       requireSuccess(processRun(process.execPath,[jsPath]),'Compiled varying Fibonacci inputs')!==expected ||
       requireSuccess(processRun(process.execPath,['--experimental-strip-types',tsPath]),
          'TypeScript varying Fibonacci inputs')!==expected)
      throw Error('Fibonacci recursion and output parity failed across varied n');

    // Proof that H-Code compiler enforces the declared (n:Number)->Number,
    // rather than accepting dynamic implicit casts or a constant output.
    const hcPrefix=original.hc.source.slice(0,-'print(fib(7));\n'.length);
    for(const [i,bad] of cases.requiredStaticFailures.entries()){
      const wrong=bad.id==='wrong-function-return'?bad.source:hcPrefix+bad.source;
      const badInput=join(temp,'invalid-'+i+'.hc');
      writeFileSync(badInput,wrong);
      const failure=processRun('cargo',['run','--quiet','--manifest-path','compiler/Cargo.toml','--',
        'build',badInput,'--out',join(temp,'invalid-'+i+'.mjs')],{timeout:180000});
      if(failure.status===0||!failure.stderr.includes(bad.diagnostic))
        throw Error('Rust compiler failed to reject '+bad.id+' properly: '+failure.stderr.slice(0,500));
      let refRejected=false;
      try{runReference(wrong)}catch{refRejected=true}
      if(!refRejected)throw Error('JS reference accepted invalid typed Fibonacci source '+bad.id);
    }

    cached={
      workloadId:'02-fibonacci-recursion',
      kind:'full-compiler-evidence',
      acceptance:cases.acceptance,
      originalM10SourceUnchanged:true,
      compilerBackend:'Rust AST/typechecker -> generated JavaScript -> Node',
      referenceInterpreter:'H-Code JS',
      typescriptBaseline:'exact SHA-frozen M10 TypeScript recursion with explicit n:number and return number',
      fixedAcceptanceN:7,
      fixedAcceptanceOutput:wanted,
      variedInputsVerified:numbers,
      positiveCasesVerified:numbers.length,
      compilerStaticTypeFailuresVerified:cases.requiredStaticFailures.length,
      stdoutParityOnAllPositiveCases:true,
      compilerGeneratedExecutionVerified:true,
      tsStaticCompilationMeasured:false,
      hashLockedSources:Object.fromEntries(Object.entries(original).map(([key,x])=>[key,{path:x.path,gitBlobSha:x.blobSha}])),
      hcodeDeveloperAuthored:{unicodeCodepoints:original.hc.codepoints,utf8Bytes:original.hc.bytes},
      typescriptDeveloperAuthored:{unicodeCodepoints:original.ts.codepoints,utf8Bytes:original.ts.bytes},
      unicodeCodepointReductionPct:percent(original.hc.codepoints,original.ts.codepoints),
      utf8ByteReductionPct:percent(original.hc.bytes,original.ts.bytes),
      generatedJsNotAuthored:compiled,
      libraryDependencyBytesMeasured:false,
      compileTimeMeasured:false,
      runtimePerformanceMeasured:false,
      twentyTaskGlobalMedian:null,
      seventyPercentGlobalTargetVerified:false
    };
    return cached;
  } finally {rmSync(temp,{recursive:true,force:true});}
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))
  console.log(JSON.stringify(verifyCanonical02(),null,2));
