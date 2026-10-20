// Task 18: actual before/after multi-file projects, unchanged assertion bytes.
import {readFileSync, mkdtempSync, rmSync, writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {join, resolve, basename} from 'node:path';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';

import {projectSources,expectedSummary,fixture,compiler,copyProject,executeProject,runProject,authored,compare,generatedSizes} from './canonical20-project-tools.mjs';

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
function fail(message){throw Error(`Canonical18 ${message}`);}
function locked(base,path,sha){
  const bytes=readFileSync(join(base,path));
  if(blob(bytes)!==sha)fail(`source lock mismatch: ${path}`);
  return bytes;
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
    baseline[language]=projectSources(base,before.files,`${folder}/baseline/${language}`);
    refactored[language]=projectSources(base,after.files,`${folder}/refactored/${language}`);
    const tests=p=>p.files.filter(f=>/\.test\.(?:hc|ts)$/.test(f.path));
    const original=tests(baseline[language]),changed=tests(refactored[language]);
    if(original.length!==2||changed.length!==2||original.some(file=>
      !changed.some(other=>basename(other.path)===basename(file.path)&&other.source===file.source))){
      fail(`assertion source changed: ${language}`);
    }
  }
  return {baseline,refactored,cases,fixtureBytes:bytes,testsUnchanged:true};
}
function generatedInputs(){
  return Array.from({length:32},(_,i)=>fixture(`generated-${i}`,
    Array.from({length:i%17},(_,j)=>(((i+3)*(j+5)*17)%81-40)/4)));
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
