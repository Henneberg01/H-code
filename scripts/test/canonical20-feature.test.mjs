import test from 'node:test';
import assert from 'node:assert/strict';
import {cpSync,mkdtempSync,rmSync,readFileSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';
import {STARTER_COMMIT,loadCanonical20FeatureSources,verifyCanonical20Feature} from '../canonical20-verify-20.mjs';

const root=fileURLToPath(new URL('../../',import.meta.url));
const folder='compact/canonical20/feature20';
function altered(path,extra=false){
  const temporary=mkdtempSync(join(tmpdir(),'jfh-feature-integrity-'));
  try{
    for(const p of [folder,'compact/canonical20/refactor18'])cpSync(join(root,p),join(temporary,p),{recursive:true});
    cpSync(join(root,'compact/canonical20/workloads.json'),join(temporary,'compact/canonical20/workloads.json'));
    const file=join(temporary,folder,path);
    writeFileSync(file,extra?'export const hidden = true;\n':readFileSync(file,'utf8')+'\n');
    assert.throws(()=>loadCanonical20FeatureSources(temporary),/source lock|inventory|assertions|old source/i);
  }finally{rmSync(temporary,{recursive:true,force:true});}
}
test('the committed starter preserves old modules, tests, CLI entry and frozen new acceptance',()=>{
  const s=loadCanonical20FeatureSources();
  assert.equal(STARTER_COMMIT,'c76bdf492ddb52a315b00fdc0df54946fc29e1e8');
  assert.equal(s.oldAssertionsUnchanged,true);
  assert.equal(s.newAssertionsUnchanged,true);
  assert.equal(s.oldEntryPointUnchanged,true);
  assert.equal(s.originalModuleSourceRetained,true);
  assert.equal(s.starter.hcode.files.length,6);
  assert.equal(s.extended.hcode.files.length,8);
  assert.equal(s.extended.typescript.files.length,11);
});
test('source locking rejects retroactive starter, manifest or origin changes',()=>{
  for(const path of ['starter/hcode/statistics.hc','starter.lock.json','../refactor18/refactored/typescript/core.ts'])altered(path);
});
test('neither old assertions nor new acceptance nor expected CLI/data outcomes may be changed',()=>{
  for(const path of ['extended/hcode/report.test.hc','acceptance/hcode/range.test.hc',
    'extended/typescript/range.test.ts','cases.json','ranges.json','invalid.json','range-invalid.json','starter-cli.json'])altered(path);
});
test('the extended source lock counts every source file and rejects hidden implementations',()=>{
  for(const path of ['extended/hcode/range.hc','extended/typescript/input.ts','extended.lock.json'])altered(path);
  altered('extended/typescript/hidden.ts',true);
});
test('valid empty array and invalid empty text retain distinct frozen outcomes despite sharing an id',()=>{
  const s=loadCanonical20FeatureSources();
  for(const language of ['hcode','typescript']){
    const outcomes=s.cliOutcomes.filter(r=>r.language===language);
    assert.equal(outcomes[0].id,'empty');
    assert.equal(outcomes[12].id,'empty');
    assert.equal(outcomes[0].status,0);
    assert.notEqual(outcomes[12].status,0);
    assert.equal(outcomes[12].stdout,'');
    assert.equal(outcomes[12].diagnosticPresent,true);
  }
});
test('actual extended app preserves old behavior, passes new acceptance, and rejects old/new faults',()=>{
  const r=verifyCanonical20Feature();
  assert.equal(r.kind,'full-compiler-evidence');
  assert.equal(r.red.typeScriptMissingFeatureAssertionFailures,10);
  assert.equal(r.red.nativeCompilerErrorCountedAsAssertionFailure,false);
  assert.equal(r.oldSuiteRuns.length,4);
  assert.equal(r.fullRuns.find(x=>x.language==='hcode').assertions,102);
  assert.equal(r.fullRuns.find(x=>x.language==='typescript').tests,34);
  assert.equal(r.generatedRuns.find(x=>x.language==='hcode').assertions,168);
  assert.equal(r.generatedRuns.find(x=>x.language==='typescript').tests,56);
  assert.equal(r.additionalGeneratedInputCasesVerified,32);
  assert.equal(r.cliRuns.length,250);
  assert.ok(r.cliRuns.every(x=>x.passed));
  assert.equal(r.cliRuns.filter(x=>x.entry==='main'&&x.inputKind==='invalid').length,28);
  assert.equal(r.cliRuns.filter(x=>x.entry==='range-invalid').length,26);
  assert.equal(r.seededFaultsRejected.length,8);
  assert.ok(r.seededFaultsRejected.every(x=>x.rejectedByAssertions));
  assert.equal(r.seededFaultsRejected.filter(x=>x.oldTestsStillPass).length,4);
  assert.equal(r.globallyVerified70Percent,false);
  assert.equal(r.independentHCodeJSReference,false);
  assert.ok(r.authoredSource.hcode.files.some(f=>f.path.endsWith('/range.test.hc')));
  assert.ok(r.generatedJavaScript.cli.totalBytes>0);
  assert.ok(r.generatedJavaScript.tests.totalBytes>0);
});
