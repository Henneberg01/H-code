import test from 'node:test';
import assert from 'node:assert/strict';
import {cpSync, mkdtempSync, readFileSync, rmSync, mkdirSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {loadCanonical18Sources, verifyCanonical18, BASELINE_COMMIT} from '../canonical20-verify-18.mjs';

const root=fileURLToPath(new URL('../../',import.meta.url));
const folder='compact/canonical20/refactor18';
function altered(change){
  const temporary=mkdtempSync(join(tmpdir(),'jfh-refactor-integrity-'));
  try{
    cpSync(join(root,folder),join(temporary,folder),{recursive:true});
    mkdirSync(join(temporary,'compact/canonical20'),{recursive:true});
    cpSync(join(root,'compact/canonical20/workloads.json'),join(temporary,'compact/canonical20/workloads.json'));
    change(temporary);
    assert.throws(()=>loadCanonical18Sources(temporary),/source lock|inventory|assertion source/i);
  }finally{rmSync(temporary,{recursive:true,force:true});}
}
test('refactor proof preserves the original registry and exact before/after test bytes',()=>{
  const s=loadCanonical18Sources();
  assert.equal(BASELINE_COMMIT,'43d49ba2529befc10210062eaa4128ff9260a2b0');
  assert.equal(s.cases.length,12);
  assert.equal(s.testsUnchanged,true);
  assert.equal(s.baseline.hcode.files.length,4);
  assert.equal(s.refactored.hcode.files.length,5);
  assert.ok(s.refactored.hcode.files.some(x=>x.path.endsWith('/core.hc')));
});
test('changed baseline implementation cannot be silently reclassified as frozen',()=>altered(base=>{
  const file=join(base,folder,'baseline/hcode/statistics.hc');
  writeFileSync(file,readFileSync(file,'utf8')+'\n');
}));
test('changing assertions or fixture expectations invalidates the proof',()=>{
  for(const path of ['refactored/hcode/statistics.test.hc','cases.json'])altered(base=>{
    const file=join(base,folder,path);
    writeFileSync(file,readFileSync(file,'utf8')+'\n');
  });
});
test('editing the lock manifest cannot bless a changed source file',()=>altered(base=>{
  const file=join(base,folder,'baseline.lock.json');
  const lock=JSON.parse(readFileSync(file,'utf8'));
  lock.files[0].gitBlobSha='0'.repeat(40);
  writeFileSync(file,JSON.stringify(lock));
}));
test('extra project files cannot hide outside the authored-source inventory',()=>altered(base=>{
  const file=join(base,folder,'refactored/typescript/hidden.ts');
  mkdirSync(dirname(file),{recursive:true});
  writeFileSync(file,'export const hidden = true;\n');
}));
test('the TypeScript refactor preserves large-array behavior instead of overflowing argument limits',()=>{
  const before=new URL('../../compact/canonical20/refactor18/baseline/typescript/statistics.ts',import.meta.url).href;
  const after=new URL('../../compact/canonical20/refactor18/refactored/typescript/statistics.ts',import.meta.url).href;
  const source=`import assert from 'node:assert/strict';
    import * as before from ${JSON.stringify(before)};
    import * as after from ${JSON.stringify(after)};
    const values=Array(200000).fill(1);
    for(const name of ['summarize','positiveSummary'])assert.deepEqual(after[name](values),before[name](values));`;
  const out=spawnSync(process.execPath,['--experimental-strip-types','--input-type=module','--eval',source],{
    encoding:'utf8',timeout:30000,windowsHide:true,
  });
  assert.ifError(out.error);
  assert.equal(out.status,0,out.stderr);
});
test('real before/after projects pass frozen and generated cases and reject seeded faults',()=>{
  const r=verifyCanonical18();
  assert.equal(r.kind,'full-compiler-evidence');
  assert.equal(r.frozenAssertionsUnchanged,true);
  assert.equal(r.fixedInputCasesVerified,12);
  assert.equal(r.additionalGeneratedInputCasesVerified,32);
  assert.equal(r.fixedRuns.length,4);
  assert.equal(r.generatedRuns.length,4);
  assert.ok(r.fixedRuns.filter(x=>x.language==='hcode').every(x=>x.assertions===72));
  assert.ok(r.generatedRuns.filter(x=>x.language==='hcode').every(x=>x.assertions===192));
  assert.equal(r.seededFaultsRejected.length,6);
  assert.equal(r.typeScriptLargeArrayRegression.elements,200000);
  assert.equal(r.typeScriptLargeArrayRegression.runs.length,2);
  assert.equal(r.independentHCodeJSReference,false);
  assert.equal(r.globallyVerified70Percent,false);
  assert.ok(r.authoredSource.refactored.hcode.files.some(x=>x.path.endsWith('.test.hc')));
  assert.ok(r.generatedJavaScript.refactored.totalBytes>0);
});
