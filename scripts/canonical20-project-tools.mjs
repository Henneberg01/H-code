// Shared execution and accounting for actual multi-file benchmark projects.
import {readFileSync,readdirSync,mkdirSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {join,basename} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=fileURLToPath(new URL('../',import.meta.url));
const fail=message=>{throw Error(`Project proof ${message}`);};
export const gitBlob=bytes=>createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
export function lockedSource(base,path,sha){
  const bytes=readFileSync(join(base,path));
  if(gitBlob(bytes)!==sha)fail(`source lock mismatch: ${path}`);
  return bytes;
}
function inventory(base,directory){
  return readdirSync(join(base,directory),{withFileTypes:true}).flatMap(entry=>{
    const path=`${directory}/${entry.name}`;
    if(entry.isSymbolicLink())fail(`inventory contains a symbolic link: ${path}`);
    if(entry.isDirectory())return inventory(base,path);
    if(!entry.isFile())fail(`inventory contains a non-file: ${path}`);
    return [path];
  }).sort();
}
export function projectSources(base,records,directory){
  const prefix=directory+'/';
  const selected=records.filter(file=>file.path.startsWith(prefix));
  const expected=selected.map(file=>file.path).sort();
  if(!selected.length||new Set(expected).size!==expected.length||
      JSON.stringify(inventory(base,directory))!==JSON.stringify(expected))fail(`inventory mismatch: ${directory}`);
  const files=selected.map(record=>{
    if(!/^\w[\w.-]*\.(?:hc|ts)$/.test(record.path.slice(prefix.length)))fail('invalid inventory path');
    const bytes=lockedSource(base,record.path,record.gitBlobSha),source=bytes.toString('utf8');
    return {...record,source,unicodeCodepoints:[...source].length,utf8Bytes:bytes.length};
  });
  return {files,unicodeCodepoints:files.reduce((n,f)=>n+f.unicodeCodepoints,0),utf8Bytes:files.reduce((n,f)=>n+f.utf8Bytes,0)};
}
export function expectedSummary(values){
  const sorted=[...values].sort((a,b)=>a-b),count=values.length;
  let total=0;for(const value of values)total+=value;
  return JSON.stringify({count,maximum:count?sorted[count-1]:0,mean:count?total/count:0,minimum:count?sorted[0]:0,total});
}
export function fixture(id,values){
  return {id,values,summary:expectedSummary(values),positive:expectedSummary(values.filter(x=>x>0))};
}
export function invoke(command,args,{cwd=root,env=process.env,timeout=30000}={}){
  const childEnv={...env};
  delete childEnv.NODE_TEST_CONTEXT;delete childEnv.NODE_TEST_REPORTER;
  const r=spawnSync(command,args,{cwd,env:childEnv,timeout,encoding:'utf8',windowsHide:true,maxBuffer:2*1024*1024});
  if(r.error)fail(`${command} could not execute: ${r.error.message}`);
  return {...r,stdout:r.stdout.replaceAll('\r\n','\n'),stderr:r.stderr.replaceAll('\r\n','\n')};
}
export function success(result,label){
  if(result.status!==0)fail(`${label} failed: ${result.stderr||result.stdout}`);
  return result.stdout;
}
export function compiler(){
  const manifest=join(root,'compiler/Cargo.toml');
  success(invoke('cargo',['build','--quiet','--manifest-path',manifest],{timeout:180000}),'current Rust compiler build');
  const metadata=JSON.parse(success(invoke('cargo',['metadata','--no-deps','--format-version','1','--manifest-path',manifest]),'Cargo metadata'));
  return join(metadata.target_directory,'debug',process.platform==='win32'?'hcodec.exe':'hcodec');
}
export function copyProject(temporary,name,source,cases){
  const cwd=join(temporary,name);
  mkdirSync(join(cwd,'data'),{recursive:true});
  for(const file of source.files)writeFileSync(join(cwd,basename(file.path)),file.source);
  writeFileSync(join(cwd,'data/cases.json'),typeof cases==='string'?cases:JSON.stringify(cases)+'\n');
  return cwd;
}
export function executeProject(binary,cwd,language,{nativeTarget='.',typeScriptFiles=['report.test.ts','statistics.test.ts']}={}){
  return language==='hcode'
    ?invoke(binary,['test',nativeTarget],{cwd,env:{...process.env,HCODE_ALLOW_FILE_READ:'1'}})
    :invoke(process.execPath,['--experimental-strip-types','--test','--test-reporter=tap',...typeScriptFiles],{cwd});
}
export function summaryValue(output,key){
  const values=[...output.matchAll(new RegExp(`^# ${key} (\\d+)$`,'gm'))];
  if(values.length!==1)fail(`missing or ambiguous test summary: ${key}`);
  return Number(values[0][1]);
}
export function runProject(binary,cwd,language,count,variant,options={}){
  const output=success(executeProject(binary,cwd,language,options),`${variant}/${language}`);
  const tests=language==='hcode'?(options.nativeFiles??2):(options.typeScriptTests??count*2);
  if(summaryValue(output,'tests')!==tests||summaryValue(output,'pass')!==tests||summaryValue(output,'fail')!==0){
    fail(`${variant}/${language} did not run every test`);
  }
  const result={variant,language,inputCases:count,tests};
  if(language==='hcode'){
    result.assertions=summaryValue(output,'assertions');
    if(result.assertions!==(options.nativeAssertions??count*6))fail(`${variant} skipped assertions`);
  }
  return result;
}
export function authored(project){return {...project,files:project.files.map(({source,...metrics})=>metrics)};}
export function compare(hcode,typescript){
  const pct=(a,b)=>Number((100*(1-a/b)).toFixed(2));
  return {unicodeCodepointReductionPct:pct(hcode.unicodeCodepoints,typescript.unicodeCodepoints),utf8ByteReductionPct:pct(hcode.utf8Bytes,typescript.utf8Bytes)};
}
export function generatedSizes(binary,cwd,temporary,variant,names=['report.test.hc','statistics.test.hc']){
  const files=names.map(file=>{
    const output=join(temporary,`${variant}-${file}.mjs`);
    success(invoke(binary,['build',join(cwd,file),'--out',output],{cwd}),'generated test program');
    const bytes=readFileSync(output);
    return {source:file,utf8Bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')};
  });
  return {files,totalBytes:files.reduce((n,f)=>n+f.utf8Bytes,0)};
}
