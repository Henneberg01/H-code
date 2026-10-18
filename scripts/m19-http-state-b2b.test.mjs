// M19.12 B2b: durable idempotency receipts for generic H-Code ⤊ state reducers.
// This DOES NOT complete canonical12 CRUD; coverage stays 11/20.
import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn,spawnSync} from 'node:child_process';
import {mkdtempSync,readFileSync,writeFileSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';
import {createHttpStateStore} from '../runtime/http-state.mjs';
import {execute} from '../prototype/src/hcode.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
const source=readFileSync(join(root,'compact/canonical20/programs/12-http-state-b2a.hc'),'utf8');
const temp=()=>mkdtempSync(join(tmpdir(),'hcode12-b2b-'));
function compile(text=source){
  const folder=temp(),file=join(folder,'api.hc'),output=join(folder,'api.mjs');
  writeFileSync(file,text);
  const run=spawnSync('cargo',['run','--quiet','--manifest-path','compiler/Cargo.toml','--',
    'build',file,'--out',output],{cwd:root,encoding:'utf8',windowsHide:true,timeout:180000});
  if(run.error||run.status!==0){
    rmSync(folder,{recursive:true,force:true});
    throw Error('B2b native Rust compiler failed: '+(run.error?.message||run.stderr));
  }
  return {folder,output};
}
async function start(compiled,store){
  const child=spawn(process.execPath,[compiled],{
    cwd:root,windowsHide:true,stdio:['ignore','pipe','pipe'],
    env:{...process.env,HCODE_HTTP_LISTEN:'127.0.0.1:0',HCODE_HTTP_STATE_ROOT:store}
  });
  let stderr='';
  child.stderr.on('data',x=>{stderr+=x.toString('utf8');});
  const port=await new Promise((resolve,reject)=>{
    let stdout='',done=false;
    const timeout=setTimeout(()=>finish(Error('B2b startup timeout: '+stderr)),15000);
    function finish(error,value){
      if(done)return;done=true;clearTimeout(timeout);
      child.stdout.off('data',onOut);
      child.off('exit',onExit);child.off('error',onErr);
      if(error)reject(error);else resolve(value);
    }
    const onOut=x=>{
      stdout+=x.toString('utf8');
      const match=/HCODE_HTTP_READY=(\d+)\n/.exec(stdout);
      if(match)finish(null,Number(match[1]));
      else if(stdout.length>4096)finish(Error('Oversized readiness'));
    };
    const onExit=code=>finish(Error('B2b server exited '+code+': '+stderr));
    const onErr=e=>finish(e);
    child.stdout.on('data',onOut);
    child.once('exit',onExit);child.once('error',onErr);
  });
  return {url:'http://127.0.0.1:'+port,child};
}
async function stop(app){
  if(!app)return;
  if(app.child.exitCode!==null||app.child.signalCode!==null)return;
  await new Promise(resolve=>{
    const guard=setTimeout(()=>{app.child.kill('SIGKILL');resolve();},4500);
    app.child.once('exit',()=>{clearTimeout(guard);resolve();});
    app.child.kill('SIGTERM');
  });
}
async function request(app,{method='POST',path='/inc',id='',body=''}={}){
  const headers=id?{'x-hcode-request-id':id}:{};
  const res=await fetch(app.url+path,{
    method,headers,body:method==='GET'?undefined:body
  });
  return {status:res.status,body:await res.text()};
}
const disk=folder=>JSON.parse(readFileSync(join(folder,'hcode-http-state.json'),'utf8'));
test('B2b standalone durable state receipts are atomic and survive close/reopen',()=>{
  const folder=temp();let storage;
  try{
    storage=createHttpStateStore({root:folder,initial:'zero'});
    assert.equal(storage.receiptSlots(),128);
    assert.equal(storage.receiptFor('key1'),null);
    const receipt={id:'key1',digest:'a'.repeat(64),status:201,body:'created'};
    assert.equal(storage.commit('one',receipt),1);
    assert.equal(storage.receiptSlots(),127);
    assert.deepEqual(storage.receiptFor('key1'),receipt);
    assert.throws(()=>storage.commit('two',receipt),/Duplicate.*receipt/);
    assert.equal(storage.read(),'one','Duplicate receipt must never mutate state');
    storage.close();storage=null;
    storage=createHttpStateStore({root:folder,initial:'ignored'});
    assert.equal(storage.read(),'one');
    assert.deepEqual(storage.receiptFor('key1'),receipt);
    assert.deepEqual(disk(folder),{version:2,seq:1,state:'one',receipts:[receipt]});
    // The old v1 format is still accepted by the B2a tests when no receipt exists.
  }finally{storage?.close();rmSync(folder,{recursive:true,force:true});}
});
test('B2b rejects forged or malformed durable receipt journals before allowing a mutation',()=>{
  const folder=temp();let cap;
  try{
    cap=createHttpStateStore({root:folder,initial:'0'});
    cap.commit('one',{id:'safe',digest:'b'.repeat(64),body:'ok',status:200});
    cap.close();cap=null;
    const target=join(folder,'hcode-http-state.json'),bad=disk(folder);
    bad.receipts[0].digest='not-a-hash';
    writeFileSync(target,JSON.stringify(bad)+'\n');
    assert.throws(()=>createHttpStateStore({root:folder,initial:'0'}),/durable receipt journal/);
  }finally{cap?.close();rmSync(folder,{recursive:true,force:true});}
});
test('B2b repeated request ID returns original response and cannot increment state again after restart',async()=>{
  const b=compile(),store=temp();let app;
  try{
    app=await start(b.output,store);
    assert.deepEqual(await request(app,{id:'buy_1',body:'one'}),{status:200,body:'1'});
    assert.deepEqual(await request(app,{id:'buy_1',body:'one'}),{status:200,body:'1'});
    assert.deepEqual(await request(app,{id:'buy_1',body:'different'}),{status:409,body:'idempotency_conflict'});
    assert.deepEqual(await request(app,{id:'bad id',body:'x'}),{status:400,body:'invalid_request_id'});
    assert.deepEqual(await request(app,{id:'buy_2',body:'two'}),{status:200,body:'2'});
    assert.deepEqual(await request(app,{method:'GET',path:'/read'}),{status:200,body:'2'});
    await stop(app);app=null;
    const stored=disk(store);
    assert.equal(stored.version,2);
    assert.equal(stored.seq,2);
    assert.equal(stored.state,'2');
    assert.deepEqual(stored.receipts.map(x=>x.id),['buy_1','buy_2']);
    app=await start(b.output,store);
    assert.deepEqual(await request(app,{id:'buy_1',body:'one'}),{status:200,body:'1'});
    assert.deepEqual(await request(app,{method:'GET',path:'/read'}),{status:200,body:'2'});
    assert.equal(disk(store).seq,2,'Replay after process restart must not commit again');
  }finally{await stop(app);rmSync(b.folder,{recursive:true,force:true});rmSync(store,{recursive:true,force:true});}
});
test('B2b ten overlapping requests with one stable ID commit exactly once',async()=>{
  const b=compile(),store=temp();let app;
  try{
    app=await start(b.output,store);
    const replies=await Promise.all(Array.from({length:10},()=>request(app,{id:'batch_once',body:'same'})));
    assert.ok(replies.every(x=>x.status===200&&x.body==='1'));
    assert.deepEqual(await request(app,{method:'GET',path:'/read'}),{status:200,body:'1'});
    assert.deepEqual({revision:disk(store).seq,receipts:disk(store).receipts.length},{revision:1,receipts:1});
  }finally{await stop(app);rmSync(b.folder,{recursive:true,force:true});rmSync(store,{recursive:true,force:true});}
});
test('B2b independent JS H-Code interpreter reducer output still agrees with compiled runtime',async()=>{
  let reducer=null;
  execute(source,{httpServeState:(fn,initial)=>{
    assert.equal(initial,'0');reducer=fn;
  }});
  assert.equal(typeof reducer,'function');
  const req=Object.assign(Object.create(null),{body:'example',method:'POST',path:'/inc'});
  const first=reducer(req,'0');
  assert.deepEqual(Object.assign({},first),{body:'1',state:'1',status:200});
  // The host journal, not the H-Code reducer, handles retry suppression.
  const b=compile(),store=temp();let app;
  try{
    app=await start(b.output,store);
    const got=await request(app,{id:'parity_1',body:'example'});
    assert.deepEqual(got,{body:first.body,status:first.status});
    assert.equal(disk(store).state,first.state);
  }finally{await stop(app);rmSync(b.folder,{recursive:true,force:true});rmSync(store,{recursive:true,force:true});}
});
