import test from 'node:test';
import assert from 'node:assert/strict';
import {measureCompactFixtures,sourceMetrics,reduction} from '../compact-metrics.mjs';
test('counts Unicode code points separately from actual UTF-8 bytes',()=>{
  assert.deepEqual(sourceMetrics('▷|>'),{codePoints:3,utf8Bytes:5,lines:1,nonBlankLines:1});
  assert.equal(reduction(3,10),70);
  assert.equal(reduction(0,0),null);
});
test('the CSE-1 fixture report does not falsely present itself as a TypeScript benchmark',()=>{
  const measured=measureCompactFixtures();
  assert.equal(measured.comparisonWithTypeScript,false);
  assert.equal(measured.results.length,7);
  for(const item of measured.results){
    assert.ok(item.glyph.codePoints>0&&item.ascii.codePoints>0);
    assert.ok(item.glyph.utf8Bytes>=item.glyph.codePoints);
    assert.ok(item.ascii.utf8Bytes>=item.ascii.codePoints);
    assert.ok(item.codePointReductionPercent!==null);
  }
});
