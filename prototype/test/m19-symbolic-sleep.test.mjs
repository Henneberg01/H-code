import test from 'node:test';
import assert from 'node:assert/strict';
import {CORE_GLYPHS,parse,tokenize,execute,executeAsync} from '../src/hcode.mjs';

test('⏳ is one native token and ⎙ is a native print sign in the independent interpreter',()=>{
  assert.equal(CORE_GLYPHS['⏳'],'sleep-ms');
  assert.equal(CORE_GLYPHS['⎙'],'print');
  assert.deepEqual(parse('⏳0;⎙(42);'),parse('sleep_ms 0;print(42);'));
  assert.deepEqual(tokenize('⏳0;').map(x=>x.type),tokenize('sleep_ms 0;').map(x=>x.type));
});
test('⏳ preserves asynchronous effect order in independent interpreter',async()=>{
  const lines=[],slept=[];
  const result=await executeAsync('⎙(1);⏳100;⎙(2);⏳200;⎙(3);',
    {stdout:x=>lines.push(x),sleep:async ms=>slept.push(ms)});
  assert.deepEqual(lines,['1','2','3']);
  assert.deepEqual(slept,[100,200]);
  assert.equal(result.httpRequests,0);
  assert.equal(result.sleepCalls,2);
});
test('synchronous reference fails closed; timing bound and effect budgets checked',async()=>{
  assert.throws(()=>execute('⏳1;'),/requires asynchronous/);
  await assert.rejects(executeAsync('⏳-1;',{sleep:async()=>{}}),/requires integer/);
  await assert.rejects(executeAsync('⏳120001;',{sleep:async()=>{}}),/requires integer/);
  await assert.rejects(executeAsync('⏳100;', {maxSleepCalls:0}),/Invalid bounded/);
  await assert.rejects(executeAsync('⏳0;⏳0;', {maxSleepCalls:1,sleep:async()=>{}}),/sleep effect budget/);
  await assert.rejects(executeAsync('⏳0;⏳0;', {maxAsyncEffects:1,sleep:async()=>{}}),/async effect budget/);
});
test('sleep does not run inside synchronous closures',async()=>{
  await assert.rejects(executeAsync('≔f←λ x:⏳x;f(0);',{sleep:async()=>{}}),/sync closure/);
});
