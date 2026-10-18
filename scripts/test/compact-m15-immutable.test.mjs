import test from 'node:test';
import assert from 'node:assert/strict';
import {frozenM15Sources,manifest} from '../m15-compare.mjs';
import {sourceMetrics} from '../compact-metrics.mjs';

test('M15 retains all eight original M10 TypeScript inputs by blob SHA',()=>{
  const cases=frozenM15Sources();
  assert.equal(cases.length,8);
  assert.equal(manifest.pairs.length,8);
  assert.equal(new Set(cases.map(x=>x.id)).size,8);
  assert.ok(cases.every(x=>x.m10Path!==x.m15Path));
});
test('each M15 program is shorter than the original on the same task',()=>{
  const cases=frozenM15Sources();
  for(const x of cases){
    const before=sourceMetrics(x.original).codePoints,after=sourceMetrics(x.m15).codePoints;
    assert.ok(after<before,'Expected M15 '+after+' < original M10 '+before);
  }
  assert.deepEqual(cases.map(x=>sourceMetrics(x.m15).codePoints),[33,47,46,27,46,56,42,61]);
});
