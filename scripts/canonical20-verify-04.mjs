#!/usr/bin/env node
// Immutable task04 evidence: Rust H-Code generated JS + JS reference + TS oracle.
import {readFileSync,writeFileSync,mkdtempSync,rmSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
import {execute} from '../prototype/src/hcode.mjs';
import {readProjectText} from './canonical20-csv-host.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
export const FROZEN=Object.freeze({
 registry:['compact/canonical20/workloads.json','46653ef90ffb3e420fba4ddfbfac3c4cfd57f3b3'],
 cases:['compact/canonical20/cases/04-csv-validation.json','0a0381b403da2c5701767bf82912b10a58012535'],
 hc:['compact/canonical20/programs/04-csv-validation.hc','ab7c4a8059244339318d31bd553dfebe463fab4f'],
 ts:['compact/canonical20/programs/04-csv-validation.ts','27b3b2f2ecbca43d33341463096a1ceff79347c8']
});
const sha1=bytes=>createHash('sha1').update('blob '+bytes.length+'\0').update(bytes).digest('hex');
const sha256=bytes=>createHash('sha256').update(bytes).digest('hex');
const pct=(a,b)=>Number((100*(1-a/b)).toFixed(2));
function locked(key){
 const [path,sha]=FROZEN[key],bytes=readFileSync(join(root,path));
 if(sha1(bytes)!==sha)throw Error('Canonical 04 source changed: '+path);
 return {path,sha,source:bytes.toString('utf8'),
   unicodeCodepoints:[...bytes.toString('utf8')].length,utf8Bytes:bytes.length};
}
function run(bin,args,{env=process.env,timeout=180000}={}){
 const p=spawnSync(bin,args,{cwd:root,env,timeout,encoding:'utf8',windowsHide:true});
 if(p.error)throw Error('Unable to run '+bin+': '+p.error.message);
 return {...p,stdout:p.stdout.replace(/\r\n/g,'\n'),stderr:p.stderr.replace(/\r\n/g,'\n')};
}
function successful(p,name){
 if(p.status!==0)throw Error(name+' failed: '+p.stderr.slice(0,1500));
 return p.stdout;
}
function build(input,target){
 successful(run('cargo',['run','--quiet','--manifest-path','compiler/Cargo.toml',
   '--','build',input,'--out',target]),'Rust H-Code compiler');
 const bytes=readFileSync(target);
 return {utf8Bytes:bytes.length,sha256:sha256(bytes)};
}
function reference(source,allowed=true){
 const output=[];
 execute(source,{stdout:v=>output.push(String(v)),
   readFile:allowed?name=>readProjectText(name,{cwd:root,allowFileRead:true}):null});
 return output.join('\n')+'\n';
}
const definition='ƒ users(path:String)→String ↩ ⤒(⧇⦃active:Bool,age:Number,name:String,note:String⦄(⧄path));\n';
const calls=(paths,lang)=>paths.map(p=>lang==='hc'?
  'print(users('+JSON.stringify(p)+'));':
  'console.log(JSON.stringify(typedUsersFromFile('+JSON.stringify(p)+')));').join('\n')+'\n';
function fixedPolicy(sources){
 const registry=JSON.parse(sources.registry.source);
 const w=registry.workloads?.[3];
 if(registry.workloads.length!==20||w?.id!=='04-csv-validation'||
    w.acceptance!=='parse quoted CSV, reject malformed rows and validate column types deterministically'||
    w.status!=='unsupported'||w.evidence!==null||
    !['filesystem-read','csv-parser','records'].every(x=>w.requiredCapabilities.includes(x)))
   throw Error('Original 20-workload acceptance changed');
 const cases=JSON.parse(sources.cases.source);
 if(cases.id!==w.id||cases.acceptance!==w.acceptance||
   cases.originalTaskCount!==20||cases.canonicalRegistryGitBlobSha!==FROZEN.registry[1]||
   cases.positiveFiles.length!==4||cases.negativeFiles.length!==6||cases.sourceTypeFailures.length!==5)
   throw Error('CSV canonical fixture count/acceptance weakened');
 for(const x of [...cases.positiveFiles,...cases.negativeFiles]){
   if(!/^canonical04\/[a-z0-9-]+\.csv$/.test(x.path))
     throw Error('Unsafe frozen data manifest path');
   const data=readFileSync(join(root,'data',x.path));
   if(sha1(data)!==x.blobSha||data.length!==x.utf8Bytes)
     throw Error('CSV data SHA changed: '+x.path);
 }
 const paths=cases.positiveFiles.map(x=>x.path);
 if(sources.hc.source!==definition+calls(paths,'hc')||
    !sources.ts.source.endsWith(calls(paths,'ts'))||
    !sources.ts.source.includes('function csvFields(')||
    !sources.ts.source.includes('export function typedUsersFromFile('))
   throw Error('Authored source no longer contains full frozen workload');
 return cases;
}
function csvVariant(seed){
 let state=seed;
 const rng=()=>((state=(Math.imul(state,1664525)+1013904223)>>>0)>>>0);
 const words=['Ada','林','"a quote"','x,y','🙂','Öresund','\nline'];
 const columns=['name','active','age','note'];
 const ordered=seed%2===0?[...columns].reverse():columns;
 const csv=[ordered.join(',')],objects=[];
 const quote=s=>/[",\r\n]/.test(s)?'"'+s.replaceAll('"','""')+'"':s;
 const count=seed%7;
 for(let i=0;i<count;i++){
   const user={active:rng()%2===0,age:rng()%300-150,name:words[rng()%words.length],note:words[rng()%words.length]};
   objects.push({active:user.active,age:user.age,name:user.name,note:user.note});
   csv.push(ordered.map(x=>quote(String(user[x]))).join(','));
 }
 return {data:csv.join(seed%2?'\n':'\r\n')+'\n',expected:JSON.stringify(objects)};
}
let cached=null;
export function verifyCanonical04(){
 const sources=Object.fromEntries(Object.keys(FROZEN).map(k=>[k,locked(k)]));
 const fixture=fixedPolicy(sources);
 if(cached)return cached;
 if(Number(process.versions.node.split('.')[0])<22)throw Error('Node 22 required');
 const yes={...process.env,HCODE_ALLOW_FILE_READ:'1'};
 const tmp=mkdtempSync(join(tmpdir(),'hcode-csv04-'));
 const generated=[];
 try {
   const main=join(tmp,'main.mjs');
   const emitted=build(join(root,sources.hc.path),main);
   const expected=fixture.positiveFiles.map(x=>x.expected).join('\n')+'\n';
   if(reference(sources.hc.source)!==expected||
      successful(run(process.execPath,[main],{env:yes}),'Rust-generated CSV 4 fixed')!==expected||
      successful(run(process.execPath,['--experimental-strip-types',join(root,sources.ts.path)]),
        'independent TS 4 fixed')!==expected)
     throw Error('Canonical 04 fixed output differs across Rust/JS/TS');
   const fixedTSCalls=calls(fixture.positiveFiles.map(x=>x.path),'ts');
   const tsPrefix=sources.ts.source.slice(0,-fixedTSCalls.length);
   const variantNames=[],wanted=[];
   for(let n=0;n<40;n++){
     const p='canonical04/generated-'+n+'.csv',v=csvVariant(n+71000);
     writeFileSync(join(root,'data',p),v.data);
     generated.push(p);variantNames.push(p);wanted.push(v.expected);
   }
   const hcCode=definition+calls(variantNames,'hc'),tsCode=tsPrefix+calls(variantNames,'ts');
   const h=join(tmp,'varied.hc'),t=join(tmp,'varied.ts'),j=join(tmp,'varied.mjs');
   writeFileSync(h,hcCode);writeFileSync(t,tsCode);build(h,j);
   const expectedVariants=wanted.join('\n')+'\n';
   if(reference(hcCode)!==expectedVariants||
      successful(run(process.execPath,[j],{env:yes}),'Rust 40 CSV varieties')!==expectedVariants||
      successful(run(process.execPath,['--experimental-strip-types',t]),'TS 40 CSV varieties')!==expectedVariants)
      throw Error('General CSV parser data dependence/parity failed');
   for(const bad of fixture.negativeFiles){
      const hc=definition+calls([bad.path],'hc');
      const ts=tsPrefix+calls([bad.path],'ts');
      const h=join(tmp,bad.id+'.hc'),t=join(tmp,bad.id+'.ts'),j=join(tmp,bad.id+'.mjs');
      writeFileSync(h,hc);writeFileSync(t,ts);build(h,j);
      let err=false;try{reference(hc)}catch{err=true}
      if(!err||run(process.execPath,[j],{env:yes}).status===0||
         run(process.execPath,['--experimental-strip-types',t]).status===0)
        throw Error('Invalid CSV was accepted: '+bad.id);
   }
   for(const [index,bad] of fixture.sourceTypeFailures.entries()){
     const file=join(tmp,'wrong-type-'+index+'.hc'),out=join(tmp,'wrong-type-'+index+'.mjs');
     writeFileSync(file,bad.source);
     if(run('cargo',['run','--quiet','--manifest-path','compiler/Cargo.toml','--',
       'build',file,'--out',out]).status===0)
       throw Error('Rust accepted incorrect CSV type: '+bad.id);
     let rejected=false;try{reference(bad.source)}catch{rejected=true}
     if(!rejected)throw Error('H-Code JS accepted incorrect CSV type: '+bad.id);
   }
   let denied=false;try{reference(sources.hc.source,false)}catch{denied=true}
   if(!denied||run(process.execPath,[main],{env:{...process.env,HCODE_ALLOW_FILE_READ:'0'}}).status===0)
      throw Error('Unapproved file read was not denied');
   for(const unsafe of ['../secret.csv','/etc/passwd','CON.txt']){
     const hc=definition+calls([unsafe],'hc'),path=join(tmp,'unsafe.hc'),js=join(tmp,'unsafe.mjs');
     writeFileSync(path,hc);build(path,js);
     let blocked=false;try{reference(hc)}catch{blocked=true}
     if(!blocked||run(process.execPath,[js],{env:yes}).status===0)
       throw Error('Unsafe file traversal path was not blocked: '+unsafe);
   }
   cached={
     workloadId:'04-csv-validation',kind:'full-compiler-evidence',
     originalAcceptance:fixture.acceptance,originalRegistryUntouched:true,
     fixedFilesVerified:4,generatedCSVFilesAndExpectedOutputsVerified:40,
     malformedFilesRejectedByThreeEngines:6,invalidTypesRejectedByRustAndReference:5,
     fileReadCapabilityFailClosed:true,pathTraversalRejected:true,
     threeEngines:'Rust H-Code compiler→Node JS, independent H-Code JS interpreter, standalone TS Node',
     sourceShaLocks:Object.fromEntries(Object.entries(sources).map(([k,v])=>[k,{path:v.path,sha:v.sha}])),
     hcodeDeveloperAuthored:{unicodeCodepoints:sources.hc.unicodeCodepoints,utf8Bytes:sources.hc.utf8Bytes},
     typescriptDeveloperAuthored:{unicodeCodepoints:sources.ts.unicodeCodepoints,utf8Bytes:sources.ts.utf8Bytes},
     referenceSourceComparisonNotFairLibraryBenchmark:true,
     rawReferenceCodepointReductionPct:pct(sources.hc.unicodeCodepoints,sources.ts.unicodeCodepoints),
     rawReferenceUtf8ReductionPct:pct(sources.hc.utf8Bytes,sources.ts.utf8Bytes),
     generatedJsNotAuthored:emitted,
     bundledDataFixtureBytes:fixture.positiveFiles.reduce((n,x)=>n+x.utf8Bytes,0),
     idiomaticExternalLibraryBaselineVerified:false,dependencySizeMeasured:false,
     compilerTimeMeasured:false,runtimePerformanceMeasured:false,
     globalTwentyMedian:null,global70PercentVerified:false
   };
   return cached;
 }finally{
   for(const p of generated)rmSync(join(root,'data',p),{force:true});
   rmSync(tmp,{recursive:true,force:true});
 }
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))
 console.log(JSON.stringify(verifyCanonical04(),null,2));
