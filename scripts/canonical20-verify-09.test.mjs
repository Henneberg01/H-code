import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,mkdtempSync,rmSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {execute} from '../prototype/src/hcode.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
const locks=Object.freeze({
 registry:['compact/canonical20/workloads.json','46653ef90ffb3e420fba4ddfbfac3c4cfd57f3b3'],
 hc:['compact/canonical20/programs/09-expiring-cache.hc','b3909631e73e27146e847d28e75931447cb177e8'],
 ts:['compact/canonical20/programs/09-expiring-cache.ts','f52e8006de9a1be27c44a48c1e17646df6fac4a1'],
 fixtures:['compact/canonical20/cases/09-expiring-cache.json','1f03ef7b2b58cc760991f7e6585c7f92ef795954']
});
const blob=b=>createHash('sha1').update('blob '+b.length+'\0').update(b).digest('hex');
function locked(k){
 const [path,hash]=locks[k],b=readFileSync(join(root,path));
 assert.equal(blob(b),hash,'Frozen canonical09 source has moved: '+path);
 return {path,source:b.toString('utf8'),codepoints:[...b.toString('utf8')].length,bytes:b.length};
}
function contract(){
 const items=Object.fromEntries(Object.keys(locks).map(k=>[k,locked(k)]));
 const r=JSON.parse(items.registry.source),f=JSON.parse(items.fixtures.source),w=r.workloads[8];
 assert.equal(r.workloads.length,20);assert.equal(w.id,'09-expiring-cache');
 assert.equal(w.acceptance,f.acceptance);
 assert.equal(w.acceptance,'fake clock, set/get/expire, prevent stale reads and bounded memory');
 assert.deepEqual(w.requiredCapabilities,['map','time','state']);
 assert.equal(w.status,'unsupported');assert.equal(w.evidence,null);
 assert.equal(f.originalRegistryGitBlobSha,locks.registry[1]);
 assert.equal(f.cases.length,6);
 assert.equal(f.maxEntries,8);
 assert.match(items.hc.source,/⌕λ/);
 assert.match(items.hc.source,/⧺/);
 return {items,f};
}
function build(hc){
 const dir=mkdtempSync(join(tmpdir(),'hcode-canonical09-'));
 const output=join(dir,'cache.mjs');
 const p=spawnSync('cargo',['run','--quiet','--manifest-path','compiler/Cargo.toml',
   '--','build',join(root,hc.path),'--out',output],
   {cwd:root,encoding:'utf8',windowsHide:true,timeout:180000});
 if(p.error||p.status!==0){
  rmSync(dir,{recursive:true,force:true});
  throw Error('Failed to compile genuine symbolic H-Code: '+(p.error?.message||p.stderr));
 }
 const b=readFileSync(output);
 assert.match(b.toString('utf8'),/__hc_filter/);
 assert.match(b.toString('utf8'),/__hc_concat/);
 return {dir,output,bytes:b.length,sha256:createHash('sha256').update(b).digest('hex')};
}
const run=(argv,input)=>spawnSync(process.execPath,argv,
 {cwd:root,encoding:'utf8',input,windowsHide:true,timeout:15000});
function generatedCases(){
 let seed=0x09A1B2C3;
 const random=()=>{seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;return seed>>>0;};
 return Array.from({length:15},(_,caseIndex)=>{
  let t=0;
  const events=Array.from({length:24+caseIndex%7},(_,i)=>{
   t+=(random()%5);
   const kind=['set','get','expire','get','set'][random()%5];
   return {at:t,key:['a','b','c','東京','🇩🇰','zero',''][random()%7],
     op:kind,ttl:(random()%19)-3,value:'V'+caseIndex+'-'+i};
  });
  return {id:'generated-'+caseIndex,events};
 });
}
test('canonical09 runs six SHA-locked fake-clock cases and 15 seeded generated streams in Rust/JS/TypeScript',()=>{
 const {items,f}=contract(),b=build(items.hc);
 try{
  console.log('CANONICAL09_GENERATED_JS_BYTES='+b.bytes);
  console.log('CANONICAL09_GENERATED_JS_SHA256='+b.sha256);
  for(const scenario of [...f.cases,...generatedCases()]){
   const input=JSON.stringify(scenario.events);
   const rust=run([b.output],input),ts=run(['--experimental-strip-types',join(root,items.ts.path)],input);
   assert.ifError(rust.error);assert.ifError(ts.error);
   assert.equal(rust.status,0,scenario.id+' Rust: '+rust.stderr);
   assert.equal(ts.status,0,scenario.id+' TS: '+ts.stderr);
   const refOut=[];
   execute(items.hc.source,{readStdin:()=>input,stdout:line=>refOut.push(line)});
   const ref=refOut.join('\n')+'\n';
   assert.equal(rust.stdout,ref,scenario.id+' Rust vs independent H-Code JS');
   assert.equal(ts.stdout,ref,scenario.id+' TS vs independent H-Code JS');
   const result=JSON.parse(rust.stdout);
   if(scenario.expected)assert.deepEqual(result,scenario.expected,scenario.id+' original fixture result');
   assert.equal(result.length,scenario.events.length);
   assert.ok(result.every(x=>x.size<=8&&x.size>=0),'bounded key-value store exceeded 8 entries');
  }
  assert.ok(items.hc.codepoints<items.ts.codepoints);
 }finally{rmSync(b.dir,{recursive:true,force:true});}
});
test('typed JSON rejects malformed event shapes and source types in both languages',()=>{
 const {items}=contract(),b=build(items.hc);
 try{
  for(const input of ['not-json','{}','[{}]','[{"at":"bad","key":"a","op":"get","ttl":0,"value":""}]']){
   const rust=run([b.output],input);
   assert.notEqual(rust.status,0,'Rust unexpectedly accepted '+input);
   assert.throws(()=>execute(items.hc.source,{readStdin:()=>input}),/JSON|json|record|schema|type|input/i);
  }
 }finally{rmSync(b.dir,{recursive:true,force:true});}
});
