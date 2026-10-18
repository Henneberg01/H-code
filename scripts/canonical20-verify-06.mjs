#!/usr/bin/env node
// M19.06 canonical06 full sign language vs frozen TS oracle over real loopback.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync,mkdtempSync,rmSync,statSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {tmpdir} from 'node:os';
import {spawn,spawnSync} from 'node:child_process';
import {executeAsync} from '../prototype/src/hcode.mjs';
import {startHttpFixture} from './canonical20-http-fixture.mjs';
import {fetchWithRetries} from './canonical20-http-oracle.ts';

const ROOT=new URL('../',import.meta.url);
const read=path=>readFileSync(new URL(path,ROOT));
const gitBlob=b=>createHash('sha1').update('blob '+b.length+'\0').update(b).digest('hex');
const sha256=b=>createHash('sha256').update(b).digest('hex');
const FIXTURE_SHA='4f12a085d9730ac637444a06fff6f75481985efb';
const REGISTRY_SHA='46653ef90ffb3e420fba4ddfbfac3c4cfd57f3b3';
const HCODE_SHA='9583fe5acf9d4a775ba7a4e86da46bd3b85b5cef';
const TYPESCRIPT_SHA='1e9f968d900ed9ab77c703afad1fec104135a83d';
const hcPath='compact/canonical20/programs/06-http-retries.hc';
const tsPath='scripts/canonical20-http-oracle.ts';
const fixture=JSON.parse(read('compact/canonical20/cases/06-http-retries.json'));
const program=read(hcPath).toString('utf8');

