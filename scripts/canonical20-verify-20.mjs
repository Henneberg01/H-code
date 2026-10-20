// Extend an actually frozen multi-file app; preserve old tests and CLI behavior.
import {readFileSync,writeFileSync,mkdtempSync,rmSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {join,basename,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';
import {lockedSource,projectSources,expectedSummary,fixture,compiler,copyProject,
  runProject,executeProject,invoke,success,summaryValue,authored,compare,generatedSizes} from './canonical20-project-tools.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
const folder='compact/canonical20/feature20';
const registrySha='46653ef90ffb3e420fba4ddfbfac3c4cfd57f3b3';
const acceptance='extend frozen starter app while retaining all prior behavior and passing new acceptance';
export const STARTER_COMMIT='c76bdf492ddb52a315b00fdc0df54946fc29e1e8';
export const LOCK=Object.freeze({
  starter:Object.freeze([`${folder}/starter.lock.json`,'f613ef20d36986c69dc142999e7ec07465bfd073']),
  extended:Object.freeze([`${folder}/extended.lock.json`,'1a75d062931872021eee12f729b74ef50eb34f2c']),
});
const fail=message=>{throw Error(`Canonical20 feature ${message}`);};
const ext=language=>language==='hcode'?'hc':'ts';
const byName=(project,name)=>project.files.find(f=>basename(f.path)===name);
const fullOptions=count=>({nativeFiles:3,nativeAssertions:72+count*3,typeScriptTests:24+count,
  typeScriptFiles:['report.test.ts','statistics.test.ts','range.test.ts']});
function checkRange(c){
  if(!Array.isArray(c.values)||!c.values.every(Number.isFinite)||!Number.isFinite(c.lower)||!Number.isFinite(c.upper)||
      c.expected!==expectedSummary(c.values.filter(value=>value>=c.lower&&value<=c.upper)))fail(`source lock expected interval: ${c.id}`);
}
export function loadCanonical20FeatureSources(base=root){
  const starter=JSON.parse(lockedSource(base,...LOCK.starter));
  const extended=JSON.parse(lockedSource(base,...LOCK.extended));
  const bytes={};
  for(const key of ['registry','contract','attributes','cases','ranges','invalid','rangeInvalid','cliOutcomes']){
    bytes[key]=lockedSource(base,starter[key].path,starter[key].gitBlobSha);
  }
  if(starter.registry.gitBlobSha!==registrySha||extended.starterCommit!==STARTER_COMMIT||
      extended.starterManifest.gitBlobSha!==LOCK.starter[1])fail('source lock provenance changed');
  const registry=JSON.parse(bytes.registry);
  if(registry.workloads.length!==20||registry.workloads[19]?.id!=='20-incremental-feature'||
      registry.workloads[19].acceptance!==acceptance)fail('source lock acceptance changed');
  const data=Object.fromEntries(['cases','ranges','invalid','rangeInvalid','cliOutcomes'].map(key=>[key,JSON.parse(bytes[key])]));
  if(data.cases.length!==12||data.ranges.length!==10||data.invalid.length!==7||data.rangeInvalid.length!==10||
      data.cliOutcomes.length!==38)fail('source lock case inventory changed');
  for(const c of data.cases){
    if(c.summary!==expectedSummary(c.values)||c.positive!==expectedSummary(c.values.filter(x=>x>0)))fail('source lock old expectations');
  }
  data.ranges.forEach(checkRange);
  const projects={starter:{},extended:{}},acceptanceSources={};
  for(const language of ['hcode','typescript']){
    for(const variant of ['starter','extended'])projects[variant][language]=projectSources(base,
      variant==='starter'?starter.files:extended.files,`${folder}/${variant}/${language}`);
    const before=projects.starter[language],after=projects.extended[language];
    for(const file of before.files){
      if(file.origin&&file.source!==lockedSource(base,file.origin.path,file.origin.gitBlobSha).toString('utf8'))fail('source lock origin changed');
      const following=byName(after,basename(file.path));
      // The feature only appends public operations to these two existing modules.
      const appended=[`statistics.${ext(language)}`,`report.${ext(language)}`].includes(basename(file.path));
      if(!following||(appended?!following.source.startsWith(file.source):following.source!==file.source)){
        fail(`old source or assertions changed: ${file.path}`);
      }
    }
    const record=starter.acceptanceTests.find(f=>f.path.includes(`/acceptance/${language}/`));
    const source=lockedSource(base,record.path,record.gitBlobSha).toString('utf8');
    if(byName(after,`range.test.${ext(language)}`)?.source!==source)fail('new acceptance assertions changed');
    if(!byName(after,`range.${ext(language)}`)||after.files.length!==before.files.length+2)fail('extended source inventory changed');
    acceptanceSources[language]=source;
  }
  return {...projects,...data,bytes,acceptanceSources,oldAssertionsUnchanged:true,newAssertionsUnchanged:true,
    oldEntryPointUnchanged:true,originalModuleSourceRetained:true};
}
function prepare(temporary,name,source,s,ranges=s.ranges){
  const cwd=copyProject(temporary,name,source,s.bytes.cases.toString('utf8'));
  writeFileSync(join(cwd,'data/ranges.json'),JSON.stringify(ranges)+'\n');
  return cwd;
}
function inputBytes(c){return c.inputHex?Buffer.from(c.inputHex,'hex'):Buffer.from(c.input,'utf8');}
function cli(args,cwd,input){
  const env={...process.env};delete env.NODE_TEST_CONTEXT;delete env.NODE_TEST_REPORTER;
  const r=spawnSync(process.execPath,args,{cwd,input,env,encoding:'utf8',timeout:10000,windowsHide:true,maxBuffer:2*1024*1024});
  if(r.error||r.signal||r.status===null)fail(`CLI did not complete: ${r.error?.message||r.signal}`);
  return {status:r.status,stdout:r.stdout.replaceAll('\r\n','\n'),diagnosticPresent:r.stderr.length>0,diagnostic:r.stderr.slice(0,2000)};
}
function expectCLI(actual,expected,label){
  if(actual.status!==expected.status||actual.stdout!==expected.stdout||actual.diagnosticPresent!==expected.diagnosticPresent){
    fail(`${label} outcome expected=${JSON.stringify(expected)} actual=${JSON.stringify(actual)}`);
  }
}
function expectRejection(actual,label){
  if(actual.status===0||actual.stdout!==''||!actual.diagnosticPresent)fail(`${label} accepted invalid input`);
}
function entry(binary,cwd,language,name){
  if(language==='typescript')return ['--experimental-strip-types',join(cwd,`${name}.ts`)];
  const output=join(cwd,`${name}.mjs`);
  success(invoke(binary,['build',join(cwd,`${name}.hc`),'--out',output],{cwd}),`${name} CLI build`);
  return [output];
}
function generatedRanges(){
  return Array.from({length:32},(_,i)=>{
    const lower=(i%11-6)/2,upper=i%8===0?lower-1:lower+(i%5)/2;
    const values=Array.from({length:i%23},(_,j)=>((i*3+j*7)%41-20)/4);
    values.push(lower,upper,lower-.25,upper+.25);
    return {id:`generated-${i}`,values,lower,upper,
      expected:expectedSummary(values.filter(x=>x>=lower&&x<=upper))};
  });
}
function generatedInvalidRanges(){
  return [
    {id:'extra-field',input:JSON.stringify({values:[1],lower:0,upper:2,extra:true})},
    {id:'boolean-upper',input:JSON.stringify({values:[1],lower:0,upper:false})},
    {id:'null-values',input:JSON.stringify({values:null,lower:0,upper:2})},
  ];
}
function redEvidence(binary,temporary,s){
  const cwd=prepare(temporary,'starter-new-acceptance',s.starter.typescript,s);
  writeFileSync(join(cwd,'range.test.ts'),s.acceptanceSources.typescript);
  const r=invoke(process.execPath,['--experimental-strip-types','--test','--test-reporter=tap','range.test.ts'],{cwd});
  if(r.status===0||summaryValue(r.stdout,'tests')!==10||summaryValue(r.stdout,'fail')!==10||
      !/^\s+code: 'ERR_ASSERTION'$/m.test(r.stdout)||!/^\s+actual: 'undefined'$/m.test(r.stdout)||
      !/^\s+expected: 'function'$/m.test(r.stdout))fail('new acceptance did not reject absent feature');
  // Check the native interface too, without calling a compiler error an assertion failure.
  const native=prepare(temporary,'starter-native-interface',s.starter.hcode,s);
  writeFileSync(join(native,'range.test.hc'),s.acceptanceSources.hcode);
  const check=invoke(binary,['check',join(native,'range.test.hc')],{cwd:native});
  if(check.status===0||!check.stderr.includes('rangeSummary'))fail('native starter falsely exposes feature');
  return {typeScriptMissingFeatureAssertionFailures:10,nativeStarterHasNoRangeOperation:true,
    nativeCompilerErrorCountedAsAssertionFailure:false};
}
function rejectFaults(binary,temporary,s){
  const changes=[
    ['hcode','exclusive-lower','statistics.hc','x≥lower','x>lower',true],
    ['hcode','exclusive-upper','statistics.hc','x≤upper','x<upper',true],
    ['hcode','old-positive-regression','statistics.hc','(>0)','(≥0)',false],
    ['hcode','old-total-regression','core.hc','total:total','total:0',false],
    ['typescript','exclusive-lower','statistics.ts','value >= lower','value > lower',true],
    ['typescript','exclusive-upper','statistics.ts','value <= upper','value < upper',true],
    ['typescript','old-positive-regression','statistics.ts','value > 0','value >= 0',false],
    ['typescript','old-total-regression','core.ts','minimum, total};','minimum, total: 0};',false],
  ];
  return changes.map(([language,id,file,before,after,newOnly])=>{
    const cwd=prepare(temporary,`fault-${language}-${id}`,s.extended[language],s),path=join(cwd,file);
    const source=readFileSync(path,'utf8');
    if(source.split(before).length!==2)fail(`ambiguous fault ${language}/${id}`);
    writeFileSync(path,source.replace(before,after));
    const r=executeProject(binary,cwd,language,fullOptions(10));
    const diagnostic=language==='hcode'?/^# Error: JFH-CODE assertion failed at \d+:\d+$/m:/^\s+code: 'ERR_ASSERTION'$/m;
    if(r.status===0||!diagnostic.test(r.stdout+r.stderr)||summaryValue(r.stdout,'fail')<1)fail(`fault not rejected by assertions: ${language}/${id}`);
    const oldLabels=[...r.stdout.matchAll(language==='hcode'?/^(ok|not ok) \d+ - .*[/\\](?:report|statistics)\.test\.hc$/gm:/^(ok|not ok) \d+ - (?:report|statistics): /gm)];
    const oldPassed=oldLabels.length===(language==='hcode'?2:24)&&oldLabels.every(x=>x[1]==='ok');
    if(newOnly?!oldPassed:oldPassed)fail(`fault did not exercise intended old/new tests: ${language}/${id}`);
    return {language,id,rejectedByAssertions:true,oldTestsStillPass:oldPassed};
  });
}
export function verifyCanonical20Feature(){
  const s=loadCanonical20FeatureSources();
  if(Number(process.versions.node.split('.')[0])<22)fail('TypeScript execution requires Node 22+');
  const binary=compiler(),temporary=mkdtempSync(join(tmpdir(),'jfh-canonical20-'));
  try{
    const oldSuiteRuns=[],fullRuns=[],generatedRuns=[],cliRuns=[],generated=generatedRanges();
    const generatedJavaScript={};
    const red=redEvidence(binary,temporary,s);
    for(const language of ['hcode','typescript']){
      for(const variant of ['starter','extended']){
        const source=s[variant][language];
        const oldSource={...source,files:source.files.filter(f=>basename(f.path)!==`range.test.${ext(language)}`)};
        const old=prepare(temporary,`old-${variant}-${language}`,oldSource,s);
        oldSuiteRuns.push(runProject(binary,old,language,12,variant));
        const cwd=prepare(temporary,`${variant}-${language}`,source,s),main=entry(binary,cwd,language,'main');
        const frozenOutcomes=s.cliOutcomes.filter(r=>r.language===language);
        for(const [index,c] of [...s.cases.map(c=>({id:c.id,input:JSON.stringify(c.values)})),...s.invalid].entries()){
          const expected=frozenOutcomes[index];
          if(!expected||expected.id!==c.id)fail('missing or reordered frozen CLI outcome');
          const actual=cli(main,cwd,inputBytes(c));
          expectCLI(actual,expected,`${variant}/${language}/${c.id}`);
          cliRuns.push({variant,language,id:c.id,entry:'main',inputKind:index<s.cases.length?'valid':'invalid',passed:true});
        }
        if(variant==='starter')continue;
        fullRuns.push(runProject(binary,cwd,language,22,variant,fullOptions(10)));
        const extra=prepare(temporary,`generated-${language}`,source,s,generated);
        generatedRuns.push(runProject(binary,extra,language,44,'extended-generated',fullOptions(32)));
        const range=entry(binary,cwd,language,'range');
        for(const c of [...s.ranges,...generated]){
          expectCLI(cli(range,cwd,Buffer.from(JSON.stringify({values:c.values,lower:c.lower,upper:c.upper}))),
            {status:0,stdout:c.expected+'\n',diagnosticPresent:false},`${language}/range/${c.id}`);
          cliRuns.push({variant,language,id:c.id,entry:'range',passed:true});
        }
        for(const c of [...s.rangeInvalid,...generatedInvalidRanges()]){
          expectRejection(cli(range,cwd,inputBytes(c)),`${language}/range/${c.id}`);
          cliRuns.push({variant,language,id:c.id,entry:'range-invalid',passed:true});
        }
        for(const c of generated){
          const old=fixture(c.id,c.values);
          expectCLI(cli(main,cwd,Buffer.from(JSON.stringify(c.values))),
            {status:0,stdout:old.summary+'\n'+old.positive+'\n',diagnosticPresent:false},`${language}/main/${c.id}`);
          cliRuns.push({variant,language,id:c.id,entry:'main-generated',passed:true});
        }
        if(language==='hcode'){
          generatedJavaScript.cli=generatedSizes(binary,cwd,temporary,'extended-cli',['main.hc','range.hc']);
          generatedJavaScript.tests=generatedSizes(binary,cwd,temporary,'extended-tests',
            ['report.test.hc','statistics.test.hc','range.test.hc']);
        }
      }
    }
    const sharedKeys=['cases','ranges','invalid','rangeInvalid','cliOutcomes'];
    const sharedFixtures={unicodeCodepoints:sharedKeys.reduce((n,k)=>n+[...s.bytes[k].toString('utf8')].length,0),
      utf8Bytes:sharedKeys.reduce((n,k)=>n+s.bytes[k].length,0)};
    const includingSharedFixtures=Object.fromEntries(['hcode','typescript'].map(language=>[language,{
      unicodeCodepoints:s.extended[language].unicodeCodepoints+sharedFixtures.unicodeCodepoints,
      utf8Bytes:s.extended[language].utf8Bytes+sharedFixtures.utf8Bytes}]));
    return {workloadId:'20-incremental-feature',kind:'full-compiler-evidence',acceptance,
      originalRegistryGitBlobSha:registrySha,starterCommit:STARTER_COMMIT,concreteFixtureEstablishedOn:'2026-10-20',
      preexistingConcreteTask20Fixture:false,oldAssertionsUnchanged:s.oldAssertionsUnchanged,
      newAssertionsUnchanged:s.newAssertionsUnchanged,oldEntryPointUnchanged:s.oldEntryPointUnchanged,
      originalModuleSourceRetained:s.originalModuleSourceRetained,red,oldSuiteRuns,fullRuns,generatedRuns,cliRuns,
      fixedOldInputCases:12,fixedIntervalInputCases:10,additionalGeneratedInputCasesVerified:32,
      additionalInvalidRangeInputsVerified:3,
      seededFaultsRejected:rejectFaults(binary,temporary,s),nativeRustCompiler:true,
      independentIdiomaticTypeScript:true,independentHCodeJSReference:false,
      authoredSource:{hcode:authored(s.extended.hcode),typescript:authored(s.extended.typescript)},
      sourceCompression:compare(s.extended.hcode,s.extended.typescript),sharedFixtures,includingSharedFixtures,
      includingSharedFixtureCompression:compare(includingSharedFixtures.hcode,includingSharedFixtures.typescript),
      generatedJavaScript,externalPackageDependencies:0,globallyVerified70Percent:false,
      limitations:'Only task20. Starter CLI is established and committed before extension, derived from task18 modules. Whole extended project counts, including old/new tests, both CLI entries, input readers and types. Shared data and CLI outcomes are separate and inclusive; generated runtime is separate. Independent JS reference has no local module loader. No global median, universal floating-point, runtime-performance or AI-token claim.'};
  }finally{rmSync(temporary,{recursive:true,force:true});}
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))console.log(JSON.stringify(verifyCanonical20Feature(),null,2));
