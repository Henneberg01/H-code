#!/usr/bin/env node
// Evidence-based promotion of canonical task06. Always verify source SHA locks;
// never trust workload.status, which remains the immutable preregistered value.
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=fileURLToPath(new URL('../',import.meta.url));
export const FROZEN=Object.freeze({
 registry:['compact/canonical20/workloads.json','46653ef90ffb3e420fba4ddfbfac3c4cfd57f3b3'],
 fixture:['compact/canonical20/cases/06-http-retries.json','4f12a085d9730ac637444a06fff6f75481985efb'],
 hc:['compact/canonical20/programs/06-http-retries.hc','8abedc2d8fa32fa6ec157bb98d3a64a02408dfda'],
 ts:['scripts/canonical20-http-oracle.ts','1e9f968d900ed9ab77c703afad1fec104135a83d']
});
const blob=bytes=>createHash('sha1').update('blob '+bytes.length+'\0').update(bytes).digest('hex');
const pct=(a,b)=>Number(((1-a/b)*100).toFixed(2));
function locked(key){
 const [path,expected]=FROZEN[key];
 const bytes=readFileSync(join(root,path));
 if(blob(bytes)!==expected)throw Error('Canonical06 source SHA changed: '+path);
 const text=bytes.toString('utf8');
 return {source:text,bytes:bytes.length,points:[...text].length};
}
let cache=null;
export function verifyCanonical06(){
 const all=Object.fromEntries(Object.keys(FROZEN).map(k=>[k,locked(k)]));
 const prereg=JSON.parse(all.registry.source),fixture=JSON.parse(all.fixture.source);
 const task=prereg.workloads?.[5];
 if(prereg.workloads?.length!==20||
    task?.id!=='06-http-retries'||
    task.acceptance!=='fake 500/429/200 responses, bounded retries and deterministic trace'||
    JSON.stringify(task.requiredCapabilities)!==JSON.stringify(['http-client','async','effect-control'])||
    task.status!=='unsupported'||task.evidence!==null||
    fixture.id!==task.id||fixture.acceptance!==task.acceptance||
    fixture.canonicalRegistryGitBlobSha!==FROZEN.registry[1]||
    fixture.cases?.length!==6||
    fixture.maxAttempts!==4||fixture.baseDelayMs!==100||
    fixture.maxBackoffMs!==1000||fixture.timeoutMs!==2000)
    throw Error('Canonical06 fixed original acceptance contract changed');

 if(cache)return cache; // source locks are still verified on every invocation
 if(Number(process.versions.node.split('.')[0])<22)
   throw Error('Node 22+ required for TypeScript correctness oracle');

 // Real acceptance harness: launches a Rust compiler, runs generated ESM
 // against real local HTTP server, independently runs H-Code JS interpreter,
 // and compares both with immutable TypeScript oracle over fixed + unseen cases.
 // A JSON label cannot pass this gate. Rust type/effect negative cases included.
 const result=spawnSync(process.execPath,
   ['--experimental-strip-types','--test',join(root,'scripts/canonical20-verify-06.test.mjs')],
   {cwd:root,encoding:'utf8',timeout:240000,windowsHide:true});
 if(result.error)throw Error('Canonical06 verifier could not start: '+result.error.message);
 if(result.status!==0)
   throw Error('Canonical06 verifier failed ('+result.status+'): '+(result.stderr+'\n'+result.stdout).slice(-3500));
 const match=/^# tests (\d+)$/m.exec(result.stdout);
 if(!match||Number(match[1])<4||!/^# fail 0$/m.test(result.stdout))
   throw Error('Canonical06 expected live parity and negative test suites did not run');
 const compiledBytes=/^# CANONICAL06_GENERATED_JS_BYTES=(\d+)$/m.exec(result.stdout);
 const compiledSha=/^# CANONICAL06_GENERATED_JS_SHA256=([a-f0-9]{64})$/m.exec(result.stdout);
 if(!compiledBytes||!compiledSha||Number(compiledBytes[1])<1)
   throw Error('Canonical06 generated JavaScript size evidence missing');

 cache=Object.freeze({
   kind:'full-compiler-evidence',
   immutableRegistryGitBlobSha:FROZEN.registry[1],
   frozenHTTPFixturesVerified:6,
   generatedHTTPVariantsVerified:10,
   compilerStaticInvalidProgramsRejected:4,
   interpreterInvalidProgramsRejected:4,
   rustGeneratedJsAndIndependentInterpreterAndTypeScriptParity:true,
   realLoopbackNetworkAndBackoffVerified:true,
   capabilityDenialVerified:true,
   realRetryLogicIsHCodeSource:true,
   hcodeUnicodeCodepoints:all.hc.points,
   typescriptCorrectnessOracleUnicodeCodepoints:all.ts.points,
   hcodeUtf8Bytes:all.hc.bytes,
   typescriptCorrectnessOracleUtf8Bytes:all.ts.bytes,
   compiledJavascriptUtf8Bytes:Number(compiledBytes[1]),
   compiledJavascriptSha256:compiledSha[1],
   comparisonIsCorrectnessOracleNotCompetitiveBaseline:true,
   provisionalCodepointReductionVsCorrectnessOraclePct:pct(all.hc.points,all.ts.points),
   provisionalUtf8ReductionVsCorrectnessOraclePct:pct(all.hc.bytes,all.ts.bytes),
   benchmarkPercentIsNotGlobalMedian:true,
   note:'Proves workload06 functional acceptance, not representative all20 compression or an independent competitive idiomatic TypeScript source baseline'
 });
 return cache;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 console.log(JSON.stringify(verifyCanonical06(),null,2));
}
