// M19.12 B2a: bounded persistent STRING state for generic typed H-Code handlers.
// This is NOT the full canonical CRUD task12 and MUST NOT change 11/20 readiness.
import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn,spawnSync} from 'node:child_process';
import {mkdtempSync,readFileSync,rmSync,writeFileSync,symlinkSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';
import {execute} from '../prototype/src/hcode.mjs';
import {createHttpStateStore} from '../runtime/http-state.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
const source=readFileSync(join(root,'compact/canonical20/programs/12-http-state-b2a.hc'),'utf8');
const alias=source.replace('⤊(reply,"0")','http_serve(reply,"0")');
const dir=()=>mkdtempSync(join(tmpdir(),'hcode12-b2a-'));
function build(text=source){
  const folder=dir(),file=join(folder,'program.hc'),output=join(folder,'program.mjs');
  writeFileSync(file,text);
  const p=spawnSync('cargo',['run','--quiet','--manifest-path','compiler/Cargo.toml',
    '--','build',file,'--out',output],{cwd:root,encoding:'utf8',windowsHide:true,timeout:180000});
  if(p.error||p.status!==0){
    rmSync(folder,{recursive:true,force:true});
    throw Error('B2a Rust compiler failed: '+(p.error?.message||p.stderr));
  }
  return {folder,output,js:readFileSync(output,'utf8')};
}
async function start(output,storage,extras={}){
  const child=spawn(process.execPath,[output],{cwd:root,stdio:['ignore','pipe','pipe','ipc'],windowsHide:true,
    env:{...process.env,HCODE_HTTP_LISTEN:'127.0.0.1:0',HCODE_HTTP_STATE_ROOT:storage,HCODE_HTTP_HOST_IPC:'1',...extras}});
  let stderr='';
  child.stderr.on('data',p=>{stderr+=p.toString('utf8');});
  const port=await new Promise((resolve,reject)=>{
    let stdout='',finished=false;
    const guard=setTimeout(()=>done(Error('B2a server start timeout: '+stderr)),12000);
    function done(err,value){
      if(finished)return;finished=true;clearTimeout(guard);
      child.stdout.off('data',onData);child.off('error',onError);child.off('exit',onExit);
      if(err)reject(err);else resolve(value);
    }
    const onData=data=>{
      stdout+=data.toString('utf8');
      const found=/HCODE_HTTP_READY=(\d+)\n/.exec(stdout);
      if(found)done(null,Number(found[1]));
      else if(stdout.length>4096)done(Error('Invalid readiness output'));
    };
    const onError=err=>done(err);
    const onExit=code=>done(Error('B2a process exited '+code+': '+stderr));
    child.stdout.on('data',onData);child.once('error',onError);child.once('exit',onExit);
  });
  return {child,url:'http://127.0.0.1:'+port};
}
async function stop(app){
  if(!app)return;
  if(app.child.exitCode!==null||app.child.signalCode!==null)return;
  await new Promise(resolve=>{
    const guard=setTimeout(()=>{app.child.kill('SIGKILL');resolve();},6000);
    app.child.once('exit',()=>{clearTimeout(guard);resolve();});
    if(app.child.connected)app.child.send({hcodeHostCommand:'close'});
    else app.child.kill('SIGTERM');
  });
}
async function request(app,method,path){
  const res=await fetch(app.url+path,{method});
  return {status:res.status,body:await res.text()};
}
function independent(text){
  let state='0',handler=null,registered=0;
  execute(text,{httpServeState:(h,initial)=>{
    assert.equal(initial,'0');handler=h;registered++;
  }});
  assert.equal(registered,1);
  return request=>{
    const shape=Object.assign(Object.create(null),{body:'',method:request.method,path:request.path});
    const answer=handler(shape,state);
    state=answer.state;
    return {status:answer.status,body:answer.body};
  };
}
test('B2a H-Code Rust-compiled HTTP state persists and matches independent JS reducer across restarts',async()=>{
  const compiled=build(source),store=dir(),ref=independent(source),refAlias=independent(alias);
  let app;
  try{
    assert.match(compiled.js,/__hc_http_serve_state/);
    assert.match(compiled.js,/HCODE_HTTP_STATE_ROOT/);
    app=await start(compiled.output,store);
    for(const step of [
      {method:'GET',path:'/read'},
      {method:'POST',path:'/inc'},
      {method:'POST',path:'/inc'},
      {method:'GET',path:'/read'}
    ]){
      const expected=ref(step),other=refAlias(step);
      assert.deepEqual(other,expected,'ASCII alias JS parity');
      assert.deepEqual(await request(app,step.method,step.path),expected,'compiled/JS parity');
    }
    await stop(app);app=null;
    app=await start(compiled.output,store);
    for(const step of [
      {method:'GET',path:'/read'},
      {method:'POST',path:'/inc'},
      {method:'GET',path:'/read'}
    ])assert.deepEqual(await request(app,step.method,step.path),ref(step));
    const disk=JSON.parse(readFileSync(join(store,'hcode-http-state.json'),'utf8'));
    assert.deepEqual(disk,{version:1,seq:3,state:'3'});
  }finally{await stop(app);rmSync(compiled.folder,{recursive:true,force:true});rmSync(store,{recursive:true,force:true});}
});
test('B2a two simultaneous HTTP clients cannot lose increments in one host process',async()=>{
  const compiled=build(),store=dir();let app;
  try{
    app=await start(compiled.output,store);
    const responses=await Promise.all(Array.from({length:12},()=>request(app,'POST','/inc')));
    assert.deepEqual(responses.map(x=>Number(x.body)).sort((a,b)=>a-b),
      Array.from({length:12},(_,i)=>i+1));
    assert.ok(responses.every(x=>x.status===200));
    await stop(app);app=null;app=await start(compiled.output,store);
    assert.deepEqual(await request(app,'GET','/read'),{status:200,body:'12'});
    const disk=JSON.parse(readFileSync(join(store,'hcode-http-state.json'),'utf8'));
    assert.equal(disk.seq,12);
  }finally{await stop(app);rmSync(compiled.folder,{recursive:true,force:true});rmSync(store,{recursive:true,force:true});}
});
test('B2a local durable store denies concurrent processes, corrupt storage and ambient root',()=>{
  const storage=dir();let cap;
  try{
    cap=createHttpStateStore({root:storage,initial:'first'});
    assert.equal(cap.sequence(),0);
    assert.throws(()=>createHttpStateStore({root:storage,initial:'second'}),/EEXIST|exist/i);
    assert.equal(cap.commit('updated'),1);
    assert.equal(cap.commit('updated'),1,'unchanged state must not duplicate writes');
    cap.close();cap=null;
    cap=createHttpStateStore({root:storage,initial:'wrong'});
    assert.equal(cap.read(),'updated','persisted state overrides provided bootstrap');
    assert.equal(cap.sequence(),1);
    cap.close();cap=null;
    writeFileSync(join(storage,'hcode-http-state.json'),'{broken JSON');
    assert.throws(()=>createHttpStateStore({root:storage,initial:'x'}),/Corrupt H-Code persisted state/);
  }finally{cap?.close();rmSync(storage,{recursive:true,force:true});}
  assert.throws(()=>createHttpStateStore({root:'./relative',initial:'x'}),/canonical absolute/);
  assert.throws(()=>independent(source.replace('⤊(reply,"0")','⤊(reply,42)'),),/requires Function and bounded String/);
});
test('B2a refuses symlinked target and never overwrites external file',t=>{
  const storage=dir(),outside=join(storage,'unrelated'),target=join(storage,'hcode-http-state.json');
  try{
    writeFileSync(outside,'important');
    try{symlinkSync(outside,target,'file');}
    catch(error){if(['EPERM','EACCES','ENOTSUP'].includes(error.code)){t.diagnostic('Symlink creation denied on this host');return;}throw error;}
    assert.throws(()=>createHttpStateStore({root:storage,initial:'0'}),/Unsafe H-Code state file target/);
    assert.equal(readFileSync(outside,'utf8'),'important');
  }finally{rmSync(storage,{recursive:true,force:true});}
});
test('B2a compiler rejects wrong handler/initial types and server effects in callbacks',()=>{
  for(const sourceBad of [
    source.replace('⤊(reply,"0")','⤊(reply,42)'),
    source.replace('⤊(reply,"0")','⤊(99,"0")'),
    source.replace('⤊(reply,"0")','ƒ nested()→Unit {⤊(reply,"0")}\nnested()')
  ]){
    const folder=dir();
    try{
      const f=join(folder,'bad.hc');writeFileSync(f,sourceBad);
      const p=spawnSync('cargo',['run','--quiet','--manifest-path','compiler/Cargo.toml',
        '--','check',f],{cwd:root,encoding:'utf8',windowsHide:true,timeout:180000});
      assert.notEqual(p.status,0,'Bad H-Code state handler should fail type/effect check');
      assert.match(p.stderr,/EFFECT|TYPE|expected|state|String|⤊/i);
    }finally{rmSync(folder,{recursive:true,force:true});}
  }
});
