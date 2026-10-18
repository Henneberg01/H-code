// M19.06: real Rust->JS / independent H-Code JS reference / TypeScript parity.
// The fixed 20-task registry and task06 fixture SHA are never altered.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,mkdtempSync,rmSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {spawn,spawnSync} from 'node:child_process';
import {executeAsync} from '../prototype/src/hcode.mjs';
import {startHttpFixture} from './canonical20-http-fixture.mjs';
import {fetchWithRetries} from './canonical20-http-oracle.ts';

const root=fileURLToPath(new URL('../',import.meta.url));
const frozen=Object.freeze({
 registry:['compact/canonical20/workloads.json','46653ef90ffb3e420fba4ddfbfac3c4cfd57f3b3'],
 fixture:['compact/canonical20/cases/06-http-retries.json','4f12a085d9730ac637444a06fff6f75481985efb'],
 hc:['compact/canonical20/programs/06-http-retries.hc','8abedc2d8fa32fa6ec157bb98d3a64a02408dfda'],
 ts:['scripts/canonical20-http-oracle.ts','1e9f968d900ed9ab77c703afad1fec104135a83d']
});
const gitBlob=bytes=>createHash('sha1').update('blob '+bytes.length+'\0').update(bytes).digest('hex');
function locked(kind){
 const [path,sha]=frozen[kind],bytes=readFileSync(join(root,path));
 assert.equal(gitBlob(bytes),sha,'Frozen canonical06 source changed: '+path);
 return {path,source:bytes.toString('utf8'),codepoints:[...bytes.toString('utf8')].length,bytes:bytes.length};
}
function sources(){
 const data=Object.fromEntries(Object.keys(frozen).map(k=>[k,locked(k)]));
 const registry=JSON.parse(data.registry.source);
 const w=registry.workloads?.[5],fixture=JSON.parse(data.fixture.source);
 assert.equal(registry.workloads.length,20);
 assert.equal(w.id,'06-http-retries');
 assert.equal(w.acceptance,'fake 500/429/200 responses, bounded retries and deterministic trace');
 assert.deepEqual(w.requiredCapabilities,['http-client','async','effect-control']);
 assert.equal(w.status,'unsupported');
 assert.equal(w.evidence,null);
 assert.equal(fixture.id,w.id);
 assert.equal(fixture.acceptance,w.acceptance);
 assert.equal(fixture.canonicalRegistryGitBlobSha,frozen.registry[1]);
 assert.equal(fixture.cases.length,6);
 assert.equal(fixture.maxAttempts,4);
 assert.equal(fixture.baseDelayMs,100);
 assert.equal(fixture.maxBackoffMs,1000);
 assert.equal(fixture.timeoutMs,2000);
 assert.match(data.hc.source,/⟳\(n<4∧¬done\)/);
 assert.match(data.hc.source,/⌛wait/);
 assert.match(data.hc.source,/≔r←⤋u/);
 return {data,fixture};
}
function build(path,into){
 const result=spawnSync('cargo',['run','--quiet','--manifest-path','compiler/Cargo.toml',
   '--','build',path,'--out',into],{cwd:root,windowsHide:true,encoding:'utf8',timeout:180000});
 assert.ifError(result.error);
 assert.equal(result.status,0,'Rust compiler failed: '+result.stderr);
 const output=readFileSync(into);
 assert.match(output.toString('utf8'),/await __hc_http_get/);
 assert.match(output.toString('utf8'),/await __hc_sleep/);
 return {bytes:output.length,sha256:createHash('sha256').update(output).digest('hex')};
}
const getFromHost=async url=>{
 try{
   const response=await fetch(url,{method:'GET',redirect:'error',signal:AbortSignal.timeout(2000)});
   const raw=response.headers.get('retry-after');
   const num=raw!==null&&/^\d+$/.test(raw)?Number(raw):0;
   const retryAfter=Number.isSafeInteger(num)&&num<=120?num*1000:0;
   return {body:await response.text(),ok:response.ok,retryAfter,status:response.status};
 }catch{return {body:'',ok:false,retryAfter:0,status:0};}
};
const fixedNumber=(str,label)=>{
 assert.match(str,/^(0|[1-9]\d*)$/,label);
 return Number(str);
};
function parseOutput(output){
 const lines=output.replace(/\r\n/g,'\n').split('\n');
 assert.equal(lines.pop(),'','program must terminate output with newline');
 assert.ok(lines.length>=4,'missing H-Code HTTP result lines');
 const reason=lines.pop(),body=lines.pop(),summary=lines.pop().split(' ');
 assert.equal(summary.length,2,'result must print ok and status');
 assert.ok(summary[0]==='true'||summary[0]==='false');
 const status=fixedNumber(summary[1],'final HTTP status');
 const trace=lines.map(line=>{
   const items=line.split(' ');
   assert.equal(items.length,4,'each attempt must contain attempt/status/decision/wait');
   assert.ok(['success','retry','http-error','exhausted','network-retry','network-exhausted'].includes(items[2]));
   const code=fixedNumber(items[1],'trace HTTP status');
   return {attempt:fixedNumber(items[0],'attempt'),status:code===0?null:code,
     decision:items[2],waitMs:fixedNumber(items[3],'bounded wait')};
 });
 return {ok:summary[0]==='true',status:status===0?null:status,body,
   reason:reason===''?null:reason,trace};
}
async function runCompiled(path,url,{origin=new URL(url).origin,permit=true}={}){
 return await new Promise((resolve,reject)=>{
   let stdout='',stderr='';
   const child=spawn(process.execPath,[path],{cwd:root,windowsHide:true,
     env:{...process.env,HCODE_HTTP_ALLOWED_ORIGINS:permit?origin:''},stdio:['pipe','pipe','pipe']});
   child.stdout.setEncoding('utf8');child.stderr.setEncoding('utf8');
   child.stdout.on('data',chunk=>{stdout+=chunk;});
   child.stderr.on('data',chunk=>{stderr+=chunk;});
   const kill=setTimeout(()=>child.kill(),15000);
   child.once('error',error=>{clearTimeout(kill);reject(error);});
   child.once('close',(code,signal)=>{clearTimeout(kill);resolve({code,signal,stdout,stderr});});
   child.stdin.on('error',()=>{});
   child.stdin.end(url);
 });
}
async function runReference(source,url){
 const lines=[],sleeps=[];
 const stats=await executeAsync(source,{
   readStdin:()=>url,httpGet:getFromHost,
   sleepMs:async ms=>{sleeps.push(ms);},maxHttpRequests:4,maxSleepEffects:3,
   maxTotalSleepMs:1700,stdout:line=>lines.push(String(line))
 });
 return {value:parseOutput(lines.join('\n')+'\n'),sleeps,stats};
}
async function runTypescript(url){
 const sleeps=[];
 const value=await fetchWithRetries(url,{maxAttempts:4,baseDelayMs:100,
   maxBackoffMs:1000,timeoutMs:2000,sleep:async ms=>{sleeps.push(ms);}});
 return {value,sleeps};
}
async function compareEngines(c,source,generated,expected){
 const engines=['typescript','reference','rust'];
 for(const engine of engines){
   const server=await startHttpFixture([c],{maxRequests:8});
   try{
     const url=server.urlFor(c.id);
     let value,sleeps=null;
     if(engine==='typescript')({value,sleeps}=await runTypescript(url));
     else if(engine==='reference'){
       const ref=await runReference(source,url);
       value=ref.value;sleeps=ref.sleeps;
       assert.equal(ref.stats.httpRequests,value.trace.length,'JS replay double-issued HTTP');
     }else{
       const raw=await runCompiled(generated,url);
       assert.equal(raw.code,0,'Rust-generated Node failed: '+raw.stderr);
       value=parseOutput(raw.stdout);
     }
     assert.deepEqual(value,expected??(await independentExpected(c,engine)),
       c.id+' / '+engine+' expected result differs');
     assert.equal(server.hitsFor(c.id),value.trace.length,c.id+' / '+engine+' attempt count');
     assert.ok(value.trace.length<=4,c.id+' / '+engine+' bounded attempts');
     if(sleeps)assert.deepEqual(sleeps,value.trace.filter(x=>x.waitMs>0).map(x=>x.waitMs),
       c.id+' / '+engine+' sleep trace');
   }finally{await server.close();}
 }
}
async function independentExpected(c,engine){
 // For generated variants, use the independently maintained TypeScript oracle
 // with its own fresh real HTTP server, never the H-Code interpreter.
 const server=await startHttpFixture([c]);
 try{return (await runTypescript(server.urlFor(c.id))).value;}
 finally{await server.close();}
}
const variations=[
 [200],[503,200],[500,502,200],[429,503,200],[404],[502,502,502,200],
 [500,400],[503,503,503,503],[429,429,200],[204]
].map((statuses,i)=>({id:'generated-'+(i+1),responses:statuses.map((status,j)=>({
 status,body:status===204?'':('v'+i+'-'+j),
 ...(status===429&&j===0?{retryAfterSeconds:1}:{})
}))}));

