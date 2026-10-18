#!/usr/bin/env node
// M19 canonical workload 05 — full compiler-backed proof; original 20-task
// preregistration is never modified. No app macro or unverified JS-only shortcut.
import {readFileSync,writeFileSync,mkdtempSync,rmSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {join,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {spawnSync} from 'node:child_process';
import {execute} from '../prototype/src/hcode.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
export const SOURCES=Object.freeze({
  registry:'46653ef90ffb3e420fba4ddfbfac3c4cfd57f3b3',
  cases:'6e151dd70cbb16b160349688be8f86aad06c54ee',
  hc:'9e98f97129e6c40c41ba4635f63fe9af26275f19',
  ts:'f01524c5559aa4606348ef166a4ff7ad5b5ed46b'
});
const paths=Object.freeze({
  registry:'compact/canonical20/workloads.json',
  cases:'compact/canonical20/cases/05-json-transformation.json',
  hc:'compact/canonical20/programs/05-json-transformation.hc',
  ts:'compact/canonical20/programs/05-json-transformation.ts'
});
const marker='/* CANONICAL05_CALLS */';
const gitBlob=bytes=>createHash('sha1').update('blob '+bytes.length+'\0').update(bytes).digest('hex');
const sha256=bytes=>createHash('sha256').update(bytes).digest('hex');
function readLocked(key) {
  const bytes=readFileSync(join(root,paths[key]));
  if(gitBlob(bytes)!==SOURCES[key])throw Error('Canonical workload 05 SHA lock failed: '+paths[key]);
  return {source:bytes.toString('utf8'),bytes:bytes.length,points:[...bytes.toString('utf8')].length};
}
function invoke(command,args,{cwd=root,timeout=30000}={}) {
  const p=spawnSync(command,args,{cwd,timeout,encoding:'utf8',windowsHide:true});
  if(p.error)throw Error('Cannot invoke '+command+': '+p.error.message);
  return {...p,stdout:p.stdout.replace(/\r\n/g,'\n'),stderr:p.stderr.replace(/\r\n/g,'\n')};
}
function requireSuccess(result,tag) {
  if(result.status!==0)throw Error(tag+' failed (exit '+result.status+'): '+result.stderr.slice(0,1000));
  return result.stdout;
}
function reference(src) {
  const out=[];
  execute(src,{stdout:value=>out.push(String(value))});
  return out.join('\n')+'\n';
}
function spliceProgram(source,inputs,lang) {
  const at=source.indexOf(marker);
  if(at<0||source.indexOf(marker,at+1)!==-1)throw Error('Missing or repeated fixed workload call marker');
  const prefix=source.slice(0,at+marker.length);
  const calls=inputs.map(raw=>lang==='hc'?'print(transform('+JSON.stringify(raw)+'));':
    'console.log(transform('+JSON.stringify(raw)+'));').join('\n');
  return prefix+'\n'+calls+'\n';
}
function fixedCallsExist(hc,ts,positives) {
  const calls=positives.map(x=>x.input);
  if(spliceProgram(hc,calls,'hc')!==hc||spliceProgram(ts,calls,'ts')!==ts)
    throw Error('Frozen workload source does not match the pinned positive inputs');
}
function compile(sourcePath,outputPath) {
  const p=invoke('cargo',['run','--quiet','--manifest-path','compiler/Cargo.toml',
    '--','build',sourcePath,'--out',outputPath],{timeout:180000});
  requireSuccess(p,'Rust compiler');
  const bytes=readFileSync(outputPath);
  return {utf8Bytes:bytes.length,sha256:sha256(bytes)};
}
function validateExpected(cases) {
  if(cases.id!=='05-json-transformation'||
     cases.acceptance!=='deserialize structured input, transform nested typed fields, serialize valid JSON')
    throw Error('Workload acceptance was redefined');
  const pos=cases.tests?.positive,neg=cases.tests?.negative;
  if(!Array.isArray(pos)||pos.length!==3||!Array.isArray(neg)||neg.length!==11)
    throw Error('Canonical-05 positive/negative fixture count weakened');
  const unique=new Set([...pos,...neg].map(x=>x.id));
  if(unique.size!==pos.length+neg.length)throw Error('Duplicate fixture IDs');
  for(const x of pos) {
    if(typeof x.input!=='string'||typeof x.expected!=='string')
      throw Error('Malformed positive test fixture');
    const expected=JSON.parse(x.expected);
    if(!expected||!Array.isArray(expected.events)||!expected.user||typeof expected.user.score!=='number')
      throw Error('The locked expected output must be structured transformed JSON');
  }
  for(const x of neg)if(typeof x.input!=='string')throw Error('Malformed negative fixture');
  return {pos,neg};
}
const percent=(a,b)=>Number(((1-a/b)*100).toFixed(2));
let cached=null;

// This routine actually runs Rust->JS, the independent JS interpreter,
// and the TS fixture; no mere "verified" label can pass.
export function verifyCanonical05() {
  // Always validate the original registry and three source SHA locks;
  // memoization skips only repeated expensive process execution.
  const locked=Object.fromEntries(Object.keys(paths).map(k=>[k,readLocked(k)]));
  const registry=JSON.parse(locked.registry.source);
  if(registry.workloads.length!==20||registry.workloads[4]?.id!=='05-json-transformation')
    throw Error('Canonical twenty inventory was replaced');
  const cases=JSON.parse(locked.cases.source);
  const {pos,neg}=validateExpected(cases);
  if(registry.workloads[4].acceptance!==cases.acceptance||
     !registry.workloads[4].requiredCapabilities.includes('records')||
     !registry.workloads[4].requiredCapabilities.includes('json-io'))
    throw Error('Workload 05 original capability requirements no longer match');
  const hc=locked.hc,ts=locked.ts;
  fixedCallsExist(hc.source,ts.source,pos);
  if(cached)return cached;
  if(Number(process.versions.node.split('.')[0])<22)throw Error('Node 22+ required for TypeScript');

  const sandbox=mkdtempSync(join(tmpdir(),'hcode-canonical05-'));
  try{
    const frozenEmitted=join(sandbox,'frozen-generated.mjs');
    const generated=compile(join(root,paths.hc),frozenEmitted);
    const expected=pos.map(x=>x.expected).join('\n')+'\n';
    const interpreted=reference(hc.source);
    const compiled=requireSuccess(invoke(process.execPath,[frozenEmitted]),'Rust-generated positive H-Code');
    const baseline=requireSuccess(invoke(process.execPath,['--experimental-strip-types',join(root,paths.ts)]),'TypeScript baseline');
    if(expected!==interpreted||expected!==compiled||expected!==baseline)
      throw Error('Positive workload parity failed: expected '+JSON.stringify(expected)+
        ' / interpreter '+JSON.stringify(interpreted)+' / compiled '+JSON.stringify(compiled)+
        ' / TS '+JSON.stringify(baseline));
    // Several new deterministic, previously unlisted inputs ensure the functions
    // actually transform arbitrary nested typed records, not hardcoded outputs.
    const variants=Array.from({length:12},(_,i)=>{
      const user={name:['Ada','Zoë','李','Ren'][i%4],score:i-6,active:i%2===0};
      const events=Array.from({length:i%4},(_,n)=>({id:'E'+i+'-'+n,value:n-i}));
      const raw=JSON.stringify({user,events});
      const result=JSON.stringify({events,user:{active:!user.active,name:user.name,score:user.score+3}});
      return {raw,result};
    });
    const variantExpected=variants.map(x=>x.result).join('\n')+'\n';
    const programHc=spliceProgram(hc.source,variants.map(x=>x.raw),'hc');
    const programTs=spliceProgram(ts.source,variants.map(x=>x.raw),'ts');
    const varHc=join(sandbox,'variants.hc'),varTs=join(sandbox,'variants.ts'),varJs=join(sandbox,'variants.mjs');
    writeFileSync(varHc,programHc);writeFileSync(varTs,programTs);
    compile(varHc,varJs);
    if(reference(programHc)!==variantExpected||
       requireSuccess(invoke(process.execPath,[varJs]),'compiled generated variants')!==variantExpected||
       requireSuccess(invoke(process.execPath,['--experimental-strip-types',varTs]),'TypeScript variants')!==variantExpected)
      throw Error('Generated non-frozen inputs exposed a hardcoded JSON transformation');

    for(const [i,test] of neg.entries()){
      const programHc=spliceProgram(hc.source,[test.input],'hc');
      const programTs=spliceProgram(ts.source,[test.input],'ts');
      let rejected=false;
      try{reference(programHc)}catch{rejected=true}
      if(!rejected)throw Error('JS reference wrongly accepted invalid JSON case '+test.id);
      const hcFile=join(sandbox,'invalid-'+i+'.hc');
      const tsFile=join(sandbox,'invalid-'+i+'.ts');
      const emitted=join(sandbox,'invalid-'+i+'.mjs');
      writeFileSync(hcFile,programHc);writeFileSync(tsFile,programTs);
      compile(hcFile,emitted); // Must compile: bad input must fail at runtime, not syntax stage.
      if(invoke(process.execPath,[emitted]).status===0)
        throw Error('Rust-generated runtime wrongly accepted '+test.id);
      if(invoke(process.execPath,['--experimental-strip-types',tsFile]).status===0)
        throw Error('TypeScript runtime wrongly accepted '+test.id);
    }
    cached={
      workloadId:'05-json-transformation',
      acceptance:cases.acceptance,
      kind:'full-compiler-evidence',
      compilerBackend:'Rust H-Code AST/typecheck/JS ESM',
      referenceInterpreter:'independent H-Code JS reference',
      typescriptBaseline:'idiomatic TypeScript with matching recursive runtime validation and no external library',
      shaFrozen:paths,
      gitBlobShas:SOURCES,
      positiveFixturesVerified:pos.length,
      generatedVariantsVerified:variants.length,
      invalidFixturesRejectedByAll:neg.length,
      stdoutParityOnEveryValidCase:true,
      compilerGeneratedExecutionVerified:true,
      runtimeMalformedInputRejectionVerified:true,
      hcodeDeveloperAuthored:{unicodeCodepoints:hc.points,utf8Bytes:hc.bytes},
      typescriptDeveloperAuthored:{unicodeCodepoints:ts.points,utf8Bytes:ts.bytes},
      codepointReductionPercent:percent(hc.points,ts.points),
      utf8ByteReductionPercent:percent(hc.bytes,ts.bytes),
      generatedJsNotAuthored:generated,
      dependencyBytesMeasured:false,
      compilerTimeMeasured:false,
      runtimePerformanceMeasured:false,
      twentyTaskGlobalMedian:null,
      allTwentyVerified:false
    };
    return cached;
  }finally{rmSync(sandbox,{recursive:true,force:true})}
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))
  console.log(JSON.stringify(verifyCanonical05(),null,2));
