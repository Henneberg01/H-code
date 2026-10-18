// Canonical workload08: three-engine live parallel HTTP proof; no fake
// concurrency, no task-specific language macro, no silent registry edits.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFileSync,mkdtempSync,rmSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';
import {spawn,spawnSync} from 'node:child_process';
import {executeAsync} from '../prototype/src/hcode.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
const frozen={
 registry:['compact/canonical20/workloads.json','46653ef90ffb3e420fba4ddfbfac3c4cfd57f3b3'],
 fixture:['compact/canonical20/cases/08-concurrent-requests.json','bc3b3e4f6443d7c72cf76cc76a543b262b0505f9'],
 hc:['compact/canonical20/programs/08-concurrent-requests.hc','1b948801e6f411a93f8de0581ccc34b7dbb4dc07'],
 ts:['compact/canonical20/programs/08-concurrent-requests.ts','9c7952f29ce910193c7eea7b4d6eb0c5705540e0']
};
const sha=bytes=>createHash('sha1').update('blob '+bytes.length+'\0').update(bytes).digest('hex');
function source(key){
 const [path,expected]=frozen[key],b=readFileSync(join(root,path));
 assert.equal(sha(b),expected,'Canonical08 SHA lock changed: '+path);
 return {path,text:b.toString('utf8'),bytes:b.length,points:[...b.toString('utf8')].length};
}
function contract(){
 const files=Object.fromEntries(Object.keys(frozen).map(x=>[x,source(x)]));
 const reg=JSON.parse(files.registry.text),c=JSON.parse(files.fixture.text);
 assert.equal(reg.workloads.length,20);
 const w=reg.workloads[7];
 assert.equal(w.id,'08-concurrent-requests');
 assert.equal(w.acceptance,c.acceptance);
 assert.equal(w.acceptance,'fan out to three deterministic fake HTTP endpoints and combine results without serial blocking');
 assert.deepEqual(w.requiredCapabilities,['async','http-client','concurrency']);
 assert.equal(w.status,'unsupported');
 assert.equal(w.evidence,null);
 assert.equal(c.canonicalRegistryGitBlobSha,frozen.registry[1]);
 assert.equal(c.id,w.id);
 assert.equal(c.maxFanout,16);
 assert.equal(c.cases.length,6);
 assert.deepEqual(c.cases.map(x=>x.responses.length),[3,3,3,5,1,0]);
 assert.match(files.hc.text,/≔results←⤋urls/);
 assert.match(files.hc.text,/print\(⤒results\)/);
 assert.match(files.ts.text,/Promise\.all/);
 for(const item of c.cases){
   assert.match(item.id,/^[a-z0-9-]+$/);
   assert.deepEqual(item.expected,item.responses.map(x=>({
     body:x.body,ok:x.status>=200&&x.status<300,retryAfter:(x.retryAfterSeconds||0)*1000,status:x.status
   })));
 }
 return {files,fixture:c};
}
function expectedFromResponses(rs){
 return rs.map(x=>({body:x.body,ok:x.status>=200&&x.status<300,
   retryAfter:(x.retryAfterSeconds||0)*1000,status:x.status}));
}
async function startBarrierCase(item){
 const rs=item.responses;
 const pending=new Map(),hits=[],replied=[];
 let sentBeforeAll=false,closed=false,barrierTimer=null;
 const server=createServer((req,res)=>{
   if(req.method!=='GET'){res.writeHead(405);res.end('method');return;}
   const match=/^\/item\/(\d+)$/.exec(req.url??'');
   const id=match?Number(match[1]):-1;
   if(id<0||id>=rs.length){res.writeHead(404);res.end('unknown');return;}
   if(pending.has(id)||hits.includes(id)){res.writeHead(409);res.end('duplicate');return;}
   hits.push(id);pending.set(id,res);
   if(hits.length===rs.length){
     clearTimeout(barrierTimer);
     for(const [index,response] of pending){
       const cfg=rs[index];
       setTimeout(()=>{
         if(closed)return;
         if(hits.length!==rs.length)sentBeforeAll=true;
         const headers={'content-type':'text/plain; charset=utf-8'};
         if(cfg.retryAfterSeconds!==undefined)headers['retry-after']=String(cfg.retryAfterSeconds);
         response.writeHead(cfg.status,headers);
         response.end(cfg.body);
         replied.push(index);
       },cfg.delayMs??0);
     }
     pending.clear();
   }
 });
 await new Promise((ok,fail)=>{
   server.once('error',fail);server.listen(0,'127.0.0.1',ok);
 });
 const origin='http://127.0.0.1:'+server.address().port;
 if(rs.length>0)barrierTimer=setTimeout(()=>{
   for(const res of pending.values()){res.writeHead(504);res.end('not parallel');}
   pending.clear();
 },4000);
 return {
   origin,urls:rs.map((_,i)=>origin+'/item/'+i),
   get hits(){return [...hits];},get replied(){return [...replied];},
   get sentBeforeAll(){return sentBeforeAll;},
   async close(){
     closed=true;clearTimeout(barrierTimer);
     server.closeAllConnections();
     await new Promise(resolve=>server.close(()=>resolve()));
   }
 };
}
async function executeNode(args,input,{origin='',timeout=12000}={}){
 return await new Promise((resolve,reject)=>{
  const child=spawn(process.execPath,args,{cwd:root,windowsHide:true,
    env:{...process.env,HCODE_HTTP_ALLOWED_ORIGINS:origin},stdio:['pipe','pipe','pipe']});
  let stdout='',stderr='',timedOut=false,done=false;
  child.stdout.setEncoding('utf8');child.stderr.setEncoding('utf8');
  child.stdout.on('data',v=>stdout+=v);child.stderr.on('data',v=>stderr+=v);
  const timer=setTimeout(()=>{timedOut=true;child.kill();},timeout);
  child.once('error',e=>{if(done)return;done=true;clearTimeout(timer);reject(e);});
  child.once('close',(code,signal)=>{
    if(done)return;done=true;clearTimeout(timer);
    resolve({code,signal,stdout:stdout.replace(/\r\n/g,'\n'),stderr,timedOut});
  });
  child.stdin.on('error',()=>{});
  child.stdin.end(input);
 });
}
function compileProgram(path){
 const tmp=mkdtempSync(join(tmpdir(),'hcode-canonical08-'));
 const dest=join(tmp,'compiled.mjs');
 const p=spawnSync('cargo',['run','--quiet','--manifest-path','compiler/Cargo.toml',
    '--','build',join(root,path),'--out',dest],{cwd:root,encoding:'utf8',
     windowsHide:true,timeout:180000});
 if(p.error||p.status!==0){
   rmSync(tmp,{recursive:true,force:true});
   throw Error('Rust H-Code compiler failed: '+(p.error?.message||p.stderr));
 }
 const b=readFileSync(dest);
 assert.match(b.toString('utf8'),/await __hc_http_batch/);
 assert.match(b.toString('utf8'),/Promise\.all\(urls\.map\(__hc_http_get\)\)/);
 return {tmp,dest,compiledBytes:b.length,compiledSha256:createHash('sha256').update(b).digest('hex')};
}
const httpHost=allowed=>async raw=>{
 const url=new URL(raw);
 if(url.origin!==allowed)throw Error('Denied by injected H-Code host');
 const res=await fetch(raw,{redirect:'error',method:'GET',signal:AbortSignal.timeout(2000)});
 const after=res.headers.get('retry-after'),secs=after!==null&&/^\d+$/.test(after)?Number(after):0;
 return {body:await res.text(),ok:res.ok,
   retryAfter:Number.isSafeInteger(secs)&&secs<=120?secs*1000:0,status:res.status};
};
async function compare(item,files,compiled){
 for(const engine of ['typescript','reference','rust-generated']){
   const fx=await startBarrierCase(item);
   try{
     const stdin=JSON.stringify(fx.urls),wanted=JSON.stringify(item.expected)+'\n';
     let output;
     if(engine==='reference'){
       const lines=[];
       const stats=await executeAsync(files.hc.text,{httpGet:httpHost(fx.origin),
         readStdin:()=>stdin,maxHttpRequests:16,stdout:x=>lines.push(String(x))});
       assert.equal(stats.httpRequests,item.responses.length,engine+' actual network calls');
       output=lines.join('\n')+'\n';
     }else{
       const args=engine==='typescript'?
         ['--experimental-strip-types',join(root,files.ts.path)]:[compiled.dest];
       const run=await executeNode(args,stdin,{origin:fx.origin});
       assert.equal(run.timedOut,false,engine+' serialized calls or hung');
       assert.equal(run.code,0,engine+' exited '+run.code+': '+run.stderr);
       output=run.stdout;
     }
     assert.equal(output,wanted,item.id+' '+engine+' result and input ordering');
     assert.equal(fx.hits.length,item.responses.length,item.id+' '+engine+' request count');
     assert.equal(fx.replied.length,item.responses.length,item.id+' '+engine+' release count');
     assert.equal(fx.sentBeforeAll,false,item.id+' '+engine+' released a response before full fan-out');
   }finally{await fx.close();}
 }
}
const generated=Array.from({length:8},(_,i)=>{
 const n=3+i%3,values=Array.from({length:n},(_,j)=>({
   status:[200,502,429,204,503][(i+j)%5],
   body:[200,502,429,204,503][(i+j)%5]===204?'':('generated-'+i+'-'+j),
   delayMs:(i*11+j*7)%35,
   ...((i+j)%5===2?{retryAfterSeconds:1}:{})
 }));
 return {id:'generated-'+i,responses:values,expected:expectedFromResponses(values)};
});

