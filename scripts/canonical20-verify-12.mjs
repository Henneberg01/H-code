#!/usr/bin/env node
// Derived Canonical12 acceptance. The original 20-task registry and six
// TypeScript contract cases stay SHA-frozen; a status label proves nothing.
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';

const root=fileURLToPath(new URL('../',import.meta.url));
export const FROZEN=Object.freeze({
 registry:['compact/canonical20/workloads.json','46653ef90ffb3e420fba4ddfbfac3c4cfd57f3b3'],
 hc:['compact/canonical20/programs/12-crud-api.hc','b3ba6542ef27474390a7354c8c01a22464156179'],
 ts:['compact/canonical20/programs/12-crud-api.ts','6ac016aaf88620578cfc36a82b6f4a94b3b72c9e'],
 cases:['compact/canonical20/cases/12-crud-api.json','0383e7ed4c342cc39756822a2a6581d833c53a76']
});
const sha=bytes=>createHash('sha1').update('blob '+bytes.length+'\0').update(bytes).digest('hex');
const pct=(a,b)=>Number((100*(1-a/b)).toFixed(2));
const readLocked=k=>{
 const [p,digest]=FROZEN[k],data=readFileSync(join(root,p));
 if(sha(data)!==digest)throw Error('Canonical12 source lock changed: '+p);
 return {source:data.toString('utf8'),codepoints:[...data.toString('utf8')].length,bytes:data.length};
};
let result=null;
export function verifyCanonical12(){
 const sources=Object.fromEntries(Object.keys(FROZEN).map(k=>[k,readLocked(k)]));
 const original=JSON.parse(sources.registry.source),w=original.workloads?.[11];
 const cases=JSON.parse(sources.cases.source);
 if(original.workloads?.length!==20||w?.id!=='12-crud-api'||
    w.acceptance!=='server endpoints create/read/update/delete, request validation and deterministic persistence'||
    JSON.stringify(w.requiredCapabilities)!==JSON.stringify(['http-server','records','storage'])||
    w.status!=='unsupported'||w.evidence!==null||
    cases.id!==w.id||cases.acceptance!==w.acceptance||
    cases.originalRegistryGitBlobSha!==FROZEN.registry[1]||
    cases.cases?.length!==6)
    throw Error('Original Canonical12 acceptance contract was changed');
 if(result)return result;
 if(Number(process.versions.node.split('.')[0])<22)
    throw Error('Canonical12 independent TS oracle requires Node 22+');
 const env={...process.env};
 delete env.NODE_TEST_CONTEXT;
 delete env.NODE_TEST_REPORTER;
 const script=join(root,'scripts/canonical20-verify-12-three-engines.test.mjs');
 const proof=spawnSync(process.execPath,[
   '--experimental-strip-types','--test','--test-reporter=tap',script
 ],{cwd:root,env,encoding:'utf8',windowsHide:true,timeout:240000,maxBuffer:16*1024*1024});
 if(proof.error)throw Error('Canonical12 proof could not run: '+proof.error.message);
 if(proof.status!==0)
   throw Error('Canonical12 Rust/JS/TS proof failed: '+(proof.stderr+'\n'+proof.stdout).slice(-7000));
 const tests=/^# tests (\d+)$/m.exec(proof.stdout);
 if(!tests||Number(tests[1])<3||!/^# fail 0$/m.test(proof.stdout))
    throw Error('Canonical12 original and generated three-engine tests were skipped');
 const generatedBytes=/^# CANONICAL12_GENERATED_JS_BYTES=(\d+)$/m.exec(proof.stdout);
 const generatedDigest=/^# CANONICAL12_GENERATED_JS_SHA256=([a-f0-9]{64})$/m.exec(proof.stdout);
 if(!generatedBytes||!generatedDigest||Number(generatedBytes[1])<1)
    throw Error('Canonical12 generated JavaScript footprint was not measured');
 result=Object.freeze({
    kind:'full-compiler-evidence',
    originalTwentyRegistryBlobSha:FROZEN.registry[1],
    originalFrozenCRUDFixturesVerified:6,
    generatedAntiCherrypickFlowsVerified:5,
    compiledHCodeVsJSReferenceVsTypeScript:true,
    persistentStateAndReplayVerified:true,
    noCrudSpecificRuntimeMacro:true,
    hcodeUnicodeCodepoints:sources.hc.codepoints,
    hcodeUtf8Bytes:sources.hc.bytes,
    typescriptCorrectnessOracleUnicodeCodepoints:sources.ts.codepoints,
    typescriptCorrectnessOracleUtf8Bytes:sources.ts.bytes,
    compiledJavascriptUtf8Bytes:Number(generatedBytes[1]),
    compiledJavascriptSha256:generatedDigest[1],
    comparisonIsCorrectnessOracleNotCompetitiveBaseline:true,
    provisionalCodepointReductionVsCorrectnessOraclePct:pct(sources.hc.codepoints,sources.ts.codepoints),
    provisionalUtf8ReductionVsCorrectnessOraclePct:pct(sources.hc.bytes,sources.ts.bytes),
    globalTwentyMedianNotComputed:true,
    note:'Full six-case typed HTTP CRUD contract plus generated flows proven in actual compiled H-Code, independent JS interpreter and frozen TypeScript correctness oracle; NOT a competitive idiomatic TypeScript baseline.'
 });
 return result;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))
 console.log(JSON.stringify(verifyCanonical12(),null,2));
