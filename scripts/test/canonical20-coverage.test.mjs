import test from 'node:test';
import assert from 'node:assert/strict';
import {readiness,registry,PREREGISTERED_GIT_BLOB_SHA} from '../canonical20-coverage.mjs';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

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
  assert.equal(r.verifiedFullWorkloads,5);
  assert.equal(r.partialReferenceEvidence,0);
  assert.equal(r.unsupported,15);
  assert.equal(r.complete,false);
  assert.equal(r.globalMedianCodepointReduction,null);
  assert.equal(r.objectiveAchieved,false);
  assert.equal(r.evidenceByFullTask['02-fibonacci-recursion'].kind,'full-compiler-evidence');
  assert.equal(r.evidenceByFullTask['02-fibonacci-recursion'].fixedAcceptanceOutput,'13\n');
  assert.equal(r.evidenceByFullTask['02-fibonacci-recursion'].positiveCasesVerified,16);
  assert.equal(r.evidenceByFullTask['02-fibonacci-recursion'].compilerStaticTypeFailuresVerified,3);
  assert.equal(r.evidenceByFullTask['02-fibonacci-recursion'].unicodeCodepointReductionPct,-2.13);
  assert.equal(r.evidenceByFullTask['10-generic-collection-transforms'].kind,'full-compiler-evidence');
  assert.equal(r.evidenceByFullTask['10-generic-collection-transforms'].frozenM14ProgramsCompiledAndExecuted.length,3);
  assert.equal(r.evidenceByFullTask['10-generic-collection-transforms'].compilerRejectedIllTypedPrograms,6);
  assert.equal(r.evidenceByFullTask['10-generic-collection-transforms'].historicalM14MedianCodepointReductionPct,68.46);
  assert.equal(r.historicalM14MedianCodepointReductionPct,68.46);
  assert.equal(r.historicalM14IsGlobalMetric,false);
  assert.equal(r.immutableRegistryGitBlobSha,PREREGISTERED_GIT_BLOB_SHA);
  assert.equal(r.capabilityDemandIsNotCompilerCoverage,true);
  assert.deepEqual(r.requestedByUnverifiedTasks.slice(0,3).map(x=>[x.capability,x.workloads]),
    [['async',3],['multi-file-project',3],['records',3]]);
  assert.equal(r.evidenceByFullTask['04-csv-validation'].kind,'full-compiler-evidence');
  assert.equal(r.evidenceByFullTask['04-csv-validation'].fixedFilesVerified,4);
  assert.equal(r.evidenceByFullTask['04-csv-validation'].generatedCSVFilesAndExpectedOutputsVerified,40);
  assert.equal(r.evidenceByFullTask['04-csv-validation'].malformedFilesRejectedByThreeEngines,6);
  assert.equal(r.evidenceByFullTask['04-csv-validation'].invalidTypesRejectedByRustAndReference,5);
  assert.equal(r.evidenceByFullTask['03-text-frequency-counter'].kind,'full-compiler-evidence');
  assert.equal(r.evidenceByFullTask['03-text-frequency-counter'].positiveFixturesVerified,10);
  assert.equal(r.evidenceByFullTask['03-text-frequency-counter'].generatedUnicodeVariantsVerified,28);
  assert.equal(r.evidenceByFullTask['03-text-frequency-counter'].staticTypeFailuresRejectedInRustAndReference,6);
  assert.equal(r.evidenceByFullTask['03-text-frequency-counter'].genericPrimitiveProgramsVerified,5);
  assert.equal(r.evidenceByFullTask['03-text-frequency-counter'].runtimeOversizedTokenSequenceRejected,true);
  assert.equal(r.evidenceByFullTask['05-json-transformation'].kind,'full-compiler-evidence');
  assert.equal(r.evidenceByFullTask['05-json-transformation'].positiveFixturesVerified,3);
  assert.equal(r.evidenceByFullTask['05-json-transformation'].generatedVariantsVerified,12);
  assert.equal(r.evidenceByFullTask['05-json-transformation'].invalidFixturesRejectedByAll,11);
});

test('registry cannot claim an unsupported case is fully verified without compiler proof',()=>{
  const target=registry.workloads[0];
  const previous=target.status;
  try {
    target.status='verified';
    assert.throws(()=>readiness(),/Unsupported readiness state|no compiler evidence checker/);
  } finally { target.status=previous; }
});

test('the strict twenty-workload CI gate intentionally fails until all 20 pass',{skip:!canRunTs},()=>{
  const root=fileURLToPath(new URL('../../',import.meta.url));
  const child=spawnSync(process.execPath,['scripts/canonical20-coverage.mjs','--require-complete'],{
    cwd:root,encoding:'utf8',timeout:30_000,windowsHide:true
  });
  assert.ifError(child.error);
  assert.equal(child.status,2);
  assert.match(child.stderr,/all 20 must be compiler-verified/);
  const report=JSON.parse(child.stdout);
  assert.equal(report.preregisteredTasks,20);
  assert.equal(report.verifiedFullWorkloads,5);
  assert.equal(report.unsupported,15);
  assert.equal(report.globalMedianCodepointReduction,null);
  assert.equal(report.objectiveAchieved,false);
});
