import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readdirSync,readFileSync,rmSync,writeFileSync,symlinkSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHttpCasStateStore} from '../runtime/http-state-cas.mjs';
const dir=()=>mkdtempSync(join(tmpdir(),'hcode-cas-fault-'));
const receipt=id=>({id,digest:'a'.repeat(64),status:200,body:'1'});
const useFaults=fn=>{const old=process.env.HCODE_CAS_TEST_FAULTS;process.env.HCODE_CAS_TEST_FAULTS='1';try{return fn();}finally{if(old===undefined)delete process.env.HCODE_CAS_TEST_FAULTS;else process.env.HCODE_CAS_TEST_FAULTS=old;}};
test('B2c-3: faults before hard-link publish never become visible',()=>useFaults(()=>{
 for(const phase of ['before-temp-fsync','after-temp-fsync','before-link']){
  const root=dir();let store;
  try{
   store=createHttpCasStateStore({root,initial:'0',faultHook:x=>{if(x===phase)throw Error('INJECTED '+phase);}});
   assert.throws(()=>store.tryCommit({expectedRevision:0,next:'1',receipt:receipt('one')}),/INJECTED/);
   assert.equal(store.snapshot().state,'0');
   assert.equal(store.snapshot().revision,0);
   assert.equal(readdirSync(root).filter(x=>x.startsWith('rev-')).length,0);
  }finally{store?.close();rmSync(root,{recursive:true,force:true});}
 }
}));
test('B2c-3: failures after atomic link require stable-ID replay, not a second mutation',()=>useFaults(()=>{
 const root=dir();let store,reopened;
 try{
  store=createHttpCasStateStore({root,initial:'0',faultHook:x=>{if(x==='after-link')throw Error('INJECTED after-link');}});
  assert.throws(()=>store.tryCommit({expectedRevision:0,next:'1',receipt:receipt('one')}),/INJECTED/);
  reopened=createHttpCasStateStore({root,initial:'0'});
  assert.equal(reopened.read(),'1');
  assert.equal(reopened.sequence(),1);
  assert.deepEqual(reopened.receiptFor('one'),receipt('one'));
  assert.deepEqual(reopened.tryCommit({expectedRevision:0,next:'2'}),{committed:false,revision:1});
 }finally{store?.close();reopened?.close();rmSync(root,{recursive:true,force:true});}
}));
test('B2c-3: mixing old state, corrupt revisions, symlink roots and malformed receipts fails closed',()=>{
 const root=dir();let store;
 try{
  store=createHttpCasStateStore({root,initial:'0'});
  store.tryCommit({expectedRevision:0,next:'1',receipt:receipt('one')});store.close();store=null;
  const file=join(root,'rev-000000000001.json');
  const original=readFileSync(file,'utf8');
  const data=JSON.parse(original);data.receipts.push({...data.receipts[0]});
  writeFileSync(file,JSON.stringify(data)+'\n');
  assert.throws(()=>createHttpCasStateStore({root,initial:'0'}),/receipt journal/);
  writeFileSync(file,original);
  const other=dir();
  try{
   const symlink=join(other,'rootlink');
   try{symlinkSync(root,symlink,'dir');assert.throws(()=>createHttpCasStateStore({root:symlink,initial:'0'}),/root/);}
   catch(error){if(!['EPERM','EACCES','ENOTSUP'].includes(error.code))throw error;}
  }finally{rmSync(other,{recursive:true,force:true});}
 }finally{store?.close();rmSync(root,{recursive:true,force:true});}
});
test('B2c-3: injection denied outside trusted test configuration',()=>{
 const root=dir();
 try{assert.throws(()=>createHttpCasStateStore({root,initial:'0',faultHook:()=>{}}),/disabled/);}
 finally{rmSync(root,{recursive:true,force:true});}
});

test('B2c-3 C09: failure before directory fsync leaves an ambiguous committed receipt',t=>useFaults(()=>{
 if(process.platform==='win32'){t.diagnostic('Directory fsync unavailable under NTFS host contract');return;}
 const root=dir();let failing,reopened;
 try{
  failing=createHttpCasStateStore({root,initial:'0',
    faultHook:phase=>{if(phase==='before-directory-fsync')throw Error('INJECTED directory sync');}});
  assert.throws(()=>failing.tryCommit({expectedRevision:0,next:'1',receipt:receipt('dir_sync')}),/INJECTED/);
  reopened=createHttpCasStateStore({root,initial:'0'});
  assert.equal(reopened.read(),'1');
  assert.deepEqual(reopened.receiptFor('dir_sync'),receipt('dir_sync'));
  assert.equal(reopened.sequence(),1);
 }finally{failing?.close();reopened?.close();rmSync(root,{recursive:true,force:true});}
}));
