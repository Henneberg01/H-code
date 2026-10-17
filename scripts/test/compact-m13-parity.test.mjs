import test from 'node:test';
import assert from 'node:assert/strict';
import {compareM13,corpus} from '../m13-compare.mjs';

const node22=Number(process.versions.node.split('.')[0])>=22;
test('all three M13 sign programs and exact unchanged M11 TypeScript baselines agree', {skip:!node22}, ()=>{
  const report=compareM13();
  assert.equal(report.cases.length,3);
  assert.equal(corpus.comparisonCases.length,3);
  assert.equal(report.rustCompilerVerified,false);
  assert.equal(report.generatedRuntimeMeasured,false);
  for(const item of report.cases){
    assert.equal(item.outputVerified,true);
    assert.ok(item.newHCode.codePoints<item.oldHCode.codePoints);
    assert.ok(item.newHCode.codePoints<item.typescript.codePoints);
  }
  assert.equal(report.medianCodePointReductionVsTypeScript,56.15);
  assert.equal(report.medianUtf8ReductionVsTypeScript,40.12);
});
