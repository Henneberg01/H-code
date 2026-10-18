#!/usr/bin/env node
// A single fixed, SHA-locked typed JSON round-trip microcase, NOT global M19/M58.
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {join,resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
import {execute} from '../prototype/src/hcode.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
const files={
  hc:{path:'compact/benchmarks/m12/json-typed.hc',sha:'f0e108c272341b16ba4d490d70b8094778f99cc5'},
  ts:{path:'compact/benchmarks/m12/json-typed.ts',sha:'51e1bb5d2b00d2317420c197fdf66f746537b372'}
};
const gitBlob=bytes=>createHash('sha1').update('blob '+bytes.length+'\0').update(bytes).digest('hex');
function fixed(file){
  const bytes=readFileSync(join(root,file.path));
  if(gitBlob(bytes)!==file.sha)throw Error('SHA-locked JSON microcase changed: '+file.path);
  const source=bytes.toString('utf8');
  return {source,unicodeCodepoints:[...source].length,utf8Bytes:bytes.length,
    gitBlobSha:file.sha,file:file.path};
}
const percent=(small,large)=>Number(((1-small/large)*100).toFixed(2));

export function compareTypedJson(){
  if(Number(process.versions.node.split('.')[0])<22)throw Error('Node 22+ required');
  const hc=fixed(files.hc),ts=fixed(files.ts);
  const output=[];
  execute(hc.source,{stdout:line=>output.push(String(line))});
  const actual=output.join('\n')+'\n',wanted='Ada\n{"age":42,"name":"Ada"}\n';
  if(actual!==wanted)throw Error('H-Code typed JSON output mismatch');
  const processResult=spawnSync(process.execPath,['--experimental-strip-types',join(root,ts.file)],{
    cwd:root,encoding:'utf8',windowsHide:true,timeout:15000
  });
  if(processResult.error||processResult.status!==0)
    throw Error('TypeScript JSON baseline failed: '+(processResult.error?.message||processResult.stderr));
  if(processResult.stdout.replace(/\r\n/g,'\n')!==wanted)
    throw Error('TypeScript JSON baseline output mismatch');
  return {
    scope:'ONE fixed typed JSON round-trip microcase; NOT twenty canonical workloads',
    task:'parse a fixed JSON record; validate exactly two typed fields; print name and deterministic JSON',
    typeScriptBaseline:'no external validation library; explicit runtime type guard and matching output',
    parityValidated:true,sourceFrozen:true,
    hcode:{file:hc.file,gitBlobSha:hc.gitBlobSha,unicodeCodepoints:hc.unicodeCodepoints,utf8Bytes:hc.utf8Bytes},
    typescript:{file:ts.file,gitBlobSha:ts.gitBlobSha,unicodeCodepoints:ts.unicodeCodepoints,utf8Bytes:ts.utf8Bytes},
    unicodeCodepointSavingsPercent:percent(hc.unicodeCodepoints,ts.unicodeCodepoints),
    utf8ByteSavingsPercent:percent(hc.utf8Bytes,ts.utf8Bytes),
    typeScriptWithoutRuntimeGuardNotEquivalent:true,
    generatedJsRuntimeBytesMeasured:false,packageBytesMeasured:false,
    compileTimeMeasured:false,runtimePerformanceMeasured:false,
    globalTwentyWorkloadCodepointMedian:null,
    seventyPercentGlobalGoalVerified:false,
    historicM14ThreeCaseMedianCodepointSavings:68.46
  };
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))
  console.log(JSON.stringify(compareTypedJson(),null,2));
