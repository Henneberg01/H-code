import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFileSync,writeFileSync,mkdtempSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {spawn,spawnSync} from 'node:child_process';

const program='≔u←⤓⟦String⟧⌨;≔r←⤋u;print(⤒r);\n';

function compile(){
 const temp=mkdtempSync(join(tmpdir(),'hcode-parallel08-'));
 const input=join(temp,'parallel.hc'),output=join(temp,'parallel.mjs');
 writeFileSync(input,program);
 const p=spawnSync('cargo',['run','--quiet','--manifest-path','compiler/Cargo.toml',
   '--','build',input,'--out',output],{encoding:'utf8',windowsHide:true,timeout:180000});
 if(p.error||p.status!==0){
   rmSync(temp,{recursive:true,force:true});
   throw Error('Rust compiler failed: '+(p.error?.message||p.stderr));
 }
 const js=readFileSync(output,'utf8');
 assert.match(js,/await __hc_http_batch/);
 assert.match(js,/Promise\.all\(urls\.map\(__hc_http_get\)\)/);
 return {temp,output,js};
}

async function liveServer(){
 const paths=['/a','/b','/c'],requested=[],responded=[];
 const server=createServer((req,res)=>{
   if(req.method!=='GET'||!paths.includes(req.url||'')){
     res.writeHead(405);res.end('not allowed');return;
   }
   requested.push(req.url);
   if(requested.length===3){
     // Do not release ANY response before all 3 requests have arrived.
     const sockets=[...pending];
     pending.length=0;
     for(const [path,r] of sockets)reply(path,r);
     reply(req.url,res);
   }else{
     pending.push([req.url,res]);
   }
 });
 const pending=[];
 const reply=(path,res)=>{
   const delay=path==='/a'?40:0;
   setTimeout(()=>{
     responded.push(path);
     res.writeHead(200,{'content-type':'text/plain'});
     res.end(path.slice(1));
   },delay);
 };
 await new Promise((ok,fail)=>{server.once('error',fail);server.listen(0,'127.0.0.1',ok);});
 const origin='http://127.0.0.1:'+server.address().port;
 return {server,origin,requested,responded,urls:paths.map(p=>origin+p),
   close:()=>new Promise(resolve=>{
     server.closeAllConnections();server.close(()=>resolve());
   })};
}
async function executeFile(output,urls,origin,timeoutMs=7000){
 return await new Promise((resolve,reject)=>{
   const child=spawn(process.execPath,[output],{windowsHide:true,
     env:{...process.env,HCODE_HTTP_ALLOWED_ORIGINS:origin},stdio:['pipe','pipe','pipe']});
   let stdout='',stderr='',finished=false;
   child.stdout.setEncoding('utf8');child.stderr.setEncoding('utf8');
   child.stdout.on('data',x=>stdout+=x);child.stderr.on('data',x=>stderr+=x);
   const timer=setTimeout(()=>{child.kill();},timeoutMs);
   child.once('error',e=>{if(finished)return;finished=true;clearTimeout(timer);reject(e);});
   child.once('close',(code,signal)=>{
     if(finished)return;finished=true;clearTimeout(timer);
     resolve({code,signal,stdout:stdout.replace(/\r\n/g,'\n'),stderr});
   });
   child.stdin.on('error',()=>{});
   child.stdin.end(JSON.stringify(urls));
 });
}
test('real Rust-generated H-Code requests all three endpoints before any response is released',async()=>{
 const built=compile();
 const fixture=await liveServer();
 try{
  const actual=await executeFile(built.output,fixture.urls,fixture.origin);
  assert.equal(actual.code,0,actual.stderr);
  assert.equal(actual.signal,null);
  assert.equal(fixture.requested.length,3,'serial execution deadlocked at server barrier');
  assert.deepEqual(fixture.requested.slice().sort(),['/a','/b','/c']);
  assert.deepEqual(JSON.parse(actual.stdout).map(v=>v.body),['a','b','c']);
  assert.deepEqual(fixture.responded[0]!=='/a',true,
    'first requested URL must be allowed to complete after later URLs');
 }finally{
  await fixture.close();
  rmSync(built.temp,{recursive:true,force:true});
 }
});
test('Rust-generated batch denies missing HTTP origin and invalid fanout before I/O',async()=>{
 const built=compile(),fixture=await liveServer();
 try{
  const denied=await executeFile(built.output,fixture.urls,'');
  assert.notEqual(denied.code,0);
  assert.match(denied.stderr,/HTTP capability denied/);
  assert.equal(fixture.requested.length,0);
  const exceeded=await executeFile(built.output,Array(17).fill(fixture.urls[0]),fixture.origin);
  assert.notEqual(exceeded.code,0);
  assert.match(exceeded.stderr,/at most 16 String URLs/);
  assert.equal(fixture.requested.length,0);
  const empty=await executeFile(built.output,[],fixture.origin);
  assert.equal(empty.code,0,empty.stderr);
  assert.equal(empty.stdout,'[]\n');
  assert.equal(fixture.requested.length,0);
 }finally{
  await fixture.close();rmSync(built.temp,{recursive:true,force:true});
 }
});
