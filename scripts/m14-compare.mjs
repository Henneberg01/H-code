// M14 vs exactly frozen M11/M13 source programs and unchanged TypeScript sources.
// Three-task provisional source-density benchmark; not the canonical 20-task study.
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {execute} from '../prototype/src/hcode.mjs';
import {sourceMetrics,reduction} from './compact-metrics.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
export const corpus=JSON.parse(readFileSync(join(root,'compact/benchmarks/m14/manifest.json'),'utf8'));
const sha=bytes=>createHash('sha1').update('blob '+bytes.length+'\0').update(bytes).digest('hex');
const median=xs=>{
  const sorted=[...xs].sort((a,b)=>a-b);
  return sorted.length?sorted[Math.floor(sorted.length/2)]:null;
};
function source(pathAndSha){
  const {path,sha:expected}=pathAndSha;
  if(!/^compact\/benchmarks\/(m11|m13|m14)\/[a-z0-9-]+\.(ts|hc)$/.test(path))throw Error('Invalid benchmark path: '+path);
  const bytes=readFileSync(join(root,path));
  if(sha(bytes)!==expected)throw Error('Frozen benchmark source changed: '+path);
  return bytes.toString('utf8');
}
function outputHC(text){
  const out=[];
  execute(text,{stdout:v=>out.push(String(v))});
  return out.join('\n')+'\n';
}
export function compareM14(){
  if(Number(process.versions.node.split('.')[0])<22)throw Error('Node 22+ required to run real TypeScript source');
  if(corpus.version!==1||corpus.id!=='M14-SAME-M11-M13-TASKS-2026-10-18-v1'||corpus.cases.length!==3)throw Error('Invalid M14 dataset');
  if(new Set(corpus.cases.map(x=>x.id)).size!==3)throw Error('Duplicate benchmark task');
  const data=[];
  for(const p of corpus.cases){
    const original=source(p.m11),m13=source(p.m13),m14=source(p.m14),ts=source(p.typescript);
    for(const [stage,hcode] of [['M11',original],['M13',m13],['M14',m14]]){
      if(outputHC(hcode)!==p.expected)throw Error(stage+' output mismatch: '+p.id);
    }
    const child=spawnSync(process.execPath,['--experimental-strip-types',join(root,p.typescript.path)],{
      cwd:root,encoding:'utf8',windowsHide:true,timeout:15000
    });
    if(child.error||child.status!==0)throw Error('TypeScript execution failed: '+p.id+': '+(child.error?.message||child.stderr));
    if(child.stdout.replace(/\r\n/g,'\n')!==p.expected)throw Error('TypeScript output mismatch: '+p.id);
    const m11Stats=sourceMetrics(original),m13Stats=sourceMetrics(m13),m14Stats=sourceMetrics(m14),tsStats=sourceMetrics(ts);
    data.push({id:p.id,outputVerified:true,codepoints:{m11:m11Stats.codePoints,m13:m13Stats.codePoints,m14:m14Stats.codePoints,typescript:tsStats.codePoints},
      utf8Bytes:{m11:m11Stats.utf8Bytes,m13:m13Stats.utf8Bytes,m14:m14Stats.utf8Bytes,typescript:tsStats.utf8Bytes},
      m14CodepointReductionVsTypeScript:reduction(m14Stats.codePoints,tsStats.codePoints),
      m14Utf8ReductionVsTypeScript:reduction(m14Stats.utf8Bytes,tsStats.utf8Bytes),
      m14CodepointReductionVsM13:reduction(m14Stats.codePoints,m13Stats.codePoints)
    });
  }
  return {
    kind:'SHA-frozen matched-task M14 interim report, NOT final 20-program research',
    corpusId:corpus.id,predecessorDataset:corpus.predecessorDataset,
    benchmarkCount:data.length,
    comparison:'Unicode codepoints primary; UTF-8 bytes separate; identical source pairs/output',
    referenceRuntimeExecuted:true,typescriptNode22Executed:true,
    rustCompilerExecuted:false,dependencyFootprintMeasured:false,generatedRuntimeMeasured:false,
    medianCodepointReductionVsTypeScript:median(data.map(x=>x.m14CodepointReductionVsTypeScript)),
    medianUtf8ReductionVsTypeScript:median(data.map(x=>x.m14Utf8ReductionVsTypeScript)),
    cases:data
  };
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  console.log(JSON.stringify(compareM14(),null,2));
}
