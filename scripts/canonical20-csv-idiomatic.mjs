#!/usr/bin/env node
// M19 task04 fairer TypeScript baseline. The original 20-task registry,
// H-Code source, fixtures, and self-contained TS correctness oracle stay frozen.
// The additional authored baseline imports actual version/SRI-locked maintained
// csv-parse and Zod packages; installed dependency bytes are measured separately.
import {readFileSync,readdirSync,statSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {parseUsers,readUsers} from '../compact/canonical20/baselines/04-idiomatic-typescript/reader.ts';

const root=fileURLToPath(new URL('../',import.meta.url));
const base='compact/canonical20/baselines/04-idiomatic-typescript';
export const LOCKED=Object.freeze({
 registry:['compact/canonical20/workloads.json','46653ef90ffb3e420fba4ddfbfac3c4cfd57f3b3'],
 fixture:['compact/canonical20/cases/04-csv-validation.json','0a0381b403da2c5701767bf82912b10a58012535'],
 hcode:['compact/canonical20/programs/04-csv-validation.hc','ab7c4a8059244339318d31bd553dfebe463fab4f'],
 independentTSOracle:['compact/canonical20/programs/04-csv-validation.ts','27b3b2f2ecbca43d33341463096a1ceff79347c8'],
 package:[base+'/package.json','3148dce11c4bd23e35f17fdcc4fc3513c0bde3d3'],
 npmLock:[base+'/package-lock.json','f83bcbf150d070ae483398979af8750d365a9959'],
 reader:[base+'/reader.ts','c4e4ef98b7d289f6d96f1e74c0c242f568f33c18'],
 program:[base+'/program.ts','b0d8412b1f102707d905f06b546fc8c8dcd4b056']
});
const gitBlob=b=>createHash('sha1').update('blob '+b.length+'\0').update(b).digest('hex');
const pct=(a,b)=>Number(((1-a/b)*100).toFixed(2));
function locked(key){
 const [path,sha]=LOCKED[key],buf=readFileSync(join(root,path));
 if(gitBlob(buf)!==sha)throw Error('Source-frozen CSV baseline was changed: '+path);
 return {path,sha,utf8Bytes:buf.length,unicodeCodepoints:[...buf.toString('utf8')].length,
   content:buf.toString('utf8')};
}
function treeBytes(dir){
 let total=0,files=0;
 for(const e of readdirSync(dir,{withFileTypes:true})){
   const p=join(dir,e.name);
   if(e.isDirectory()){const v=treeBytes(p);total+=v.bytes;files+=v.files;}
   else if(e.isFile()){total+=statSync(p).size;files++;}
 }
 return {bytes:total,files};
}
function fixtureOracle(n){
 let state=n;
 const next=()=>((state=(Math.imul(state,1664525)+1013904223)>>>0)>>>0);
 const words=['Ada','林','"a quote"','x,y','🙂','Öresund','\nline'];
 const columns=['name','active','age','note'];
 const ordered=n%2===0?[...columns].reverse():columns;
 const lines=[ordered.join(',')],expected=[];
 const quote=s=>/[",\r\n]/.test(s)?'"'+s.replaceAll('"','""')+'"':s;
 for(let i=0;i<n%7;i++){
   const p={active:next()%2===0,age:next()%300-150,
     name:words[next()%words.length],note:words[next()%words.length]};
   expected.push(p);
   lines.push(ordered.map(col=>quote(String(p[col]))).join(','));
 }
 return {csv:lines.join(n%2?'\n':'\r\n')+'\n',expected:JSON.stringify(expected)};
}
export function verifyCsvIdiomatic(){
 const frozen=Object.fromEntries(Object.keys(LOCKED).map(k=>[k,locked(k)]));
 const fixture=JSON.parse(frozen.fixture.content);
 const registry=JSON.parse(frozen.registry.content);
 if(registry.workloads?.length!==20||
    registry.workloads[3].id!=='04-csv-validation'||
    registry.workloads[3].acceptance!==fixture.acceptance||
    fixture.positiveFiles?.length!==4||fixture.negativeFiles?.length!==6)
   throw Error('Original 20-task CSV acceptance or fixtures changed');
 const pkg=JSON.parse(frozen.package.content),lock=JSON.parse(frozen.npmLock.content);
 if(pkg.dependencies['csv-parse']!=='7.0.2'||pkg.dependencies.zod!=='4.6.5'||
    lock.lockfileVersion!==3||lock.packages[''].dependencies['csv-parse']!=='7.0.2'||
    lock.packages[''].dependencies.zod!=='4.6.5'||
    lock.packages['node_modules/csv-parse'].version!=='7.0.2'||
    lock.packages['node_modules/zod'].version!=='4.6.5'||
    lock.packages['node_modules/csv-parse'].integrity!==
      'sha512-uKZghv9UmPkMVLYy//KZ9HFAIJsl7wkhoEdIL0+rhuSY9pZQlhaeGEDPIe+/w7eh81MOql8Q/9+inAGWG6ZHYA=='||
    lock.packages['node_modules/zod'].integrity!==
      'sha512-v5l/aFXZQeai4awLbOpSoHecE9UiMrnfx75tEXLjNonXVARxQ5mOeipTjROUchszUNCqnE+hqAMujRsRHsut2Q==')
   throw Error('NPM dependency versions or signed tarball integrity drifted');
 for(const [name,version] of Object.entries(pkg.dependencies)){
   const installed=JSON.parse(readFileSync(join(root,base,'node_modules',name,'package.json'),'utf8'));
   if(installed.version!==version)throw Error('Incorrect installed dependency '+name);
 }
 const oldEnv=process.env.HCODE_ALLOW_FILE_READ;
 try {
   process.env.HCODE_ALLOW_FILE_READ='1';
   for(const x of fixture.positiveFiles){
     const bytes=readFileSync(join(root,'data',x.path));
     if(gitBlob(bytes)!==x.blobSha||bytes.length!==x.utf8Bytes)
       throw Error('Original CSV fixture changed: '+x.path);
     if(JSON.stringify(readUsers(x.path))!==x.expected)
       throw Error('Maintained TS library baseline output differs: '+x.id);
   }
   for(const x of fixture.negativeFiles){
     const bytes=readFileSync(join(root,'data',x.path));
     if(gitBlob(bytes)!==x.blobSha||bytes.length!==x.utf8Bytes)
       throw Error('Frozen malformed CSV fixture changed: '+x.path);
     let rejected=false;
     try{readUsers(x.path)}catch{rejected=true;}
     if(!rejected)throw Error('Maintained TS libraries incorrectly accepted malformed CSV '+x.id);
   }
   for(let i=0;i<40;i++){
     const {csv,expected}=fixtureOracle(i+71000);
     if(JSON.stringify(parseUsers(csv))!==expected)
       throw Error('Maintained TS csv-parse/Zod baseline differed on generated set '+i);
   }
   process.env.HCODE_ALLOW_FILE_READ='0';
   let denied=false;try{readUsers(fixture.positiveFiles[0].path)}catch{denied=true;}
   if(!denied)throw Error('Maintained TS baseline failed closed');
   process.env.HCODE_ALLOW_FILE_READ='1';
   for(const bad of ['../secret.csv','/etc/passwd','CON.txt']){
     let denied=false;try{readUsers(bad)}catch{denied=true;}
     if(!denied)throw Error('Maintained TypeScript baseline allowed unsafe path '+bad);
   }
   let tooLarge=false;
   try{parseUsers('a'.repeat(1048577))}catch{tooLarge=true}
   if(!tooLarge)throw Error('Maintained TS baseline allowed oversized CSV');
   const program=join(root,base,'program.ts');
   const child=spawnSync(process.execPath,['--experimental-strip-types',program],
     {cwd:root,env:{...process.env,HCODE_ALLOW_FILE_READ:'1'},timeout:40000,encoding:'utf8',windowsHide:true});
   if(child.error||child.status!==0)throw Error('Idiomatic TS command failed: '+(child.stderr||child.error?.message));
   const stdout=child.stdout.replace(/\r\n/g,'\n');
   if(stdout!==fixture.positiveFiles.map(x=>x.expected).join('\n')+'\n')
     throw Error('Idiomatic source entrypoint output does not match original full task 04');
 }finally {
   if(oldEnv===undefined)delete process.env.HCODE_ALLOW_FILE_READ;
   else process.env.HCODE_ALLOW_FILE_READ=oldEnv;
 }
 const tsPoints=frozen.reader.unicodeCodepoints+frozen.program.unicodeCodepoints;
 const tsBytes=frozen.reader.utf8Bytes+frozen.program.utf8Bytes;
 return {
  workloadId:'04-csv-validation',kind:'version-pinned-idiomatic-typescript-comparator',
  fullOriginalAcceptanceAndSourcePreserved:true,
  positiveOriginalFilesVerified:4,malformedOriginalFilesRejected:6,
  generatedDatasetsVerified:40,filePermissionAndUnsafePathRejected:true,
  libraryPackages:[
   {name:'csv-parse',version:'7.0.2',...treeBytes(join(root,base,'node_modules/csv-parse'))},
   {name:'zod',version:'4.6.5',...treeBytes(join(root,base,'node_modules/zod'))}
  ],
  hcodeDeveloperSource:{codepoints:frozen.hcode.unicodeCodepoints,utf8Bytes:frozen.hcode.utf8Bytes},
  idiomaticTypescriptDeveloperSource:{codepoints:tsPoints,utf8Bytes:tsBytes,files:['reader.ts','program.ts']},
  codepointReductionPercentVsIdiomaticTS:pct(frozen.hcode.unicodeCodepoints,tsPoints),
  utf8ReductionPercentVsIdiomaticTS:pct(frozen.hcode.utf8Bytes,tsBytes),
  packageManifestBytes:frozen.package.utf8Bytes,
  packageLockBytes:frozen.npmLock.utf8Bytes,
  comparisonScope:'all authored TS imports, path validation, typed CSV parse and 4 calls; dependencies counted separately',
  originalStandaloneTSOracleCountedInIdiomaticSource:false,
  packageLockIntegrityVerified:true,
  npmTarballBytesMeasured:false,typescriptTscStaticCheckMeasured:false,
  compilerTimeMeasured:false,runtimePerformanceMeasured:false,
  generalGlobalMedianCodepointReduction:null,global70PercentObjectiveProven:false
 };
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))
 console.log(JSON.stringify(verifyCsvIdiomatic(),null,2));
