import test from 'node:test';
import assert from 'node:assert/strict';
import {cpSync,mkdtempSync,rmSync,readFileSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {loadCanonical19Sources,verifyCanonical19,SEED_COMMIT,oldNativeTestsPassed} from '../canonical20-verify-19.mjs';

const root=fileURLToPath(new URL('../../',import.meta.url));
const folder='compact/canonical20/bug19';
function altered(path){
  const temporary=mkdtempSync(join(tmpdir(),'jfh-repair-lock-'));
  try{
    for(const p of [folder,'compact/canonical20/refactor18'])cpSync(join(root,p),join(temporary,p),{recursive:true});
    cpSync(join(root,'compact/canonical20/workloads.json'),join(temporary,'compact/canonical20/workloads.json'));
    const file=join(temporary,folder,path);
    writeFileSync(file,readFileSync(file,'utf8')+'\n');
    assert.throws(()=>loadCanonical19Sources(temporary),/source lock|inventory|assertion|repair/i);
  }finally{rmSync(temporary,{recursive:true,force:true});}
}
test('seed, prior project and both old/new assertion sources remain anchored',()=>{
  const s=loadCanonical19Sources();
  assert.equal(SEED_COMMIT,'ced043c5668d3563c51cf25049e36bff2c33a0ef');
  assert.equal(s.originalCases.length,12);
  assert.equal(s.regressions.length,6);
  assert.equal(s.oldTestsUnchanged,true);
  assert.equal(s.regressionTestsUnchanged,true);
  assert.equal(s.minimalRootCauseRepair,true);
});
test('seeded source, prior source and manifest cannot be retroactively changed',()=>{
  for(const path of ['seeded/hcode/core.hc','seed.lock.json','../refactor18/refactored/hcode/core.hc'])altered(path);
});
test('old assertions, new assertions and expected data are immutable',()=>{
  for(const path of ['fixed/hcode/statistics.test.hc','fixed/typescript/regression.test.ts','regressions.json'])altered(path);
});
test('repaired source and repaired manifest are source locked',()=>{
  for(const path of ['fixed/typescript/core.ts','fixed.lock.json'])altered(path);
});
test('native counterfactual labels accept Windows and POSIX separators and reject old failures',()=>{
  for(const separator of ['\\','/']){
    const output=`TAP version 13\nnot ok 1 - .${separator}regression.test.hc\nok 2 - .${separator}report.test.hc\nok 3 - .${separator}statistics.test.hc\n1..3\n# tests 3\n# pass 2\n# fail 1\n`;
    assert.equal(oldNativeTestsPassed(output),true,separator);
    assert.equal(oldNativeTestsPassed(output.replace('ok 2 -','not ok 2 -')),false);
  }
});
test('real seeded failures, minimal repair, regression and counterfactual are verified',()=>{
  const r=verifyCanonical19();
  assert.equal(r.kind,'full-compiler-evidence');
  assert.equal(r.oldSuiteRuns.length,4);
  assert.equal(r.reproductions.length,10);
  assert.equal(r.controls.length,2);
  assert.ok(r.reproductions.every(x=>x.failedByAssertion));
  assert.equal(r.fixedRuns.find(x=>x.language==='hcode').assertions,102);
  assert.equal(r.fixedRuns.find(x=>x.language==='typescript').tests,30);
  assert.equal(r.additionalGeneratedInputCasesVerified,32);
  assert.equal(r.generatedRuns.find(x=>x.language==='hcode').assertions,232);
  assert.equal(r.generatedRuns.find(x=>x.language==='typescript').tests,56);
  assert.ok(r.reintroducedRuns.every(x=>x.failedByAssertion&&x.oldTestsStillPass));
  assert.equal(r.globallyVerified70Percent,false);
  assert.equal(r.independentHCodeJSReference,false);
  assert.ok(r.authoredSource.hcode.files.some(x=>x.path.endsWith('/regression.test.hc')));
  assert.ok(r.generatedJavaScript.totalBytes>0);
});
