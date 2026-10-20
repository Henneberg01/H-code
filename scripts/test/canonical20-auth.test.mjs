import test from 'node:test';
import assert from 'node:assert/strict';
import {cpSync,mkdtempSync,rmSync,readFileSync,writeFileSync,symlinkSync,unlinkSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';
import {CONTRACT_COMMIT,loadCanonical16Sources,verifyCanonical16} from '../canonical20-verify-16.mjs';

const root=fileURLToPath(new URL('../../',import.meta.url)),folder='compact/canonical20/auth16';
function altered(path,mode='append'){
  const temporary=mkdtempSync(join(tmpdir(),'jfh-auth-integrity-'));
  try{
    cpSync(join(root,folder),join(temporary,folder),{recursive:true});
    cpSync(join(root,'compact/canonical20/workloads.json'),join(temporary,'compact/canonical20/workloads.json'));
    const file=join(temporary,folder,path);
    if(mode==='symlink'){unlinkSync(file);symlinkSync(join(root,folder,path),file);}
    else writeFileSync(file,mode==='extra'?'export const hidden = true;\n':readFileSync(file,'utf8')+'\n');
    assert.throws(()=>loadCanonical16Sources(temporary),/source lock|inventory/i);
  }finally{rmSync(temporary,{recursive:true,force:true});}
}
test('session contract was committed before both whole applications',()=>{
  const s=loadCanonical16Sources();
  assert.equal(CONTRACT_COMMIT,'01cef3b86b361eafc6accd2b78a6a3be6b20108e');
  assert.equal(s.fixture.flows.length,6);
  assert.equal(s.hcode.files.length,1);
  assert.equal(s.typescript.files.length,1);
  assert.equal(s.hcode.unicodeCodepoints,2403);
  assert.equal(s.typescript.unicodeCodepoints,7762);
});
test('registry, protocol, fixtures and manifests cannot be rewritten retroactively',()=>{
  for(const path of ['../workloads.json','CONTRACT.md','fixtures.json','contract.lock.json','application.lock.json'])altered(path);
});
test('whole-source inventory rejects changed, hidden and symlinked implementations',()=>{
  for(const language of ['hcode','typescript'])altered(`${language}/main.${language==='hcode'?'hc':'ts'}`);
  altered('typescript/hidden.ts','extra');
  altered('hcode/main.hc','symlink');
});
test('actual session apps survive restarts, reject stale MACs and reject broken authentication policies',()=>{
  const r=verifyCanonical16();
  assert.equal(r.kind,'full-compiler-evidence');
  assert.equal(r.httpAssertions,888);
  assert.equal(r.generationBoundaryRuns.length,3);
  assert.equal(r.forcedCrashes,45);
  assert.equal(r.concurrentRotations,42);
  assert.equal(r.keyChanges,12);
  assert.equal(r.startupRejections.length,18);
  assert.equal(r.seededFaultsRejected.length,9);
  assert.equal(r.sharedReferenceHttpAndCasHost,true);
  assert.equal(r.independentTypeScriptSQLite,true);
  assert.equal(r.sourceCompression.unicodeCodepointReductionPct,69.04);
  assert.equal(r.sourceCompression.utf8ByteReductionPct,64.13);
  assert.equal(r.globallyVerified70Percent,false);
  assert.equal(r.externalPackageDependencies,0);
  assert.ok(r.compiledJavaScript.utf8Bytes>r.authoredSource.hcode.utf8Bytes);
  assert.ok(r.includingSharedFixtureCompression.unicodeCodepointReductionPct<r.sourceCompression.unicodeCodepointReductionPct);
});
