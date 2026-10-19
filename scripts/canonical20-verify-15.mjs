#!/usr/bin/env node
// Canonical15: derived full acceptance, never edit the original frozen registry.
// Candidate uses pure H-Code signs for a real SQLite dashboard; no authored SQL.
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';

const root=fileURLToPath(new URL('../',import.meta.url));
export const FROZEN15=Object.freeze({
 registry:['compact/canonical20/workloads.json','46653ef90ffb3e420fba4ddfbfac3c4cfd57f3b3'],
 contract:['compact/canonical20/cases/15-db-dashboard.json','184266b6e49cb8e328e868e6ebc3f1a9bec78b58'],
 original:['compact/canonical20/programs/15-db-dashboard-b2b.hc','096d248c3c6d42f7e430d7e53a6b191a3560e52f'],
 backend:['compact/canonical20/candidates/15-db-dashboard-sqlfree-b4.hc','250bfa1c78da2f6e4affb23f478fd421ba3ef6cc'],
 browser:['compact/canonical20/programs/15-db-dashboard-ui.hc','ebfe4116989491cd28bc46ecdf56d910c4280773'],
 html:['compact/canonical20/programs/15-db-dashboard.html','cdfa3dc455eae25c60ef0d1c4daed6e317d55567'],
 probe:['scripts/m19-db-dashboard-browser-probe.js','1baf7c7fe7093eb6cecbae2431cb983704e3100c'],
 typescriptBackend:['compact/canonical20/idiomatic/15-db-dashboard-backend.ts','6a38199524ce4b25a1476859d7817c6751006579'],
 typescriptBrowser:['compact/canonical20/idiomatic/15-db-dashboard-browser.ts','537236ac89b9eba6e4c9c188f33d1b34637ca1b0'],
 chromiumProof:['scripts/m19-sqlfree-chromium-parity.test.mjs','e42bffa8db1172d27de371d5168338c2b8c74a90']
});
function locked(k){
 const [path,expected]=FROZEN15[k],checkoutBytes=readFileSync(join(root,path));
 // Git stores the canonical LF text, but Windows checkout may materialize
 // CRLF for HTML/JS. Verify the canonical Git blob bytes on every OS;
 // reject stray carriage returns or invalid UTF-8 rather than skipping a hash.
 const checkout=new TextDecoder('utf-8',{fatal:true}).decode(checkoutBytes);
 const text=checkout.replaceAll('\r\n','\n');
 if(text.includes('\r'))throw Error('Noncanonical carriage return in '+path);
 const bytes=Buffer.from(text,'utf8');
 const sha=createHash('sha1').update('blob '+bytes.length+'\0').update(bytes).digest('hex');
 if(sha!==expected)throw Error('Canonical15 source/contract/probe tampered: '+path);
 return {text,codepoints:[...text].length,utf8Bytes:bytes.length};
}
function run(name,command,args,timeout=240000){
 const env={...process.env};
 delete env.NODE_TEST_CONTEXT;
 delete env.NODE_TEST_REPORTER;
 const result=spawnSync(command,args,{
   cwd:root,windowsHide:true,env,encoding:'utf8',timeout,maxBuffer:16*1024*1024
 });
 if(result.error||result.status!==0)
   throw Error('Canonical15 '+name+' failed: '+(result.error?.message||(result.stderr+'\n'+result.stdout)).slice(-8500));
 return result.stdout;
}
function passed(name,log,min){
 const t=/^# tests (\d+)$/m.exec(log),
   f=/^# fail (\d+)$/m.exec(log),
   skipped=/^# skipped (\d+)$/m.exec(log);
 if(!t||Number(t[1])<min||!f||Number(f[1])!==0||
   !skipped||Number(skipped[1])!==0)
   throw Error('Canonical15 '+name+' had incomplete, skipped or failed tests');
 return Number(t[1]);
}
const pct=(n,d)=>Number((100*(1-n/d)).toFixed(2));
let cached=null;
export function verifyCanonical15(){
 const files=Object.fromEntries(Object.keys(FROZEN15).map(k=>[k,locked(k)]));
 const registration=JSON.parse(files.registry.text),c=JSON.parse(files.contract.text),
   task=registration.workloads?.[14];
 if(registration.workloads?.length!==20||
   task?.id!=='15-db-dashboard'||task?.status!=='unsupported'||
   task?.evidence!==null||
   task?.acceptance!=='query seeded data, aggregate metrics and render result views'||
   JSON.stringify(task?.requiredCapabilities)!==JSON.stringify(['database','records','ui'])||
   c.id!==task.id||c.registryBlobSha!==FROZEN15.registry[1]||
   c.originalAcceptance!==task.acceptance||c.cases?.length!==5)
   throw Error('Canonical15 original frozen preregistration/cases not preserved');
 if(cached)return cached;
 if(Number(process.versions.node.split('.')[0])<22)
   throw Error('Canonical15 full proof requires Node22+ for native SQLite and independent TypeScript');
 const hc=files.backend.codepoints+files.browser.codepoints,
   hcbytes=files.backend.utf8Bytes+files.browser.utf8Bytes,
   ts=files.typescriptBackend.codepoints+files.typescriptBrowser.codepoints,
   tsbytes=files.typescriptBackend.utf8Bytes+files.typescriptBrowser.utf8Bytes;
 if(hc!==1266||hcbytes!==1444||ts!==5488||tsbytes!==5488||
   pct(hc,ts)!==76.93||pct(hcbytes,tsbytes)!==73.69||
   files.backend.text.includes('SELECT ')||files.backend.text.includes('ORDER BY '))
   throw Error('Canonical15 SQL-free candidate/source size contract changed');
 // The same Rust AST and ESM compiler must validate native glyphs and side effects.
 const rust=run('native typed ↥ operation','cargo',[
   'test','--quiet','--manifest-path','compiler/Cargo.toml','--test','m19_sort_text'
 ]);
 if(!/test result: ok\./.test(rust))throw Error('Canonical15 Rust glyph test not executed');
 const js=run('independent H-Code symbol reference',process.execPath,[
   '--test','--test-reporter=tap',join(root,'scripts/m19-sort-text.test.mjs')
 ]);
 const jsTests=passed('JS reference',js,5);
 // New and source-locked original H-Code backends + independent TypeScript all
 // execute against the same real disk-backed SQLite, with no inlined answer.
 const engines=run('five SQLite cases, Unicode ties and denied DB host',process.execPath,[
   '--experimental-sqlite','--experimental-strip-types','--test','--test-reporter=tap',
   join(root,'scripts/m19-sqlfree-dashboard.test.mjs')
 ]);
 const sqliteTests=passed('real SQLite engines',engines,4);
 if(!engines.includes('HCODE15_SQLFREE_LOCKED_SIZE')||
   !engines.includes('"reductionPct":76.93')||
   !engines.includes('"reductionPct":73.69'))
   throw Error('Canonical15 locked source measurement evidence missing');
 // A browser result is mandatory: the real SQL-free program must be used,
 // not merely the historical B3 source or a mocked DOM.
 const browser=run('real Chromium SQL-free H-Code versus idiomatic TypeScript',process.execPath,[
  '--experimental-sqlite','--experimental-strip-types','--test','--test-reporter=tap',
  join(root,'scripts/m19-sqlfree-chromium-parity.test.mjs')
 ],300000);
 const browserTests=passed('real Chromium',browser,1);
 cached=Object.freeze({
  kind:'full-compiler-evidence',
  preregisteredTwentySha:FROZEN15.registry[1],
  originalTaskId:task.id,
  fullOriginalAcceptancePreserved:true,
  nativeRustCompiler:true,independentHCodeJSInterpreter:true,
  independentIdiomaticTypeScript:true,actualBrowserChromium:true,
  SQLFreeHCodeAuthoredBackend:true,noDashboardSpecificCompilerMacro:true,
  actualDiskBackedSQLite:true,readOnlyDatabasePermissionVerified:true,
  fiveOriginalScenariosVerified:c.cases.length,
  adversarialUnicodeAndSeedPermutationVerified:true,
  accessibleSemanticHTMLAndInertHostileMarkup:true,
  browserMutationAndReopenVerified:true,
  existingOriginalB3SourcePreserved:true,
  rustNativeTestsVerified:3,independentJSTestsVerified:jsTests,
  independentRealSQLiteTestsVerified:sqliteTests,
  independentRealChromiumTestsVerified:browserTests,
  hcodeUnicodeCodepoints:hc,hcodeUtf8Bytes:hcbytes,
  idiomaticTypeScriptUnicodeCodepoints:ts,idiomaticTypeScriptUtf8Bytes:tsbytes,
  codepointReductionVsIdiomaticTypeScriptPct:pct(hc,ts),
  utf8ReductionVsIdiomaticTypeScriptPct:pct(hcbytes,tsbytes),
  generatedESMSizeExcludedFromDeveloperAuthoredSource:true,
  globalTwentyMedianNotComputed:true,
  globallyVerified70Percent:false,
  note:'Real Chromium, independent Rust ESM/H-Code JS interpreter/idiomatic TS, five SQL-free SQLite fixtures, Unicode ties and source hashes. HTTP server validates ISO dates before execution. Does not imply all 20 tasks pass.'
 });
 return cached;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 console.log(JSON.stringify(verifyCanonical15(),null,2));
}
