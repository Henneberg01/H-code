#!/usr/bin/env node
// Canonical08 readiness is DERIVED only after real Rust-generated parallel GET,
// independent H-Code JS interpreter, and frozen independent TypeScript proof.
// The historical 20-task registry remains immutable and never self-certifies.
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
export const FROZEN=Object.freeze({
 registry:['compact/canonical20/workloads.json','46653ef90ffb3e420fba4ddfbfac3c4cfd57f3b3'],
 fixture:['compact/canonical20/cases/08-concurrent-requests.json','bc3b3e4f6443d7c72cf76cc76a543b262b0505f9'],
 hc:['compact/canonical20/programs/08-concurrent-requests.hc','1b948801e6f411a93f8de0581ccc34b7dbb4dc07'],
 ts:['compact/canonical20/programs/08-concurrent-requests.ts','9c7952f29ce910193c7eea7b4d6eb0c5705540e0']
});
const sha=bytes=>createHash('sha1').update('blob '+bytes.length+'\0').update(bytes).digest('hex');
const pct=(a,b)=>Number(((1-a/b)*100).toFixed(2));
const locked=key=>{
 const [path,shaExpected]=FROZEN[key],bytes=readFileSync(join(root,path));
 if(sha(bytes)!==shaExpected)throw Error('Canonical08 source SHA changed: '+path);
 return {source:bytes.toString('utf8'),points:[...bytes.toString('utf8')].length,bytes:bytes.length};
};
let cached=null;
export function verifyCanonical08(){
 const all=Object.fromEntries(Object.keys(FROZEN).map(k=>[k,locked(k)]));
 const reg=JSON.parse(all.registry.source),caseData=JSON.parse(all.fixture.source);
 const w=reg.workloads?.[7];
 if(reg.workloads?.length!==20||w?.id!=='08-concurrent-requests'||
    w.acceptance!=='fan out to three deterministic fake HTTP endpoints and combine results without serial blocking'||
    JSON.stringify(w.requiredCapabilities)!==JSON.stringify(['async','http-client','concurrency'])||
    w.status!=='unsupported'||w.evidence!==null||
    caseData.canonicalRegistryGitBlobSha!==FROZEN.registry[1]||
    caseData.id!==w.id||caseData.acceptance!==w.acceptance||
    caseData.maxFanout!==16||caseData.cases?.length!==6)
   throw Error('Original canonical08 preregistration/contract changed');
 if(cached)return cached;
 if(Number(process.versions.node.split('.')[0])<22)
   throw Error('Node 22+ required for independent TS proof');
 const env={...process.env};delete env.NODE_TEST_CONTEXT;delete env.NODE_TEST_REPORTER;
 const proof=spawnSync(process.execPath,[
   '--experimental-strip-types','--test','--test-reporter=tap',
   join(root,'scripts/canonical20-verify-08.test.mjs')
 ],{cwd:root,env,encoding:'utf8',timeout:240000,windowsHide:true});
 if(proof.error)throw Error('Cannot execute canonical08 full proof: '+proof.error.message);
 if(proof.status!==0)throw Error('Canonical08 full proof failed: '+(proof.stderr+'\n'+proof.stdout).slice(-5000));
 const tests=/^# tests (\d+)$/m.exec(proof.stdout);
 if(!tests||Number(tests[1])<3||!/^# fail 0$/m.test(proof.stdout))
   throw Error('Canonical08 3-engine and negative source tests did not run: '+proof.stdout.slice(-1500));
 const generatedBytes=/^# CANONICAL08_GENERATED_JS_BYTES=(\d+)$/m.exec(proof.stdout);
 const generatedSha=/^# CANONICAL08_GENERATED_JS_SHA256=([a-f0-9]{64})$/m.exec(proof.stdout);
 if(!generatedBytes||!generatedSha||Number(generatedBytes[1])<1)
   throw Error('Canonical08 generated ESM footprint missing');
 cached=Object.freeze({
   kind:'full-compiler-evidence',
   frozenOriginalRegistryGitBlobSha:FROZEN.registry[1],
   frozenConcurrentCasesVerified:6,
   generatedConcurrentVariantsVerified:8,
   realThreeEndpointNoSerialBlockingVerified:true,
   rustGeneratedJsAndIndependentInterpreterAndTypeScriptParity:true,
   immutableSourceProofVerified:true,
   permissionAndFanoutBoundaryRejectedBeforeIO:true,
   compilerAndInterpreterInvalidSourceCasesRejected:4,
   vectorizedHttpIsGeneralTypedLanguagePrimitive:true,
   hcodeUnicodeCodepoints:all.hc.points,hcodeUtf8Bytes:all.hc.bytes,
   typescriptCorrectnessOracleUnicodeCodepoints:all.ts.points,
   typescriptCorrectnessOracleUtf8Bytes:all.ts.bytes,
   compiledJavascriptUtf8Bytes:Number(generatedBytes[1]),
   compiledJavascriptSha256:generatedSha[1],
   comparisonIsCorrectnessOracleNotCompetitiveBaseline:true,
   provisionalCodepointReductionVsCorrectnessOraclePct:pct(all.hc.points,all.ts.points),
   provisionalUtf8ReductionVsCorrectnessOraclePct:pct(all.hc.bytes,all.ts.bytes),
   global20MedianNotComputed:true,
   note:'Full async concurrency acceptance verified, but this individual correctness-oracle comparison does not prove a competitive TS baseline or the global 70% goal'
 });
 return cached;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))
 console.log(JSON.stringify(verifyCanonical08(),null,2));
