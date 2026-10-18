// M19.12 B2c-3: actual Rust-compiled process and socket acceptance tests.
// Formerly RED B2b coverage; now part of the required opt-in CAS CI.
// No mocks: real Rust compiler, generated Node ESM, loopback HTTP, on-disk state.
import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn,spawnSync} from 'node:child_process';
import {mkdtempSync,readFileSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=fileURLToPath(new URL('../',import.meta.url));
const source=readFileSync(join(root,'compact/canonical20/programs/12-http-state-b2a.hc'),'utf8');
const workspace=()=>mkdtempSync(join(tmpdir(),'hcode12-b2c-red-'));
function compile(){
  const dir=workspace(),file=join(dir,'source.hc'),output=join(dir,'state.mjs');
  writeFileSync(file,source);
  const result=spawnSync('cargo',['run','--quiet','--manifest-path','compiler/Cargo.toml','--',
    'build',file,'--out',output],{cwd:root,windowsHide:true,encoding:'utf8',timeout:180000});
  if(result.error||result.status!==0){
    rmSync(dir,{recursive:true,force:true});
    throw Error('Native H-Code B2c test compile failed: '+(result.error?.message||result.stderr));
  }
  return {dir,output};
}
async function launch(output,stateRoot,extraEnv={}){
  const child=spawn(process.execPath,[output],{
    cwd:root,windowsHide:true,stdio:['ignore','pipe','pipe','ipc'],
    env:{...process.env,HCODE_HTTP_LISTEN:'127.0.0.1:0',HCODE_HTTP_STATE_ROOT:stateRoot,
      HCODE_HTTP_STATE_MODE:'cas-v1',HCODE_HTTP_HOST_IPC:'1',...extraEnv}
  });
  let stderr='';
  child.stderr.on('data',data=>{stderr+=String(data);});
  const port=await new Promise((resolve,reject)=>{
    let stdout='',done=false;
    const guard=setTimeout(()=>finish(Error('B2c server did not become ready: '+stderr)),12000);
    const finish=(error,value)=>{
      if(done)return;
      done=true;clearTimeout(guard);
      child.stdout.off('data',onOutput);
      child.off('error',onError);
      child.off('exit',onExit);
      if(error)reject(error);else resolve(value);
    };
    const onOutput=buffer=>{
      stdout+=String(buffer);
      const found=/HCODE_HTTP_READY=(\d+)\n/.exec(stdout);
      if(found)finish(null,Number(found[1]));
      else if(stdout.length>4096)finish(Error('Unbounded readiness output'));
    };
    const onExit=code=>finish(Error('State host exited '+code+': '+stderr));
    const onError=error=>finish(error);
    child.stdout.on('data',onOutput);
    child.once('exit',onExit);
    child.once('error',onError);
  });
  return {child,port,url:'http://127.0.0.1:'+port};
}
async function shutdown(app){
  if(!app||app.child.exitCode!==null||app.child.signalCode!==null)return;
  await new Promise(resolve=>{
    const deadline=setTimeout(()=>{app.child.kill('SIGKILL');resolve();},4500);
    app.child.once('exit',()=>{clearTimeout(deadline);resolve();});
    if(app.child.connected)app.child.send({hcodeHostCommand:'close'});
    else app.child.kill('SIGTERM');
  });
}
async function abruptKill(app){
  if(!app||app.child.exitCode!==null||app.child.signalCode!==null)return;
  await new Promise(resolve=>{
    const deadline=setTimeout(resolve,6000);
    app.child.once('exit',()=>{clearTimeout(deadline);resolve();});
    app.child.kill('SIGKILL');
  });
}
async function http(app,{method='POST',path='/inc',id,body='',contentType}){
  const headers={...(id?{'x-hcode-request-id':id}:{}),...(contentType?{'content-type':contentType}:{})};
  const response=await fetch(app.url+path,{
    method,headers,body:method==='GET'?undefined:body
  });
  return {status:response.status,body:await response.text()};
}
test('B2c C01: abrupt SIGKILL requires restart without manually deleting stale lock',async()=>{
  const build=compile(),storage=workspace();let app;
  try{
    app=await launch(build.output,storage);
    assert.deepEqual(await http(app,{id:'crash_01'}),{status:200,body:'1'});
    await abruptKill(app);app=null; // deliberately no clean IPC shutdown
    app=await launch(build.output,storage); // CAS must survive an orphaned legacy lock condition
    assert.deepEqual(await http(app,{method:'GET',path:'/read'}),{status:200,body:'1'});
    assert.deepEqual(await http(app,{id:'crash_01'}),{status:200,body:'1'});
  }finally{await shutdown(app);rmSync(build.dir,{recursive:true,force:true});rmSync(storage,{recursive:true,force:true});}
});
test('B2c C03+C04: two independent servers share one CAS root safely without lost updates',async()=>{
  const build=compile(),storage=workspace();let first,second;
  try{
    first=await launch(build.output,storage);
    second=await launch(build.output,storage); // independent writers must both start
    const operations=Array.from({length:32},(_,i)=>({
      id:'proc_'+i,body:'counter-'+i,app:i%2===0?first:second
    }));
    const replies=await Promise.all(operations.map(x=>http(x.app,x)));
    assert.ok(replies.every(x=>x.status===200));
    const read=await http(first,{method:'GET',path:'/read'});
    assert.deepEqual(read,{status:200,body:'32'});
    const duplicate=await Promise.all([
      http(first,{id:'replay_1',body:'same'}),
      http(second,{id:'replay_1',body:'same'})
    ]);
    assert.deepEqual(duplicate,[{status:200,body:'33'},{status:200,body:'33'}]);
    assert.deepEqual(await http(second,{method:'GET',path:'/read'}),{status:200,body:'33'});
  }finally{
    await shutdown(first);await shutdown(second);
    rmSync(build.dir,{recursive:true,force:true});rmSync(storage,{recursive:true,force:true});
  }
});

test('B2c C02: SIGKILL after commit but before HTTP response; replay succeeds only once',async()=>{
  const build=compile(),storage=workspace();let app;
  try{
    app=await launch(build.output,storage,{
      HCODE_CAS_TEST_FAULTS:'1',HCODE_CAS_KILL_AFTER_COMMIT_ID:'after_publish'});
    const terminated=new Promise(resolve=>app.child.once('exit',(code,signal)=>resolve({code,signal})));
    await assert.rejects(()=>http(app,{id:'after_publish',body:'payload'}));
    const exit=await terminated;
    assert.ok(exit.signal||exit.code!==0,'fault must abruptly terminate host process');
    app=null;
    app=await launch(build.output,storage);
    assert.deepEqual(await http(app,{method:'GET',path:'/read'}),{status:200,body:'1'});
    assert.deepEqual(await http(app,{id:'after_publish',body:'payload'}),{status:200,body:'1'});
    assert.deepEqual(await http(app,{id:'after_publish',body:'different'}),{status:409,body:'idempotency_conflict'});
    assert.deepEqual(await http(app,{method:'GET',path:'/read'}),{status:200,body:'1'});
  }finally{
    await shutdown(app);rmSync(build.dir,{recursive:true,force:true});
    rmSync(storage,{recursive:true,force:true});
  }
});
test('B2c C05: digest binds request ID to method, path, body and content type',async()=>{
  const build=compile(),storage=workspace();let app;
  try{
    app=await launch(build.output,storage);
    assert.deepEqual(await http(app,{id:'conflict',body:'payload',contentType:'application/json'}),{status:200,body:'1'});
    for(const args of [
      {method:'GET',path:'/read',id:'conflict'},
      {method:'POST',path:'/different',id:'conflict',body:'payload',contentType:'application/json'},
      {method:'POST',path:'/inc',id:'conflict',body:'different',contentType:'application/json'},
      {method:'POST',path:'/inc',id:'conflict',body:'payload',contentType:'text/plain'}
    ])assert.deepEqual(await http(app,args),{status:409,body:'idempotency_conflict'});
    assert.deepEqual(await http(app,{method:'GET',path:'/read'}),{status:200,body:'1'});
  }finally{await shutdown(app);rmSync(build.dir,{recursive:true,force:true});rmSync(storage,{recursive:true,force:true});}
});
test('B2c C06: surviving second writer remains live after first SIGKILL',async()=>{
  const build=compile(),storage=workspace();let first,second,third;
  try{
    first=await launch(build.output,storage);
    second=await launch(build.output,storage);
    assert.deepEqual(await http(first,{id:'live_a'}),{status:200,body:'1'});
    await abruptKill(first);first=null;
    assert.deepEqual(await http(second,{id:'live_b'}),{status:200,body:'2'});
    third=await launch(build.output,storage);
    assert.deepEqual(await http(third,{id:'live_c'}),{status:200,body:'3'});
    assert.deepEqual(await http(second,{method:'GET',path:'/read'}),{status:200,body:'3'});
  }finally{
    await shutdown(first);await shutdown(second);await shutdown(third);
    rmSync(build.dir,{recursive:true,force:true});rmSync(storage,{recursive:true,force:true});
  }
});
