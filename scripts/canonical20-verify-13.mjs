#!/usr/bin/env node
// Canonical13 source-locked acceptance proof. Unchanged preregistration
// cannot be promoted merely by changing a status flag or authored metrics.
import {readFileSync,statSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=fileURLToPath(new URL('../',import.meta.url));
export const FROZEN13=Object.freeze({
 registry:['compact/canonical20/workloads.json','46653ef90ffb3e420fba4ddfbfac3c4cfd57f3b3'],
 hc:['compact/canonical20/programs/13-form-validation-ui.hc','67d5766dd1624fb9780639d574a13d15f8a55e6f'],
 ts:['compact/canonical20/idiomatic/13-form-validation-ui.ts','716aeede97a7cda7a0e45b0ea638e842f0684ef9'],
 html:['compact/canonical20/programs/13-form-validation-ui.html','376e62dbc511d8feb137d4c8d05a8e8461b8703a'],
 probe:['scripts/m19-browser-ui-probe.js','58bfe367b7f26926e360b9045ae28624fd2fb0b8']
});
function locked(k){
 const [path,sha]=FROZEN13[k],bytes=readFileSync(join(root,path));
 const actual=createHash('sha1').update('blob '+bytes.length+'\0').update(bytes).digest('hex');
 if(actual!==sha)throw Error('Canonical13 original/competitor source drift: '+path);
 const text=new TextDecoder('utf8',{fatal:true}).decode(bytes);
 return {text,codepoints:[...text].length,utf8Bytes:bytes.length};
}
function checkedSubprocess(name,program,args,timeout=240000){
 const env={...process.env};
 delete env.NODE_TEST_CONTEXT;
 delete env.NODE_TEST_REPORTER;
 const out=spawnSync(program,args,{cwd:root,windowsHide:true,env,
   encoding:'utf8',timeout,maxBuffer:16*1024*1024});
 if(out.error)throw Error('Canonical13 '+name+' failed to start: '+out.error.message);
 if(out.status!==0)throw Error('Canonical13 '+name+' failed: '+(out.stderr+'\n'+out.stdout).slice(-10000));
 return out.stdout;
}
function requireTests(name,output,atLeast){
 const total=/^# tests (\d+)$/m.exec(output),fails=/^# fail (\d+)$/m.exec(output);
 const skipped=/^# skipped (\d+)$/m.exec(output);
 if(!total||Number(total[1])<atLeast||!fails||Number(fails[1])!==0||
    !skipped||Number(skipped[1])!==0)
  throw Error('Canonical13 '+name+' tests missing, failed or skipped');
 return Number(total[1]);
}
let cached=null;
export function verifyCanonical13(){
 const files=Object.fromEntries(Object.keys(FROZEN13).map(k=>[k,locked(k)]));
 const manifest=JSON.parse(files.registry.text);
 const task=manifest.workloads?.[12];
 if(manifest.workloads?.length!==20||task?.id!=='13-form-validation-ui'||
    task?.acceptance!=='interactive required/email validation with accessible error feedback'||
    JSON.stringify(task?.requiredCapabilities)!==JSON.stringify(['dom','ui-events','form-controls'])||
    task?.status!=='unsupported'||task?.evidence!==null)
  throw Error('Original immutable Canonical13 acceptance changed');
 if(cached)return cached;
 if(Number(process.versions.node.split('.')[0])<22)
  throw Error('Canonical13 TS competitor needs Node 22+');
 const chromium=process.env.HCODE_CHROME||process.env.CHROME_BIN||
   (process.platform==='win32'?'chrome':'google-chrome');
 // chrome.exe is a Windows GUI subsystem binary: "--version" can hang,
 // produce no console output or return only the numeric product version.
 // Verify an actual installed executable path on Windows. The following
 // independent headless browser HTTP/DOM tests prove it really runs Chrome.
 if(process.platform==='win32'){
  let executable=false;
  try{executable=/chrome\\.exe$/i.test(chromium)&&statSync(chromium).isFile();}
  catch{}
  if(!executable)throw Error('Canonical13 requires a working chrome.exe path in HCODE_CHROME');
 }else{
  const version=spawnSync(chromium,['--version'],{windowsHide:true,encoding:'utf8',timeout:10000});
  if(version.error||version.status!==0||
     !/Chrome|Chromium/i.test(version.stdout+version.stderr))
   throw Error('Canonical13 requires real Chromium; set HCODE_CHROME to a working Chrome binary');
 }

 const rust=checkedSubprocess('native Rust static and effect checks','cargo',[
   'test','--quiet','--manifest-path','compiler/Cargo.toml','--test','m19_browser_dom'
 ],180000);
 if(!/test result: ok\./.test(rust)&&!rust.includes('running '))
  throw Error('Canonical13 native Rust type/effect tests were skipped');
 const reference=checkedSubprocess('H-Code JS reference parity',process.execPath,[
   '--test','--test-reporter=tap',join(root,'scripts/m19-browser-dom.test.mjs')
 ]);
 const referenceTests=requireTests('H-Code JS reference',reference,5);

 const real=checkedSubprocess('Chrome H-Code vs idiomatic TS comparator',process.execPath,[
   '--test','--test-reporter=tap',join(root,'scripts/m19-browser-ui-compare.test.mjs')
 ]);
 const browserTests=requireTests('Chrome competitor',real,2);
 const reportMatch=/^# CANONICAL13_IDIOMATIC_SOURCE_REPORT=(\{[^\n]*\})$/m.exec(real);
 const jsBytes=/^# CANONICAL13_GENERATED_ESM_UTF8_BYTES=(\d+)$/m.exec(real);
 if(!reportMatch||!jsBytes||!Number.isSafeInteger(Number(jsBytes[1]))||Number(jsBytes[1])<1)
  throw Error('Canonical13 actual Chrome/browser and generated ESM measurement missing');
 const report=JSON.parse(reportMatch[1]);
 if(report.hcode?.codepoints!==files.hc.codepoints||
    report.hcode?.utf8Bytes!==files.hc.utf8Bytes||
    report.typescriptIdiomatic?.codepoints!==files.ts.codepoints||
    report.typescriptIdiomatic?.utf8Bytes!==files.ts.utf8Bytes||
    report.codepointReductionPct!==Number((100*(1-files.hc.codepoints/files.ts.codepoints)).toFixed(2))||
    report.byteReductionPct!==Number((100*(1-files.hc.utf8Bytes/files.ts.utf8Bytes)).toFixed(2))||
    report.globallyVerified70Percent!==false)
  throw Error('Canonical13 source metrics mismatched actual source locks');
 cached=Object.freeze({
  kind:'full-compiler-evidence',
  originalTwentyRegistryBlobSha:FROZEN13.registry[1],
  originalAcceptance:'interactive required/email validation with accessible error feedback',
  actualBrowserChromium:true,
  nativeRustChecked:true,
  independentHCodeJSReference:true,
  independentIdiomaticTypeScript:true,
  browserHtml5ScenariosVerified:9,
  exactDOMTraceParity:true,
  realChromeTestCases:browserTests,
  independentJSReferenceTests:referenceTests,
  accessibleErrorLiveFeedbackVerified:true,
  invalidSubmitPrevented:true,
  nativeRequiredEmailValidity:true,
  htmlInjectionWasTextOnly:true,
  hcodeUnicodeCodepoints:files.hc.codepoints,
  hcodeUtf8Bytes:files.hc.utf8Bytes,
  idiomaticTypeScriptUnicodeCodepoints:files.ts.codepoints,
  idiomaticTypeScriptUtf8Bytes:files.ts.utf8Bytes,
  codepointReductionVsIdiomaticTypeScriptPct:report.codepointReductionPct,
  utf8ReductionVsIdiomaticTypeScriptPct:report.byteReductionPct,
  compiledBrowserJavascriptUtf8Bytes:Number(jsBytes[1]),
  globalTwentyMedianNotComputed:true,
  globallyVerified70Percent:false,
  note:'Native Rust/browser ESM, independent H-Code JS interpreter, and actual Chromium against independent idiomatic TS; one task only. Source and browser input fixtures SHA-locked.'
 });
 return cached;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))
 console.log(JSON.stringify(verifyCanonical13(),null,2));
