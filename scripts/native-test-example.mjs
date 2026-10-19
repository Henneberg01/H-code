// Reproduce one illustrative library + test comparison, outside Canonical-20.
import {createHash} from 'node:crypto';
import {mkdtempSync, readFileSync, rmSync, statSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {sourceMetrics, reduction} from './compact-metrics.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
if(Number(process.versions.node.split('.')[0])<22)throw Error('This TypeScript comparison requires Node 22+');
function run(command,args){
  const result=spawnSync(command,args,{cwd:root,encoding:'utf8',timeout:180000,maxBuffer:1024*1024});
  if(result.error||result.status!==0)throw Error(`${command} failed: ${result.error?.message||result.stderr||result.stdout}`);
  return result.stdout.replaceAll('\r\n','\n');
}
const cargo=['run','--quiet','--manifest-path','compiler/Cargo.toml','--'];
const native=run('cargo',[...cargo,'test','examples/testing']);
if(!native.includes('\n1..1\n')||!native.includes('# fail 0\n')||!native.includes('# assertions 4\n')){
  throw Error('Expected exactly one native test file with four executed assertions');
}
const typescript=run(process.execPath,['--experimental-strip-types','--test','--test-reporter=tap','examples/testing/typescript/number.test.ts']);
if(!typescript.includes('# tests 1\n')||!typescript.includes('# pass 1\n')||!typescript.includes('# fail 0\n')){
  throw Error('Expected the independent TypeScript numeric helper test to pass');
}
function measure(paths){
  const files=paths.map(path=>{
    const bytes=readFileSync(join(root,path));
    return {path,sha256:createHash('sha256').update(bytes).digest('hex'),...sourceMetrics(bytes.toString('utf8'))};
  });
  return {files,codePoints:files.reduce((sum,x)=>sum+x.codePoints,0),utf8Bytes:files.reduce((sum,x)=>sum+x.utf8Bytes,0)};
}
const hcode=measure(['examples/testing/number.hc','examples/testing/number.test.hc']);
const ts=measure(['examples/testing/typescript/number.ts','examples/testing/typescript/number.test.ts']);
const temporary=mkdtempSync(join(tmpdir(),'jfh-test-example-'));
try{
  const output=join(temporary,'number.test.mjs');
  run('cargo',[...cargo,'build','examples/testing/number.test.hc','--out',output]);
  console.log(JSON.stringify({
    scope:'One numeric library and four assertions; illustrative, outside the frozen twenty workloads',
    bothImplementationsExecuted:true,canonical20Complete:false,global70PercentProved:false,
    includes:'Both handwritten module and test files, including imports and whitespace',
    hcode,typescript:ts,
    codePointReductionPercent:reduction(hcode.codePoints,ts.codePoints),
    utf8ByteReductionPercent:reduction(hcode.utf8Bytes,ts.utf8Bytes),
    generatedJavaScriptBytes:statSync(output).size,
    limitations:'No runtime-speed, AI-token, dependency-size or global-median claim; generated runtime is separate',
  },null,2));
}finally{rmSync(temporary,{recursive:true,force:true});}
