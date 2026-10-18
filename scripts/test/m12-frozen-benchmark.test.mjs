import test from 'node:test';
import assert from 'node:assert/strict';
import {compareM12} from '../m12-records-compare.mjs';

test('fixed records and immutable ⊞ update both run with identical TS output',{skip:Number(process.versions.node.split('.')[0])<22},()=>{
  const report=compareM12();
  assert.equal(report.caseCount,2);
  assert.equal(report.allInputsSourceFrozen,true);
  assert.equal(report.outputVerifiedForAll,true);
  assert.deepEqual(report.cases.map(c=>[c.id,c.hcode.unicodeCodepoints,c.typescript.unicodeCodepoints,c.codepointSavingsPercent]),[
    ['nested-record-read',79,96,17.71],
    ['immutable-record-update',81,114,28.95]
  ]);
  assert.equal(report.generatedRuntimeSizeMeasured,false);
  assert.equal(report.dependenciesMeasured,false);
  assert.equal(report.global20Median,null);
  assert.equal(report.global70PercentAchieved,false);
  assert.equal(report.historicalM14ThreeTaskMedianCodepointReductionPct,68.46);
});
