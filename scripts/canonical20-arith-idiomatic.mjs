#!/usr/bin/env node
// An independent maintained-library TypeScript source comparator for the
// original SHA-frozen H-Code task 01. Not a substitute for Rust/JS/TS oracle.
// Run after npm ci --prefix compact/canonical20/baselines/01-idiomatic-typescript
import {readFileSync,readdirSync,statSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=fileURLToPath(new URL('../',import.meta.url));
const folder='compact/canonical20/baselines/01-idiomatic-typescript';
const fixed={
 registry:['compact/canonical20/workloads.json','46653ef90ffb3e420fba4ddfbfac3c4cfd57f3b3'],
 cases:['compact/canonical20/cases/01-calculator-cli.json','ec2a70c7108c5120bbffef22878290a885ecefb0'],
 hc:['compact/canonical20/programs/01-calculator-cli.hc','3acfbc0be6f7902db7aee5dd46ecf0a8eb07a5a6'],
 originalTS:['compact/canonical20/programs/01-calculator-cli.ts','6bb1ef9a47b77fa9429b560f66faf0e8ced64ca6'],
 pkg:[folder+'/package.json','1f18d3c72aa7f5c30b0aaa7fdebe941f814729ef'],
 npmLock:[folder+'/package-lock.json','cf3d71a3eb58ffb60ae4d525624219a0598166ad'],
 ts:[folder+'/program.ts','175320b2f535acdbf4ced0b6dfe928b0351f627c']
};
const blob=b=>createHash('sha1').update('blob '+b.length+'\0').update(b).digest('hex');
const pct=(a,b)=>Number(((1-a/b)*100).toFixed(2));
function locked([path,sha]){
 const bytes=readFileSync(join(root,path));
 if(blob(bytes)!==sha)throw Error('Arithmetic source SHA drift: '+path);
 return {path,sha,codepoints:[...bytes.toString('utf8')].length,bytes:bytes.length,content:bytes.toString('utf8')};
}
function inputRun(bytes){
 const file=join(root,folder,'program.ts');
 const p=spawnSync(process.execPath,['--experimental-strip-types',file],
   {cwd:root,input:bytes,encoding:'utf8',windowsHide:true,timeout:20000,maxBuffer:2*1024*1024});
 if(p.error)throw Error('TypeScript expression-library CLI spawn failed: '+p.error.message);
 return {status:p.status,stdout:(p.stdout||'').replace(/\r\n/g,'\n'),
   stderr:(p.stderr||'').replace(/\r\n/g,'\n')};
}
function assertResult(got,expected,context){
 for(const key of ['status','stdout','stderr'])
   if(got[key]!==expected[key])
     throw Error(context+' '+key+' expected '+JSON.stringify(expected[key])+' got '+JSON.stringify(got[key]));
}
function generate(seed){
 let state=seed>>>0;
 const rng=()=>((state=(Math.imul(state,1664525)+1013904223)>>>0)>>>0);
 const atoms=['0','1','2','3','4','7','11','19','0.5','.25','1e2','3.75'];
 function expr(depth){
   if(depth===3||rng()%5===0){
     const atom=atoms[rng()%atoms.length];
     if(rng()%4===0)return {source:'(-'+atom+')',value:-Number(atom)};
     return {source:atom,value:Number(atom)};
   }
   const a=expr(depth+1),b=expr(depth+1),op=['+','-','*','/'][rng()%4];
   if(op==='/'&&b.value===0)return {source:'('+a.source+'+1)',value:a.value+1};
   const value=op==='+'?a.value+b.value:op==='-'?a.value-b.value:op==='*'?a.value*b.value:a.value/b.value;
   if(!Number.isFinite(value))throw Error('Independent arithmetic fixture overflow');
   return {source:'('+a.source+op+b.source+')',value};
 }
 const out=expr(0);
 return {input:out.source+'\n',expected:{status:0,stdout:String(out.value)+'\n',stderr:''}};
}
function bytesIn(dir){
 let size=0,n=0;
 for(const entry of readdirSync(dir,{withFileTypes:true})){
   const p=join(dir,entry.name);
   if(entry.isDirectory()){const x=bytesIn(p);size+=x.bytes;n+=x.files;}
   else if(entry.isFile()){size+=statSync(p).size;n++;}
 }
 return {bytes:size,files:n};
}
export function verifyIdiomaticCalculator(){
 const src=Object.fromEntries(Object.entries(fixed).map(([k,v])=>[k,locked(v)]));
 const registry=JSON.parse(src.registry.content),fixtures=JSON.parse(src.cases.content);
 if(registry.workloads.length!==20||registry.workloads[0].id!=='01-calculator-cli'||
    registry.workloads[0].acceptance!=='stdin expressions for +,-,*,/ with invalid division; stable stdout/stderr and exit status'||
    fixtures.id!=='01-calculator-cli'||fixtures.positives.length!==17||fixtures.negatives.length!==15||
    fixtures.registryBlobSha!==src.registry.sha||src.hc.content!=='print(⩚⌨);\n')
   throw Error('Unchanged original task 01 acceptance and source required');
 const pkg=JSON.parse(src.pkg.content);
 if(pkg.dependencies?.['@expr-eval/js']!=='3.7.0')throw Error('Maintained math library version changed');
 const lock=JSON.parse(src.npmLock.content);
 if(lock.lockfileVersion!==3||lock.packages[''].dependencies['@expr-eval/js']!=='3.7.0'||
    lock.packages['node_modules/@expr-eval/js']?.version!=='3.7.0'||
    lock.packages['node_modules/@expr-eval/js'].integrity!==
      'sha512-bt6N4klnRt6sfhVSI1TyM5fO0l9xIV5ofXpuk2a/GlpgyHZkkUiUSYNMf3FURABCWPbehlHWzvqX35teSgA1TA=='||
    !lock.packages['node_modules/@expr-eval/js'].resolved.startsWith('https://registry.npmjs.org/'))
   throw Error('NPM package-lock lacks exact version, registry and tarball SHA512');
 const installed=JSON.parse(readFileSync(join(root,folder,'node_modules/@expr-eval/js/package.json'),'utf8'));
 if(installed.version!=='3.7.0')throw Error('Installed calculator parser version not exact');
 for(const c of [...fixtures.positives,...fixtures.negatives])
   assertResult(inputRun(Buffer.from(c.input,'utf8')),
     {status:c.exitCode,stdout:c.stdout,stderr:c.stderr},'Frozen '+c.id);
 for(let i=0;i<64;i++){
   const {input,expected}=generate(46001+i);
   assertResult(inputRun(Buffer.from(input,'utf8')),expected,'Generated '+i);
 }
 assertResult(inputRun(Buffer.from(fixtures.additionalInvalidUtf8BytesHex,'hex')),
   {status:2,stdout:'',stderr:'HCODE_ERROR: Invalid UTF-8\n'},'Invalid UTF8');
 assertResult(inputRun(Buffer.alloc(fixtures.additionalOversizeBytes,0x31)),
   {status:2,stdout:'',stderr:'HCODE_ERROR: Arithmetic input exceeds 64 KiB\n'},'Oversize stdin');
 const attacks=['2^3','1%2','process.exit()','constructor','2(3)','[1]','PI','1;2','1/0','1/(2-2)'];
 for(const [i,attack] of attacks.entries()){
   const out=inputRun(Buffer.from(attack,'utf8'));
   if(out.status!==2||out.stdout!==''||!out.stderr.startsWith('HCODE_ERROR: '))
     throw Error('Parser permitted unregistered syntax '+i+': '+attack);
 }
 const lib=bytesIn(join(root,folder,'node_modules/@expr-eval/js'));
 return {
  workloadId:'01-calculator-cli',kind:'maintained-idiomatic-typescript-library-comparator',
  originalPreregistrationShaUnchanged:true,originalFrozenInputs:32,
  additionalUnseenValidInputSets:64,invalidUtf8Rejected:true,oversizedStdinRejected:true,
  unsafeNonArithmeticSyntaxRejected:true,
  dependency:{name:'@expr-eval/js',version:'3.7.0',installedBytes:lib.bytes,files:lib.files,
    integrity:lock.packages['node_modules/@expr-eval/js'].integrity},
  hcodeAuthoredSource:{unicodeCodepoints:src.hc.codepoints,utf8Bytes:src.hc.bytes},
  idiomaticTypeScriptAuthoredSource:{unicodeCodepoints:src.ts.codepoints,utf8Bytes:src.ts.bytes},
  unicodeCodepointReductionPct:pct(src.hc.codepoints,src.ts.codepoints),
  utf8ByteReductionPct:pct(src.hc.bytes,src.ts.bytes),
  standaloneHandwrittenTSOracleIsNotBaseline:true,
  packageManifestBytes:src.pkg.bytes,packageLockBytes:src.npmLock.bytes,
  libraryFootprintSeparateFromAuthoredSource:true,
  standaloneTscStrictCheckMeasured:false,compilerPerformanceMeasured:false,
  runtimePerformanceMeasured:false,globalTwentyMedian:null,global70PercentProven:false
 };
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))
  console.log(JSON.stringify(verifyIdiomaticCalculator(),null,2));
