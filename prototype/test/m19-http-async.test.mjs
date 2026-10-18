import test from 'node:test';
import assert from 'node:assert/strict';
import {executeAsync} from '../src/hcode.mjs';
import {startHttpFixture} from '../../scripts/canonical20-http-fixture.mjs';

const request=async raw=>{
  const response=await fetch(raw,{method:'GET',redirect:'error',signal:AbortSignal.timeout(2000)});
  const rawAfter=response.headers.get('retry-after');
  const seconds=rawAfter!==null&&/^\d+$/.test(rawAfter)?Number(rawAfter):0;
  return {status:response.status,ok:response.ok,body:await response.text(),
    retryAfter:Number.isSafeInteger(seconds)&&seconds<=120?seconds*1000:0};
};

test('real loopback GET through independent async H-Code reference interpreter',async()=>{
  const server=await startHttpFixture([{id:'x',responses:[
    {status:500,body:'try again'}, {status:200,body:'done'}]}]);
  try{
    const lines=[],url=server.urlFor('x');
    const script=`≔url←"${url}"
≔r←⤋url
print(r·status)
r←⤋url
print(r·body)`;
    const stats=await executeAsync(script,{httpGet:request,stdout:x=>lines.push(x)});
    assert.deepEqual(lines,['500','done']);
    assert.equal(stats.httpRequests,2);
    assert.equal(server.hitsFor('x'),2,'replay must not issue duplicate requests');
  }finally{await server.close();}
});
test('no ambient network permission; host errors fail closed to status zero',async()=>{
  await assert.rejects(executeAsync('print((⤋"http://127.0.0.1:1/x")·status);'),/capability denied/);
  const lines=[];
  const result=await executeAsync('print((⤋"http://127.0.0.1:1/x")·status);',
    {httpGet:async()=>{throw Error('secret');},stdout:x=>lines.push(x)});
  assert.deepEqual(lines,['0']);
  assert.equal(result.httpRequests,1);
});
test('HTTP host must supply exact typed response and valid options',async()=>{
  const code='print((⤋"https://example.invalid/x")·status);';
  for(const answer of [
    {status:'200',ok:true,body:'ok',retryAfter:0},
    {status:200,ok:false,body:'ok',retryAfter:0},
    {status:200,ok:true,body:'ok',retryAfter:0,extra:true},
    Object.assign(Object.create(null),{status:200,ok:true,body:'x'.repeat(65537),retryAfter:0})
  ]){
    await assert.rejects(executeAsync(code,{httpGet:async()=>answer}),/Invalid H-Code HTTP response/);
  }
  await assert.rejects(executeAsync(code,{httpGet:request,maxHttpRequests:0}),/Invalid bounded/);
  await assert.rejects(executeAsync('print((⤋"file:///etc/passwd")·status);',{httpGet:request}),/HTTP\(S\) URL/);
});
test('effect request count is bounded even when source loops indefinitely',async()=>{
  const code='≔i←0;⟳(i<10){≔r←⤋"https://example.invalid/x";i←i+1;}';
  await assert.rejects(executeAsync(code,{maxHttpRequests:3,httpGet:async()=>({status:200,ok:true,body:'ok',retryAfter:0})}),
    /effect budget exceeded/);
});
