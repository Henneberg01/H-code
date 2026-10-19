// M19.12 B3: real, independent Rust-compiled H-Code HTTP proof attempt.
// Frozen Canonical12 fixtures, TypeScript oracle and manifest stay byte-identical.
// CAS revisions hold the SAME logical JSON item state as oracle items-state.json,
// but use a different physical durability format. Never silently call 12 verified.
import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import {spawn,spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {mkdtempSync,rmSync,writeFileSync,readFileSync,symlinkSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHttpCasStateStore} from '../runtime/http-state-cas.mjs';

const ROOT=fileURLToPath(new URL('../',import.meta.url));
const ROOTS={
 registry:['compact/canonical20/workloads.json','46653ef90ffb3e420fba4ddfbfac3c4cfd57f3b3'],
 oracle:['compact/canonical20/programs/12-crud-api.ts','6ac016aaf88620578cfc36a82b6f4a94b3b72c9e'],
 fixtures:['compact/canonical20/cases/12-crud-api.json','0383e7ed4c342cc39756822a2a6581d833c53a76']
};
function immutable(which){
 const [path,sha]=ROOTS[which];
 const bytes=readFileSync(join(ROOT,path));
 const actual=createHash('sha1').update('blob '+bytes.length+'\0').update(bytes).digest('hex');
 assert.equal(actual,sha,'Canonical12 original file changed: '+path);
 return bytes.toString('utf8');
}
const contract=JSON.parse(immutable('fixtures'));
const original=JSON.parse(immutable('registry'));
immutable('oracle');
assert.equal(original.workloads[11].id,'12-crud-api');
assert.equal(contract.cases.length,6);
const makeRoot=()=>mkdtempSync(join(tmpdir(),'hcode12-compiled-'));
let cached=null;
function compiler(){
 if(cached)return cached;
 const dir=makeRoot(),source=join(ROOT,'compact/canonical20/programs/12-crud-api.hc'),output=join(dir,'hcode-server.mjs');
 const result=spawnSync('cargo',['run','--quiet','--manifest-path','compiler/Cargo.toml','--','build',source,'--out',output],{
  cwd:ROOT,windowsHide:true,encoding:'utf8',timeout:180000,maxBuffer:1048576
 });
 if(result.error||result.status!==0){
  rmSync(dir,{recursive:true,force:true});
  throw Error('Rust H-Code compiler failed: '+String(result.error?.message??result.stderr));
 }
 cached={dir,output};
 return cached;
}
after(()=>{if(cached)rmSync(cached.dir,{recursive:true,force:true});});
async function launch(dir){
 const child=spawn(process.execPath,[compiler().output],{
  cwd:ROOT,stdio:['ignore','pipe','pipe','ipc'],windowsHide:true,
  env:{...process.env,HCODE_HTTP_LISTEN:'127.0.0.1:0',
   HCODE_HTTP_STATE_ROOT:dir,HCODE_HTTP_STATE_MODE:'cas-v1',HCODE_HTTP_HOST_IPC:'1'}
 });
 let errors='';
 child.stderr.on('data',bytes=>{if(errors.length<10000)errors+=String(bytes);});
 let out='';
 const port=await new Promise((resolve,reject)=>{
  let settled=false;
  const deadline=setTimeout(()=>finish(Error('H-Code HTTP readiness timeout '+errors)),12000);
  const onData=bytes=>{
   out+=String(bytes);
   const found=/HCODE_HTTP_READY=(\d+)\n/.exec(out);
   if(found)finish(null,Number(found[1]));
   else if(out.length>4096)finish(Error('Unexpected server readiness output'));
  };
  const onError=e=>finish(e);
  const onExit=code=>finish(Error('H-Code server failed before readiness '+code+': '+errors));
  function finish(e,value){
   if(settled)return;
   settled=true;clearTimeout(deadline);
   child.stdout.off('data',onData);
   child.off('error',onError);
   child.off('exit',onExit);
   if(e)reject(e);else resolve(value);
  }
  child.stdout.on('data',onData);child.once('error',onError);child.once('exit',onExit);
 });
 return {child,url:'http://127.0.0.1:'+port};
}
async function stop(app){
 if(!app||app.child.exitCode!==null||app.child.signalCode!==null)return;
 await new Promise(resolve=>{
  const guard=setTimeout(()=>{app.child.kill('SIGKILL');resolve();},5000);
  app.child.once('exit',()=>{clearTimeout(guard);resolve();});
  if(app.child.connected)app.child.send({hcodeHostCommand:'close'});
  else app.child.kill('SIGTERM');
 });
}
async function call(app,step){
 const opts={method:step.method,redirect:'manual',headers:{}};
 if(Object.hasOwn(step,'body')||Object.hasOwn(step,'rawBody')){
  opts.body=Object.hasOwn(step,'rawBody')?step.rawBody:JSON.stringify(step.body);
  opts.headers['content-type']='application/json';
 }
 if(step.headers)Object.assign(opts.headers,step.headers);
 const response=await fetch(app.url+step.path,opts);
 return {status:response.status,body:await response.text(),
  contentType:response.headers.get('content-type')};
}
async function assertContractResponse(app,step){
 const got=await call(app,step);
 assert.equal(got.status,step.status,step.method+' '+step.path);
 assert.equal(got.body,step.response===null?'':JSON.stringify(step.response)+'\n',
  'Exact bytes for '+step.method+' '+step.path);
 if(step.response!==null)
  assert.equal(got.contentType,'application/json; charset=utf-8');
 else
  assert.equal(got.contentType,null,'204 must not send content-type');
 return got;
}
function durable(dir){
 // This is H-Code's REAL production revision store, not a fabricated oracle
 // items-state.json. Check integrity via CAS snapshot and compare logical JSON.
 const store=createHttpCasStateStore({root:dir,initial:'[]'});
 try{return {state:JSON.parse(store.read()),sequence:store.sequence()};}
 finally{store.close();}
}
test('Canonical12: all six FROZEN HTTP scenarios, durable process restarts and logical snapshots',async()=>{
 for(const scenario of contract.cases){
  const dir=makeRoot();let server;
  try{
   server=await launch(dir);
   for(const step of scenario.steps){
    if(step.restart){await stop(server);server=await launch(dir);}
    else await assertContractResponse(server,step);
   }
   assert.deepEqual(durable(dir).state,scenario.snapshot,scenario.id+' persisted data');
  }finally{await stop(server);rmSync(dir,{recursive:true,force:true});}
 }
});
test('Canonical12: CAS-backed simultaneous optimistic PUTs have one winner, surviving restart',async()=>{
 const dir=makeRoot();let server;
 try{
  server=await launch(dir);
  await assertContractResponse(server,{
   method:'POST',path:'/items',body:{id:'shared',name:'Init',qty:0},
   status:201,response:{id:'shared',name:'Init',qty:0,version:1}
  });
  const [a,b]=await Promise.all([
   call(server,{method:'PUT',path:'/items/shared',body:{name:'Client A',qty:1,version:1}}),
   call(server,{method:'PUT',path:'/items/shared',body:{name:'Client B',qty:2,version:1}})
  ]);
  assert.deepEqual([a.status,b.status].sort(),[200,409]);
  const winner=JSON.parse((a.status===200?a:b).body);
  assert.equal(winner.version,2);
  assert.ok(['Client A','Client B'].includes(winner.name));
  await stop(server);server=await launch(dir);
  assert.deepEqual(JSON.parse((await call(server,{method:'GET',path:'/items/shared'})).body),winner);
  assert.deepEqual(durable(dir).state,[winner]);
 }finally{await stop(server);rmSync(dir,{recursive:true,force:true});}
});
test('Canonical12: invalid bodies and wrong content-type cannot mutate durable state',async()=>{
 const dir=makeRoot();let server;
 try{
  server=await launch(dir);
  for(const body of [
   '{'+' '.repeat(16400)+'}',
   Buffer.from([0x7b,0xff,0x7d]),
   '{"id":"broken","name":"\\ud800","qty":1}'
  ]){
   const response=await fetch(server.url+'/items',{
    method:'POST',headers:{'content-type':'application/json'},body
   });
   assert.equal(response.status,Buffer.byteLength(body)>16384?413:400);
  }
  assert.equal((await call(server,{method:'POST',path:'/items',
   body:{id:'bad',name:'Denied',qty:1},headers:{'content-type':'text/plain'}})).status,400);
  assert.deepEqual(durable(dir).state,[]);
 }finally{await stop(server);rmSync(dir,{recursive:true,force:true});}
});
test('Canonical12: replay exact CRUD response across restart with durable request-ID',async()=>{
 const dir=makeRoot();let server;
 try{
  server=await launch(dir);
  const step={method:'POST',path:'/items',body:{id:'repeat',name:'Only once',qty:1},
   headers:{'x-hcode-request-id':'unique_1'}};
  const first=await call(server,step);
  assert.equal(first.status,201);
  const before=durable(dir);
  await stop(server);server=await launch(dir);
  assert.deepEqual(await call(server,step),first);
  assert.deepEqual(durable(dir),before,'No additional revision after replay');
  assert.equal((await call(server,{...step,body:{id:'repeat',name:'DIFFERENT',qty:1}})).status,409);
  assert.deepEqual(durable(dir),before);
 }finally{await stop(server);rmSync(dir,{recursive:true,force:true});}
});
test('Canonical12: symlinked CAS committed revision fails closed without rewriting target',async(t)=>{
 const dir=makeRoot(),outside=join(dir,'outside.txt');let app;
 try{
  writeFileSync(outside,'DO NOT TOUCH');
  const link=join(dir,'rev-000000000001.json');
  try{symlinkSync(outside,link,'file');}
  catch(e){if(['EPERM','EACCES','ENOTSUP'].includes(e?.code)){
    t.diagnostic('Symlink unsupported by host');return;
   }throw e;}
  await assert.rejects(()=>launch(dir),/failed before readiness|readiness timeout|Unsafe|Error/);
  assert.equal(readFileSync(outside,'utf8'),'DO NOT TOUCH');
 }finally{await stop(app);rmSync(dir,{recursive:true,force:true});}
});
