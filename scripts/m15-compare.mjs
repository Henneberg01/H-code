// M15 uses the exact eight frozen M10 tasks, not a reselected set.
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {join,resolve} from 'node:path';
import {sourceMetrics,reduction} from './compact-metrics.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
export const manifest=JSON.parse(readFileSync(join(root,'compact/benchmarks/m15/manifest.json'),'utf8'));
const ids=['typed-function','chained-functions','recursive-fibonacci','counter-loop','string-greeting','boolean-check','recursive-factorial','conditional-branch'];
const gitBlob=bytes=>createHash('sha1').update('blob '+bytes.length+'\0').update(bytes).digest('hex');
const median=values=>{
  const xs=[...values].sort((a,b)=>a-b);
  const n=xs.length/2;
  return Number((xs.length%2?xs[Math.floor(n)]:(xs[n-1]+xs[n])/2).toFixed(2));
};
function fail(message){throw Error('M15 frozen benchmark: '+message);}
export function frozenM15Sources(){
  if(manifest.version!==1||manifest.id!=='HCODE-M15-M10-EIGHT-SAME-TASKS-2026-10-18-v1'||
     manifest.originalDataset!=='M10-EIGHT-2026-10-18-v1'||manifest.pairs?.length!==8)
    fail('invalid version or task count');
  const frozen=JSON.parse(readFileSync(join(root,'compact/results/frozen-baseline-m10-eight.json'),'utf8'));
  const tasks=JSON.parse(readFileSync(join(root,'compact/benchmarks/paired/manifest.json'),'utf8'));
  if(frozen.id!==manifest.originalDataset||frozen.pairs.length!==8||tasks.pairs.length!==8)
    fail('original task inventory missing');
  return manifest.pairs.map((caseFile,i)=>{
    const id=ids[i],m10=frozen.pairs[i],old=tasks.pairs[i];
    if(caseFile.id!==id||m10.id!==id||old.id!==id||
      caseFile.expected!==old.expected||caseFile.m10.path!==m10.hcodePath||
      caseFile.m10.blob!==m10.hcodeBlobSha||caseFile.typescript.path!==m10.tsPath||
      caseFile.typescript.blob!==m10.tsBlobSha)fail('baseline replaced or task omitted: '+id);
    function verified(item,path){
      if(item.path!==path||!/^[a-f0-9]{40}$/.test(item.blob))fail('invalid path or hash: '+id);
      const bytes=readFileSync(join(root,item.path));
      if(gitBlob(bytes)!==item.blob)fail('frozen source changed: '+item.path);
      return bytes.toString('utf8');
    }
    return {
      id,expected:caseFile.expected,
      m10Path:caseFile.m10.path,m15Path:caseFile.m15.path,typescriptPath:caseFile.typescript.path,
      original:verified(caseFile.m10,'compact/benchmarks/paired/'+id+'.hc'),
      m15:verified(caseFile.m15,'compact/benchmarks/m15/'+id+'.hc'),
      typescript:verified(caseFile.typescript,'compact/benchmarks/paired/'+id+'.ts')
    };
  });
}
function run(program,args,label){
  const child=spawnSync(program,args,{cwd:root,encoding:'utf8',windowsHide:true,timeout:180000});
  if(child.error||child.status!==0)fail(label+': '+(child.error?.message||child.stderr||child.status));
  return child.stdout.replace(/\r\n/g,'\n');
}
export function compareM15(){
  if(Number(process.versions.node.split('.')[0])<22)fail('Node 22+ required');
  const cases=[];
  for(const p of frozenM15Sources()){
    const ts=run(process.execPath,['--experimental-strip-types',join(root,p.typescriptPath)],p.id+' TS');
    const original=run('cargo',['run','--quiet','--manifest-path','compiler/Cargo.toml','--','run',join(root,p.m10Path)],p.id+' M10 compiled');
    const newest=run('cargo',['run','--quiet','--manifest-path','compiler/Cargo.toml','--','run',join(root,p.m15Path)],p.id+' M15 compiled');
    if(ts!==p.expected||original!==p.expected||newest!==p.expected)fail('compiler/output mismatch: '+p.id);
    const a=sourceMetrics(p.original),b=sourceMetrics(p.m15),c=sourceMetrics(p.typescript);
    cases.push({
      id:p.id,verifiedOutput:true,
      codepoints:{m10:a.codePoints,m15:b.codePoints,typescript:c.codePoints},
      utf8Bytes:{m10:a.utf8Bytes,m15:b.utf8Bytes,typescript:c.utf8Bytes},
      m10CodepointReductionVsTS:reduction(a.codePoints,c.codePoints),
      m15CodepointReductionVsTS:reduction(b.codePoints,c.codePoints),
      m15CodepointReductionVsM10:reduction(b.codePoints,a.codePoints),
      m15ByteReductionVsTS:reduction(b.utf8Bytes,c.utf8Bytes)
    });
  }
  return {
    dataset:manifest.id,sameEightTasks:true,originalTSUnchanged:true,
    rustCompiledProgramsExecuted:16,typeScriptProgramsExecuted:8,
    medianM10CodepointReductionVsTS:median(cases.map(x=>x.m10CodepointReductionVsTS)),
    medianM15CodepointReductionVsTS:median(cases.map(x=>x.m15CodepointReductionVsTS)),
    medianM15ByteReductionVsTS:median(cases.map(x=>x.m15ByteReductionVsTS)),
    medianM15CodepointReductionVsM10:median(cases.map(x=>x.m15CodepointReductionVsM10)),
    canonical20Complete:false,
    limitations:'Only original M10 eight tasks; not the canonical 20, performance, dependency or AI-token benchmark',
    cases
  };
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  console.log(JSON.stringify(compareM15(),null,2));
}
