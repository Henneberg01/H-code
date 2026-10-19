#!/usr/bin/env node
// M19.14 strict source-SHA-locked canonical todo app proof.
// Original 20-task registry stays preregistered (task14 status unsupported).
// The status is DERIVED only after real Rust, independent JS reference,
// idiomatic TS and actual Chromium add/complete/remove/reload tests all pass.
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=fileURLToPath(new URL('../',import.meta.url));
export const FROZEN14=Object.freeze({
 registry:['compact/canonical20/workloads.json','46653ef90ffb3e420fba4ddfbfac3c4cfd57f3b3'],
 hc:['compact/canonical20/programs/14-todo-app.hc','2931b75caac9db0582e0d8088fe2f1e29f5cd934'],
 ts:['compact/canonical20/idiomatic/14-todo-app.ts','d3ca8ac09a9c0a6d830fd559b4aaf0f36ead8bad'],
 html:['compact/canonical20/programs/14-todo-app.html','8b1865443f5b1eeafb8e678e1c56c13ab0092dc4'],
 probe:['scripts/m19-todo-browser-probe.js','65ac2bda0d9a7ca4b0d10f3cbf43b1764f79660d']
});
const pct=(a,b)=>Number((100*(1-a/b)).toFixed(2));
function locked(k){
 const [path,expected]=FROZEN14[k],bytes=readFileSync(join(root,path));
 const actual=createHash('sha1').update('blob '+bytes.length+'\0').update(bytes).digest('hex');
 if(actual!==expected)throw Error('Frozen Canonical14 source/fixture changed: '+path);
 const decoded=new TextDecoder('utf-8',{fatal:true}).decode(bytes);
 return {source:decoded,unicodeCodepoints:[...decoded].length,utf8Bytes:bytes.length};
}
function checkTestRun(name,args,timeout=240000){
 const env={...process.env};
 delete env.NODE_TEST_CONTEXT;
 delete env.NODE_TEST_REPORTER;
 const run=spawnSync(args[0],args.slice(1),{
   cwd:root,env,windowsHide:true,encoding:'utf8',timeout,maxBuffer:16*1024*1024
 });
 if(run.error||run.status!==0)
   throw Error('Canonical14 '+name+' failed: '+(run.error?.message??(run.stderr+'\n'+run.stdout)).slice(-7000));
 return run.stdout;
}
function testsPassed(name,log,minTests){
 const total=/^# tests (\d+)$/m.exec(log);
 const fails=/^# fail (\d+)$/m.exec(log);
 const skips=/^# skipped (\d+)$/m.exec(log);
 if(!total||Number(total[1])<minTests||!fails||Number(fails[1])!==0||
    !skips||Number(skips[1])!==0)
   throw Error('Canonical14 '+name+' did not run complete positive/negative tests');
 return Number(total[1]);
}
let evidence=null;
export function verifyCanonical14(){
 const files=Object.fromEntries(Object.keys(FROZEN14).map(k=>[k,locked(k)]));
 const manifest=JSON.parse(files.registry.source);
 const w=manifest.workloads?.[13];
 if(manifest.workloads?.length!==20||w?.id!=='14-todo-app'||
    w?.acceptance!=='add/complete/remove with persisted state and accessible UI updates'||
    JSON.stringify(w?.requiredCapabilities)!==JSON.stringify(['dom','ui-events','persistence'])||
    w?.status!=='unsupported'||w?.evidence!==null)
   throw Error('Canonical14 immutable original contract changed');
 if(evidence)return evidence;
 if(Number(process.versions.node.split('.')[0])<22)throw Error('Canonical14 needs Node22+');
 const rust=checkTestRun('Rust native todo/list typecheck',[
   'cargo','test','--quiet','--manifest-path','compiler/Cargo.toml','--test','m19_todo_ui'
 ]);
 if(!/test result: ok\./.test(rust))throw Error('Canonical14 Rust native typed source test skipped');
 const independent=checkTestRun('H-Code JS reference and Rust ESM parity',[
   process.execPath,'--test','--test-reporter=tap',join(root,'scripts/m19-todo-ui.test.mjs')
 ]);
 const referenceCount=testsPassed('JS reference',independent,4);
 // Real Chrome is REQUIRED, not a mocked browser or manufactured fixture.
 // Chrome's Windows GUI "--version" is unreliable: the browser test actually
 // spawns Chrome with headless rendering and requires DOM probe results.
 const browser=checkTestRun('three real Chromium lifetimes versus idiomatic TS',[
   process.execPath,'--test','--test-reporter=tap',join(root,'scripts/m19-todo-browser-compare.test.mjs')
 ]);
 const browserTests=testsPassed('Chrome TypeScript comparator',browser,1);
 const originalCases=/^# M19_14_REAL_CHROME_SCENARIOS=(\d+)$/m.exec(browser);
 const metric=/^# M19_14_SOURCE_AND_RUNTIME=(\{[^\n]*\})$/m.exec(browser);
 if(!originalCases||Number(originalCases[1])!==15||!metric)
   throw Error('Canonical14 real Chrome original add/complete/remove/reload evidence missing');
 const m=JSON.parse(metric[1]);
 if(m.hcode?.codepoints!==files.hc.unicodeCodepoints||
    m.hcode?.utf8Bytes!==files.hc.utf8Bytes||
    m.idiomaticTypescript?.codepoints!==files.ts.unicodeCodepoints||
    m.idiomaticTypescript?.utf8Bytes!==files.ts.utf8Bytes||
    m.reductionCodepointPct!==pct(files.hc.unicodeCodepoints,files.ts.unicodeCodepoints)||
    m.reductionBytePct!==pct(files.hc.utf8Bytes,files.ts.utf8Bytes)||
    !Number.isSafeInteger(m.generatedHCodeESMBytes)||
    m.generatedHCodeESMBytes<1||
    m.globallyVerified70Percent!==false)
   throw Error('Canonical14 source or runtime size measurements mismatch actual SHA-locked files');
 evidence=Object.freeze({
   kind:'full-compiler-evidence',
   originalTwentyRegistryBlobSha:FROZEN14.registry[1],
   actualBrowserChromium:true,
   nativeRustTypedSource:true,
   independentHCodeJSReference:true,
   independentIdiomaticTypeScript:true,
   genericNonTodoDOMListAndStorageOperations:true,
   addCompleteRemoveWithPersistence:true,
   accessibleSemanticListAndLiveFeedback:true,
   unsafeHTMLNeverInterpreted:true,
   fullBrowserRestartsVerified:2,
   persistedEmojiAndCompletionVerified:true,
   originalBrowserTraceStagesVerified:15,
   independentJSTestsVerified:referenceCount,
   independentChromeTestsVerified:browserTests,
   hcodeUnicodeCodepoints:files.hc.unicodeCodepoints,
   hcodeUtf8Bytes:files.hc.utf8Bytes,
   idiomaticTypeScriptUnicodeCodepoints:files.ts.unicodeCodepoints,
   idiomaticTypeScriptUtf8Bytes:files.ts.utf8Bytes,
   codepointReductionVsIdiomaticTypeScriptPct:m.reductionCodepointPct,
   utf8ReductionVsIdiomaticTypeScriptPct:m.reductionBytePct,
   compiledBrowserJavascriptUtf8Bytes:m.generatedHCodeESMBytes,
   globalTwentyMedianNotComputed:true,
   globallyVerified70Percent:false,
   note:'All task14 business behavior is source-authored H-Code, independent JS and TypeScript app. Real Chrome executes 15 steps over 3 separate browser launches for each engine and checks durable JSON plus accessible list and live status. Per-task source savings are below the 70% goal.'
 });
 return evidence;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))
 console.log(JSON.stringify(verifyCanonical14(),null,2));
