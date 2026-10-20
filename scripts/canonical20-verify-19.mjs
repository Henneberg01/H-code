// Actual seeded failure -> minimal root-cause repair -> unchanged regression.
import {readFileSync,writeFileSync,mkdtempSync,rmSync} from 'node:fs';
import {join,basename,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';
import {lockedSource,projectSources,expectedSummary,fixture,compiler,copyProject,
  executeProject,runProject,summaryValue,success,authored,compare,generatedSizes} from './canonical20-project-tools.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
const folder='compact/canonical20/bug19';
const registrySha='46653ef90ffb3e420fba4ddfbfac3c4cfd57f3b3';
const acceptance='reproduce seeded failure, fix actual root cause and verify regression test';
export const SEED_COMMIT='ced043c5668d3563c51cf25049e36bff2c33a0ef';
export const LOCK=Object.freeze({
  seed:Object.freeze([`${folder}/seed.lock.json`,'bd15bd39340aeeac903d995a3d7134a7bc449e83']),
  fixed:Object.freeze([`${folder}/fixed.lock.json`,'bb4b7f63da93cfbdcd3a73f66887e57c68db55cd']),
});
const changes={hcode:['⟳(i<count)','⟳(i<count∧i<16)'],
  typescript:['for (const value of values)','for (const value of values.slice(0,16))']};
const fail=message=>{throw Error(`Canonical19 ${message}`);};
const byName=(project,name)=>project.files.find(f=>basename(f.path)===name);
const extension=language=>language==='hcode'?'hc':'ts';
function checkCases(cases){
  for(const c of cases){
    if(!Array.isArray(c.values)||!c.values.every(Number.isFinite)||c.summary!==expectedSummary(c.values)||
        c.positive!==expectedSummary(c.values.filter(x=>x>0)))fail(`source lock inconsistent expected output: ${c.id}`);
  }
}
export function loadCanonical19Sources(base=root){
  const seed=JSON.parse(lockedSource(base,...LOCK.seed));
  const fixed=JSON.parse(lockedSource(base,...LOCK.fixed));
  for(const key of ['registry','originalCases','regressions','contract','attributes']){
    lockedSource(base,seed[key].path,seed[key].gitBlobSha);
  }
  if(seed.registry.gitBlobSha!==registrySha||fixed.seedCommit!==SEED_COMMIT||
      fixed.seedManifest.gitBlobSha!==LOCK.seed[1])fail('source lock provenance changed');
  const registry=JSON.parse(readFileSync(join(base,seed.registry.path)));
  if(registry.workloads.length!==20||registry.workloads[18]?.id!=='19-bug-repair-task'||
      registry.workloads[18].acceptance!==acceptance)fail('source lock acceptance changed');
  const originalBytes=readFileSync(join(base,seed.originalCases.path));
  const regressionBytes=readFileSync(join(base,seed.regressions.path));
  const originalCases=JSON.parse(originalBytes),regressions=JSON.parse(regressionBytes);
  checkCases(originalCases);checkCases(regressions);
  if(originalCases.length!==12||regressions.length!==6||new Set(regressions.map(c=>c.id)).size!==6){
    fail('source lock case inventory changed');
  }
  const projects={seeded:{},fixed:{}},regressionSources={};
  for(const language of ['hcode','typescript']){
    projects.seeded[language]=projectSources(base,seed.files,`${folder}/seeded/${language}`);
    projects.fixed[language]=projectSources(base,fixed.files,`${folder}/fixed/${language}`);
    const before=projects.seeded[language],after=projects.fixed[language],core=`core.${extension(language)}`;
    if(after.files.length!==before.files.length+1)fail('repair inventory differs beyond the new regression');
    for(const file of before.files){
      const origin=lockedSource(base,file.origin.path,file.origin.gitBlobSha).toString('utf8');
      const [good,bad]=changes[language];
      if(basename(file.path)===core){
        if(origin.split(good).length!==2||file.source!==origin.replace(good,bad))fail('seed differs from declared root cause');
      }else if(file.source!==origin)fail('seed altered prior source or assertions');
      if(byName(after,basename(file.path))?.source!==origin)fail('repair is not the minimal root-cause repair');
    }
    const record=seed.regressionTests.find(file=>file.path.includes(`/regression/${language}/`));
    const source=lockedSource(base,record.path,record.gitBlobSha).toString('utf8');
    if(byName(after,`regression.test.${extension(language)}`)?.source!==source)fail('new assertion source changed');
    regressionSources[language]=source;
  }
  return {...projects,originalCases,regressions,originalBytes,regressionBytes,regressionSources,
    reproducingIds:seed.reproducingIds,controlId:seed.controlId,oldTestsUnchanged:true,
    regressionTestsUnchanged:true,minimalRootCauseRepair:true};
}
function prepare(temporary,name,source,s,regressions,language,addRegression=false){
  const cwd=copyProject(temporary,name,source,s.originalBytes.toString('utf8'));
  writeFileSync(join(cwd,'data/regression.json'),JSON.stringify(regressions)+'\n');
  if(addRegression)writeFileSync(join(cwd,`regression.test.${extension(language)}`),s.regressionSources[language]);
  return cwd;
}
function requireAssertionFailure(result,language){
  const output=result.stdout+result.stderr;
  const diagnostic=language==='hcode'?/^# Error: JFH-CODE assertion failed at \d+:\d+$/m:/^\s+code: 'ERR_ASSERTION'$/m;
  if(result.status===0||!diagnostic.test(output))fail(`${language} did not reproduce an assertion failure`);
  if(summaryValue(result.stdout,'fail')<1)fail('failure has no failing test result');
  if(language==='hcode'&&summaryValue(result.stdout,'assertions')<1)fail('failure executed no assertions');
}
const fullOptions=count=>({nativeFiles:3,nativeAssertions:72+count*5,typeScriptTests:24+count,
  typeScriptFiles:['report.test.ts','statistics.test.ts','regression.test.ts']});
function generatedInputs(){
  return Array.from({length:32},(_,i)=>{
    const values=Array.from({length:16+i},(_,j)=>((j*7+i*3)%21-10)/4);
    values.push(i%2===0?500+i:-500-i);
    return fixture(`generated-boundary-${i}`,values);
  });
}
export function oldNativeTestsPassed(output){
  const old=[...output.matchAll(/^ok \d+ - .*[/\\](?:report|statistics)\.test\.hc$/gm)];
  return old.length===2&&summaryValue(output,'tests')===3&&summaryValue(output,'pass')===2&&summaryValue(output,'fail')===1;
}
function proveReintroduction(binary,temporary,s,language){
  const cwd=prepare(temporary,`reintroduced-${language}`,s.fixed[language],s,s.regressions,language);
  const core=`core.${extension(language)}`;
  writeFileSync(join(cwd,core),byName(s.seeded[language],core).source);
  const result=executeProject(binary,cwd,language,fullOptions(6));
  requireAssertionFailure(result,language);
  if(language==='hcode'){
    if(!oldNativeTestsPassed(result.stdout)){
      fail('reintroduced native fault also broke or skipped old tests');
    }
  }else{
    const old=[...result.stdout.matchAll(/^(ok|not ok) \d+ - (?:report|statistics): /gm)];
    if(old.length!==24||old.some(x=>x[1]!=='ok')||summaryValue(result.stdout,'pass')!==25||summaryValue(result.stdout,'fail')!==5){
      fail('reintroduced TypeScript fault also broke or skipped old tests');
    }
  }
  return {language,failedByAssertion:true,oldTestsStillPass:true};
}
export function verifyCanonical19(){
  const s=loadCanonical19Sources();
  if(Number(process.versions.node.split('.')[0])<22)fail('TypeScript execution requires Node 22+');
  const binary=compiler(),temporary=mkdtempSync(join(tmpdir(),'jfh-canonical19-'));
  try{
    const oldSuiteRuns=[],reproductions=[],controls=[],fixedRuns=[],generatedRuns=[],reintroducedRuns=[];
    const other=generatedInputs();
    let generatedJavaScript;
    for(const language of ['hcode','typescript']){
      for(const variant of ['seeded','fixed']){
        const oldSource={...s[variant][language],files:s[variant][language].files.filter(f=>!basename(f.path).startsWith('regression.'))};
        const cwd=prepare(temporary,`old-${variant}-${language}`,oldSource,s,[],language);
        oldSuiteRuns.push(runProject(binary,cwd,language,12,variant));
      }
      for(const c of s.regressions){
        const cwd=prepare(temporary,`reproduce-${language}-${c.id}`,s.seeded[language],s,[c],language,true);
        const name=`regression.test.${extension(language)}`;
        const result=executeProject(binary,cwd,language,{nativeTarget:join(cwd,name),typeScriptFiles:[name]});
        if(c.id===s.controlId){
          const output=success(result,`${language} boundary control`);
          if(summaryValue(output,'tests')!==1||summaryValue(output,'pass')!==1||summaryValue(output,'fail')!==0)fail('boundary control skipped');
          if(language==='hcode'&&summaryValue(output,'assertions')!==5)fail('boundary control skipped assertions');
          controls.push({language,id:c.id,passed:true});
        }else{
          if(!s.reproducingIds.includes(c.id))fail('undeclared reproduction input');
          requireAssertionFailure(result,language);
          reproductions.push({language,id:c.id,failedByAssertion:true});
        }
      }
      const cwd=prepare(temporary,`fixed-${language}`,s.fixed[language],s,s.regressions,language);
      fixedRuns.push(runProject(binary,cwd,language,18,'fixed',fullOptions(6)));
      if(language==='hcode')generatedJavaScript=generatedSizes(binary,cwd,temporary,'fixed',
        ['report.test.hc','statistics.test.hc','regression.test.hc']);
      const generated=prepare(temporary,`generated-${language}`,s.fixed[language],s,other,language);
      generatedRuns.push(runProject(binary,generated,language,44,'fixed-generated',fullOptions(other.length)));
      reintroducedRuns.push(proveReintroduction(binary,temporary,s,language));
    }
    if(reproductions.length!==10||controls.length!==2)fail('incomplete reproduction matrix');
    const sharedFixtures={unicodeCodepoints:[...s.originalBytes.toString('utf8')].length+[...s.regressionBytes.toString('utf8')].length,
      utf8Bytes:s.originalBytes.length+s.regressionBytes.length};
    const includingSharedFixtures=Object.fromEntries(['hcode','typescript'].map(language=>[language,{
      unicodeCodepoints:s.fixed[language].unicodeCodepoints+sharedFixtures.unicodeCodepoints,
      utf8Bytes:s.fixed[language].utf8Bytes+sharedFixtures.utf8Bytes}]));
    return {workloadId:'19-bug-repair-task',kind:'full-compiler-evidence',acceptance,
      originalRegistryGitBlobSha:registrySha,seedCommit:SEED_COMMIT,deliberatelySeeded:true,
      concreteFixtureEstablishedOn:'2026-10-20',oldAssertionsUnchanged:s.oldTestsUnchanged,
      regressionAssertionsUnchanged:s.regressionTestsUnchanged,minimalRootCauseRepair:s.minimalRootCauseRepair,
      oldSuiteRuns,reproductions,controls,fixedRuns,additionalGeneratedInputCasesVerified:32,generatedRuns,reintroducedRuns,
      nativeRustCompiler:true,independentIdiomaticTypeScript:true,independentHCodeJSReference:false,
      authoredSource:{hcode:authored(s.fixed.hcode),typescript:authored(s.fixed.typescript)},
      sourceCompression:compare(s.fixed.hcode,s.fixed.typescript),sharedFixtures,includingSharedFixtures,
      includingSharedFixtureCompression:compare(includingSharedFixtures.hcode,includingSharedFixtures.typescript),
      generatedJavaScript,externalPackageDependencies:0,globallyVerified70Percent:false,
      limitations:'Only task19. Seed and repair are benchmark fixtures, not a production incident or timing study. All modules, old/new tests, types and fixture readers count. Both shared JSON files have separate and inclusive totals. Generated runtime is separate and depends on resolved paths. The JS reference has no local module loader. No global median, performance or AI-token claim.'};
  }finally{rmSync(temporary,{recursive:true,force:true});}
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))console.log(JSON.stringify(verifyCanonical19(),null,2));
