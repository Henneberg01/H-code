#!/usr/bin/env node
// M12 source-size *microcases*: two fixed pairs, NOT twenty-workload M19 proof.
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {join,resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
import {execute} from '../prototype/src/hcode.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
const cases=Object.freeze([
  {id:'nested-record-read', expected:'Ada\n51\n',
    hc:{path:'compact/benchmarks/m12/records.hc',sha:'7fe1a8ec27ed3187f20e9495548b726e9a5c0200'},
    ts:{path:'compact/benchmarks/m12/records.ts',sha:'feec513f574ab84a3017f71881217de57bb33df1'}},
  {id:'immutable-record-update', expected:'42\n43\nAda\n',
    hc:{path:'compact/benchmarks/m12/update.hc',sha:'cbf2cf6b5c34d860992ad69a323795a937a14231'},
    ts:{path:'compact/benchmarks/m12/update.ts',sha:'00e48a2dfad24dac7a18578c9e1beb1784f60b66'}}
]);
const gitBlob=bytes=>createHash('sha1').update('blob '+bytes.length+'\0').update(bytes).digest('hex');
const percent=(a,b)=>Number(((1-a/b)*100).toFixed(2));
function frozen(spec){
 const bytes=readFileSync(join(root,spec.path));
 if(gitBlob(bytes)!==spec.sha)throw Error('Frozen M12 fixture edited: '+spec.path);
 return {source:bytes.toString('utf8'),bytes:bytes.length,codepoints:[...bytes.toString('utf8')].length,
   file:spec.path,gitBlobSha:spec.sha};
}
export function compareM12(){
 if(Number(process.versions.node.split('.')[0])<22)throw Error('Node 22+ required for TypeScript parity');
 const results=[];
 for(const item of cases){
   const hc=frozen(item.hc),ts=frozen(item.ts);
   const stdout=[];
   execute(hc.source,{stdout:v=>stdout.push(String(v))});
   if(stdout.join('\n')+'\n'!==item.expected)throw Error('H-Code execution mismatch: '+item.id);
   const run=spawnSync(process.execPath,['--experimental-strip-types',join(root,item.ts.path)],
     {cwd:root,windowsHide:true,encoding:'utf8',timeout:15000});
   if(run.error||run.status!==0||run.stdout.replace(/\r\n/g,'\n')!==item.expected)
     throw Error('TypeScript execution mismatch: '+item.id+': '+(run.error?.message||run.stderr));
   results.push({
     id:item.id,outputVerified:true,
     hcode:{file:hc.file,gitBlobSha:hc.gitBlobSha,unicodeCodepoints:hc.codepoints,utf8Bytes:hc.bytes},
     typescript:{file:ts.file,gitBlobSha:ts.gitBlobSha,unicodeCodepoints:ts.codepoints,utf8Bytes:ts.bytes},
     codepointSavingsPercent:percent(hc.codepoints,ts.codepoints),
     utf8ByteSavingsPercent:percent(hc.bytes,ts.bytes)
   });
 }
 return {
   scope:'Two fixed M12 record microcases ONLY; not the pre-registered M19/M58 canonical-20 benchmark',
   outputVerifiedForAll:true,cases:results,caseCount:2,allInputsSourceFrozen:true,
   packageAuthoringSourceRequired:false,generatedRuntimeSizeMeasured:false,
   dependenciesMeasured:false,compilerTimeMeasured:false,
   global20Median:null,global70PercentAchieved:false,
   historicalM14ThreeTaskMedianCodepointReductionPct:68.46
 };
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 console.log(JSON.stringify(compareM12(),null,2));
}
