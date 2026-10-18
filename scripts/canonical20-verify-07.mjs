#!/usr/bin/env node
// Canonical07 immutable, derived readiness. Do not rewrite the original
// preregistered 20 workloads or trust a manually edited status flag.
import {readFileSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
const root=fileURLToPath(new URL('../',import.meta.url));
export const FROZEN=Object.freeze({
 registry:['compact/canonical20/workloads.json','46653ef90ffb3e420fba4ddfbfac3c4cfd57f3b3'],
 hc:['compact/canonical20/programs/07-file-conversion.hc','b93015a0dab3cd5b616026a16348de97162b5bac'],
 ts:['compact/canonical20/programs/07-file-conversion.ts','8d81d7b3c8150201728d9451dfbd3d07e1359d69'],
 products:['compact/canonical20/cases/07-products.csv','46e536392d088824e261e44a1baf5aa441bcdf3d'],
 unicode:['compact/canonical20/cases/07-unicode.csv','508b88528f82cec4b393768f355f87d5aacaa12a'],
 empty:['compact/canonical20/cases/07-header-only.csv','f692fb78f747d391f69361885b81ac16c0089bc6'],
 malformed:['compact/canonical20/cases/07-malformed.csv','222761cc354efa336adce033cb6a04012f825fe0']
});
const gitBlob=bytes=>createHash('sha1').update('blob '+bytes.length+'\0').update(bytes).digest('hex');
const pct=(a,b)=>Number(((1-a/b)*100).toFixed(2));
function locked(key){
 const [path,sha]=FROZEN[key],bytes=readFileSync(join(root,path));
 if(gitBlob(bytes)!==sha)throw Error('Canonical07 frozen source changed: '+path);
 return {codepoints:[...bytes.toString('utf8')].length,utf8Bytes:bytes.length};
}
let previous=null;
export function verifyCanonical07(){
 const all=Object.fromEntries(Object.keys(FROZEN).map(k=>[k,locked(k)]));
 const prereg=JSON.parse(readFileSync(join(root,FROZEN.registry[0]),'utf8'));
 const w=prereg.workloads?.[6];
 if(prereg.workloads?.length!==20||w?.id!=='07-file-conversion'||
    w.acceptance!=='read a file, convert content, write destination and verify bytes'||
    JSON.stringify(w.requiredCapabilities)!==JSON.stringify(['filesystem-read','filesystem-write'])||
    w.status!=='unsupported'||w.evidence!==null)
    throw Error('Original canonical07 acceptance was weakened');
 if(previous)return previous;
 if(Number(process.versions.node.split('.')[0])<22)
   throw Error('Node 22+ required for TypeScript standalone oracle');
 const env={...process.env};
 delete env.NODE_TEST_CONTEXT;delete env.NODE_TEST_REPORTER;
 const result=spawnSync(process.execPath,[
   '--experimental-strip-types','--test','--test-reporter=tap',
   join(root,'scripts/canonical20-verify-07.test.mjs')
 ],{cwd:root,env,encoding:'utf8',timeout:300000,windowsHide:true});
 if(result.error)throw Error('Canonical07 verifier could not start: '+result.error.message);
 if(result.status!==0)throw Error('Canonical07 full proof failed: '+(result.stderr+'\n'+result.stdout).slice(-4500));
 const tests=/^# tests (\d+)$/m.exec(result.stdout),failed=/^# fail 0$/m.test(result.stdout);
 if(!tests||Number(tests[1])<4||!failed)
   throw Error('Canonical07 acceptance tests missing: '+result.stdout.slice(-1500));
 const bytes=/^# CANONICAL07_GENERATED_JS_BYTES=(\d+)$/m.exec(result.stdout);
 const hash=/^# CANONICAL07_GENERATED_JS_SHA256=([a-f0-9]{64})$/m.exec(result.stdout);
 if(!bytes||!hash||Number(bytes[1])<1)
   throw Error('Canonical07 generated ESM footprint proof missing');
 previous=Object.freeze({
  kind:'full-compiler-evidence',
  originalRegistryGitBlobSha:FROZEN.registry[1],
  frozenPositiveFilesystemCasesVerified:3,
  generatedPositiveCSVVariationsVerified:18,
  negativeMalformedCSVInputsRejectedByThreeEngines:6,
  invalidStaticTypedAndEffectProgramsRejectedByRustAndReference:4,
  rustGeneratedJsAndIndependentReferenceAndTypeScriptParity:true,
  exactUtf8OutputBytesAndWriteCountVerified:true,
  originFilesystemOutputCapabilityDeniedWhenAbsent:true,
  atomicNoOverwriteAndSymlinkTargetProtected:true,
  fileWriteReplayNoDuplicateSideEffects:true,
  generalCsvReadTypedParseJsonWriteAndAtomicFileWrite:true,
  hcodeUnicodeCodepoints:all.hc.codepoints,
  hcodeUtf8Bytes:all.hc.utf8Bytes,
  typescriptCorrectnessOracleUnicodeCodepoints:all.ts.codepoints,
  typescriptCorrectnessOracleUtf8Bytes:all.ts.utf8Bytes,
  compiledJavascriptUtf8Bytes:Number(bytes[1]),
  compiledJavascriptSha256:hash[1],
  comparisonIsCorrectnessOracleNotCompetitiveBaseline:true,
  provisionalCodepointReductionVsCorrectnessOraclePct:pct(all.hc.codepoints,all.ts.codepoints),
  provisionalUtf8ReductionVsCorrectnessOraclePct:pct(all.hc.utf8Bytes,all.ts.utf8Bytes),
  global20MedianNotComputed:true,
  note:'This is real file-conversion acceptance but the TypeScript source is a correctness oracle, NOT a competitive idiomatic TS baseline. No overall 70% claim.'
 });
 return previous;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))
 console.log(JSON.stringify(verifyCanonical07(),null,2));
