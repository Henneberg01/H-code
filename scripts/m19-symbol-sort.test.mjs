import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {execute,tokenize,RESERVED_USER_GLYPHS} from '../prototype/src/hcode.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
const literal=String.raw`≔xs←⟦⦃name:"a",score:2⦄,⦃name:"b",score:4⦄,⦃name:"c",score:4⦄,⦃name:"d",score:-5⦄⟧↧λr:r·score
⎙(⤒xs)`;
const runReference=source=>{const lines=[];execute(source,{stdout:s=>lines.push(s)});return lines;};
test('↧ and ⎙ are real reserved H-Code tokens; ASCII alternatives are secondary',()=>{
 assert.ok(RESERVED_USER_GLYPHS.has('↧'));
 assert.ok(RESERVED_USER_GLYPHS.has('⎙'));
 const alias=literal.replace('↧','@v').replace('⎙','print');
 assert.deepEqual(tokenize(literal).map(t=>[t.type,t.value]),
  tokenize(alias).map(t=>[t.type,t.value]));
});
test('symbolic stable descending sort operates on general user-authored records',()=>{
 const out=runReference(literal);
 assert.equal(out.length,1);
 const data=JSON.parse(out[0]);
 assert.deepEqual(data.map(x=>x.name),['b','c','a','d'],'Equal scores retain input order');
 assert.deepEqual(data.map(x=>x.score),[4,4,2,-5]);
});
test('↧ does not mutate input and calls selector exactly once per element',()=>{
 const code=String.raw`≔xs←⟦3,1,2⟧
≔ys←xs↧λv:v
⎙(⤒xs)
⎙(⤒ys)`;
 assert.deepEqual(runReference(code),['[3,1,2]','[3,2,1]']);
});
test('invalid H-Code comparator type and shape fail in reference interpreter',()=>{
 for(const [source,match] of [
  ['⟦1,2⟧↧λv:"x";',/key must return a finite Number/],
  ['1↧λv:v;',/Expected sequence/],
  ['⟦1,2⟧↧false;',/requires a unary numeric key/]
 ])assert.throws(()=>runReference(source),match);
});
test('real Rust-generated Node ESM and independent H-Code interpreter sort identically',()=>{
 const dir=mkdtempSync(join(tmpdir(),'hcode-sort-symbol-'));
 try{
   const src=join(dir,'sort.hc'),out=join(dir,'sort.mjs');
   writeFileSync(src,literal);
   const build=spawnSync('cargo',['run','--quiet','--manifest-path','compiler/Cargo.toml','--','build',src,'--out',out],
      {cwd:root,windowsHide:true,encoding:'utf8',timeout:180000,maxBuffer:1048576});
   assert.equal(build.status,0,build.stderr||build.stdout||String(build.error));
   const generated=readFileSync(out,'utf8');
   assert.match(generated,/__hc_sort_desc/);
   const native=spawnSync(process.execPath,[out],{cwd:root,windowsHide:true,encoding:'utf8',timeout:20000});
   assert.equal(native.status,0,native.stderr||String(native.error));
   assert.deepEqual(native.stdout.trim().split(/\r?\n/),runReference(literal));
 }finally{rmSync(dir,{recursive:true,force:true});}
});

test('↧ denies all callback host effects in interpreter before host I/O is touched',()=>{
 const stdout=[],files=[],stdin=[];
 assert.throws(()=>execute('⟦1,2⟧↧λx:⎙(x);',{stdout:x=>stdout.push(x)}),
   /CAS reducer effect denied/);
 assert.deepEqual(stdout,[],'No output from failed sort selector');
 assert.throws(()=>execute('⟦1,2⟧↧λx:⧄"secret";',{
  readFile:path=>{files.push(path);return 'data';}
 }),/↧ key effect denied: file read/);
 assert.deepEqual(files,[],'File host must not be invoked');
 assert.throws(()=>execute('⟦1,2⟧↧λx:⌨;',{
  readStdin:()=>{stdin.push(1);return '1';}
 }),/↧ key effect denied: stdin/);
 assert.deepEqual(stdin,[],'Stdin host must not be consumed');
});
test('↧ retains numeric sorting with pure named H-Code functions',()=>{
 const source='ƒ score(n:Number)→Number ↩n*2; ⎙(⤒(⟦3,1,2⟧↧score));';
 assert.deepEqual(runReference(source),['[3,2,1]']);
});
