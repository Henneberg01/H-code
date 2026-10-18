import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHttpCasStateStore} from '../runtime/http-state-cas.mjs';
import {executeHttpCasTransaction} from '../runtime/http-state-cas-adapter.mjs';
const temp=()=>mkdtempSync(join(tmpdir(),'hcode-cas-b2c2-'));
const record=(body,state)=>Object.assign(Object.create(null),{body,state,status:200});
const request=(method='POST')=>Object.assign(Object.create(null),{method,path:'/inc',body:''});
const metadata=id=>({requestId:id,isCancelled:()=>false});
const digest='a'.repeat(64);
test('B2c-2: same request ID commits exactly once and conflicting payload is denied',()=>{
 const root=temp();let store;
 try{
  store=createHttpCasStateStore({root,initial:'0'});
  let calls=0;
  const handler=(_,s)=>{calls++;const next=String(Number(s)+1);return record(next,next);};
  const opts={store,handler,request:request(),metadata:metadata('once'),digest,invoke:(fn,r,s)=>fn(r,s)};
  assert.deepEqual(executeHttpCasTransaction(opts),{status:200,body:'1'});
  assert.deepEqual(executeHttpCasTransaction(opts),{status:200,body:'1'});
  assert.equal(calls,1);
  assert.deepEqual(executeHttpCasTransaction({...opts,digest:'b'.repeat(64)}),{status:409,body:'idempotency_conflict'});
  assert.equal(store.read(),'1');
 }finally{store?.close();rmSync(root,{recursive:true,force:true});}
});
test('B2c-2: CAS conflict retries pure H-Code reducer against latest state',()=>{
 const root=temp();let a,b;
 try{
  a=createHttpCasStateStore({root,initial:'0'});
  b=createHttpCasStateStore({root,initial:'0'});
  let attempts=0;
  const result=executeHttpCasTransaction({
   store:a,handler:(r,s)=>{attempts++;if(attempts===1)b.tryCommit({expectedRevision:0,next:'10'});return record(String(Number(s)+1),String(Number(s)+1));},
   request:request(),metadata:metadata('retry'),digest,invoke:(fn,r,s)=>fn(r,s)
  });
  assert.deepEqual(result,{status:200,body:'11'});
  assert.equal(attempts,2);
  assert.equal(b.read(),'11');
 }finally{a?.close();b?.close();rmSync(root,{recursive:true,force:true});}
});
test('B2c-2: read-only, cancellation, and invalid reducer results cannot mutate data',()=>{
 const root=temp();let store;
 try{
  store=createHttpCasStateStore({root,initial:'0'});
  const options={store,request:request('GET'),metadata:metadata(''),digest:null,invoke:(fn,r,s)=>fn(r,s)};
  assert.deepEqual(executeHttpCasTransaction({...options,handler:()=>record('changed','1')}),{status:405,body:'unsafe_state_transition'});
  assert.throws(()=>executeHttpCasTransaction({...options,request:request(),metadata:{requestId:'one',isCancelled:()=>true},handler:()=>record('changed','1')}),/canceled/);
  assert.throws(()=>executeHttpCasTransaction({...options,handler:()=>({body:'x',state:'1',status:200})}),/Invalid H-Code CAS reducer/);
  assert.equal(store.sequence(),0);
 }finally{store?.close();rmSync(root,{recursive:true,force:true});}
});
test('B2c-2: legacy state mode remains default and CAS is opt-in in emitted prelude',async()=>{
 const {readFileSync}=await import('node:fs');
 const text=readFileSync(new URL('../compiler/src/http_state_prelude.js',import.meta.url),'utf8');
 assert.match(text,/HCODE_HTTP_STATE_MODE\?\?'legacy'/);
 assert.match(text,/createHttpCasStateStore/);
 assert.match(text,/executeHttpCasTransaction/);
});
