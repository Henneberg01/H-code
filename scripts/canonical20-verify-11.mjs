#!/usr/bin/env node
// Derived immutable canonical11 acceptance: never relabel the frozen registry.
// Proof requires actual Rust compiler -> Node ESM and two independent parsers.
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';

const root=fileURLToPath(new URL('../',import.meta.url));
export const FROZEN=Object.freeze({
 registry:['compact/canonical20/workloads.json','46653ef90ffb3e420fba4ddfbfac3c4cfd57f3b3'],
 hc:['compact/canonical20/programs/11-markdown-processing.hc','e826116ae1f7df4603fad62aee356594c7e58d5f'],
 ts:['compact/canonical20/programs/11-markdown-processing.ts','b60a9066f1b73c97737e131ebd21b23cd2fbf066'],
 cases:['compact/canonical20/cases/11-markdown-processing.json','754ec2974a3194389ab9e8bf6add038217914fa3']
});
const blob=b=>createHash('sha1').update('blob '+b.length+'\0').update(b).digest('hex');
const pct=(a,b)=>Number(((1-a/b)*100).toFixed(2));
const locked=k=>{
 const [path,sha]=FROZEN[k],data=readFileSync(join(root,path));
 if(blob(data)!==sha)throw Error('Canonical11 original source SHA changed: '+path);
 return {source:data.toString('utf8'),codepoints:[...data.toString('utf8')].length,bytes:data.length};
};
let cached=null;
export function verifyCanonical11(){
 const all=Object.fromEntries(Object.keys(FROZEN).map(k=>[k,locked(k)]));
 const original=JSON.parse(all.registry.source),fixtures=JSON.parse(all.cases.source),w=original.workloads?.[10];
 if(original.workloads?.length!==20||w?.id!=='11-markdown-processing'||
    w.acceptance!=='parse headings/links into deterministic structured output on an agreed fixture'||
    JSON.stringify(w.requiredCapabilities)!==JSON.stringify(['string-processing','records','markdown-library'])||
    w.status!=='unsupported'||w.evidence!==null||
    fixtures.id!==w.id||fixtures.acceptance!==w.acceptance||
    fixtures.originalRegistryGitBlobSha!==FROZEN.registry[1]||
    fixtures.cases?.length!==6)
   throw Error('Canonical11 immutable original registry contract changed');
 if(cached)return cached;
 if(Number(process.versions.node.split('.')[0])<22)
   throw Error('Node22+ required for TypeScript independent oracle');
 const env={...process.env};
 delete env.NODE_TEST_CONTEXT;delete env.NODE_TEST_REPORTER;
 const proof=spawnSync(process.execPath,[
   '--experimental-strip-types','--test','--test-reporter=tap',
   join(root,'scripts/canonical20-verify-11.test.mjs')
 ],{cwd:root,env,encoding:'utf8',windowsHide:true,timeout:240000});
 if(proof.error)throw Error('Cannot run canonical11 proof: '+proof.error.message);
 if(proof.status!==0)throw Error('Real canonical11 multi-engine proof failed: '+
    (proof.stderr+'\n'+proof.stdout).slice(-5000));
 const tests=/^# tests (\d+)$/m.exec(proof.stdout);
 if(!tests||Number(tests[1])<3||!/^# fail 0$/m.test(proof.stdout))
    throw Error('Canonical11 full acceptance and negative tests were skipped');
 const size=/^# CANONICAL11_GENERATED_JS_BYTES=(\d+)$/m.exec(proof.stdout);
 const digest=/^# CANONICAL11_GENERATED_JS_SHA256=([a-f0-9]{64})$/m.exec(proof.stdout);
 if(!size||!digest||Number(size[1])<1)
   throw Error('Missing compiler-generated Markdown runtime footprint');
 cached=Object.freeze({
  kind:'full-compiler-evidence',
  originalTwentyRegistryBlobSha:FROZEN.registry[1],
  agreedFrozenMarkdownDocumentsVerified:6,
  generatedMarkdownDocumentsVerified:19,
  rustGeneratedJsVsIndependentHCodeReferenceVsTypeScriptOracle:true,
  pureGenericMarkdownLexingIntrinsic:true,
  parserScope:'bounded Markdown heading/link extraction subset, not full CommonMark',
  typedMarkdownStructuralTokenRecords:true,
  noHTMLExecutionOrNetworkFetch:true,
  malformedUnicodeAndOversizedStdinDenied:true,
  fourIllTypedProgramsRejectedByCompilerAndInterpreter:4,
  hcodeUnicodeCodepoints:all.hc.codepoints,
  hcodeUtf8Bytes:all.hc.bytes,
  typescriptCorrectnessOracleUnicodeCodepoints:all.ts.codepoints,
  typescriptCorrectnessOracleUtf8Bytes:all.ts.bytes,
  compiledJavascriptUtf8Bytes:Number(size[1]),
  compiledJavascriptSha256:digest[1],
  comparisonIsCorrectnessOracleNotCompetitiveBaseline:true,
  provisionalCodepointReductionVsCorrectnessOraclePct:pct(all.hc.codepoints,all.ts.codepoints),
  provisionalUtf8ReductionVsCorrectnessOraclePct:pct(all.hc.bytes,all.ts.bytes),
  globalTwentyMedianNotComputed:true,
  note:'Compiler-verified original heading/link extraction against a standalone correctness oracle, not a complete CommonMark claim and not a global 70%-reduction proof.'
 });
 return cached;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))
 console.log(JSON.stringify(verifyCanonical11(),null,2));
