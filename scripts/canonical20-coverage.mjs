// Canonical 20-workload *readiness* checker. NOT a completed 20-program benchmark.
import {readFileSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {execute} from '../prototype/src/hcode.mjs';
import {compareM14} from './m14-compare.mjs';
import {verifyCanonical05} from './canonical20-verify-05.mjs';
import {verifyCanonical02} from './canonical20-verify-02.mjs';
import {verifyCanonical10} from './canonical20-verify-10.mjs';
import {verifyCanonical03} from './canonical20-verify-03.mjs';
import {verifyCanonical04} from './canonical20-verify-04.mjs';
import {verifyCanonical01} from './canonical20-verify-01.mjs';
import {verifyCanonical06} from './canonical20-verify-06.mjs';
import {verifyCanonical07} from './canonical20-verify-07.mjs';
import {verifyCanonical08} from './canonical20-verify-08.mjs';
import {verifyCanonical09} from './canonical20-verify-09.mjs';
import {verifyCanonical11} from './canonical20-verify-11.mjs';
import {verifyCanonical12} from './canonical20-verify-12.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
const registryBytes=readFileSync(join(root,'compact/canonical20/workloads.json'));
export const registry=JSON.parse(registryBytes.toString('utf8'));
// Git blob SHA1 of the actual, preregistered 20-workload registry from M19 PR #15.
// A renamed task, weaker acceptance contract, or altered status MUST be reviewed
// as a new registry version, not silently reinterpreted as a 70% improvement.
export const PREREGISTERED_GIT_BLOB_SHA='46653ef90ffb3e420fba4ddfbfac3c4cfd57f3b3';
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
    historicalM14MedianUnicodeCodepointReductionPct:baseline.medianCodepointReductionVsTypeScript,
    historicalM14MedianUtf8ReductionPct:baseline.medianUtf8ReductionVsTypeScript,
    note:'partial workload evidence only, not full acceptance for a general collection library'};
}
export function readiness(){
  if(gitBlob(registryBytes)!==PREREGISTERED_GIT_BLOB_SHA)
    throw Error('Canonical twenty preregistration SHA changed; update the registry version through a reviewed milestone, never silently change the denominator');
  if(registry.schemaVersion!==1||registry.id!=='HCODE-CANONICAL20-2026-10-18-PREREG-1')
    throw Error('Unexpected canonical-20 registry version');
  if(registry.workloads.length!==20)throw Error('Never cherry-pick or omit canonical workloads');
  if(registry.objective?.all20MustPass!==true||registry.objective.unsupportedsCountAsFailures!==true)
    throw Error('Canonical-20 integrity policy was weakened');
  const evidence={};
  let partial=0,unsupported=0,verified=0;
  const fullEvidence={};
  for(let index=0;index<canonicalIds.length;index++){
    const w=registry.workloads[index];
    if(w.id!==canonicalIds[index]||!w.title||!w.acceptance)throw Error('Workload identity/order changed: '+canonicalIds[index]);
    if(!Array.isArray(w.requiredCapabilities)||w.requiredCapabilities.length===0)throw Error('Missing capability contract: '+w.id);
    if(w.status==='unsupported'){
      if(w.evidence!==null)throw Error('Unsupported task falsely claims evidence: '+w.id);
      if(w.id==='01-calculator-cli'){
        fullEvidence[w.id]=verifyCanonical01();
        verified++;
      }else if(w.id==='03-text-frequency-counter'){
        // Do not relabel the historical preregistration. Verification must
        // come from the full source-SHA-locked Rust/JS/TS Unicode test suite.
        fullEvidence[w.id]=verifyCanonical03();
        verified++;
      }else if(w.id==='04-csv-validation'){
        fullEvidence[w.id]=verifyCanonical04();
        verified++;
      }else if(w.id==='05-json-transformation'){
        // The frozen original preregistry remains untouched; promotion is derived
        // exclusively from repeatable, SHA-locked full Rust/JS/TS execution.
        fullEvidence[w.id]=verifyCanonical05();
        verified++;
      }else if(w.id==='06-http-retries'){
        // Re-run the pinned live HTTP fixtures, 10 unseen permutations, negative
        // compiler effects/types, and independent JS/TypeScript parity.
        // Do NOT trust the frozen JSON registry's original unsupported label.
        fullEvidence[w.id]=verifyCanonical06();
        verified++;
      }else if(w.id==='07-file-conversion'){
        // Derived only from exact-SHA frozen source, real filesystem IO,
        // byte-exact Rust/JS/TS parity, security and invalid inputs.
        fullEvidence[w.id]=verifyCanonical07();
        verified++;
      }else if(w.id==='08-concurrent-requests'){
        // Exactly the original concurrent HTTP acceptance: barrier server
        // blocks any response until all calls begin. All three independently
        // executed runtimes must pass SHA-locked fixtures and generated cases.
        fullEvidence[w.id]=verifyCanonical08();
        verified++;
      }else if(w.id==='09-expiring-cache'){
        // No cache-specific runtime macro. Require source-locked replay against
        // virtual-clock events, real Rust compilation, independent JS and TS.
        fullEvidence[w.id]=verifyCanonical09();
        verified++;
      }else if(w.id==='11-markdown-processing'){
        // Proof is derived exclusively from source-SHA-locked Markdown fixtures,
        // real Rust codegen and independent JS/TS parsers. No registry edits.
        fullEvidence[w.id]=verifyCanonical11();
        verified++;
      }else if(w.id==='12-crud-api'){
        // Real user-written H-Code CRUD source, native Rust->HTTP ESM, H-Code
        // JS reference and frozen TS oracle must ALL pass the same original
        // HTTP cases and durable state comparisons; no CRUD-specific macro.
        fullEvidence[w.id]=verifyCanonical12();
        verified++;
      }else{unsupported++;}
    }else if(w.status==='reference_partial'){
      if(w.evidence==='m10:fibonacci'){
        if(w.id!=='02-fibonacci-recursion')throw Error('Misassigned reference');
        // Never promote a status by editing the original JSON registry. The
        // original frozen source must actually pass Rust + JS + TS runtime and
        // explicit compiler type-error conformance, including varied n.
        fullEvidence[w.id]=verifyCanonical02();
        verified++;
      }else if(w.evidence==='m14:collections'){
        if(w.id!=='10-generic-collection-transforms')throw Error('Misassigned reference');
        fullEvidence[w.id]=verifyCanonical10();
        verified++;
      }
      else throw Error('Unknown or fabricated partial evidence for '+w.id);
    }else{
      // A future report must implement full compiler-proof verification; changing
      // a status in JSON alone MUST NEVER produce a "70% achieved" result.
      throw Error('Unsupported readiness state / no compiler evidence checker: '+w.status);
    }
  }
  // Counts describe unmet workload requirements, NOT confirmed compiler features.
  // This exposes reusable language/runtime bottlenecks without cherry-picking
  // the benchmark or promising that a glyph alone can solve I/O/security.
  const capabilityDemand=new Map();
  for(const task of registry.workloads){
    if(fullEvidence[task.id])continue;
    for(const capability of new Set(task.requiredCapabilities)){
      const old=capabilityDemand.get(capability)??[];
      old.push(task.id);
      capabilityDemand.set(capability,old);
    }
  }
  const requestedByUnverifiedTasks=[...capabilityDemand]
    .map(([capability,taskIds])=>({capability,workloads:taskIds.length,taskIds}))
    .sort((a,b)=>b.workloads-a.workloads||a.capability.localeCompare(b.capability,'en'));
  return {
    id:registry.id,preregisteredTasks:20,strictTargetPercent:70,
    immutableRegistryGitBlobSha:PREREGISTERED_GIT_BLOB_SHA,
    capabilityDemandIsNotCompilerCoverage:true,
    requestedByUnverifiedTasks,
    verifiedFullWorkloads:verified,partialReferenceEvidence:partial,unsupported,
    complete:false,globalMedianCodepointReduction:null,globalMedianUtf8Reduction:null,
    objectiveAchieved:false,compilerProvenanceValidated:false,
    historicalM14MedianCodepointReductionPct:fullEvidence['10-generic-collection-transforms'].historicalM14MedianCodepointReductionPct,
    historicalM14IsGlobalMetric:false,
    evidenceByFullTask:fullEvidence,
    evidenceByPartialTask:evidence,
    explanation:'Full verification is derived from frozen Rust/JS/TS proofs (including CRUD HTTP/disk parity with immutable six-case acceptance); original preregistration remains SHA-frozen and unsupported tasks stay in the denominator. Correctness oracles are not automatically competitive TypeScript baselines.'
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
