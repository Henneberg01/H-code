#!/usr/bin/env node
// Recount the source pairs in a saved acceptance run. This is a diagnostic,
// never a fresh acceptance run or a certificate of competitive TS baselines.
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {join,resolve} from 'node:path';
import {FROZEN as f06} from './canonical20-verify-06.mjs';
import {FROZEN as f07} from './canonical20-verify-07.mjs';
import {FROZEN as f08} from './canonical20-verify-08.mjs';
import {FROZEN as f09} from './canonical20-verify-09.mjs';
import {FROZEN as f11} from './canonical20-verify-11.mjs';
import {FROZEN as f12} from './canonical20-verify-12.mjs';
import {FROZEN13 as f13} from './canonical20-verify-13.mjs';
import {FROZEN14 as f14} from './canonical20-verify-14.mjs';
import {FROZEN15 as f15} from './canonical20-verify-15.mjs';
import {SOURCES as f05} from './canonical20-verify-05.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
const blob=bytes=>createHash('sha1').update('blob '+bytes.length+'\0').update(bytes).digest('hex');
const bytes=readFileSync(join(root,'compact/canonical20/workloads.json'));
if(blob(bytes)!=='46653ef90ffb3e420fba4ddfbfac3c4cfd57f3b3')throw Error('Original twenty-task registry changed');
const registry=JSON.parse(bytes);
const path=resolve(root,process.argv[2]||'compact/results/canonical20-acceptance-2026-10-20.json');
const reportBytes=readFileSync(path),report=JSON.parse(reportBytes);
const entries=Object.entries(report.evidenceByFullTask||{});
if(!report.acceptanceComplete||report.verifiedFullWorkloads!==20||report.unsupported!==0||
 JSON.stringify(entries.map(([id])=>id))!==JSON.stringify(registry.workloads.map(w=>w.id)))throw Error('A saved complete original twenty-task acceptance report is required');
const pairs={6:f06,7:f07,8:f08,9:f09,11:f11,12:f12,13:f13,14:f14};
function measure(files){
 const measured=files.map(({path,gitBlobSha})=>{
  if(typeof path!=='string'||!(/^(compact|scripts)\//.test(path))||path.split('/').includes('..'))throw Error('Invalid source path');
  const text=new TextDecoder('utf-8',{fatal:true}).decode(readFileSync(join(root,path))).replaceAll('\r\n','\n');
  if(text.includes('\r'))throw Error('Noncanonical source newlines');
  const data=Buffer.from(text);
  if(blob(data)!==gitBlobSha)throw Error('Saved source lock differs from checkout: '+path);
  return {path,gitBlobSha,unicodeCodepoints:[...text].length,utf8Bytes:data.length};
 });
 return {files:measured,unicodeCodepoints:measured.reduce((n,f)=>n+f.unicodeCodepoints,0),utf8Bytes:measured.reduce((n,f)=>n+f.utf8Bytes,0)};
}
const fromLock=([path,gitBlobSha])=>({path,gitBlobSha});
const rows=entries.map(([id,v],i)=>{
 const n=i+1,nested=v.authoredSource?.refactored??v.authoredSource;
 let hc,ts;
 if(nested){hc=nested.hcode.files;ts=nested.typescript.files;}
 else if(n===15){hc=[f15.backend,f15.browser].map(fromLock);ts=[f15.typescriptBackend,f15.typescriptBrowser].map(fromLock);}
 else if(pairs[n]){hc=[fromLock(pairs[n].hc)];ts=[fromLock(pairs[n].ts)];}
 else if(n===5){hc=[{path:v.shaFrozen.hc,gitBlobSha:f05.hc}];ts=[{path:v.shaFrozen.ts,gitBlobSha:f05.ts}];}
 else{
  const locks=v.sourceShaLocks??v.hashLockedSources??v.sourceGitBlobShas??v.sourceGitBlobs;
  const convert=f=>({path:f.path??f.file,gitBlobSha:f.gitBlobSha??f.sha});
  hc=[convert(locks.hc)];ts=[convert(locks.ts)];
 }
 const hcode=measure(hc),typescript=measure(ts);
 const expectedH=v.hcodeDeveloperSource??v.hcodeDeveloperAuthored??nested?.hcode??{unicodeCodepoints:v.hcodeUnicodeCodepoints,utf8Bytes:v.hcodeUtf8Bytes};
 const expectedT=v.independentTypeScriptOracleSource??v.typescriptDeveloperAuthored??nested?.typescript??{unicodeCodepoints:v.typescriptCorrectnessOracleUnicodeCodepoints??v.idiomaticTypeScriptUnicodeCodepoints,utf8Bytes:v.typescriptCorrectnessOracleUtf8Bytes??v.idiomaticTypeScriptUtf8Bytes};
 for(const key of ['unicodeCodepoints','utf8Bytes'])if(hcode[key]!==expectedH[key]||typescript[key]!==expectedT[key])throw Error('Source size differs from saved acceptance report: '+id);
 const oracle=!!(v.sourceRatioIsNotALibraryBackedTSBenchmark||v.referenceSourceComparisonNotFairLibraryBenchmark||v.comparisonIsCorrectnessOracleNotCompetitiveBaseline);
 return {id,comparison:oracle?'correctness-oracle; not a competitive baseline':'source pair; competitiveness review still required',hcode,typescript,
  rawCodepointReductionPct:100*(1-hcode.unicodeCodepoints/typescript.unicodeCodepoints),rawUtf8ReductionPct:100*(1-hcode.utf8Bytes/typescript.utf8Bytes)};
});
const median=key=>{const values=rows.map(r=>r[key]).sort((a,b)=>a-b);return (values[9]+values[10])/2;};
const round=n=>Number(n.toFixed(2));
console.log(JSON.stringify({kind:'diagnostic-source-inventory',registryGitBlobSha:blob(bytes),
 savedAcceptanceReportSha256:createHash('sha256').update(reportBytes).digest('hex'),acceptanceWasRerun:false,
 originalTasks:20,correctnessOraclePairs:rows.filter(r=>r.comparison.startsWith('correctness-oracle')).length,
 counting:'Whole LF-normalized UTF-8 authored files, including comments and whitespace; task18 refactored project, task19 fixed project, task20 extended project; task02 original recursion, task15 proven B4 backend plus UI. Shared HTML/JSON, generated JS, dependencies and host runtime excluded from this source-only diagnostic; consult individual proofs for those costs.',
 rawMixedComparisonMedianCodepointReductionPct:round(median('rawCodepointReductionPct')),
 rawMixedComparisonMedianUtf8ReductionPct:round(median('rawUtf8ReductionPct')),
 competitiveBaselineAuditComplete:false,globalMedianCodepointReduction:null,objectiveAchieved:false,
 rows:rows.map(r=>({...r,rawCodepointReductionPct:round(r.rawCodepointReductionPct),rawUtf8ReductionPct:round(r.rawUtf8ReductionPct)}))},null,2));
