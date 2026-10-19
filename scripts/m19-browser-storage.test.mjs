import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {spawnSync} from 'node:child_process';
import {join} from 'node:path';
import {runInNewContext} from 'node:vm';
import {fileURLToPath} from 'node:url';
import {execute,tokenize,RESERVED_USER_GLYPHS} from '../prototype/src/hcode.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
const file=join(root,'compact/canonical20/programs/14-browser-storage-demo.hc');
const source=readFileSync(file,'utf8');
function makeHost(){
 const values=new Map(),calls=[],nodes=new Map([['#before',{textContent:''}],['#after',{textContent:''}]]);
 const storageHost={
   getItem:key=>{calls.push(['get',key]);return values.has(key)?values.get(key):null;},
   setItem:(key,value)=>{calls.push(['put',key,value]);values.set(key,value);},
   removeItem:key=>{calls.push(['del',key]);values.delete(key);}
 };
 const domHost={querySelector:sel=>nodes.get(sel)??null};
 const snapshot=()=>({
   before:nodes.get('#before').textContent,
   after:nodes.get('#after').textContent,
   stored:values.get('hcode:probe')??null
 });
 return {storageHost,domHost,values,nodes,calls,snapshot};
}
test('storage glyphs and ASCII fallbacks have the exact same lexical meaning',()=>{
 for(const [glyph,alias] of [['⟕','store_get'],['⟖','store_put'],['⟗','store_del']]){
  assert.equal(RESERVED_USER_GLYPHS.has(glyph),true);
  const a=tokenize(glyph+'("hcode:probe");'),b=tokenize(alias+'("hcode:probe");');
  assert.deepEqual(a.map(x=>[x.type,x.value]),b.map(x=>[x.type,x.value]),glyph);
 }
});
test('independent JS reference persists data over repeat program executions',()=>{
 const host=makeHost();
 execute(source,{domHost:host.domHost,storageHost:host.storageHost});
 assert.deepEqual(host.snapshot(),{before:'',after:'persisted',stored:'persisted'});
 host.nodes.get('#before').textContent='';
 host.nodes.get('#after').textContent='';
 execute(source,{domHost:host.domHost,storageHost:host.storageHost});
 assert.deepEqual(host.snapshot(),{before:'persisted',after:'persisted',stored:'persisted'});
 assert.deepEqual(host.calls.map(x=>x[0]),['get','put','get','get','put','get']);
});
test('generated Rust ESM and independent JS reference have identical persistent behavior',()=>{
 const temp=mkdtempSync(join(tmpdir(),'hcode-storage-'));
 try{
  const output=join(temp,'out.mjs');
  const built=spawnSync('cargo',['run','--quiet','--manifest-path','compiler/Cargo.toml','--',
    'build',file,'--out',output],{cwd:root,encoding:'utf8',windowsHide:true,timeout:180000,maxBuffer:1024*1024});
  assert.equal(built.status,0,built.stderr||built.stdout||String(built.error));
  const js=readFileSync(output,'utf8');
  assert.ok(js.includes('globalThis.localStorage'));
  assert.ok(!js.includes('node:fs'));
  const a=makeHost(),b=makeHost();
  for(let n=0;n<2;n++){
    execute(source,{domHost:a.domHost,storageHost:a.storageHost});
    runInNewContext(js,{
      document:b.domHost,localStorage:b.storageHost,TextEncoder,console
    },{timeout:10000});
    assert.deepEqual(a.snapshot(),b.snapshot(),'Run '+n);
    assert.deepEqual(a.calls,b.calls,'Effect order in run '+n);
  }
 }finally{rmSync(temp,{recursive:true,force:true});}
});
test('browser storage rejects absent host, invalid keys and oversized text',()=>{
 assert.throws(()=>execute('⟕("hcode:probe");'),/capability unavailable/);
 const host=makeHost();
 for(const key of ['foreign','hcode:','hcode:UPPER','hcode:../../foo','hcode:a/b']){
   assert.throws(()=>execute('⟖('+JSON.stringify(key)+',"x");',
      {storageHost:host.storageHost}),/namespaced hcode/,key);
 }
 assert.throws(()=>execute('⟖("hcode:probe",'+JSON.stringify('x'.repeat(65537))+');',
  {storageHost:host.storageHost}),/65536 UTF-8 bytes/);
 assert.equal(host.values.size,0);
});
test('deletion is generic, scoped to namespaced keys and persists as absence',()=>{
 const h=makeHost();
 execute('⟖("hcode:one","one"); ⟖("hcode:two","two"); ⟗("hcode:one");',
    {storageHost:h.storageHost});
 assert.equal(h.values.has('hcode:one'),false);
 assert.equal(h.values.get('hcode:two'),'two');
 assert.deepEqual(h.calls.slice(-1),[['del','hcode:one']]);
});
test('effectful storage cannot hide inside a pure package function',()=>{
 const h=makeHost();
 const src='fn evil(x:String)->String { return ⟕(x); }';
 assert.throws(()=>execute(src,{storageHost:h.storageHost}),/Unknown name|storage|effect/i);
});
