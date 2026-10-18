// M19.12 B2c-0: intentionally RED real-process acceptance tests.
// Do NOT add to required CI until a lock-free CAS backend has been implemented.
// These tests currently expose B2b's documented SIGKILL stale-lock limitation.
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
async function launch(output,stateRoot){
  const child=spawn(process.execPath,[output],{
    cwd:root,windowsHide:true,stdio:['ignore','pipe','pipe','ipc'],
    env:{...process.env,HCODE_HTTP_LISTEN:'127.0.0.1:0',HCODE_HTTP_STATE_ROOT:stateRoot,
      HCODE_HTTP_STATE_MODE:'cas-v1',HCODE_HTTP_HOST_IPC:'1'}
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
async function http(app,{method='POST',path='/inc',id,body=''}){
  const headers=id?{'x-hcode-request-id':id}:{};
  const response=await fetch(app.url+path,{
    method,headers,body:method==='GET'?undefined:body
  });
  return {status:response.status,body:await response.text()};
}
test('B2c RED/C01+C02: abrupt SIGKILL requires restart without manually deleting stale lock',async()=>{
  const build=compile(),storage=workspace();let app;
  try{
    app=await launch(build.output,storage);
    assert.deepEqual(await http(app,{id:'crash_01'}),{status:200,body:'1'});
    await abruptKill(app);app=null; // deliberately no clean IPC shutdown
    app=await launch(build.output,storage); // RED today: legacy lock causes EEXIST
    assert.deepEqual(await http(app,{method:'GET',path:'/read'}),{status:200,body:'1'});
    assert.deepEqual(await http(app,{id:'crash_01'}),{status:200,body:'1'});
  }finally{await shutdown(app);rmSync(build.dir,{recursive:true,force:true});rmSync(storage,{recursive:true,force:true});}
});
test('B2c RED/C03+C04: two independent servers share one CAS root safely without lost updates',async()=>{
  const build=compile(),storage=workspace();let first,second;
  try{
    first=await launch(build.output,storage);
    second=await launch(build.output,storage); // RED today: single-writer lock rejects second
    const operations=Array.from({length:24},(_,i)=>({
      id:'proc_'+i,body:'counter-'+i,app:i%2===0?first:second
    }));
    const replies=await Promise.all(operations.map(x=>http(x.app,x)));
    assert.ok(replies.every(x=>x.status===200));
    const read=await http(first,{method:'GET',path:'/read'});
    assert.deepEqual(read,{status:200,body:'24'});
    const duplicate=await Promise.all([
      http(first,{id:'replay_1',body:'same'}),
      http(second,{id:'replay_1',body:'same'})
    ]);
    assert.deepEqual(duplicate,[{status:200,body:'25'},{status:200,body:'25'}]);
    assert.deepEqual(await http(second,{method:'GET',path:'/read'}),{status:200,body:'25'});
  }finally{
    await shutdown(first);await shutdown(second);
    rmSync(build.dir,{recursive:true,force:true});rmSync(storage,{recursive:true,force:true});
  }
});
