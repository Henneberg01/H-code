#!/usr/bin/env node
// Derive task09 acceptance from SHA-locked source + actual three-engine execution.
// The original twenty tasks and their preregistered unsupported labels never change.
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {join,resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
const root=fileURLToPath(new URL('../',import.meta.url));
export const FROZEN=Object.freeze({
 registry:['compact/canonical20/workloads.json','46653ef90ffb3e420fba4ddfbfac3c4cfd57f3b3'],
 hc:['compact/canonical20/programs/09-expiring-cache.hc','c77479b480904950a1c059f5d920e4a78d31ed62'],
 ts:['compact/canonical20/programs/09-expiring-cache.ts','f52e8006de9a1be27c44a48c1e17646df6fac4a1'],
 fixtures:['compact/canonical20/cases/09-expiring-cache.json','1f03ef7b2b58cc760991f7e6585c7f92ef795954']
});
const blob=b=>createHash('sha1').update('blob '+b.length+'\0').update(b).digest('hex');
const pct=(a,b)=>Number(((1-a/b)*100).toFixed(2));
const locked=name=>{
 const [path,expected]=FROZEN[name],bytes=readFileSync(join(root,path));
 if(blob(bytes)!==expected)throw Error('Canonical09 source lock changed: '+path);
 return {source:bytes.toString('utf8'),codepoints:[...bytes.toString('utf8')].length,bytes:bytes.length};
};
let cached=null;
export function verifyCanonical09(){
 const all=Object.fromEntries(Object.keys(FROZEN).map(k=>[k,locked(k)]));
 const original=JSON.parse(all.registry.source),f=JSON.parse(all.fixtures.source);
 const w=original.workloads?.[8];
 if(original.workloads?.length!==20||w?.id!=='09-expiring-cache'||
    w.acceptance!=='fake clock, set/get/expire, prevent stale reads and bounded memory'||
    JSON.stringify(w.requiredCapabilities)!==JSON.stringify(['map','time','state'])||
    w.status!=='unsupported'||w.evidence!==null||
    f.id!==w.id||f.acceptance!==w.acceptance||
    f.originalRegistryGitBlobSha!==FROZEN.registry[1]||
    f.maxEntries!==8||f.cases?.length!==6)
    throw Error('Canonical09 immutable original acceptance changed');
 if(cached)return cached;
 if(Number(process.versions.node.split('.')[0])<22)
    throw Error('Node 22+ required for standalone TypeScript oracle');
 // Explicit fake timestamps, NEVER wall time, are the clock injection point.
 const env={...process.env};delete env.NODE_TEST_CONTEXT;delete env.NODE_TEST_REPORTER;
 const result=spawnSync(process.execPath,
  ['--experimental-strip-types','--test','--test-reporter=tap',
    join(root,'scripts/canonical20-verify-09.test.mjs')],
  {cwd:root,env,encoding:'utf8',windowsHide:true,timeout:240000});
 if(result.error)throw Error('Task09 verifier startup failed: '+result.error.message);
 if(result.status!==0)throw Error('Task09 live Rust/JS/TS proof failed:\n'+
   (result.stderr+'\n'+result.stdout).slice(-4500));
 const tests=/^# tests (\d+)$/m.exec(result.stdout);
 if(!tests||Number(tests[1])<2||!/^# fail 0$/m.test(result.stdout))
   throw Error('Task09 expected canonical suites were skipped: '+result.stdout.slice(-1400));
 const bytes=/^# CANONICAL09_GENERATED_JS_BYTES=(\d+)$/m.exec(result.stdout);
 const sha=/^# CANONICAL09_GENERATED_JS_SHA256=([a-f0-9]{64})$/m.exec(result.stdout);
 if(!bytes||!sha||Number(bytes[1])<1)
   throw Error('Compiled JavaScript size/hash evidence missing from task09');
 cached=Object.freeze({
  kind:'full-compiler-evidence',
  unchangedTwentyTaskRegistryGitBlobSha:FROZEN.registry[1],
  frozenFakeClockTracesVerified:6,
  generatedFakeClockStreamsVerified:15,
  rustCompiledJsAndIndependentInterpreterAndTypeScriptParity:true,
  exactExpiryBoundaryAndStaleReadPreventionVerified:true,
  boundedEntries:8,
  deterministicFifoEvictionAndReplacementVerified:true,
  unicodeKeysAndZeroTtlVerified:true,
  invalidTypedJsonEventsRejectedByRustAndReference:true,
  clockInjection:'event timestamps; no wall clock or external clock host used',
  cacheStorage:'source-defined associative record sequence with O(n) key lookup; no native hash map claim',
  hcodeUnicodeCodepoints:all.hc.codepoints,
  hcodeUtf8Bytes:all.hc.bytes,
  typescriptCorrectnessOracleUnicodeCodepoints:all.ts.codepoints,
  typescriptCorrectnessOracleUtf8Bytes:all.ts.bytes,
  compiledJavascriptUtf8Bytes:Number(bytes[1]),
  compiledJavascriptSha256:sha[1],
  comparisonIsCorrectnessOracleNotCompetitiveBaseline:true,
  provisionalCodepointReductionVsCorrectnessOraclePct:pct(all.hc.codepoints,all.ts.codepoints),
  provisionalUtf8ReductionVsCorrectnessOraclePct:pct(all.hc.bytes,all.ts.bytes),
  globalTwentyMedianNotComputed:true,
  note:'This verifies original time/state/map observable behavior, not an efficient native hash map and NOT a global 70% compression benchmark.'
 });
 return cached;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))
 console.log(JSON.stringify(verifyCanonical09(),null,2));
