// M19.06 preregistered fixture/independent TypeScript oracle contract.
// No H-Code compiler verification is claimed by this test.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {startHttpFixture} from './canonical20-http-fixture.mjs';
import {fetchWithRetries} from './canonical20-http-oracle.ts';

const read = path => readFileSync(new URL('../'+path,import.meta.url));
const gitBlob = data => createHash('sha1').update('blob '+data.length+'\0').update(data).digest('hex');
const REGISTRY_SHA='46653ef90ffb3e420fba4ddfbfac3c4cfd57f3b3';
const CASES_SHA='4f12a085d9730ac637444a06fff6f75481985efb';
const fixed=JSON.parse(read('compact/canonical20/cases/06-http-retries.json').toString('utf8'));

test('canonical06 cases cannot drift from preregistered acceptance',()=>{
  assert.equal(gitBlob(read('compact/canonical20/workloads.json')),REGISTRY_SHA);
  assert.equal(gitBlob(read('compact/canonical20/cases/06-http-retries.json')),CASES_SHA);
  const original=JSON.parse(read('compact/canonical20/workloads.json').toString('utf8'));
  assert.equal(original.workloads.length,20);
  assert.equal(original.workloads[5].id,'06-http-retries');
  assert.equal(original.workloads[5].acceptance,'fake 500/429/200 responses, bounded retries and deterministic trace');
  assert.deepEqual(original.workloads[5].requiredCapabilities,['http-client','async','effect-control']);
  assert.equal(original.workloads[5].status,'unsupported');
  assert.equal(original.workloads[5].evidence,null);
  assert.equal(fixed.id,original.workloads[5].id);
  assert.equal(fixed.acceptance,original.workloads[5].acceptance);
  assert.equal(fixed.canonicalRegistryGitBlobSha,REGISTRY_SHA);
  assert.equal(fixed.stage,'fixture-contract-only-not-compiler-verified');
  assert.equal(fixed.cases.length,6);
  assert.deepEqual(fixed.retryableStatuses,[429,500,502,503,504]);
});

test('loopback real HTTP server and independent TypeScript baseline match all six locked cases',async()=>{
  const server=await startHttpFixture(fixed.cases);
  try{
    for(const c of fixed.cases){
      const slept=[];
      const actual=await fetchWithRetries(server.urlFor(c.id),{
        maxAttempts:fixed.maxAttempts,baseDelayMs:fixed.baseDelayMs,
        maxBackoffMs:fixed.maxBackoffMs,timeoutMs:fixed.timeoutMs,
        sleep:async ms=>{slept.push(ms);}
      });
      assert.deepEqual(actual,c.expected,c.id);
      assert.deepEqual(slept,c.expected.trace.filter(x=>x.waitMs>0).map(x=>x.waitMs),c.id+' backoff');
      assert.equal(server.hitsFor(c.id),c.expected.trace.length,c.id+' no missing/extra attempts');
      assert.ok(server.hitsFor(c.id)<=fixed.maxAttempts,c.id+' max attempts');
    }
    assert.equal(server.received.length,fixed.cases.reduce((sum,c)=>sum+c.expected.trace.length,0));
  }finally{await server.close();}
});

test('network errors are bounded, fail closed and never leak nondeterministic exception strings',async()=>{
  let count=0;
  const sleeps=[];
  const result=await fetchWithRetries('http://127.0.0.1:1/unused',{
    maxAttempts:3,baseDelayMs:10,maxBackoffMs:100,
    transport:async()=>{count++;throw Error('secret credential must never leak');},
    sleep:async ms=>{sleeps.push(ms);}
  });
  assert.equal(count,3);
  assert.deepEqual(sleeps,[10,20]);
  assert.deepEqual(result,{ok:false,status:null,body:'',reason:'network',trace:[
    {attempt:1,status:null,decision:'network-retry',waitMs:10},
    {attempt:2,status:null,decision:'network-retry',waitMs:20},
    {attempt:3,status:null,decision:'network-exhausted',waitMs:0}
  ]});
});

test('invalid retry bounds and non-http schemes are rejected before I/O',async()=>{
  await assert.rejects(fetchWithRetries('https://example.invalid',{maxAttempts:0}),/Invalid bounded retry/);
  await assert.rejects(fetchWithRetries('https://example.invalid',{maxAttempts:9}),/Invalid bounded retry/);
  await assert.rejects(fetchWithRetries('file:///etc/passwd'),/HTTP\(S\) URL required/);
  await assert.rejects(fetchWithRetries('data:,hello'),/HTTP\(S\) URL required/);
});

test('fake HTTP fixture rejects malformed cases, unknown routes and unsafe methods',async()=>{
  await assert.rejects(startHttpFixture([{id:'bad/path',responses:[{status:200,body:'ok'}]}]));
  await assert.rejects(startHttpFixture([{id:'x',responses:[{status:200,body:'ok'}]},{id:'x',responses:[{status:200,body:'ok'}]}]));
  const server=await startHttpFixture(fixed.cases);
  try{
    const missing=await fetch('http://127.0.0.1:'+new URL(server.urlFor('first-200')).port+'/case/missing');
    assert.equal(missing.status,404);
    const post=await fetch(server.urlFor('first-200'),{method:'POST'});
    assert.equal(post.status,405);
    assert.equal(server.hitsFor('first-200'),0);
  }finally{await server.close();}
});
