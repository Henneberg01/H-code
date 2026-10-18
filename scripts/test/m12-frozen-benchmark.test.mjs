import test from 'node:test';
import assert from 'node:assert/strict';
import {compareM12} from '../m12-records-compare.mjs';

test('M12 microcase is a frozen runnable parity pair, not a 20-workload success',{skip:Number(process.versions.node.split('.')[0])<22},()=>{
 const m=compareM12();
 assert.equal(m.hcode.codepoints,79);
 assert.equal(m.typescript.codepoints,96);
 assert.equal(m.codepointSavingsPercent,17.71);
 assert.equal(m.generatedRuntimeSizeMeasured,false);
 assert.equal(m.dependenciesMeasured,false);
 assert.equal(m.global20Median,null);
 assert.equal(m.global70PercentAchieved,false);
 assert.equal(m.m14PreservedMedianCodepointReductionPct,68.46);
});
