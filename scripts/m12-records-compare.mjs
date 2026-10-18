#!/usr/bin/env node
// Fixed, small M12 record example. Distinct from canonical M19/M58 twenty-workload study.
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {join,resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
import {execute} from '../prototype/src/hcode.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
const fixture=[
 {path:'compact/benchmarks/m12/records.hc',gitBlobSha:'7fe1a8ec27ed3187f20e9495548b726e9a5c0200'},
 {path:'compact/benchmarks/m12/records.ts',gitBlobSha:'feec513f574ab84a3017f71881217de57bb33df1'}
];
const gitBlob=bytes=>createHash('sha1').update('blob '+bytes.length+'\0').update(bytes).digest('hex');
function readFrozen(spec){
 const bytes=readFileSync(join(root,spec.path));
 if(gitBlob(bytes)!==spec.gitBlobSha)throw Error('M12 frozen fixture changed: '+spec.path);
 return {source:bytes.toString('utf8'),bytes:bytes.length,codepoints:[...bytes.toString('utf8')].length};
}
export function compareM12(){
 if(Number(process.versions.node.split('.')[0])<22)throw Error('Node 22+ required for matched TypeScript execution');
 const [hc,ts]=fixture.map(readFrozen),out=[];
 execute(hc.source,{stdout:v=>out.push(String(v))});
 const result=out.join('\n')+'\n',expected='Ada\n51\n';
 if(result!==expected)throw Error('H-Code record fixture output mismatch');
 const run=spawnSync(process.execPath,['--experimental-strip-types',join(root,fixture[1].path)],
  {cwd:root,encoding:'utf8',windowsHide:true,timeout:15000});
 if(run.error||run.status!==0)throw Error('TypeScript fixture failed: '+(run.error?.message||run.stderr));
 if(run.stdout.replace(/\r\n/g,'\n')!==expected)throw Error('TypeScript record fixture output mismatch');
 const percent=(n,d)=>Number(((1-n/d)*100).toFixed(2));
 return {
  scope:'M12 single record microcase only; NOT canonical twenty coverage',
  sourceIdentity:'exact frozen Git SHA1 blobs, real matching runtime output',
  typeScriptIsIdiomatic:true,
  functionality:'nested immutable records and field projection, no hidden JSON/DB/UI runtime',
  hcode:{file:fixture[0].path,...hc,source:undefined,gitBlobSha:fixture[0].gitBlobSha},
  typescript:{file:fixture[1].path,...ts,source:undefined,gitBlobSha:fixture[1].gitBlobSha},
  codepointSavingsPercent:percent(hc.codepoints,ts.codepoints),
  utf8ByteSavingsPercent:percent(hc.bytes,ts.bytes),
  generatedRuntimeSizeMeasured:false,dependenciesMeasured:false,compilerTimeMeasured:false,
  global20Median:null,global70PercentAchieved:false,
  m14PreservedMedianCodepointReductionPct:68.46
 };
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))
 console.log(JSON.stringify(compareM12(),null,2));
