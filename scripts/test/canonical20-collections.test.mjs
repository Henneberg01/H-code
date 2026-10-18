import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {verifyCanonical10,LOCK} from '../canonical20-verify-10.mjs';

test('canonical10 immutable registry, M14 sources, and new full task source cannot drift',()=>{
  for(const [label,[name,expected]] of Object.entries(LOCK)){
    const b=readFileSync(new URL('../../'+name,import.meta.url));
    const got=createHash('sha1').update('blob '+b.length+'\0').update(b).digest('hex');
    assert.equal(got,expected,label+' SHA drift');
  }
  assert.equal(LOCK.registry[1],'46653ef90ffb3e420fba4ddfbfac3c4cfd57f3b3');
});

test('real Rust, reference and TS execute typed collections across all compatible value types',{
  skip:Number(process.versions.node.split('.')[0])<22
},()=>{
  const result=verifyCanonical10();
  assert.equal(result.kind,'full-compiler-evidence');
  assert.equal(result.workloadId,'10-generic-collection-transforms');
  assert.equal(result.frozenM14ProgramsCompiledAndExecuted.length,3);
  assert.equal(result.historicalM14MedianCodepointReductionPct,68.46);
  assert.equal(result.independentFixedPositiveOutputCases,11);
  assert.equal(result.generatedVariableInputSets,19);
  assert.equal(result.generatedOutputAssertions,47);
  assert.equal(result.compilerRejectedIllTypedPrograms,6);
  assert.equal(result.successfulSameOutputInRustJsAndTs,true);
  assert.equal(result.hcodeDeveloperAuthored.unicodeCodepoints,505);
  assert.equal(result.typescriptDeveloperAuthored.unicodeCodepoints,836);
  assert.equal(result.unicodeCodepointReductionPct,39.59);
  assert.equal(result.externalLibrariesUsed,false);
  assert.equal(result.generatedJsNotAuthored.sha256.length,64);
  assert.equal(result.fullTwentyMedian,null);
  assert.equal(result.global70GoalReached,false);
});
