import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,readFileSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {execute,tokenize,RESERVED_USER_GLYPHS} from '../prototype/src/hcode.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
const source=[
  '≔xs←⟦⦃name:"😀",rank:1⦄,⦃name:"\uE000",rank:1⦄,⦃name:"B",rank:2⦄,⦃name:"B",rank:3⦄⟧',
  '⎙(⤒(xs↥λr:r·name))'
].join('\n');
function reference(s){
 const out=[];execute(s,{stdout:v=>out.push(v)});
 return out;
}
function native(s){
 const folder=mkdtempSync(join(tmpdir(),'hcode15-sort-text-'));
 try{
  const path=join(folder,'sort.hc'),compiled=join(folder,'sort.mjs');
  writeFileSync(path,s);
  const built=spawnSync('cargo',['run','--quiet','--manifest-path','compiler/Cargo.toml',
    '--','build',path,'--out',compiled],{
    cwd:root,encoding:'utf8',windowsHide:true,timeout:180000,maxBuffer:1048576
  });
  assert.equal(built.status,0,built.stderr||built.stdout||String(built.error));
  const generated=readFileSync(compiled,'utf8');
  const out=spawnSync(process.execPath,[compiled],{
    cwd:root,encoding:'utf8',windowsHide:true,timeout:20000
  });
  assert.equal(out.status,0,out.stderr||String(out.error));
  return {generated,lines:out.stdout.trim().split(/\r?\n/)};
 }finally{rmSync(folder,{recursive:true,force:true});}
}
test('↥ and accessible @^ produce exactly the same H-Code AST token stream',()=>{
 assert.ok(RESERVED_USER_GLYPHS.has('↥'),'Core syntax must reserve new glyph');
 const ascii=source.replace('↥','@^');
 assert.deepEqual(tokenize(source).map(t=>[t.type,t.value]),
   tokenize(ascii).map(t=>[t.type,t.value]));
});
test('Unicode scalar order and stable ties are independent of JavaScript UTF-16 sort',()=>{
 const values=JSON.parse(reference(source)[0]);
 assert.deepEqual(values.map(v=>v.name),['B','B','\uE000','😀']);
 assert.deepEqual(values.map(v=>v.rank),[2,3,1,1]);
 assert.notDeepEqual(['\uE000','😀'].sort(),['\uE000','😀'],
   'Built-in JS UTF-16 code-unit order is not the H-Code String ordering');
});
test('Rust-generated ESM and independent H-Code reference sort identically',()=>{
 const output=native(source);
 assert.deepEqual(output.lines,reference(source));
 assert.match(output.generated,/const __hc_sort_text=/);
 assert.match(output.generated,/const __hc_compare=/);
 assert.doesNotMatch(output.generated,/node:sqlite/);
});
test('↥ rejects invalid key shapes and prevents selector side effects',()=>{
 for(const s of [
   '⟦1,2⟧↥λn:n',
   '⟦1,2⟧↥λn:n≡1',
   '⟦1,2⟧↥false',
 ]){
   assert.throws(()=>reference(s));
 }
 const observed=[];
 assert.throws(()=>execute('⟦1,2⟧↥λn:⎙(n)',{
    stdout:v=>observed.push(v)
 }),/effect denied/);
 assert.deepEqual(observed,[]);
});
test('old H-Code glyphs retain working numeric descending behavior',()=>{
 assert.deepEqual(reference('⎙(⤒(⟦2,5,1⟧↧λx:x))'),['[5,2,1]']);
});
