import test from 'node:test';
import assert from 'node:assert/strict';
import {execute,parse} from '../prototype/src/hcode.mjs';
const schema='⦃id:String,name:String,qty:Number⦄';
const cases=[
  ['{"id":"alpha","name":"First","qty":3}',true],
  ['{"id":"alpha","name":"First","qty":"3"}',false],
  ['{"id":"alpha","name":"First"}',false],
  ['{"id":"alpha","name":"First","qty":3,"admin":true}',false],
  ['{not-json',false],
  ['null',false],
  ['[]',false],
  ['{"id":"東京","name":"Café 🦊","qty":0}',true],
  ['{"id":"alpha","name":"First","qty":3}',true]
];
test('B3b1 independent JS: ⤔ is a genuine typed JSON validity predicate',()=>{
  for(const [value,expected] of cases){
    const src='print(⤔'+schema+JSON.stringify(value)+');';
    const output=[];
    execute(src,{stdout:line=>output.push(line)});
    assert.deepEqual(output,[String(expected)],value);
  }
});
test('B3b1 symbolic spelling and explicit ASCII alias are semantically equivalent',()=>{
  for(const [value,expected] of cases){
    const a=[],b=[];
    execute('print(⤔'+schema+JSON.stringify(value)+');',{stdout:line=>a.push(line)});
    execute('print(json_valid'+schema+JSON.stringify(value)+');',{stdout:line=>b.push(line)});
    assert.deepEqual(a,b);
    assert.equal(a[0],String(expected));
  }
});
test('B3b1 malformed schemas and non-string arguments fail closed',()=>{
  for(const source of [
    'print(⤔Bogus "{}");',
    'print(⤔⦃id:String,id:Number⦄ "{}");',
    'print(⤔⦃id:String⦄ 7);'
  ])assert.throws(()=>execute(source));
});

test('B3b: Unicode escaped lone surrogate is invalid, not silently accepted',()=>{
 const code='print(⤔⦃id:String⦄'+JSON.stringify('{"id":"\\uD800"}')+');';
 const output=[];
 execute(code,{stdout:line=>output.push(line)});
 assert.deepEqual(output,['false']);
});