function verifyFrozen(){
  assert.equal(gitBlob(read('compact/canonical20/workloads.json')),REGISTRY_SHA,'registry drift');
  assert.equal(gitBlob(read('compact/canonical20/cases/06-http-retries.json')),FIXTURE_SHA,'cases drift');
  assert.equal(gitBlob(read(hcPath)),HCODE_SHA,'H-Code source drift');
  assert.equal(gitBlob(read(tsPath)),TYPESCRIPT_SHA,'idiomatic TypeScript baseline drift');
  assert.equal(fixture.cases.length,6);
  assert.equal(fixture.id,'06-http-retries');
  assert.deepEqual(fixture.retryableStatuses,[429,500,502,503,504]);
  assert.equal(fixture.maxAttempts,4);
  assert.equal(fixture.timeoutMs,2000);
  assert.equal(fixture.baseDelayMs,100);
  assert.equal(fixture.maxBackoffMs,1000);
  const registry=JSON.parse(read('compact/canonical20/workloads.json'));
  assert.equal(registry.workloads.length,20);
  assert.equal(registry.workloads[5].id,'06-http-retries');
  assert.equal(registry.workloads[5].acceptance,fixture.acceptance);
  assert.deepEqual(registry.workloads[5].requiredCapabilities,['http-client','async','effect-control']);
  assert.equal(registry.workloads[5].status,'unsupported','original preregistration must not be edited');
  assert.equal(fixture.stage,'fixture-contract-only-not-compiler-verified');
}
function points(src){return [...src].length;}
function reduction(smaller,larger){return Number((100*(1-smaller/larger)).toFixed(2));}
function canonicalize(output){
  const p=typeof output==='string'?JSON.parse(output.trim()):output;
  assert.deepEqual(Object.keys(p).sort(),['body','ok','reason','status','trace']);
  assert.ok(Array.isArray(p.trace)&&p.trace.length<=fixture.maxAttempts);
  const trace=p.trace.map(entry=>{
    assert.deepEqual(Object.keys(entry).sort(),['attempt','decision','status','waitMs']);
    return {...entry,status:entry.status===0?null:entry.status};
  });
  return {...p,status:p.status===0?null:p.status,reason:p.reason===''?null:p.reason,trace};
}
function typedResponse(r,body){
  const raw=r.headers.get('retry-after');
  const seconds=raw!==null&&/^\d+$/.test(raw)?Number(raw):0;
  return {status:r.status,ok:r.ok,body,retryAfter:Number.isSafeInteger(seconds)&&seconds<=120?seconds*1000:0};
}
async function request(url){
  const response=await fetch(url,{method:'GET',redirect:'error',signal:AbortSignal.timeout(2000)});
  return typedResponse(response,await response.text());
}
function compile(out){
  const command=spawnSync('cargo',['run','--quiet','--manifest-path','compiler/Cargo.toml',
    '--','build',hcPath,'--out',out],{
     cwd:new URL('.',ROOT),encoding:'utf8',windowsHide:true,timeout:180000
    });
  if(command.error||command.status!==0)throw Error('H-Code Rust compiler failed: '+
    (command.error?.message||command.stderr?.slice(0,2400)));
}
async function runCompiled(file,url){
  const origin=new URL(url).origin;
  return await new Promise((resolve,reject)=>{
    const child=spawn(process.execPath,[file],{
      cwd:new URL('.',ROOT),windowsHide:true,
      env:{...process.env,HCODE_HTTP_ALLOWED_ORIGINS:origin,HCODE_TEST_VIRTUAL_SLEEP:'1'},
      stdio:['pipe','pipe','pipe']
    });
    let stdout='',stderr='',settled=false;
    const fail=err=>{if(settled)return;settled=true;clearTimeout(timer);child.kill();reject(err);};
    const timer=setTimeout(()=>fail(Error('Compiled H-Code runtime timed out')),15000);
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data',value=>{stdout+=value;if(stdout.length>65536)fail(Error('Excessive stdout'));});
    child.stderr.on('data',value=>{stderr+=value;if(stderr.length>65536)fail(Error('Excessive stderr'));});
    child.on('error',fail);
    child.on('close',code=>{
      if(settled)return;
      settled=true;clearTimeout(timer);
      if(code!==0)reject(Error('Compiled H-Code exited '+code+': '+stderr.slice(0,2000)));
      else resolve(stdout.replace(/\r\n/g,'\n'));
    });
    child.stdin.on('error',()=>{});
    child.stdin.end(url);
  });
}
async function runReference(url,sleeps){
  const out=[];
  const r=await executeAsync(program,{
    readStdin:()=>url,httpGet:request,maxHttpRequests:4,maxSleepCalls:4,
    sleep:async ms=>{sleeps.push(ms);},stdout:line=>out.push(line)
  });
  assert.ok(r.httpRequests<=4);
  assert.equal(r.sleepCalls,sleeps.length);
  assert.equal(out.length,1,'H-Code program must emit only the final result');
  return out[0];
}
async function verifyEngine(engine,jsPath){
  const server=await startHttpFixture(fixture.cases);
  try{
    for(const c of fixture.cases){
      const url=server.urlFor(c.id);
      let actual,slept=[];
      if(engine==='rust-compiled'){
        actual=canonicalize(await runCompiled(jsPath,url));
      }else if(engine==='js-independent'){
        actual=canonicalize(await runReference(url,slept));
      }else{
        actual=await fetchWithRetries(url,{maxAttempts:fixture.maxAttempts,
          baseDelayMs:fixture.baseDelayMs,maxBackoffMs:fixture.maxBackoffMs,
          timeoutMs:fixture.timeoutMs,sleep:async ms=>{slept.push(ms);}
        });
      }
      assert.deepEqual(actual,c.expected,engine+' '+c.id);
      assert.equal(server.hitsFor(c.id),c.expected.trace.length,engine+' '+c.id+' HTTP request count');
      assert.ok(server.hitsFor(c.id)<=fixture.maxAttempts);
      if(engine!=='rust-compiled')assert.deepEqual(slept,
        c.expected.trace.filter(x=>x.waitMs>0).map(x=>x.waitMs),engine+' '+c.id+' scheduler');
    }
    assert.equal(server.received.length,fixture.cases.reduce((n,x)=>n+x.expected.trace.length,0));
  }finally{await server.close();}
}
// Unseen deterministic variants prevent hardcoding the six preregistered responses.
async function verifyUnseen(jsPath){
  const cases=[
    {id:'g201',responses:[{status:201,body:'created'}]},
    {id:'g204',responses:[{status:204,body:''}]},
    {id:'g299',responses:[{status:299,body:'München 東京'}]},
    {id:'g504',responses:[{status:504,body:'timeout'},{status:200,body:'yes'}]},
    {id:'g500x2',responses:[{status:500,body:'a'},{status:500,body:'b'},{status:200,body:'c'}]},
    {id:'g503429',responses:[{status:503,body:'d'},{status:429,body:'e',retryAfterSeconds:0},{status:200,body:'f'}]},
    {id:'g429after',responses:[{status:429,body:'slow',retryAfterSeconds:10},{status:200,body:'fine'}]},
    {id:'g418',responses:[{status:418,body:'teapot'}]},
    {id:'g403',responses:[{status:403,body:'forbidden'}]},
    {id:'g408',responses:[{status:408,body:'not retryable'}]},
    {id:'g599',responses:[{status:599,body:'other failure'}]},
    {id:'g4mix',responses:[{status:502,body:'a'},{status:503,body:'b'},{status:500,body:'c'},{status:200,body:'finally'}]}
  ];
  const oracle=await startHttpFixture(cases);
  const expected=new Map();
  try{
    for(const c of cases){
      expected.set(c.id,await fetchWithRetries(oracle.urlFor(c.id),{
        maxAttempts:fixture.maxAttempts,baseDelayMs:fixture.baseDelayMs,
        maxBackoffMs:fixture.maxBackoffMs,timeoutMs:fixture.timeoutMs,
        sleep:async()=>{}
      }));
      assert.equal(oracle.hitsFor(c.id),expected.get(c.id).trace.length,c.id+' oracle');
    }
  }finally{await oracle.close();}
  for(const engine of ['rust-compiled','js-independent']){
    const server=await startHttpFixture(cases);
    try{
      for(const c of cases){
        const url=server.urlFor(c.id),slept=[];
        const got=canonicalize(engine==='rust-compiled'?
          await runCompiled(jsPath,url):await runReference(url,slept));
        assert.deepEqual(got,expected.get(c.id),engine+' unseen '+c.id);
        assert.equal(server.hitsFor(c.id),expected.get(c.id).trace.length,engine+' unseen request count '+c.id);
        if(engine==='js-independent')assert.deepEqual(slept,
          expected.get(c.id).trace.filter(x=>x.waitMs>0).map(x=>x.waitMs),engine+' unseen scheduler '+c.id);
      }
    }finally{await server.close();}
  }
  return cases.length;
}

