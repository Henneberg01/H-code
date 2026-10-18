import test from 'node:test';
import assert from 'node:assert/strict';
import {readiness,registry} from '../canonical20-coverage.mjs';

const canRunTs=Number(process.versions.node.split('.')[0])>=22;
test('all 20 canonical tasks remain registered in source order, including unsupported tasks',()=>{
  assert.equal(registry.workloads.length,20);
  assert.deepEqual(registry.workloads.map(t=>Number(t.id.slice(0,2))),
    Array.from({length:20},(_,i)=>i+1));
  assert.equal(new Set(registry.workloads.map(t=>t.id)).size,20);
  assert.equal(registry.objective.all20MustPass,true);
  assert.equal(registry.objective.codepointMedianTargetPct,70);
});
test('source-locked reference-only examples cannot be misrepresented as global 70% proof',{skip:!canRunTs},()=>{
  const r=readiness();
  assert.equal(r.preregisteredTasks,20);
  assert.equal(r.verifiedFullWorkloads,0);
  assert.equal(r.partialReferenceEvidence,2);
  assert.equal(r.unsupported,18);
  assert.equal(r.complete,false);
  assert.equal(r.globalMedianCodepointReduction,null);
  assert.equal(r.objectiveAchieved,false);
  assert.equal(r.evidenceByPartialTask['02-fibonacci-recursion'].subcasesVerified,1);
  assert.equal(r.evidenceByPartialTask['10-generic-collection-transforms'].subcasesVerified,3);
});
