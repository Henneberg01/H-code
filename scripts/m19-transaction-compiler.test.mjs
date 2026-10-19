import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync,spawn} from 'node:child_process';
import {mkdtempSync,writeFileSync,readFileSync,rmSync,symlinkSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const step='ƒ step(s:String)→⦃state:String,value:String⦄ {≔n←⤓Number s;↩⦃state:⤒(n+1),value:⤒(n+1)⦄}';
function build(source){
 const dir=mkdtempSync(join(tmpdir(),'jfh-tx-native-')),input=join(dir,'program.hc'),output=join(dir,'program.mjs');
 writeFileSync(input,source);
 const result=spawnSync(join(root,'compiler/target/debug/hcodec'+(process.platform==='win32'?'.exe':'')),['build',input,'--out',output],{encoding:'utf8',timeout:30000});
 assert.equal(result.status,0,result.stderr);
 return {dir,output,env:{...process.env,HCODE_TX_STATE_ROOT:dir}};
}
function run(c,env=c.env){return spawnSync(process.execPath,[c.output],{env,encoding:'utf8',timeout:10000});}
test('real Rust-generated generic transaction commits and reopens without any session helper',()=>{
 const c=build(step+'\n⎙(⥁(step,"0"))');
 try{for(let n=1;n<=3;n++){const result=run(c);assert.equal(result.status,0,result.stderr);assert.equal(result.stdout,n+'\n');}}
 finally{rmSync(c.dir,{recursive:true,force:true});}
});
test('separate native processes serialize generic increments including first DB creation',async()=>{
 const c=build(step+'\n⎙(⥁(step,"0"))');
 try{
  const child=()=>new Promise((resolve,reject)=>{
   const p=spawn(process.execPath,[c.output],{env:c.env,timeout:10000});let out='',err='';
   p.stdout.on('data',s=>out+=s);p.stderr.on('data',s=>err+=s);p.on('error',reject);
   p.on('close',code=>{try{assert.equal(code,0,err);resolve(Number(out));}catch(e){reject(e);}});
  });
  const results=await Promise.all([child(),child(),child(),child()]);assert.deepEqual(results.sort((a,b)=>a-b),[1,2,3,4]);
 }finally{rmSync(c.dir,{recursive:true,force:true});}
});
test('native dynamic purity and nested transaction guards deny I/O and roll back',()=>{
 for(const source of [
  step+'\nƒ f(s:String)→String ↩⥁(step,s);≔g←f;⟦"0"⟧↥g',
  step+'\nƒ outer(s:String)→⦃state:String,value:String⦄ ↩⦃state:s,value:⥁(step,s)⦄;⥁(outer,"0")'
 ]){
  const c=build(source);
  try{const r=run(c);assert.notEqual(r.status,0);assert.match(r.stderr,/effect denied|nested transaction/);}
  finally{rmSync(c.dir,{recursive:true,force:true});}
 }
});
test('native permission denial, symlink rejection and transaction used only in loop condition',()=>{
 const c=build(step+'\n⟳(⥁(step,"0")≡"never"){}');
 try{
  const denied={...c.env};delete denied.HCODE_TX_STATE_ROOT;assert.match(run(c,denied).stderr,/capability denied/);
  if(process.platform!=='win32'){
   symlinkSync(join(c.dir,'missing'),join(c.dir,'state.sqlite'));assert.match(run(c).stderr,/Invalid transaction database/);rmSync(join(c.dir,'state.sqlite'));
  }
  const r=run(c);assert.equal(r.status,0,r.stderr);assert.equal(r.stdout,'');
  assert.equal(readFileSync(join(c.dir,'state.sqlite')).subarray(0,16).toString(),'SQLite format 3\0');
 }finally{rmSync(c.dir,{recursive:true,force:true});}
});
