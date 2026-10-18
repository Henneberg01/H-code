// Canonical 20-workload *readiness* checker. NOT a completed 20-program benchmark.
import {readFileSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {execute} from '../prototype/src/hcode.mjs';
import {compareM14} from './m14-compare.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
export const registry=JSON.parse(readFileSync(join(root,'compact/canonical20/workloads.json'),'utf8'));
const canonicalIds=[
 '01-calculator-cli','02-fibonacci-recursion','03-text-frequency-counter','04-csv-validation',
 '05-json-transformation','06-http-retries','07-file-conversion','08-concurrent-requests',
 '09-expiring-cache','10-generic-collection-transforms','11-markdown-processing','12-crud-api',
 '13-form-validation-ui','14-todo-app','15-db-dashboard','16-auth-sessions',
 '17-websocket-chat','18-refactor-task','19-bug-repair-task','20-incremental-feature'
];
function read(path){return readFileSync(join(root,path))}
function gitBlob(bytes){return createHash('sha1').update('blob '+bytes.length+'\0').update(bytes).digest('hex')}
function checkedFile(path,expected){
  if(!/^compact\/benchmarks\/paired\/[a-z0-9-]+\.(hc|ts)$/.test(path))throw Error('Unapproved M10 path');
  const bytes=read(path);
  if(gitBlob(bytes)!==expected)throw Error('Frozen source modified: '+path);
  return bytes.toString('utf8');
}
const runHc=(src)=>{
  const lines=[];
  execute(src,{stdout:value=>lines.push(String(value))});
  return lines.join('\n')+'\n';
};
const runTs=path=>{
  const result=spawnSync(process.execPath,['--experimental-strip-types',join(root,path)],{
    cwd:root,windowsHide:true,encoding:'utf8',timeout:15000
  });
  if(result.error||result.status!==0)throw Error('TS failed: '+(result.error?.message||result.stderr));
  return result.stdout.replace(/\r\n/g,'\n');
};
function fibonacciEvidence(){
  const baseline=JSON.parse(read('compact/results/frozen-baseline-m10-eight.json').toString('utf8'));
  const ids=JSON.parse(read('compact/benchmarks/paired/manifest.json').toString('utf8')).pairs;
  const p=baseline.pairs.find(x=>x.id==='recursive-fibonacci');
  const expected=ids.find(x=>x.id==='recursive-fibonacci')?.expected;
  if(!p||expected!=='13\n')throw Error('M10 Fibonacci baseline no longer pinned');
  const hc=checkedFile(p.hcodePath,p.hcodeBlobSha);
  checkedFile(p.tsPath,p.tsBlobSha);
  if(runHc(hc)!==expected||runTs(p.tsPath)!==expected)throw Error('M10 Fibonacci parity failure');
  return {kind:'reference-only',source:'M10 frozen Fibonacci fixture',subcasesVerified:1,compilerEvidence:false};
}
function collectionEvidence(){
  const baseline=compareM14(); // validates original TS bytes + M11/M13/M14 H-Code SHA and stdout
  if(baseline.benchmarkCount!==3||!baseline.cases.every(c=>c.outputVerified)){
    throw Error('M14 collection partial proof unavailable');
  }
  return {kind:'reference-only',source:baseline.corpusId,subcasesVerified:3,compilerEvidence:false,
    note:'partial workload evidence only, not full acceptance for a general collection library'};
}
export function readiness(){
  if(registry.schemaVersion!==1||registry.id!=='HCODE-CANONICAL20-2026-10-18-PREREG-1')
    throw Error('Unexpected canonical-20 registry version');
  if(registry.workloads.length!==20)throw Error('Never cherry-pick or omit canonical workloads');
  if(registry.objective?.all20MustPass!==true||registry.objective.unsupportedsCountAsFailures!==true)
    throw Error('Canonical-20 integrity policy was weakened');
  const evidence={};
  let partial=0,unsupported=0;
  for(let index=0;index<canonicalIds.length;index++){
    const w=registry.workloads[index];
    if(w.id!==canonicalIds[index]||!w.title||!w.acceptance)throw Error('Workload identity/order changed: '+canonicalIds[index]);
    if(!Array.isArray(w.requiredCapabilities)||w.requiredCapabilities.length===0)throw Error('Missing capability contract: '+w.id);
    if(w.status==='unsupported'){
      unsupported++;
      if(w.evidence!==null)throw Error('Unsupported task falsely claims evidence: '+w.id);
    }else if(w.status==='reference_partial'){
      partial++;
      if(w.evidence==='m10:fibonacci'){if(w.id!=='02-fibonacci-recursion')throw Error('Misassigned reference');evidence[w.id]=fibonacciEvidence();}
      else if(w.evidence==='m14:collections'){if(w.id!=='10-generic-collection-transforms')throw Error('Misassigned reference');evidence[w.id]=collectionEvidence();}
      else throw Error('Unknown or fabricated partial evidence for '+w.id);
    }else{
      // A future report must implement full compiler-proof verification; changing
      // a status in JSON alone MUST NEVER produce a "70% achieved" result.
      throw Error('Unsupported readiness state / no compiler evidence checker: '+w.status);
    }
  }
  return {
    id:registry.id,preregisteredTasks:20,strictTargetPercent:70,
    verifiedFullWorkloads:0,partialReferenceEvidence:partial,unsupported,
    complete:false,globalMedianCodepointReduction:null,globalMedianUtf8Reduction:null,
    objectiveAchieved:false,compilerProvenanceValidated:false,
    evidenceByPartialTask:evidence,
    explanation:'20-workload goal remains incomplete; no missing task is excluded from denominator.'
  };
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const report=readiness();
  console.log(JSON.stringify(report,null,2));
  if(process.argv.includes('--require-complete')&&!report.complete){
    console.error('Canonical 20-task gate NOT MET: all 20 must be compiler-verified.');
    process.exitCode=2;
  }
}
