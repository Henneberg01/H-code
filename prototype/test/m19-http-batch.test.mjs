import test from 'node:test';
import assert from 'node:assert/strict';
import {executeAsync,execute} from '../src/hcode.mjs';
const success=(body)=>({status:200,body,ok:true,retryAfter:0});
const urls=['https://a.invalid/x','https://b.invalid/y','https://c.invalid/z'];
const source='≔r←⤋⟦'+urls.map(JSON.stringify).join(',')+'⟧;print(⤒r);';

test('vector HTTP launches all three requests before awaiting any; preserves input order',async()=>{
 const started=[],output=[];let release;
 const barrier=new Promise(resolve=>{release=resolve;});
 const result=await Promise.race([
   executeAsync(source,{
     httpGet:async u=>{
       started.push(u);
       if(started.length===3)release();
       await barrier;
       return success(u.slice(8,9));
     },stdout:line=>output.push(line)
   }),
   new Promise((_,reject)=>setTimeout(()=>reject(Error('serialized batch GET deadlock')),2000))
 ]);
 assert.deepEqual(started,urls);
 assert.deepEqual(JSON.parse(output[0]).map(x=>x.body),['a','b','c']);
 assert.equal(result.httpRequests,3,'batch counts real requests, not one journal entry');
});

test('scalar GET semantics remain intact and typed empty batches use zero network',async()=>{
 const output=[];
 const stats=await executeAsync('≔v←⤋"https://example.invalid/s";print(v·status);≔xs:⟦String⟧←⟦⟧;print(⤒(⤋xs));',{
  httpGet:async()=>success('ok'),stdout:x=>output.push(x)
 });
 assert.deepEqual(output,['200','[]']);
 assert.equal(stats.httpRequests,1);
 assert.throws(()=>execute('print(⌗(⤋⟦"https://example.invalid"⟧));'),/asynchronous H-Code interpreter/);
});

test('batch preflights every URL and protects host from partial egress',async()=>{
 let calls=0;
 const code='≔v←⤋⟦"https://ok.invalid","file:///etc/passwd"⟧;print(⌗v);';
 await assert.rejects(executeAsync(code,{httpGet:async()=>{calls++;return success('unsafe');}}),/HTTP\(S\) URL required/);
 assert.equal(calls,0);
 await assert.rejects(executeAsync('⤋⟦1,2⟧;',{httpGet:async()=>{calls++;return success('x');}}),/String URLs/);
 assert.equal(calls,0);
});

test('batch enforces fan-out and accumulated network budget',async()=>{
 let calls=0;
 const many=Array.from({length:17},(_,i)=>'https://example.invalid/x'+i);
 await assert.rejects(executeAsync('⤋⟦'+many.map(JSON.stringify).join(',')+'⟧;',{
  httpGet:async()=>{calls++;return success('x');}
 }),/at most 16 String URLs/);
 assert.equal(calls,0);
 await assert.rejects(executeAsync(source,{
   httpGet:async()=>{calls++;return success('x');},maxHttpRequests:2
 }),/effect budget exceeded/);
 assert.equal(calls,0);
});

test('a failed request does not suppress other responses or reorder the batch',async()=>{
 const output=[];
 const r=await executeAsync(source,{stdout:x=>output.push(x),httpGet:async u=>{
  if(u===urls[1])throw Error('no credential leakage');
  return success(u.slice(8,9));
 }});
 assert.equal(r.httpRequests,3);
 assert.deepEqual(JSON.parse(output[0]).map(x=>x.body),['a','','c']);
});
