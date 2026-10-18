#!/usr/bin/env node
// Original canonical task 01: real Rust H-Code compiler->Node, independent JS CLI,
// and independently written TypeScript CLI. Original 20-task registry is immutable.
import {readFileSync,writeFileSync,mkdtempSync,rmSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {join,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const LOCKED=Object.freeze({
 registry:['compact/canonical20/workloads.json','46653ef90ffb3e420fba4ddfbfac3c4cfd57f3b3'],
 cases:['compact/canonical20/cases/01-calculator-cli.json','ec2a70c7108c5120bbffef22878290a885ecefb0'],
 hc:['compact/canonical20/programs/01-calculator-cli.hc','3acfbc0be6f7902db7aee5dd46ecf0a8eb07a5a6'],
 ts:['compact/canonical20/programs/01-calculator-cli.ts','6bb1ef9a47b77fa9429b560f66faf0e8ced64ca6']
});
const blob=b=>createHash('sha1').update('blob '+b.length+'\0').update(b).digest('hex');
const sha=b=>createHash('sha256').update(b).digest('hex');
const pct=(a,b)=>Number((100*(1-a/b)).toFixed(2));
function locked(key){
 const [path,expected]=LOCKED[key],bytes=readFileSync(join(root,path));
 if(blob(bytes)!==expected)throw Error('SHA-frozen original calculator source changed: '+path);
 return {path,blob:expected,text:bytes.toString('utf8'),
   unicodeCodepoints:[...bytes.toString('utf8')].length,utf8Bytes:bytes.length};
}
function run(bin,args,input=Buffer.alloc(0)){
 const p=spawnSync(bin,args,{cwd:root,input,encoding:'utf8',timeout:60000,
   windowsHide:true,maxBuffer:3*1024*1024});
 if(p.error)throw Error('Cannot launch '+bin+': '+p.error.message);
 return {status:p.status,stdout:(p.stdout??'').replace(/\r\n/g,'\n'),
   stderr:(p.stderr??'').replace(/\r\n/g,'\n')};
}
function assertOutcome(actual,expected,context){
 for(const key of ['status','stdout','stderr'])
  if(actual[key]!==expected[key])throw Error(context+' '+key+' expected='+
    JSON.stringify(expected[key])+' actual='+JSON.stringify(actual[key]?.slice?.(0,600)??actual[key]));
}
// Fresh inputs and independently calculated numeric results, not compiler outputs.
function variant(seed){
 let state=seed>>>0;
 const rand=()=>((state=(Math.imul(state,1664525)+1013904223)>>>0)>>>0);
 const atoms=['0','1','2','3','4','7','11','19','0.5','.25','1e2','3.75'];
 function make(depth){
   if(depth===3||rand()%5===0){
     const atom=atoms[rand()%atoms.length];
     if(rand()%4===0)return {src:'(-'+atom+')',n:-Number(atom)};
     return {src:atom,n:Number(atom)};
   }
   const a=make(depth+1),b=make(depth+1),op=['+','-','*','/'][rand()%4];
   if(op==='/'&&b.n===0)return {src:'('+a.src+'+1)',n:a.n+1};
   const n=op==='+'?a.n+b.n:op==='-'?a.n-b.n:op==='*'?a.n*b.n:a.n/b.n;
   if(!Number.isFinite(n))throw Error('Generator overflow');
   return {src:'('+a.src+op+b.src+')',n};
 }
 const v=make(0);
 return {input:v.src+'\n',expected:{status:0,stdout:String(v.n)+'\n',stderr:''}};
}
let cache;
export function verifyCanonical01(){
 const f=Object.fromEntries(Object.keys(LOCKED).map(k=>[k,locked(k)]));
 const registry=JSON.parse(f.registry.text),test=JSON.parse(f.cases.text),w=registry.workloads[0];
 const acceptance='stdin expressions for +,-,*,/ with invalid division; stable stdout/stderr and exit status';
 if(registry.workloads.length!==20||registry.objective.all20MustPass!==true||
    registry.objective.unsupportedsCountAsFailures!==true||
    w.id!=='01-calculator-cli'||w.acceptance!==acceptance||w.status!=='unsupported'||
    w.evidence!==null||!w.requiredCapabilities.includes('stdin')||
    !w.requiredCapabilities.includes('cli-io')||
    test.id!==w.id||test.acceptance!==w.acceptance||
    test.registryBlobSha!==f.registry.blob||
    test.positives.length!==17||test.negatives.length!==15||
    test.maxStdinUtf8Bytes!==65536||test.additionalOversizeBytes!==65537||
    f.hc.text!=='print(⩚⌨);\n')
   throw Error('Original task 01 was weakened or changed');
 if(cache)return cache;
 if(Number(process.versions.node.split('.')[0])<22)throw Error('Node 22 required');
 const dir=mkdtempSync(join(tmpdir(),'hcode-m1901-'));
 try{
   const js=join(dir,'task01.mjs');
   const compile=run('cargo',['run','--quiet','--manifest-path','compiler/Cargo.toml',
     '--','build',f.hc.path,'--out',js]);
   if(compile.status!==0)throw Error('Rust calculator compilation failed '+compile.stderr);
   const compiled=readFileSync(js);
   const methods=[
    ['real Rust compiled JS',input=>run(process.execPath,[js],input)],
    ['independent JS H-Code CLI',input=>run(process.execPath,
      ['prototype/bin/hcode.mjs','run',f.hc.path],input)],
    ['independent TypeScript CLI',input=>run(process.execPath,
      ['--experimental-strip-types',f.ts.path],input)]
   ];
   let fixed=0;
   for(const c of [...test.positives,...test.negatives]){
     const input=Buffer.from(c.input,'utf8');
     const expected={status:c.exitCode,stdout:c.stdout,stderr:c.stderr};
     for(const [name,method] of methods)assertOutcome(method(input),expected,name+' frozen '+c.id);
     fixed++;
   }
   for(let i=0;i<64;i++){
     const {input,expected}=variant(46001+i);
     for(const [name,method] of methods)
       assertOutcome(method(Buffer.from(input,'utf8')),expected,name+' unseen '+i);
   }
   const edge=[
    ['invalid binary UTF-8',Buffer.from(test.additionalInvalidUtf8BytesHex,'hex'),
      {status:2,stdout:'',stderr:'HCODE_ERROR: Invalid UTF-8\n'}],
    ['stdin >64 KiB',Buffer.alloc(test.additionalOversizeBytes,0x31),
      {status:2,stdout:'',stderr:'HCODE_ERROR: Arithmetic input exceeds 64 KiB\n'}]
   ];
   for(const [caseName,input,expected] of edge)
     for(const [name,method] of methods)
       assertOutcome(method(input),expected,name+' '+caseName);
   const cargoRun=input=>run('cargo',['run','--quiet','--manifest-path',
     'compiler/Cargo.toml','--','run',f.hc.path],input);
   for(const c of [test.positives[1],test.positives[2],test.negatives[0]])
     assertOutcome(cargoRun(Buffer.from(c.input,'utf8')),
       {status:c.exitCode,stdout:c.stdout,stderr:c.stderr},'real hcodec run '+c.id);
   const invalidTypes=['print(⩚42);','print(⩚⊤);','print(⌨+2);',
     'print(⩚⟦1⟧);','print(⩚⦃a:1⦄);'];
   for(let i=0;i<invalidTypes.length;i++){
     const path=join(dir,'type-error-'+i+'.hc');
     writeFileSync(path,invalidTypes[i]);
     const result=run('cargo',['run','--quiet','--manifest-path','compiler/Cargo.toml',
       '--','check',path]);
     if(result.status===0)throw Error('Rust accepted wrong type: '+invalidTypes[i]);
   }
   cache={
     workloadId:'01-calculator-cli',kind:'full-compiler-evidence',
     originalAcceptance:acceptance,registryUnmodified:true,
     positiveFrozenInputsVerified:17,negativeFrozenInputsVerified:15,
     previouslyUnseenGeneratedInputsVerified:64,invalidUtf8Rejected:true,
     oversizedStdinRejected:true,rustStaticWrongTypesRejected:5,
     actualCargoRunCliTested:true,engines:methods.map(x=>x[0]),
     sourceShaLocks:Object.fromEntries(Object.entries(f).map(([k,v])=>[k,{path:v.path,gitBlobSha:v.blob}])),
     hcodeDeveloperSource:{unicodeCodepoints:f.hc.unicodeCodepoints,utf8Bytes:f.hc.utf8Bytes},
     independentTypeScriptOracleSource:{unicodeCodepoints:f.ts.unicodeCodepoints,utf8Bytes:f.ts.utf8Bytes},
     rawOracleCodepointReductionPercent:pct(f.hc.unicodeCodepoints,f.ts.unicodeCodepoints),
     rawOracleUtf8ReductionPercent:pct(f.hc.utf8Bytes,f.ts.utf8Bytes),
     sourceRatioIsNotALibraryBackedTSBenchmark:true,
     generatedJSNotAuthored:{utf8Bytes:compiled.length,sha256:sha(compiled)},
     globalTwentyMedian:null,global70PercentObjectiveProven:false
   };
   return cache;
 }finally{rmSync(dir,{recursive:true,force:true});}
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))
 console.log(JSON.stringify(verifyCanonical01(),null,2));
