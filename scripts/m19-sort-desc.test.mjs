// Genuine generic stable numeric-key sorting in both engines and all aliases.
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,rmSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {execute,tokenize,RESERVED_USER_GLYPHS} from '../prototype/src/hcode.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
const source='≔xs←⟦⦃name:"Alpha",score:5⦄,⦃name:"Beta",score:9⦄,'+
 '⦃name:"Gamma",score:9⦄,⦃name:"Delta",score:1⦄⟧\nprint(⤒(xs⇣λx:x·score))';
const expected=[
 {name:'Beta',score:9},{name:'Gamma',score:9},
 {name:'Alpha',score:5},{name:'Delta',score:1}
];
function interpret(src){
 const output=[];
 execute(src,{stdout:line=>output.push(line)});
 assert.equal(output.length,1);
 return JSON.parse(output[0]);
}
function native(src){
 const dir=mkdtempSync(join(tmpdir(),'hcode-sort-'));
 try{
  const from=join(dir,'sort.hc'),to=join(dir,'sort.mjs');
  writeFileSync(from,src);
  const build=spawnSync('cargo',['run','--quiet','--manifest-path','compiler/Cargo.toml',
   '--','build',from,'--out',to],{cwd:root,windowsHide:true,encoding:'utf8',timeout:180000,maxBuffer:1048576});
  assert.equal(build.status,0,build.stderr||build.stdout||String(build.error));
  const esm=readFileSync(to,'utf8');
  const run=spawnSync(process.execPath,[to],{
   cwd:root,windowsHide:true,encoding:'utf8',timeout:20000,maxBuffer:1048576});
  assert.equal(run.status,0,run.stderr||String(run.error));
  return {result:JSON.parse(run.stdout.trim()),esm};
 }finally{rmSync(dir,{recursive:true,force:true});}
}
test('⇣ and @v tokenize identically and are protected core syntax',()=>{
 assert.equal(RESERVED_USER_GLYPHS.has('⇣'),true);
 assert.deepEqual(tokenize(source).map(t=>[t.type,t.value]),
   tokenize(source.replace('⇣','@v')).map(t=>[t.type,t.value]));
});
test('real generic stable sort descending, tie order and interpreter/native parity',()=>{
 const result=interpret(source);
 assert.deepEqual(result,expected);
 assert.deepEqual(interpret(source.replace('⇣','@v')),result);
 const code=native(source);
 assert.deepEqual(code.result,result);
 assert.ok(code.esm.includes('__hc_sort_desc'));
 assert.ok(!code.esm.includes('__hc_dashboard'));
});
test('sorting works on anonymous scalar numeric lists and annotated empty lists',()=>{
 const normal='print(⤒(⟦3,8,2,8⟧⇣λn:n))';
 assert.deepEqual(interpret(normal),[8,8,3,2]);
 assert.deepEqual(native(normal).result,[8,8,3,2]);
 const empty='≔xs:⟦Number⟧←⟦⟧\nprint(⤒(xs⇣λn:n))';
 assert.deepEqual(interpret(empty),[]);
 assert.deepEqual(native(empty).result,[]);
});
test('numeric key must be finite and must not have observable host effects',()=>{
 assert.throws(()=>interpret('≔xs←⟦1,2⟧\nprint(⤒(xs⇣λn:print(n)))'),/CAS reducer effect denied/);
 assert.throws(()=>interpret('≔xs←⟦1,2⟧\nprint(⤒(xs⇣λn:n/0))'),/Division by zero/);
});
