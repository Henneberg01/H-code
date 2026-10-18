// Canonical12 B0 proof: REAL independent TypeScript HTTP reference, not H-Code.
// This must stay green while 12-crud-api remains UNSUPPORTED in Canonical20.
// No mocked responses: exercises network sockets, disk, process restart and concurrency.
import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {createHash} from 'node:crypto';
import {existsSync,mkdtempSync,readFileSync,rmSync,symlinkSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=fileURLToPath(new URL('../',import.meta.url));
const FROZEN=Object.freeze({
  registry:['compact/canonical20/workloads.json','46653ef90ffb3e420fba4ddfbfac3c4cfd57f3b3'],
  ts:['compact/canonical20/programs/12-crud-api.ts','6ac016aaf88620578cfc36a82b6f4a94b3b72c9e'],
  cases:['compact/canonical20/cases/12-crud-api.json','0383e7ed4c342cc39756822a2a6581d833c53a76']
});
const blob=b=>createHash('sha1').update('blob '+b.length+'\0').update(b).digest('hex');
function locked(name){
  const [path,sha]=FROZEN[name],bytes=readFileSync(join(root,path));
  assert.equal(blob(bytes),sha,'Frozen canonical12 contract source changed: '+path);
  return bytes.toString('utf8');
}
function contract(){
  const registry=JSON.parse(locked('registry')),fixtures=JSON.parse(locked('cases'));
  const w=registry.workloads?.[11];
  assert.equal(registry.workloads.length,20);
  assert.equal(w.id,'12-crud-api');
  assert.equal(w.title,'Basic CRUD API');
  assert.equal(w.acceptance,'server endpoints create/read/update/delete, request validation and deterministic persistence');
  assert.deepEqual(w.requiredCapabilities,['http-server','records','storage']);
  assert.equal(w.status,'unsupported');
  assert.equal(w.evidence,null);
  assert.equal(fixtures.id,w.id);
  assert.equal(fixtures.acceptance,w.acceptance);
  assert.equal(fixtures.originalRegistryGitBlobSha,FROZEN.registry[1]);
  assert.equal(fixtures.cases.length,6);
  locked('ts');
  return fixtures;
}
function workspace(){
  return mkdtempSync(join(tmpdir(),'hcode12-oracle-'));
}
const oraclePath=join(root,FROZEN.ts[0]);
async function start(dir){
  const child=spawn(process.execPath,['--experimental-strip-types',oraclePath,dir],{
    cwd:root,stdio:['ignore','pipe','pipe'],windowsHide:true
  });
  const line=await new Promise((resolve,reject)=>{
    let out='',err='',settled=false;
    const timeout=setTimeout(()=>finish(Error('Oracle startup timed out: '+err)),15000);
    const finish=(error,value)=>{
      if(settled)return;
      settled=true;clearTimeout(timeout);
      child.stdout.off('data',onData);
      child.stderr.off('data',onError);
      child.off('error',onStartError);
      child.off('exit',onExit);
      if(error)reject(error);else resolve(value);
    };
    const onData=bytes=>{
      out+=bytes.toString('utf8');
      if(out.length>4096)finish(Error('Oversized readiness output'));
      else if(out.includes('\n'))finish(null,out.split('\n')[0]);
    };
    const onError=bytes=>{err+=bytes.toString('utf8');};
    const onStartError=e=>finish(e);
    const onExit=(code)=>finish(Error('Oracle exited before ready ('+code+'): '+err));
    child.stdout.on('data',onData);
    child.stderr.on('data',onError);
    child.once('error',onStartError);
    child.once('exit',onExit);
  });
  const info=JSON.parse(line);
  assert.equal(info.ready,true);
  assert.ok(Number.isInteger(info.port)&&info.port>0);
  return {child,url:'http://127.0.0.1:'+info.port};
}
async function stop(instance){
  if(!instance)return;
  const child=instance.child;
  if(child.exitCode!==null || child.signalCode!==null)return;
  await new Promise(resolve=>{
    const guard=setTimeout(()=>{child.kill('SIGKILL');resolve();},5000);
    child.once('exit',()=>{clearTimeout(guard);resolve();});
    child.kill('SIGTERM');
  });
}
async function request(instance,step){
  const {method,path}=step;
  const opts={method,redirect:'manual',headers:{}};
  if(Object.hasOwn(step,'body')||Object.hasOwn(step,'rawBody')){
    opts.body=Object.hasOwn(step,'rawBody')?step.rawBody:JSON.stringify(step.body);
    opts.headers['content-type']='application/json';
  }
  if(step.headers)Object.assign(opts.headers,step.headers);
  const res=await fetch(instance.url+path,opts);
  const body=await res.text();
  return {status:res.status,body,contentType:res.headers.get('content-type')};
}
async function perform(instance,step){
  const got=await request(instance,step);
  assert.equal(got.status,step.status,step.method+' '+step.path);
  assert.equal(got.body,step.response===null?'':JSON.stringify(step.response)+'\n',
    'Byte-exact response for '+step.method+' '+step.path);
  if(step.response!==null)assert.equal(got.contentType,'application/json; charset=utf-8');
  return got;
}
function snapshot(dir){
  const file=join(dir,'items-state.json');
  return existsSync(file)?JSON.parse(readFileSync(file,'utf8')):[];
}
test('canonical12 preregistered exact contract and source SHA locks cannot promote coverage',()=>{
  contract();
});
test('canonical12 six source-locked HTTP fixtures survive real process restarts',async()=>{
  const fixtures=contract();
  for(const scenario of fixtures.cases){
    const dir=workspace();let instance;
    try{
      instance=await start(dir);
      for(const step of scenario.steps){
        if(step.restart){
          await stop(instance);
          instance=await start(dir);
        }else await perform(instance,step);
      }
      assert.deepEqual(snapshot(dir),scenario.snapshot,scenario.id+' durable store snapshot');
    }finally{await stop(instance);rmSync(dir,{recursive:true,force:true});}
  }
});
test('canonical12 optimistic concurrency protects simultaneous HTTP updates',async()=>{
  contract();
  const dir=workspace();let instance;
  try{
    instance=await start(dir);
    await perform(instance,{method:'POST',path:'/items',body:{id:'shared',name:'Init',qty:0},
      status:201,response:{id:'shared',name:'Init',qty:0,version:1}});
    const [a,b]=await Promise.all([
      request(instance,{method:'PUT',path:'/items/shared',body:{name:'Client A',qty:1,version:1}}),
      request(instance,{method:'PUT',path:'/items/shared',body:{name:'Client B',qty:2,version:1}})
    ]);
    assert.deepEqual([a.status,b.status].sort(),[200,409]);
    const winner=JSON.parse((a.status===200?a:b).body);
    assert.equal(winner.version,2);
    assert.ok(['Client A','Client B'].includes(winner.name));
    await stop(instance);instance=await start(dir);
    const read=await request(instance,{method:'GET',path:'/items/shared'});
    assert.equal(read.status,200);
    assert.deepEqual(JSON.parse(read.body),winner,'No lost update or ghost commit after restart');
    assert.deepEqual(snapshot(dir),[winner]);
  }finally{await stop(instance);rmSync(dir,{recursive:true,force:true});}
});
test('canonical12 rejects oversize bodies, malformed UTF-8, invalid types and JSON content-type without writes',async()=>{
  contract();
  const dir=workspace();let instance;
  try{
    instance=await start(dir);
    for(const body of [
      '{'+ ' '.repeat(16400) +'}',
      Buffer.from([0x7b,0xff,0x7d]),
      '{"id":"broken","name":"\\ud800","qty":1}'
    ]){
      const response=await fetch(instance.url+'/items',{
        method:'POST',headers:{'content-type':'application/json'},body
      });
      assert.equal(response.status,Buffer.byteLength(body)>16384?413:400);
    }
    const wrongType=await request(instance,{method:'POST',path:'/items',
      body:{id:'bad',name:'Denied',qty:1},headers:{'content-type':'text/plain'}});
    assert.equal(wrongType.status,400);
    assert.deepEqual(snapshot(dir),[]);
  }finally{await stop(instance);rmSync(dir,{recursive:true,force:true});}
});
test('canonical12 oracle refuses symlinked persistent state target',async(t)=>{
  contract();
  const dir=workspace();const outside=join(dir,'outside.json'),state=join(dir,'items-state.json');
  try{
    writeFileSync(outside,'[]\n');
    try{symlinkSync(outside,state,'file');}
    catch(e){
      if(['EPERM','EACCES','ENOTSUP'].includes(e.code)){t.diagnostic('Filesystem denied symlink creation');return;}
      throw e;
    }
    const child=spawn(process.execPath,['--experimental-strip-types',oraclePath,dir],{
      cwd:root,stdio:['ignore','pipe','pipe'],windowsHide:true
    });
    let err='';
    child.stderr.on('data',b=>{err+=b.toString('utf8');});
    const exit=await new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>{child.kill('SIGKILL');reject(Error('Symlink test hung'));},10000);
      child.once('error',reject);
      child.once('exit',code=>{clearTimeout(timer);resolve(code);});
    });
    assert.notEqual(exit,0);
    assert.match(err,/persistent state|symlink|Invalid|Error/i);
    assert.equal(readFileSync(outside,'utf8'),'[]\n');
  }finally{rmSync(dir,{recursive:true,force:true});}
});
