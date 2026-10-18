import test from 'node:test';
import assert from 'node:assert/strict';
import {compareM14,corpus} from '../m14-compare.mjs';

test('same three SHA-locked M11/M13/M14 programs produce identical working results', {skip:Number(process.versions.node.split('.')[0])<22},()=>{
  const report=compareM14();
  assert.equal(report.benchmarkCount,3);
  assert.equal(corpus.cases.length,3);
  assert.equal(report.rustCompilerExecuted,false);
  assert.equal(report.medianCodepointReductionVsTypeScript,68.46);
  assert.equal(report.medianUtf8ReductionVsTypeScript,55.09);
  const byId=new Map(report.cases.map(x=>[x.id,x]));
  assert.equal(byId.get('sum-typed-sequence').codepoints.m14,17);
  assert.equal(byId.get('map-typed-sequence').codepoints.m14,41);
  assert.equal(byId.get('filter-typed-sequence').codepoints.m14,55);
  for(const row of report.cases){
    assert.equal(row.outputVerified,true);
    assert.ok(row.codepoints.m14<=row.codepoints.m13);
    assert.ok(row.codepoints.m14<row.codepoints.typescript);
  }
});
