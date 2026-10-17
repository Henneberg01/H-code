// M13: exact same three previously frozen M11 tasks and unmodified TypeScript baselines.
// This is an interim source-density report, NOT the final 20-task 70% study.
import {readFileSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {execute} from '../prototype/src/hcode.mjs';
import {sourceMetrics,reduction} from './compact-metrics.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
export const corpus=JSON.parse(readFileSync(join(root,'compact/benchmarks/m13/manifest.json'),'utf8'));

function gitBlobSha(bytes){
  return createHash('sha1').update('blob '+bytes.length+'\0').update(bytes).digest('hex');
}
const median=items=>{
  if(items.length===0)return null;
  const ordered=[...items].sort((a,b)=>a-b);
  return ordered.length%2?ordered[Math.floor(ordered.length/2)]:
    Number(((ordered[ordered.length/2-1]+ordered[ordered.length/2])/2).toFixed(2));
};
function runHC(code){
  const lines=[];
  execute(code,{stdout:value=>lines.push(String(value))});
  return lines.join('\n')+'\n';
}
export function compareM13(){
  if(Number(process.versions.node.split('.')[0])<22){
    throw Error('M13 executable TypeScript parity requires Node 22 or newer');
  }
  if(corpus.version!==1||corpus.id!=='M13-SAME-M11-TASKS-2026-10-18-v1'||corpus.comparisonCases.length!==3){
    throw Error('Unexpected or mutated M13 comparison corpus');
  }
  const items=[];
  for(const p of corpus.comparisonCases){
    if(!/^[a-z0-9-]+$/.test(p.id))throw Error('Unsafe benchmark ID');
    const pair=[
      [p.originalHCodePath,p.originalHCodeSha],
      [p.newHCodePath,p.newHCodeSha],
      [p.typescriptPath,p.typescriptSha]
    ];
    const sources=[];
    for(const [relative,expectedSha] of pair){
      if(!/^compact\/benchmarks\/(m11|m13)\/[a-z0-9-]+\.(ts|hc)$/.test(relative))throw Error('Unexpected benchmark path');
      const bytes=readFileSync(join(root,relative));
      if(gitBlobSha(bytes)!==expectedSha)throw Error('Frozen source was modified: '+relative);
      sources.push(bytes.toString('utf8'));
    }
    const [oldHC,newHC,ts]=sources;
    const actualOld=runHC(oldHC),actualNew=runHC(newHC);
    const tsRun=spawnSync(process.execPath,['--experimental-strip-types',join(root,p.typescriptPath)],{
      cwd:root,encoding:'utf8',timeout:15000,windowsHide:true
    });
    if(tsRun.error||tsRun.status!==0)throw Error('TypeScript run failed for '+p.id+': '+(tsRun.error?.message||tsRun.stderr));
    const actualTS=tsRun.stdout.replace(/\r\n/g,'\n');
    if(actualOld!==p.expected||actualNew!==p.expected||actualTS!==p.expected){
      throw Error('Behavior mismatch: '+p.id);
    }
    const previousHCode=sourceMetrics(oldHC);
    const symbolHCode=sourceMetrics(newHC);
    const typescript=sourceMetrics(ts);
    items.push({
      id:p.id,outputVerified:true,oldHCode:previousHCode,newHCode:symbolHCode,typescript,
      codePointReductionVsTypeScript:reduction(symbolHCode.codePoints,typescript.codePoints),
      utf8ReductionVsTypeScript:reduction(symbolHCode.utf8Bytes,typescript.utf8Bytes),
      codePointReductionVsOldHCode:reduction(symbolHCode.codePoints,previousHCode.codePoints)
    });
  }
  return {
    study:'M13 exact-source three-task interim comparison, not a 20-program representative study',
    corpusId:corpus.id,baselineCorpus:corpus.sourceDataset,
    verifiedVia:'JavaScript H-Code reference and Node 22 TypeScript execution; Rust compiled parity separately pending',
    medianCodePointReductionVsTypeScript:median(items.map(x=>x.codePointReductionVsTypeScript)),
    medianUtf8ReductionVsTypeScript:median(items.map(x=>x.utf8ReductionVsTypeScript)),
    dependencyFootprintMeasured:false,generatedRuntimeMeasured:false,rustCompilerVerified:false,
    cases:items
  };
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  console.log(JSON.stringify(compareM13(),null,2));
}
