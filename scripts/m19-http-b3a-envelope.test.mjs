import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHttpCasStateStore} from '../runtime/http-state-cas.mjs';
import {executeHttpCasTransaction} from '../runtime/http-state-cas-adapter.mjs';
const tmp=()=>mkdtempSync(join(tmpdir(),'hcode-b3-envelope-'));
const record=(body,state,status,contentType)=>Object.assign(Object.create(null),{body,state,status,contentType});
test('B3a: CAS HTTP typed JSON response preserves MIME in receipts and replays',()=>{
 const root=tmp();let store;
 try{
  store=createHttpCasStateStore({root,initial:'0'});
  let n=0;const req=Object.assign(Object.create(null),{body:'{"x":1}',contentType:'application/json',method:'POST',path:'/create'});
  const options={store,request:req,metadata:{requestId:'mime_01',isCancelled:()=>false},digest:'a'.repeat(64),expanded:true,
    handler:(_req,old)=>{n++;return record('{"ok":true}',String(Number(old)+1),201,'application/json; charset=utf-8');},
    invoke:(fn,r,s)=>fn(r,s)};
  const expected={body:'{"ok":true}',status:201,contentType:'application/json; charset=utf-8'};
  assert.deepEqual(executeHttpCasTransaction(options),expected);
  assert.deepEqual(executeHttpCasTransaction(options),expected);
  assert.equal(n,1);
  assert.equal(store.sequence(),1);
  assert.equal(store.receiptFor('mime_01').contentType,expected.contentType);
  assert.deepEqual(executeHttpCasTransaction({...options,digest:'b'.repeat(64)}),
    {body:'idempotency_conflict',status:409,contentType:'text/plain; charset=utf-8'});
 }finally{store?.close();rmSync(root,{recursive:true,force:true});}
});
test('B3a: MIME cannot inject headers and bad response cannot mutate state',()=>{
 const root=tmp();let store;
 try{
  store=createHttpCasStateStore({root,initial:'0'});
  const options={store,expanded:true,digest:'a'.repeat(64),
    request:{method:'POST',path:'/create',body:'x',contentType:'application/json'},
    metadata:{requestId:'invalid',isCancelled:()=>false},invoke:(fn,r,s)=>fn(r,s)};
  for(const mime of ['text/plain\r\nset-cookie: hacked=1','text/plain; charset=latin1','application/json\n','']){
    assert.throws(()=>executeHttpCasTransaction({...options,handler:()=>record('ok','1',200,mime)}),/invalid|Invalid/);
    assert.equal(store.sequence(),0);
  }
 }finally{store?.close();rmSync(root,{recursive:true,force:true});}
});
