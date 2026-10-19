// Task 18: actual before/after multi-file projects, unchanged assertion bytes.
import {readFileSync, readdirSync, mkdirSync, mkdtempSync, rmSync, writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {join, resolve, basename} from 'node:path';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';

const root=fileURLToPath(new URL('../',import.meta.url));
const folder='compact/canonical20/refactor18';
const registrySha='46653ef90ffb3e420fba4ddfbfac3c4cfd57f3b3';
const acceptance='refactor a frozen baseline without modifying its required behavior or assertions';
export const BASELINE_COMMIT='43d49ba2529befc10210062eaa4128ff9260a2b0';
export const LOCK=Object.freeze({
  baseline:Object.freeze([`${folder}/baseline.lock.json`,'14b812d12478fef0dba7920dc2858865c120bee2']),
  refactored:Object.freeze([`${folder}/refactored.lock.json`,'27a4d358e8d737fcc6ab534b318915985bff034a']),
});
const blob=bytes=>createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
const sha256=bytes=>createHash('sha256').update(bytes).digest('hex');
const pct=(size,reference)=>Number((100*(1-size/reference)).toFixed(2));
function fail(message){throw Error(`Canonical18 ${message}`);}
function locked(base,path,sha){
  const bytes=readFileSync(join(base,path));
  if(blob(bytes)!==sha)fail(`source lock mismatch: ${path}`);
  return bytes;
}
function listFiles(base,directory){
  return readdirSync(join(base,directory),{withFileTypes:true}).flatMap(entry=>{
    const path=`${directory}/${entry.name}`;
    if(entry.isSymbolicLink())fail(`inventory contains a symbolic link: ${path}`);
    if(entry.isDirectory())return listFiles(base,path);
    if(!entry.isFile())fail(`inventory contains a non-file: ${path}`);
    return [path];
  }).sort();
}
function project(base,manifest,variant,language){
  const prefix=`${folder}/${variant}/${language}/`;
  const records=manifest.files.filter(file=>file.path.startsWith(prefix));
  const expected=records.map(file=>file.path).sort();
  if(!records.length||new Set(expected).size!==expected.length||
      JSON.stringify(listFiles(base,prefix.slice(0,-1)))!==JSON.stringify(expected)){
    fail(`inventory mismatch: ${variant}/${language}`);
  }
  const files=records.map(record=>{
    if(!/^\w[\w.-]*\.(?:hc|ts)$/.test(record.path.slice(prefix.length)))fail('invalid inventory path');
    const bytes=locked(base,record.path,record.gitBlobSha),source=bytes.toString('utf8');
    return {...record,source,unicodeCodepoints:[...source].length,utf8Bytes:bytes.length};
  });
  return {files,unicodeCodepoints:files.reduce((n,f)=>n+f.unicodeCodepoints,0),
    utf8Bytes:files.reduce((n,f)=>n+f.utf8Bytes,0)};
}
function expectedSummary(values){
  const ordered=[...values].sort((a,b)=>a-b),count=values.length;
  let total=0;
  for(const value of values)total+=value;
  return JSON.stringify({count,maximum:count?ordered[count-1]:0,mean:count?total/count:0,
    minimum:count?ordered[0]:0,total});
}
function fixture(id,values){
  return {id,values,summary:expectedSummary(values),positive:expectedSummary(values.filter(x=>x>0))};
}
export function loadCanonical18Sources(base=root){
  const before=JSON.parse(locked(base,...LOCK.baseline));
  const after=JSON.parse(locked(base,...LOCK.refactored));
  for(const key of ['registry','contract','cases','attributes']){
    locked(base,before[key].path,before[key].gitBlobSha);
  }
  if(before.registry.gitBlobSha!==registrySha||after.baselineCommit!==BASELINE_COMMIT||
      after.baselineManifest.gitBlobSha!==LOCK.baseline[1])fail('source lock provenance mismatch');
  const registry=JSON.parse(readFileSync(join(base,before.registry.path)));
  if(registry.workloads.length!==20||registry.workloads[17]?.id!=='18-refactor-task'||
      registry.workloads[17].acceptance!==acceptance||registry.objective.codepointMedianTargetPct!==70){
    fail('source lock acceptance changed');
  }
  const bytes=readFileSync(join(base,before.cases.path)),cases=JSON.parse(bytes);
  if(cases.length!==12||new Set(cases.map(c=>c.id)).size!==12)fail('source lock case inventory changed');
  for(const c of cases){
    if(!Array.isArray(c.values)||!c.values.every(Number.isFinite)||
        c.summary!==expectedSummary(c.values)||c.positive!==expectedSummary(c.values.filter(x=>x>0))){
      fail(`source lock expected output inconsistent: ${c.id}`);
    }
  }
  const baseline={},refactored={};
  for(const language of ['hcode','typescript']){
    baseline[language]=project(base,before,'baseline',language);
    refactored[language]=project(base,after,'refactored',language);
    const tests=p=>p.files.filter(f=>/\.test\.(?:hc|ts)$/.test(f.path));
    const original=tests(baseline[language]),changed=tests(refactored[language]);
    if(original.length!==2||changed.length!==2||original.some(file=>
      !changed.some(other=>basename(other.path)===basename(file.path)&&other.source===file.source))){
      fail(`assertion source changed: ${language}`);
    }
  }
  return {baseline,refactored,cases,fixtureBytes:bytes,testsUnchanged:true};
}
function invoke(command,args,{cwd=root,env=process.env,timeout=30000}={}){
  // Each invocation is a standalone process, not a worker of an outer node:test.
  const childEnv={...env};
  delete childEnv.NODE_TEST_CONTEXT;
  delete childEnv.NODE_TEST_REPORTER;
  const r=spawnSync(command,args,{cwd,env:childEnv,timeout,encoding:'utf8',windowsHide:true,maxBuffer:2*1024*1024});
  if(r.error)fail(`${command} could not execute: ${r.error.message}`);
  return {...r,stdout:r.stdout.replaceAll('\r\n','\n'),stderr:r.stderr.replaceAll('\r\n','\n')};
}
function success(result,label){
  if(result.status!==0)fail(`${label} failed: ${result.stderr||result.stdout}`);
  return result.stdout;
}
function compiler(){
  const manifest=join(root,'compiler/Cargo.toml');
  success(invoke('cargo',['build','--quiet','--manifest-path',manifest],{timeout:180000}),'current Rust compiler build');
  const metadata=JSON.parse(success(invoke('cargo',['metadata','--no-deps','--format-version','1','--manifest-path',manifest]),'Cargo metadata'));
  return join(metadata.target_directory,'debug',process.platform==='win32'?'hcodec.exe':'hcodec');
}
function copyProject(temporary,name,source,cases){
  const cwd=join(temporary,name);
  mkdirSync(join(cwd,'data'),{recursive:true});
  for(const file of source.files)writeFileSync(join(cwd,basename(file.path)),file.source);
  writeFileSync(join(cwd,'data/cases.json'),typeof cases==='string'?cases:JSON.stringify(cases)+'\n');
  return cwd;
}
function executeProject(binary,cwd,language){
  return language==='hcode'
    ?invoke(binary,['test','.'],{cwd,env:{...process.env,HCODE_ALLOW_FILE_READ:'1'}})
    :invoke(process.execPath,['--experimental-strip-types','--test','--test-reporter=tap','report.test.ts','statistics.test.ts'],{cwd});
}
function summaryValue(output,key){
  const values=[...output.matchAll(new RegExp(`^# ${key} (\\d+)$`,'gm'))];
  if(values.length!==1)fail(`missing or ambiguous test summary: ${key}`);
  return Number(values[0][1]);
}
function runProject(binary,cwd,language,count,variant){
  const output=success(executeProject(binary,cwd,language),`${variant}/${language}`);
  const tests=language==='hcode'?2:count*2;
  if(summaryValue(output,'tests')!==tests||summaryValue(output,'pass')!==tests||
      summaryValue(output,'fail')!==0)fail(`${variant}/${language} did not run every test`);
  const result={variant,language,inputCases:count,tests};
  if(language==='hcode'){
    result.assertions=summaryValue(output,'assertions');
    if(result.assertions!==count*6)fail(`${variant} skipped assertions`);
  }
  return result;
}
function generatedInputs(){
  return Array.from({length:32},(_,i)=>fixture(`generated-${i}`,
    Array.from({length:i%17},(_,j)=>(((i+3)*(j+5)*17)%81-40)/4)));
}
function authored(project){
  return {...project,files:project.files.map(({source,...metrics})=>metrics)};
}
function compare(hcode,typescript){
  return {unicodeCodepointReductionPct:pct(hcode.unicodeCodepoints,typescript.unicodeCodepoints),
    utf8ByteReductionPct:pct(hcode.utf8Bytes,typescript.utf8Bytes)};
}
function generatedSizes(binary,cwd,temporary,variant){
  const files=['report.test.hc','statistics.test.hc'].map(file=>{
    const output=join(temporary,`${variant}-${file}.mjs`);
    success(invoke(binary,['build',join(cwd,file),'--out',output],{cwd}),'generated test program');
    const bytes=readFileSync(output);
    return {source:file,utf8Bytes:bytes.length,sha256:sha256(bytes)};
  });
  return {files,totalBytes:files.reduce((n,f)=>n+f.utf8Bytes,0)};
}
function rejectFaults(binary,temporary,sources){
  const changes=[
    ['hcode','zero-total','core.hc','total:total','total:0'],
    ['hcode','zero-minimum','core.hc','minimum:minimum','minimum:0'],
    ['hcode','zero-is-positive','statistics.hc','(>0)','(≥0)'],
    ['typescript','zero-total','core.ts','minimum, total};','minimum, total: 0};'],
    ['typescript','zero-minimum','core.ts','minimum, total};','minimum: 0, total};'],
    ['typescript','zero-is-positive','statistics.ts','value > 0','value >= 0'],
  ];
  return changes.map(([language,id,file,previous,replacement])=>{
    const cwd=copyProject(temporary,`fault-${language}-${id}`,sources.refactored[language],sources.fixtureBytes.toString('utf8'));
    const path=join(cwd,file),source=readFileSync(path,'utf8');
    if(source.split(previous).length!==2)fail(`ambiguous seeded fault ${language}/${id}`);
    writeFileSync(path,source.replace(previous,replacement));
    const result=executeProject(binary,cwd,language),log=result.stdout+result.stderr;
    const diagnostic=language==='hcode'?'JFH-CODE assertion failed':'ERR_ASSERTION';
    if(result.status===0||!log.includes(diagnostic))fail(`seeded fault not rejected by assertions: ${language}/${id}`);
    return {language,id,rejectedByAssertions:true};
  });
}
export function verifyCanonical18(){
  const s=loadCanonical18Sources();
  if(Number(process.versions.node.split('.')[0])<22)fail('TypeScript execution requires Node 22+');
  const binary=compiler(),temporary=mkdtempSync(join(tmpdir(),'jfh-canonical18-'));
  try{
    const fixedRuns=[],generatedRuns=[],generatedJavaScript={},other=generatedInputs();
    for(const variant of ['baseline','refactored']){
      for(const language of ['hcode','typescript']){
        const cwd=copyProject(temporary,`${variant}-${language}`,s[variant][language],s.fixtureBytes.toString('utf8'));
        fixedRuns.push(runProject(binary,cwd,language,s.cases.length,variant));
        if(language==='hcode')generatedJavaScript[variant]=generatedSizes(binary,cwd,temporary,variant);
        const generated=copyProject(temporary,`generated-${variant}-${language}`,s[variant][language],other);
        generatedRuns.push(runProject(binary,generated,language,other.length,variant));
      }
    }
    const authoredSource=Object.fromEntries(['baseline','refactored'].map(variant=>[variant,
      Object.fromEntries(['hcode','typescript'].map(language=>[language,authored(s[variant][language])]))]));
    // Preserve the TypeScript baseline's large-array behavior as well. This is
    // separate from cross-language cases: native sequences already have limits.
    const large=[fixture('large-array',Array(200000).fill(1))];
    const largeRuns=['baseline','refactored'].map(variant=>{
      const cwd=copyProject(temporary,`large-${variant}-typescript`,s[variant].typescript,large);
      return runProject(binary,cwd,'typescript',large.length,variant);
    });
    const fixtureMetrics={unicodeCodepoints:[...s.fixtureBytes.toString('utf8')].length,utf8Bytes:s.fixtureBytes.length};
    const includingSharedFixture=Object.fromEntries(['baseline','refactored'].map(variant=>[variant,
      Object.fromEntries(['hcode','typescript'].map(language=>[language,{
        unicodeCodepoints:s[variant][language].unicodeCodepoints+fixtureMetrics.unicodeCodepoints,
        utf8Bytes:s[variant][language].utf8Bytes+fixtureMetrics.utf8Bytes}]))]));
    return {
      workloadId:'18-refactor-task',kind:'full-compiler-evidence',acceptance,
      originalRegistryGitBlobSha:registrySha,baselineCommit:BASELINE_COMMIT,
      concreteFixtureEstablishedOn:'2026-10-19',preexistingConcreteFixture:false,
      frozenAssertionsUnchanged:s.testsUnchanged,nativeRustCompiler:true,independentIdiomaticTypeScript:true,
      independentHCodeJSReference:false,fixedInputCasesVerified:s.cases.length,
      additionalGeneratedInputCasesVerified:other.length,fixedRuns,generatedRuns,
      typeScriptLargeArrayRegression:{elements:200000,runs:largeRuns,nativeCoverageClaimed:false},
      seededFaultsRejected:rejectFaults(binary,temporary,s),authoredSource,
      sourceCompression:{baselineVsTypeScript:compare(s.baseline.hcode,s.baseline.typescript),
        refactoredVsTypeScript:compare(s.refactored.hcode,s.refactored.typescript),
        hcodeRefactor:compare(s.refactored.hcode,s.baseline.hcode)},
      sharedFixture:fixtureMetrics,includingSharedFixture,
      includingSharedFixtureCompression:compare(includingSharedFixture.refactored.hcode,includingSharedFixture.refactored.typescript),
      generatedJavaScript,externalPackageDependencies:0,globallyVerified70Percent:false,
      limitations:'Only task18. All project modules, types, fixture readers and tests count as authored source. Shared JSON input is separate and included in alternate totals. Generated JS includes duplicated runtime per test file. No speed, AI-token, toolchain-size or global median claim. The JS reference has no local module loader and is not counted.',
    };
  }finally{rmSync(temporary,{recursive:true,force:true});}
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  console.log(JSON.stringify(verifyCanonical18(),null,2));
}
