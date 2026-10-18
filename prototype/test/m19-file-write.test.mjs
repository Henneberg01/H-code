import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,existsSync,rmSync,readdirSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {parse,execute,executeAsync,CORE_GLYPHS} from '../src/hcode.mjs';
import {createFileWriteCapability} from '../../runtime/file-write.mjs';

test('⧅/file_write are intrinsic parser aliases with exactly two operands',()=>{
 assert.equal(CORE_GLYPHS['⧅'],'file-write');
 assert.deepEqual(parse('⧅("x.txt","hello");'),parse('file_write("x.txt","hello");'));
 assert.throws(()=>parse('⧅("x.txt");'),/Expected/);
 assert.throws(()=>parse('⧅("x.txt","hello",2);'),/Expected/);
 assert.throws(()=>execute('⧅("x.txt","hello");'),/asynchronous H-Code interpreter/);
});

test('independent JS effect journal writes exactly once despite HTTP and sleep replay',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'hcode-m19-write-replay-'));
 try{
   const cap=createFileWriteCapability({root:dir});
   const calls=[],outs=[];
   const source='≔a←⧅("a.txt","Møbel 🧩");⌛0;≔r←⤋"https://example.invalid";≔b←⧅("b.txt",r·body);print(a,b);';
   const result=await executeAsync(source,{
     fileWrite:async(name,content)=>{calls.push(name);return cap.write(name,content)},
     httpGet:async()=>({status:200,ok:true,body:'HTTP ok',retryAfter:0}),
     sleepMs:async()=>{},
     stdout:x=>outs.push(x)
   });
   assert.deepEqual(calls,['a.txt','b.txt']);
   assert.deepEqual(readdirSync(dir).sort(),['a.txt','b.txt']);
   assert.equal(readFileSync(join(dir,'a.txt'),'utf8'),'Møbel 🧩');
   assert.equal(readFileSync(join(dir,'b.txt'),'utf8'),'HTTP ok');
   assert.equal(result.fileWrites,2);
   assert.equal(result.httpRequests,1);
   assert.equal(result.sleeps,1);
   assert.equal(result.totalFileBytes,Buffer.byteLength('Møbel 🧩')+Buffer.byteLength('HTTP ok'));
   assert.deepEqual(outs,[Buffer.byteLength('Møbel 🧩')+' '+Buffer.byteLength('HTTP ok')]);
 }finally{rmSync(dir,{recursive:true,force:true});}
});

test('JS rejects untrusted/ill-typed file names and excessive write budgets before I/O',async()=>{
 let calls=0;const host=async()=>{calls++;return 1};
 for(const [src,part] of [
   ['⧅(12,"x");',/filename must be String/],
   ['⧅("x",12);',/content must be String/],
   ['⧅("../x","data");',/portable single-component filename/],
   ['⧅("CON.txt","data");',/portable single-component filename/],
   ['⧅("foo","\ud800");',/unpaired Unicode surrogates/],
   ['ƒ f()→Number ↩ ⧅("x","a");print(f());',/file write effect denied/]
 ])await assert.rejects(executeAsync(src,{fileWrite:host}),part);
 assert.equal(calls,0);
 await assert.rejects(executeAsync('⧅("x","abc");',{fileWrite:host,maxTotalFileBytes:2}),/effect budget exceeded/);
 assert.equal(calls,0);
 await assert.rejects(executeAsync('⧅("x","abc");',{fileWrite:async()=>2}),/Invalid H-Code file-write byte count/);
});

test('failed atomic host write causes no replay or silent overwrite',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'hcode-m19-write-deny-'));
 try{
  const cap=createFileWriteCapability({root:dir}),host=(n,v)=>cap.write(n,v);
  await assert.rejects(executeAsync('⧅("x.txt","a");⧅("x.txt","b");',{fileWrite:host}),e=>e.code==='EEXIST');
  assert.equal(readFileSync(join(dir,'x.txt'),'utf8'),'a');
  assert.equal(cap.stats().writes,1);
  assert.equal(existsSync(join(dir,'.hcode-tmp')),false);
 }finally{rmSync(dir,{recursive:true,force:true});}
});


test('two separate Node processes race for one output inode: exactly one atomic success',async()=>{
 const {spawn} = await import('node:child_process');
 const dir=mkdtempSync(join(tmpdir(),'hcode-m19-write-race-'));
 const url=new URL('../../runtime/file-write.mjs',import.meta.url).href;
 const script='import {createFileWriteCapability} from '+JSON.stringify(url)+';'+
   'const w=createFileWriteCapability({root:process.env.HCODE_FILE_WRITE_ROOT});'+
   'try{w.write("raced.txt",process.env.HCODE_RACE_CONTENT);process.stdout.write("OK");}'+
   'catch(e){process.stderr.write(String(e.code||e.message));process.exitCode=4;}';
 const race=content=>new Promise((resolve,reject)=>{
   const p=spawn(process.execPath,['--input-type=module','--eval',script],{
     env:{...process.env,HCODE_FILE_WRITE_ROOT:dir,HCODE_RACE_CONTENT:content},
     stdio:['ignore','pipe','pipe'],windowsHide:true
   });
   let stdout='',stderr='';p.stdout.on('data',x=>stdout+=x);p.stderr.on('data',x=>stderr+=x);
   p.once('error',reject);p.once('close',code=>resolve({code,stdout,stderr}));
 });
 try{
  const results=await Promise.all([race('A'.repeat(4096)),race('B'.repeat(4096))]);
  assert.equal(results.filter(x=>x.code===0).length,1);
  assert.equal(results.filter(x=>x.code===4&&x.stderr.includes('EEXIST')).length,1);
  const bytes=readFileSync(join(dir,'raced.txt'),'utf8');
  assert.ok(bytes==='A'.repeat(4096)||bytes==='B'.repeat(4096));
  assert.deepEqual(readdirSync(dir),['raced.txt']);
 }finally{rmSync(dir,{recursive:true,force:true});}
});

test('direct capability enforces output UTF-8 byte budget, unsafe names, and no overwrite',()=>{
 const dir=mkdtempSync(join(tmpdir(),'hcode-m19-write-budget-'));
 try{
  const cap=createFileWriteCapability({root:dir,maxWrites:2,maxTotalBytes:65536});
  assert.throws(()=>cap.write('../outside','hello'),/portable single-component filename/);
  assert.throws(()=>cap.write('too-big.txt','🧩'.repeat(16385)),/64 KiB UTF-8/);
  assert.equal(cap.write('empty.txt',''),0);
  assert.equal(cap.write('ok.txt','Møbel'),Buffer.byteLength('Møbel'));
  assert.throws(()=>cap.write('third.txt','x'),/effect budget exceeded/);
  assert.deepEqual(readdirSync(dir).sort(),['empty.txt','ok.txt']);
 }finally{rmSync(dir,{recursive:true,force:true});}
});