test('canonical08 frozen preregistration and compiler-backed live Rust/JS/TS parity',async()=>{
 const {files,fixture}=contract(),built=compileProgram(files.hc.path);
 try{
   console.log('CANONICAL08_GENERATED_JS_BYTES='+built.compiledBytes);
   console.log('CANONICAL08_GENERATED_JS_SHA256='+built.compiledSha256);
   for(const c of [...fixture.cases,...generated])await compare(c,files,built);
   assert.ok(files.hc.points<files.ts.points);
 }finally{rmSync(built.tmp,{recursive:true,force:true});}
});
test('canonical08 generated compiled effect preflights permissions and fanout before I/O',async()=>{
 const {files}=contract(),built=compileProgram(files.hc.path);
 const fx=await startBarrierCase({responses:[{status:200,body:'x'}]});
 try{
  const noGrant=await executeNode([built.dest],JSON.stringify(fx.urls),{origin:''});
  assert.notEqual(noGrant.code,0);
  assert.match(noGrant.stderr,/HTTP capability denied/);
  assert.equal(fx.hits.length,0);
  const tooMany=await executeNode([built.dest],JSON.stringify(Array(17).fill(fx.urls[0])),{origin:fx.origin});
  assert.notEqual(tooMany.code,0);
  assert.match(tooMany.stderr,/at most 16 String URLs/);
  assert.equal(fx.hits.length,0);
  const noScheme=await executeNode([built.dest],JSON.stringify([fx.urls[0],'file:///etc/passwd']),{origin:fx.origin});
  assert.notEqual(noScheme.code,0);
  assert.match(noScheme.stderr,/HTTP\(S\) URL required/);
  assert.equal(fx.hits.length,0);
 }finally{await fx.close();rmSync(built.tmp,{recursive:true,force:true});}
});