test('canonical06 fixed and independent generated sequences run as real H-Code across all three engines',async()=>{
 const {data,fixture}=sources();
 const tmp=mkdtempSync(join(tmpdir(),'hcode-http06-'));
 try{
   const generated=join(tmp,'out.mjs'),emitted=build(join(root,data.hc.path),generated);
   assert.ok(emitted.bytes>0);
   assert.equal(data.ts.codepoints,3112,'oracle source baseline must remain unchanged');
   for(const c of fixture.cases)await compareEngines(c,data.hc.source,generated,c.expected);
   for(const c of variations)await compareEngines(c,data.hc.source,generated);
   assert.ok(data.hc.codepoints<data.ts.codepoints);
   // These are source counts against a correctness oracle, NOT certification
   // of the global 70% median or an independent competitive idiomatic TS baseline.
   assert.equal(data.hc.codepoints,776);
   assert.equal(data.hc.bytes,961);
 }finally{rmSync(tmp,{recursive:true,force:true});}
});

test('ambient HTTP is denied even for otherwise well-typed H-Code',async()=>{
 const {data}=sources();
 const tmp=mkdtempSync(join(tmpdir(),'hcode-http06-denial-'));
 try{
   const path=join(tmp,'out.mjs');build(join(root,data.hc.path),path);
   const server=await startHttpFixture([{id:'deny',responses:[{status:200,body:'secret'}]}]);
   try{
     const out=await runCompiled(path,server.urlFor('deny'),{permit:false});
     assert.notEqual(out.code,0);
     assert.match(out.stderr,/HTTP capability denied/);
     assert.equal(server.hitsFor('deny'),0,'denied network still reached server');
   }finally{await server.close();}
 }finally{rmSync(tmp,{recursive:true,force:true});}
});
