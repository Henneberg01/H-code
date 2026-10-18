#!/usr/bin/env node
// M19 immutable 20-workload task 03. A complete proof is SHA-locked across
// source, fixtures and preregistration, and runs Rust-generated JS + independent
// JS interpreter + idiomatic TypeScript against the original acceptance.
// No benchmark hardcoding in the language runtime or registry.
import {readFileSync,writeFileSync,mkdtempSync,rmSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {join,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {execute} from '../prototype/src/hcode.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
export const FROZEN=Object.freeze({
 registry:['compact/canonical20/workloads.json','46653ef90ffb3e420fba4ddfbfac3c4cfd57f3b3'],
 fixture:['compact/canonical20/cases/03-text-frequency-counter.json','448e77cb094d5c0ba9fb3c561de53e80407fc606'],
 hc:['compact/canonical20/programs/03-text-frequency-counter.hc','c8a54820def663c364ec39ee0989d1406d6370e2'],
 ts:['compact/canonical20/programs/03-text-frequency-counter.ts','cd42048825aa837104340bff6215441a0a97523f']
});
const gitBlob=bytes=>createHash('sha1').update('blob '+bytes.length+'\0').update(bytes).digest('hex');
const sha256=bytes=>createHash('sha256').update(bytes).digest('hex');
const pct=(a,b)=>Number(((1-a/b)*100).toFixed(2));
const utf8=s=>new TextEncoder().encode(s).length;
function locked(key){
 const [path,expected]=FROZEN[key],data=readFileSync(join(root,path));
 if(gitBlob(data)!==expected)throw Error('M19 task03 frozen source modified: '+path);
 const source=data.toString('utf8');
 return {path,sha:expected,source,unicodeCodepoints:[...source].length,utf8Bytes:data.length};
}
function invoke(bin,args,{cwd=root,timeout=30000}={}){
 const p=spawnSync(bin,args,{cwd,encoding:'utf8',timeout,windowsHide:true});
 if(p.error)throw Error('Unable to invoke '+bin+': '+p.error.message);
 return {...p,stdout:p.stdout.replace(/\r\n/g,'\n'),stderr:p.stderr.replace(/\r\n/g,'\n')};
}
function success(p,name){
 if(p.status!==0)throw Error(name+' exit '+p.status+': '+p.stderr.slice(0,1200));
 return p.stdout;
}
function reference(src){
 const out=[];execute(src,{stdout:value=>out.push(String(value)),maxSteps:200000});
 return out.join('\n')+'\n';
}
function compile(file,to){
 success(invoke('cargo',['run','--quiet','--manifest-path','compiler/Cargo.toml','--',
   'build',file,'--out',to],{timeout:180000}),'Rust H-Code compiler');
 const bytes=readFileSync(to);
 return {utf8Bytes:bytes.length,sha256:sha256(bytes)};
}
function scalarCompare(a,b){
 const x=Array.from(a),y=Array.from(b);
 for(let i=0;i<Math.min(x.length,y.length);i++){
   const d=x[i].codePointAt(0)-y[i].codePointAt(0);
   if(d)return d;
 }
 return x.length-y.length;
}
// Third independently written functional oracle; not imported from the H-Code
// reference/runtime and not part of either developer-authored benchmark source.
function expectedFrequency(input){
 const normalized=input.normalize('NFC').toLowerCase().normalize('NFC');
 const matches=normalized.match(/[\p{L}\p{N}][\p{L}\p{M}\p{N}\p{Pc}]*/gu)||[];
 const m=new Map();
 for(const word of matches)m.set(word,(m.get(word)||0)+1);
 return JSON.stringify([...m].sort((a,b)=>scalarCompare(a[0],b[0]))
   .map(([value,count])=>({count,value})));
}
function validatedContracts(frozen){
 const registry=JSON.parse(frozen.registry.source);
 const task=registry.workloads?.[2];
 if(registry.workloads.length!==20||task?.id!=='03-text-frequency-counter'||
    task.acceptance!=='normalize and count tokens; deterministic frequency ordering including Unicode cases'||
    !['strings','maps','unicode-text'].every(x=>task.requiredCapabilities.includes(x))||
    task.status!=='unsupported'||task.evidence!==null)
   throw Error('Original M19 canonical task 03 preregistration changed');
 const test=JSON.parse(frozen.fixture.source);
 if(test.id!==task.id||test.acceptance!==task.acceptance||
    test.historicCorpusGitBlobSha!==FROZEN.registry[1]||
    test.positives?.length!==10||test.negatives?.length!==6||
    new Set(test.positives.map(x=>x.id)).size!==10||
    new Set(test.negatives.map(x=>x.id)).size!==6)
   throw Error('Task03 acceptance/fixture contract was weakened');
 for(const c of test.positives){
   if(typeof c.input!=='string'||typeof c.expected!=='string'||
      c.expected!==expectedFrequency(c.input))
     throw Error('Incorrect independent task03 expected output: '+c.id);
 }
 for(const c of test.negatives)
   if(typeof c.source!=='string'||typeof c.diagnostic!=='string')
     throw Error('Invalid task03 negative type fixture');
 const fixedHC=test.positives.map(x=>'print(frequency('+JSON.stringify(x.input)+'));').join('\n')+'\n';
 const fixedTS=test.positives.map(x=>'console.log(frequency('+JSON.stringify(x.input)+'));').join('\n')+'\n';
 const hp=frozen.hc.source.slice(0,-fixedHC.length);
 const tp=frozen.ts.source.slice(0,-fixedTS.length);
 if(!hp.startsWith('ƒ frequency(s:String)→String ↩ ⤒(⧉(⟟s));\n')||
    hp+fixedHC!==frozen.hc.source||!tp.includes('function frequency(input:string):string')||
    tp+fixedTS!==frozen.ts.source)
   throw Error('Frozen full task03 sources no longer match the registered cases');
 return {test,hp,tp};
}
function variants(){
 // Deterministic test data with different Unicode scripts, Unicode case pairs,
 // punctuation and empty records. Not a substitution for the 10 frozen inputs.
 const vocab=['Hello','HELLO','café','CAFÉ','東京','世界','🦊','fox','İ','I','ı','σ','ς','Z','z',
   'a_b','123','٤٥٦','путь','ПУТЬ','Ø','ø','FÜß'];
 const separators=[' ','\t','-','!?','🦊','\n'];
 let seed=0x19397021;const rnd=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)>>>8);
 return Array.from({length:28},(_,i)=>{
   const count=i%7===0?0:(i*3)%17+1;
   const tokens=Array.from({length:count},(_,j)=>vocab[rnd()%vocab.length]);
   const s=tokens.map((word,n)=>word+(n+1<count?separators[rnd()%separators.length]:'')).join('');
   return {input:s,expected:expectedFrequency(s)};
 });
}
let cache=null;
export function verifyCanonical03(){
 // SHA validation is repeated even after the expensive execution was cached.
 const sources=Object.fromEntries(Object.keys(FROZEN).map(k=>[k,locked(k)]));
 const {test,hp,tp}=validatedContracts(sources);
 if(cache)return cache;
 if(Number(process.versions.node.split('.')[0])<22)throw Error('Node22+ required for TypeScript parity');
 const tmp=mkdtempSync(join(tmpdir(),'hcode-m19-unicode-03-'));
 try{
   const js=join(tmp,'frozen.mjs'),emitted=compile(join(root,sources.hc.path),js);
   const expected=test.positives.map(x=>x.expected).join('\n')+'\n';
   if(reference(sources.hc.source)!==expected||
      success(invoke(process.execPath,[js]),'Rust compiled task03')!==expected||
      success(invoke(process.execPath,['--experimental-strip-types',join(root,sources.ts.path)]),
        'Frozen TS task03')!==expected)
     throw Error('Fixed task03 failed independent H-Code Rust/JS/TS output parity');
   const varied=variants();
   const sourceHC=hp+varied.map(x=>'print(frequency('+JSON.stringify(x.input)+'));').join('\n')+'\n';
   const sourceTS=tp+varied.map(x=>'console.log(frequency('+JSON.stringify(x.input)+'));').join('\n')+'\n';
   const variedExpected=varied.map(x=>x.expected).join('\n')+'\n';
   const hcFile=join(tmp,'varied.hc'),tsFile=join(tmp,'varied.ts'),jsFile=join(tmp,'varied.mjs');
   writeFileSync(hcFile,sourceHC);writeFileSync(tsFile,sourceTS);compile(hcFile,jsFile);
   if(reference(sourceHC)!==variedExpected||
      success(invoke(process.execPath,[jsFile]),'Rust compiled 28 unseen Unicode cases')!==variedExpected||
      success(invoke(process.execPath,['--experimental-strip-types',tsFile]),'TS 28 unseen Unicode cases')!==variedExpected)
     throw Error('Unicode normalization/word tokenization was hardcoded or produced divergent output');
   // Reject wrong types at COMPILE time (not just by crashing generated JS).
   for(const [i,bad] of test.negatives.entries()){
     const file=join(tmp,'bad-'+i+'.hc'),out=join(tmp,'bad-'+i+'.mjs');
     writeFileSync(file,bad.source);
     const failure=invoke('cargo',['run','--quiet','--manifest-path','compiler/Cargo.toml','--',
       'build',file,'--out',out],{timeout:180000});
     if(failure.status===0||!failure.stderr.includes(bad.diagnostic))
       throw Error('Rust failed to reject wrong typed task03 '+bad.id+': '+failure.stderr.slice(0,900));
     let rejected=false;try{reference(bad.source)}catch{rejected=true}
     if(!rejected)throw Error('JS reference accepted invalid task03 type: '+bad.id);
   }
   // Universal scalar and histogram support cannot be implemented by only
   // recognizing the literal frequency benchmark source.
   const primitives=[
     ['print(⤒(⫶"a🙂字"));','["a","🙂","字"]\n'],
     ['print(⤒(⧉⟦3,-2,3,0⟧));','[{"count":1,"value":-2},{"count":1,"value":0},{"count":2,"value":3}]\n'],
     ['print(⤒(⧉⟦⊤,⊥,⊤⟧));','[{"count":1,"value":false},{"count":2,"value":true}]\n'],
     ['≔xs:⟦String⟧←⟦⟧;print(⤒(⧉xs));','[]\n'],
     ['print(⤒(⧉⟦"__proto__","constructor","__proto__"⟧));',
       '[{"count":2,"value":"__proto__"},{"count":1,"value":"constructor"}]\n']
   ];
   for(const [i,[src,wanted]] of primitives.entries()){
     const file=join(tmp,'primitive-'+i+'.hc'),js=join(tmp,'primitive-'+i+'.mjs');
     writeFileSync(file,src);compile(file,js);
     if(reference(src)!==wanted||success(invoke(process.execPath,[js]),'primitive '+i)!==wanted)
       throw Error('Generic Unicode/histogram semantics failed independent primitive '+i);
   }
   const long='a '.repeat(16385);
   const oversized=hp+'print(frequency('+JSON.stringify(long)+'));\n';
   const tooLarge=join(tmp,'over-items.hc'),tooLargeJS=join(tmp,'over-items.mjs');
   writeFileSync(tooLarge,oversized);compile(tooLarge,tooLargeJS);
   let refRejected=false;try{reference(oversized)}catch(err){
     refRejected=String(err).includes('Sequence allocation limit exceeded');
   }
   const runtimeFailure=invoke(process.execPath,[tooLargeJS]);
   if(!refRejected||runtimeFailure.status===0||!runtimeFailure.stderr.includes('Sequence allocation limit exceeded'))
     throw Error('Runtime allocation bound was bypassed by 16385 Unicode word tokens');
   cache={
     workloadId:'03-text-frequency-counter',kind:'full-compiler-evidence',
     acceptance:test.acceptance,normalization:'NFC+Unicode lowercase+NFC',
     tokenRule:test.tokenizer,sortOrder:'Unicode scalar ascending',
     outputCompatibleWithIndependentOracle:true,
     positiveFixturesVerified:test.positives.length,
     generatedUnicodeVariantsVerified:varied.length,
     staticTypeFailuresRejectedInRustAndReference:test.negatives.length,
     genericPrimitiveProgramsVerified:primitives.length,
     runtimeOversizedTokenSequenceRejected:true,
     originalPreregistrationUnchanged:true,
     threeEngines:'Rust H-Code compiler→JS Node, independent H-Code JS reference, idiomatic TS Node',
     sourceGitBlobShas:Object.fromEntries(Object.entries(sources).map(([k,v])=>[k,{file:v.path,sha:v.sha}])),
     hcodeDeveloperAuthored:{unicodeCodepoints:sources.hc.unicodeCodepoints,utf8Bytes:sources.hc.utf8Bytes},
     typescriptDeveloperAuthored:{unicodeCodepoints:sources.ts.unicodeCodepoints,utf8Bytes:sources.ts.utf8Bytes},
     codepointReductionPercent:pct(sources.hc.unicodeCodepoints,sources.ts.unicodeCodepoints),
     utf8ByteReductionPercent:pct(sources.hc.utf8Bytes,sources.ts.utf8Bytes),
     generatedJsNotAuthored:emitted,
     externalLibrarySizeMeasured:false,compilerTimeMeasured:false,runtimePerformanceMeasured:false,
     globalTwentyCodepointMedian:null,globalSeventyPercentVerified:false
   };
   return cache;
 }finally{rmSync(tmp,{recursive:true,force:true})}
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))
  console.log(JSON.stringify(verifyCanonical03(),null,2));
