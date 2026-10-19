import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,readFileSync,symlinkSync,chmodSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execute,executeAsync,parse} from '../prototype/src/hcode.mjs';
const record=(state,value)=>Object.freeze(Object.assign(Object.create(null),{state,value}));
const program='ƒ step(s:String)→⦃state:String,value:String⦄ {≔n←⤓Number s;↩⦃state:⤒(n+1),value:⤒(n+1)⦄}\n⎙(⥁(step,"0"))';
async function fixture(run){
 const root=mkdtempSync(join(tmpdir(),'jfh-tx-'));
 try{
  const {createStringTransactionStore:create}=await import('../runtime/string-transaction.mjs');
  await run(root,create);
 }finally{rmSync(root,{recursive:true,force:true});}
}
test('⥁ is a native typed state operation with identical secondary alias',()=>{
 assert.deepEqual(parse('⥁(step,"0")'),parse('state_transaction(step,"0")'));
 assert.throws(()=>execute(program),/transaction capability denied/);
});
test('real SQLite transaction returns value, persists state only and survives reopen',()=>fixture((root,create)=>{
 let store=create({root});
 assert.equal(store.transact(s=>record('next','DO_NOT_PERSIST'), 'initial'),'DO_NOT_PERSIST');
 store.close();store=create({root});
 try{assert.equal(store.transact(s=>record(s,s),'ignored'),'next');}
 finally{store.close();}
 const bytes=readFileSync(join(root,'state.sqlite'));
 assert.equal(bytes.subarray(0,16).toString(),'SQLite format 3\0');
 assert.equal(bytes.includes(Buffer.from('DO_NOT_PERSIST')),false);
}));
test('callback exception, invalid result and reentrancy roll back without state changes',()=>fixture((root,create)=>{
 const store=create({root});
 try{
  assert.equal(store.transact(s=>record('committed','ok'),'start'),'ok');
  assert.throws(()=>store.transact(()=>{throw Error('application failure');},'start'),/application failure/);
  for(const value of [null,Promise.resolve(record('bad','bad')),{state:'bad',value:'bad'},record('x'.repeat(1048577),'bad'),record('bad','x'.repeat(65537))]){
   assert.throws(()=>store.transact(()=>value,'start'),/transaction result/);
  }
  assert.throws(()=>store.transact(()=>record(store.transact(s=>record('bad','bad'),'start'),'bad'),'start'),/nested transaction/);
  assert.equal(store.transact(s=>record(s,s),'start'),'committed');
 }finally{store.close();}
}));
test('independent interpreter runs generic state transitions with persistence',()=>fixture((root,create)=>{
 const store=create({root}),lines=[];
 try{
  for(let n=0;n<3;n++)execute(program,{stateTransaction:store.transact,stdout:s=>lines.push(s)});
  assert.deepEqual(lines,['1','2','3']);
 }finally{store.close();}
}));
test('pure, nested and async replay contexts cannot invoke a transaction host',async()=>{
 let calls=0;const stateTransaction=()=>{calls++;return 'bad';};
 assert.throws(()=>execute('⟦"x"⟧↥λx:⥁(λs:⦃state:s,value:s⦄,"0")',{stateTransaction}),/effect denied/);
 await assert.rejects(()=>executeAsync(program,{stateTransaction}),/async replay/);
 for(const suffix of ['⌛1','⤋"http://test.invalid"','⧅("x","y")']){
  assert.throws(()=>execute(program+'\n'+suffix,{stateTransaction}),/cannot combine/);
 }
 assert.equal(calls,0);
});
test('host capability requires an existing canonical root and refuses symlink DB',()=>fixture((root,create)=>{
 assert.throws(()=>create({}),/capability denied/);
 assert.throws(()=>create({root:join(root,'missing')}),/transaction root/);
 if(process.platform!=='win32'){
  symlinkSync(join(root,'elsewhere.sqlite'),join(root,'state.sqlite'));
  assert.throws(()=>create({root}),/transaction database/);
  rmSync(join(root,'state.sqlite'));
  chmodSync(root,0o777);
  assert.throws(()=>create({root}),/transaction root/);
 }
}));
