import test from 'node:test';
import assert from 'node:assert/strict';
import {tokenize,parse,execute,executeAsync,CORE_GLYPHS} from '../src/hcode.mjs';

test('⌛ is an intrinsic token and its ASCII alias has identical AST',()=>{
  assert.equal(CORE_GLYPHS['⌛'],'sleep-ms');
  assert.deepEqual(tokenize('⌛10').map(x=>x.type),tokenize('sleep_ms 10').map(x=>x.type));
  assert.deepEqual(parse('⌛10;'),parse('sleep_ms 10;'));
  assert.throws(()=>execute('⌛0;'),/requires asynchronous H-Code interpreter/);
});

test('source-language conditional and loop delays are ordered, bounded and replayed exactly once',async()=>{
  const delays=[],lines=[];
  const script='≔i←0;⟳(i<3){⌛(i*10);print(i);i←i+1;}';
  const result=await executeAsync(script,{sleepMs:async ms=>delays.push(ms),stdout:line=>lines.push(line)});
  assert.deepEqual(delays,[0,10,20]);
  assert.deepEqual(lines,['0','1','2']);
  assert.equal(result.sleeps,3);
  assert.equal(result.totalSleepMs,30);
  assert.equal(result.httpRequests,0);
});

test('delay rejects negative/fractional values, excess budget and invalid host injection',async()=>{
  for(const script of ['⌛-1;','⌛120001;','⌛(1/2);'])
    await assert.rejects(executeAsync(script,{sleepMs:async()=>{throw Error('Should not be called');}}),/bounded nonnegative integer/);
  await assert.rejects(executeAsync('⌛10;⌛20;',{sleepMs:async()=>{},maxTotalSleepMs:29}),/delay effect budget exceeded/);
  await assert.rejects(executeAsync('⌛0;⌛0;',{sleepMs:async()=>{},maxSleepEffects:1}),/delay effect budget exceeded/);
  await assert.rejects(executeAsync('⌛0;',{sleepMs:42}),/Invalid bounded H-Code delay/);
  await assert.rejects(executeAsync('ƒ f()→Unit{⌛1;} f();',{sleepMs:async()=>{}}),/delay effect denied/);
});
