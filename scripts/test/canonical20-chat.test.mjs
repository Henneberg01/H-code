import test from 'node:test';
import assert from 'node:assert/strict';
import {cpSync,mkdirSync,mkdtempSync,rmSync,readFileSync,writeFileSync,symlinkSync,unlinkSync} from 'node:fs';
import {join,dirname} from 'node:path';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';
import {loadCanonical17Sources,verifyCanonical17} from '../canonical20-verify-17.mjs';
const root=fileURLToPath(new URL('../../',import.meta.url)),folder='compact/canonical20/chat17';
function altered(path,mode='append'){
 const temporary=mkdtempSync(join(tmpdir(),'jfh-chat-integrity-'));
 try{
  for(const p of [folder,'compact/canonical20/workloads.json','package-lock.json','third_party/ws-LICENSE.txt']){
   mkdirSync(dirname(join(temporary,p)),{recursive:true});cpSync(join(root,p),join(temporary,p),{recursive:true});
  }
  const file=join(temporary,path);
  if(mode==='symlink'){unlinkSync(file);symlinkSync(join(root,path),file);}
  else writeFileSync(file,mode==='extra'?'export const hidden = true;\n':readFileSync(file,'utf8')+'\n');
  assert.throws(()=>loadCanonical17Sources(temporary),/source lock|inventory/);
 }finally{rmSync(temporary,{recursive:true,force:true});}
}
test('frozen chat sources count whole apps and retain the preregistered wire protocol',()=>{
 const s=loadCanonical17Sources();assert.equal(s.fixture.scenarios.length,4);
 assert.equal(s.hcode.unicodeCodepoints,1689);assert.equal(s.hcode.utf8Bytes,2065);
 assert.equal(s.typescript.unicodeCodepoints,3968);assert.equal(s.typescript.files.length,1);
});
test('contract, fixtures, dependency metadata and application lock cannot bless retroactive changes',()=>{
 for(const path of ['compact/canonical20/workloads.json',`${folder}/CONTRACT.md`,`${folder}/fixtures.json`,
  `${folder}/contract.lock.json`,`${folder}/application.lock.json`,'package-lock.json','third_party/ws-LICENSE.txt'])altered(path);
});
test('changed, hidden and symlinked app implementations invalidate whole-source inventory',()=>{
 altered(`${folder}/hcode/main.hc`);altered(`${folder}/typescript/main.ts`);
 altered(`${folder}/typescript/hidden.ts`,'extra');altered(`${folder}/hcode/main.hc`,'symlink');
});
test('actual isolated clients prove routing, ordered bursts, disconnects and rejected faults',()=>{
 const r=verifyCanonical17();assert.equal(r.kind,'full-compiler-evidence');
 assert.equal(r.fixedRuns.length,12);assert.equal(r.generatedRuns.length,24);
 assert.equal(r.abruptRuns.length,3);assert.equal(r.counterBoundaryRuns.length,3);
 assert.equal(r.acceptedChatMessages,2526);assert.equal(r.concurrentSends,2388);
 assert.equal(r.forcedDisconnects,3);assert.equal(r.seededFaultsRejected.length,9);
 assert.equal(r.externalPackageDependencies,1);assert.ok(r.maintainedDependency.totalBytes>0);
 assert.ok(r.sourceCompression.unicodeCodepointReductionPct<70);
 assert.ok(r.includingSharedFixtureCompression.unicodeCodepointReductionPct<r.sourceCompression.unicodeCodepointReductionPct);
 assert.equal(r.globallyVerified70Percent,false);
});