async function verifyNetworkError(){
  const url='http://127.0.0.1:1/unreachable';
  const sleeps=[],lines=[];
  const stats=await executeAsync(program,{
    readStdin:()=>url,maxHttpRequests:4,maxSleepCalls:4,
    httpGet:async()=>{throw Error('secret should not leak');},
    sleep:async ms=>{sleeps.push(ms);},stdout:line=>lines.push(line)
  });
  assert.equal(stats.httpRequests,4);
  assert.equal(stats.sleepCalls,3);
  assert.deepEqual(sleeps,[100,200,400]);
  assert.deepEqual(canonicalize(lines[0]),{
    ok:false,status:null,body:'',reason:'network',trace:[
      {attempt:1,status:null,decision:'network-retry',waitMs:100},
      {attempt:2,status:null,decision:'network-retry',waitMs:200},
      {attempt:3,status:null,decision:'network-retry',waitMs:400},
      {attempt:4,status:null,decision:'network-exhausted',waitMs:0}
    ]
  });
}
export async function verifyCanonical06(){
  verifyFrozen();
  const tmp=mkdtempSync(join(tmpdir(),'hcode-canonical06-'));
  const out=join(tmp,'workload06.mjs');
  try{
    compile(out);
    for(const engine of ['rust-compiled','js-independent','ts-independent'])
      await verifyEngine(engine,out);
    const variants=await verifyUnseen(out);
    await verifyNetworkError();
    const h=read(hcPath),ts=read(tsPath),output=readFileSync(out);
    return {
      id:'06-http-retries',kind:'full-compiler-evidence',verified:true,positiveCases:fixture.cases.length,
      generatedVariantsVerified:variants,negativeCases:1,
      hcodeCodePoints:points(program),typescriptCodePoints:points(ts.toString('utf8')),
      hcodeUtf8Bytes:h.length,typescriptUtf8Bytes:ts.length,
      codepointReductionPct:reduction(points(program),points(ts.toString('utf8'))),
      utf8ReductionPct:reduction(h.length,ts.length),
      compilerJsBytes:statSync(out).size,compilerJsSha256:sha256(output),
      externalRuntimeDependencies:0,timeoutMs:fixture.timeoutMs
    };
  }finally{rmSync(tmp,{recursive:true,force:true});}
}
if(process.argv[1]&&resolve(fileURLToPath(import.meta.url))===resolve(process.argv[1])){
  verifyCanonical06().then(v=>console.log(JSON.stringify(v,null,2))).catch(e=>{
    console.error('Canonical06 full parity FAILED:',e.stack||e);
    process.exitCode=1;
  });
}
