import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtempSync,readFileSync,readdirSync,rmSync,writeFileSync,unlinkSync,symlinkSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';
import {createHttpCasStateStore} from '../runtime/http-state-cas.mjs';
const worker=fileURLToPath(new URL('./cas-worker.mjs',import.meta.url));
const temp=()=>mkdtempSync(join(tmpdir(),'hcode-cas-b2c1-'));
const receipt=(id,body)=>({id,digest:'a'.repeat(64),status:200,body});
function processWorker(root,env={}){
 return new Promise((resolve,reject)=>{
  const child=spawn(process.execPath,[worker],{windowsHide:true,
   env:{...process.env,CAS_ROOT:root,...env},stdio:['ignore','pipe','pipe']});
  let stdout='',stderr='';
  child.stdout.on('data',x=>stdout+=x);
  child.stderr.on('data',x=>stderr+=x);
  child.on('error',reject);
  child.on('close',(code,signal)=>{
   if(env.CAS_KILL_SELF==='1'){
    if(code===0&&!signal)reject(Error('Worker should have been killed'));
    else resolve({code,signal});
   }else if(code===0)resolve(JSON.parse(stdout));
   else reject(Error('CAS worker '+code+'/'+signal+': '+stderr));
  });
 });
}
test('B2c-1: optimistic CAS losers cannot overwrite a winning revision',()=>{
 const root=temp();let first,second;
 try{
  first=createHttpCasStateStore({root,initial:'0'});
  second=createHttpCasStateStore({root,initial:'0'});
  const old=first.snapshot();
  assert.equal(old.revision,0);
  assert.deepEqual(first.tryCommit({expectedRevision:0,next:'1',receipt:receipt('id1','1')}),
    {committed:true,revision:1,changed:true});
  assert.deepEqual(second.tryCommit({expectedRevision:old.revision,next:'999',receipt:receipt('id2','999')}),
    {committed:false,revision:1});
  assert.equal(second.read(),'1');
  assert.deepEqual(second.receiptFor('id1'),receipt('id1','1'));
  assert.equal(first.tryCommit({expectedRevision:1,next:'1'}).changed,false);
  assert.equal(readdirSync(root).filter(x=>x.startsWith('rev-')).length,1);
 }finally{first?.close();second?.close();rmSync(root,{recursive:true,force:true});}
});
test('B2c-1: real independent OS processes safely publish 32 increments',async()=>{
 const root=temp();let store;
 try{
  const results=await Promise.all([
   processWorker(root,{CAS_PREFIX:'proc_a',CAS_TOTAL:'16'}),
   processWorker(root,{CAS_PREFIX:'proc_b',CAS_TOTAL:'16'})
  ]);
  assert.equal(results.flat().length,32);
  store=createHttpCasStateStore({root,initial:'0'});
  assert.equal(store.read(),'32');
  assert.equal(store.sequence(),32);
  assert.equal(store.receiptSlots(),96);
  assert.equal(new Set(store.snapshot().receipts.map(x=>x.id)).size,32);
  assert.ok(!readdirSync(root).some(x=>x.endsWith('.tmp')));
 }finally{store?.close();rmSync(root,{recursive:true,force:true});}
});
test('B2c-1: same request ID across independent processes commits once',async()=>{
 const root=temp();let store;
 try{
  const results=await Promise.all([
   processWorker(root,{CAS_PREFIX:'a',CAS_SAME_ID:'once'}),
   processWorker(root,{CAS_PREFIX:'b',CAS_SAME_ID:'once'})
  ]);
  assert.deepEqual(results,[['1'],['1']]);
  store=createHttpCasStateStore({root,initial:'0'});
  assert.deepEqual({state:store.read(),seq:store.sequence(),slots:store.receiptSlots()},
   {state:'1',seq:1,slots:127});
 }finally{store?.close();rmSync(root,{recursive:true,force:true});}
});
test('B2c-1: SIGKILL, restart, durable receipt and ignored uncommitted temp',async()=>{
 const root=temp();let store;
 try{
  await processWorker(root,{CAS_PREFIX:'crash',CAS_KILL_SELF:'1'});
  writeFileSync(join(root,'.hcode-cas-tmp-unpublished.tmp'),'partial and invalid');
  store=createHttpCasStateStore({root,initial:'0'});
  assert.equal(store.sequence(),1);
  assert.equal(store.receiptFor('crash_0').body,'1');
  assert.deepEqual(await processWorker(root,{CAS_SAME_ID:'crash_0'}),['1']);
  assert.equal(store.sequence(),1);
 }finally{store?.close();rmSync(root,{recursive:true,force:true});}
});
test('B2c-1: fail closed on mixed legacy, modified and missing revisions',()=>{
 const root=temp();let store;
 try{
  store=createHttpCasStateStore({root,initial:'0'});
  store.tryCommit({expectedRevision:0,next:'1',receipt:receipt('a','1')});
  store.tryCommit({expectedRevision:1,next:'2',receipt:receipt('b','2')});
  store.close();store=null;
  assert.throws(()=>createHttpCasStateStore({root,initial:'DIFFERENT'}),/hash chain/);
  writeFileSync(join(root,'hcode-http-state.json'),'{}');
  assert.throws(()=>createHttpCasStateStore({root,initial:'0'}),/mixed legacy/);
  unlinkSync(join(root,'hcode-http-state.json'));
  writeFileSync(join(root,'rev-000000000001.json'),'{invalid');
  assert.throws(()=>createHttpCasStateStore({root,initial:'0'}),/Corrupt/);
  unlinkSync(join(root,'rev-000000000001.json'));
  assert.throws(()=>createHttpCasStateStore({root,initial:'0'}),/Missing/);
 }finally{store?.close();rmSync(root,{recursive:true,force:true});}
});
test('B2c-1: reject symlink revision without touching target',t=>{
 const root=temp(),outside=join(root,'external.txt');
 try{
  writeFileSync(outside,'untouched');
  try{symlinkSync(outside,join(root,'rev-000000000001.json'),'file');}
  catch(error){if(['EPERM','EACCES','ENOTSUP'].includes(error.code)){t.diagnostic('Symlink unavailable');return;}throw error;}
  assert.throws(()=>createHttpCasStateStore({root,initial:'0'}),/Unsafe/);
  assert.equal(readFileSync(outside,'utf8'),'untouched');
 }finally{rmSync(root,{recursive:true,force:true});}
});
test('B2c-1: no silent receipt eviction or over-budget state',()=>{
 const root=temp();let store;
 try{
  store=createHttpCasStateStore({root,initial:'0'});
  assert.throws(()=>store.tryCommit({expectedRevision:0,next:'x'.repeat(1048577)}),/exceeds 1 MiB/);
  let rev=0;
  for(let i=0;i<128;i++){
   assert.equal(store.tryCommit({expectedRevision:rev,next:String(i),receipt:receipt('r'+i,String(i))}).committed,true);
   rev++;
  }
  assert.equal(store.receiptSlots(),0);
  assert.throws(()=>store.tryCommit({expectedRevision:rev,next:'next',receipt:receipt('excess','next')}),/journal full/);
  assert.equal(store.sequence(),rev);
 }finally{store?.close();rmSync(root,{recursive:true,force:true});}
});
