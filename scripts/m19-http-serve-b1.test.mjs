// M19.12 B1: genuine H-Code symbol ⤊ + ASCII alias must accept inbound HTTP.
// This is a generic stateless handler; canonical12 full CRUD remains unsupported.
import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn,spawnSync} from 'node:child_process';
import {readFileSync,mkdtempSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {execute} from '../prototype/src/hcode.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
const sourcePath=join(root,'compact/canonical20/programs/12-http-serve-b1.hc');
const original=readFileSync(sourcePath,'utf8');
const alias=original.replace('⤊reply','http_serve reply');
function build(source=original){
  const dir=mkdtempSync(join(tmpdir(),'hcode-server-b1-'));
  const file=join(dir,'source.hc'),out=join(dir,'server.mjs');
  writeFileSync(file,source);
  const run=spawnSync('cargo',['run','--quiet','--manifest-path','compiler/Cargo.toml','--',
    'build',file,'--out',out],{cwd:root,encoding:'utf8',windowsHide:true,timeout:180000});
  if(run.error || run.status!==0){
    rmSync(dir,{recursive:true,force:true});
    throw Error('H-Code compiler failed: '+(run.error?.message||run.stderr));
  }
  return {dir,out,compiled:readFileSync(out,'utf8')};
}
async function start(compiled,grant='127.0.0.1:0'){
  const child=spawn(process.execPath,[compiled],{cwd:root,windowsHide:true,
    env:{...process.env,HCODE_HTTP_LISTEN:grant},stdio:['ignore','pipe','pipe']});
  const port=await new Promise((resolve,reject)=>{
    let stdout='',stderr='',finished=false;
    const timeout=setTimeout(()=>done(Error('H-Code HTTP readiness timed out: '+stderr)),10000);
    function done(error,value){
      if(finished)return;
      finished=true;clearTimeout(timeout);
      child.stdout.off('data',onData);
      child.stderr.off('data',onError);
      child.off('error',onStart);
      child.off('exit',onExit);
      if(error)reject(error);else resolve(value);
    }
    const onData=part=>{
      stdout+=part.toString('utf8');
      const match=/HCODE_HTTP_READY=(\d+)\n/.exec(stdout);
      if(match)done(null,Number(match[1]));
      else if(stdout.length>4096)done(Error('Oversized readiness stream'));
    };
    const onError=part=>{stderr+=part.toString('utf8');};
    const onStart=error=>done(error);
    const onExit=code=>done(Error('H-Code server exited '+code+': '+stderr));
    child.stdout.on('data',onData);child.stderr.on('data',onError);
    child.once('error',onStart);child.once('exit',onExit);
  });
  return {child,url:'http://127.0.0.1:'+port};
}
async function stop(instance){
  if(!instance)return;
  const child=instance.child;
  if(child.exitCode!==null||child.signalCode!==null)return;
  await new Promise(resolve=>{
    const timeout=setTimeout(()=>{child.kill('SIGKILL');resolve();},3500);
    child.once('exit',()=>{clearTimeout(timeout);resolve();});
    child.kill('SIGTERM');
  });
}
function reference(source){
  let registered=null;
  execute(source,{httpServe:handler=>{registered=handler;}});
  assert.equal(typeof registered,'function');
  return input=>{
    const req=Object.assign(Object.create(null),input);
    const result=registered(req);
    return {body:result.body,status:result.status};
  };
}
test('H-Code Rust→Node generated server and independent JS interpreter accept same glyph and alias handlers',async()=>{
  const ref=reference(original),ascii=reference(alias);
  const b=build(original);
  try{
    assert.match(b.compiled,/__hc_http_serve/);
    assert.match(b.compiled,/HCODE_HTTP_LISTEN/);
    assert.doesNotMatch(b.compiled,/__hc_http_get\s*=/,
      'unused outgoing HTTP GET should not inflate a server-only program');
    let app;
    try{
      app=await start(b.out);
      for(const sample of [
        {method:'GET',path:'/ping',body:''},
        {method:'POST',path:'/orders',body:'Æøå 日本語'},
        {method:'PUT',path:'/item/a',body:'{"x":1}'}
      ]){
        const expected=ref(sample),expectedAscii=ascii(sample);
        assert.deepEqual(expectedAscii,expected);
        const response=await fetch(app.url+sample.path,{
          method:sample.method,body:sample.method==='GET'?undefined:sample.body
        });
        assert.equal(response.status,expected.status);
        assert.equal(await response.text(),expected.body);
      }
    }finally{await stop(app);}
  }finally{rmSync(b.dir,{recursive:true,force:true});}
});
test('⤊ and http_serve both fail closed without explicitly granted host',()=>{
  for(const text of [original,alias]){
    assert.throws(()=>execute(text),/HTTP server capability denied|httpServe/);
    const b=build(text);
    try{
      const env={...process.env};delete env.HCODE_HTTP_LISTEN;
      const result=spawnSync(process.execPath,[b.out],{cwd:root,env,
        encoding:'utf8',windowsHide:true,timeout:8000});
      assert.notEqual(result.status,0,'Ambient inbound network access was allowed');
      assert.match(result.stderr,/capability denied|HCODE_HTTP_LISTEN/);
    }finally{rmSync(b.dir,{recursive:true,force:true});}
  }
});
test('wrong handler type and nested effect rejected by Rust, JS interpreter rejects wrong handler',()=>{
  for(const source of ['⤊"wrong"','http_serve 42']){
    const dir=mkdtempSync(join(tmpdir(),'hcode-server-negative-'));
    try{
      const path=join(dir,'invalid.hc');writeFileSync(path,source+'\n');
      const result=spawnSync('cargo',['run','--quiet','--manifest-path','compiler/Cargo.toml',
        '--','check',path],{cwd:root,encoding:'utf8',windowsHide:true,timeout:180000});
      assert.notEqual(result.status,0,'Rust compiler accepted invalid handler '+source);
      assert.match(result.stderr,/TYPE|handler|Function|⤊|requires/i);
      assert.throws(()=>execute(source,{httpServe:()=>{}}),/handler function/);
    }finally{rmSync(dir,{recursive:true,force:true});}
  }
});
test('real inbound HTTP rejects invalid UTF-8 and oversized bodies without invoking H-Code',async()=>{
  const b=build(original);let app;
  try{
    app=await start(b.out);
    const invalid=await fetch(app.url+'/invalid',{method:'POST',body:Buffer.from([0xff,0xfe])});
    assert.equal(invalid.status,400);
    assert.deepEqual(await invalid.json(),{error:'invalid_utf8'});
    const oversized=await fetch(app.url+'/huge',{method:'POST',body:'x'.repeat(17000)});
    assert.equal(oversized.status,413);
    assert.deepEqual(await oversized.json(),{error:'body_too_large'});
  }finally{await stop(app);rmSync(b.dir,{recursive:true,force:true});}
});
