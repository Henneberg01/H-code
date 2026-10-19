import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,mkdtempSync,rmSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {runInNewContext} from 'node:vm';
import {execute,tokenize,RESERVED_USER_GLYPHS} from '../prototype/src/hcode.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
const sourceFile=join(root,'compact/canonical20/programs/14-todo-app.hc');
const source=readFileSync(sourceFile,'utf8');
function ui(values=new Map()){
 const nodes=new Map();
 function element(tagName='DIV'){
  return {tagName,textContent:'',value:'',children:[],listeners:new Map(),
   addEventListener(type,fn){this.listeners.set(type,fn);},
   replaceChildren(...items){this.children=[...items];},
   setAttribute(name,value){this[name]=value;}};
 }
 for(const sel of ['#todo-input','#todo-list','#status','#summary','#add','#complete','#remove'])
  nodes.set(sel,element(sel==='#todo-list'?'UL':sel==='#todo-input'?'INPUT':'BUTTON'));
 const domHost={querySelector:selector=>nodes.get(selector)??null,
   createElement:tag=>element(String(tag).toUpperCase())};
 const storageHost={getItem:key=>values.get(key)??null,
   setItem:(key,value)=>values.set(key,value),removeItem:key=>values.delete(key)};
 const click=(target,value)=>{
  nodes.get('#todo-input').value=value;
  const listener=nodes.get(target).listeners.get('click');
  assert.equal(typeof listener,'function',target+' listener missing');
  let prevented=false;
  listener({target:nodes.get(target),cancelable:true,preventDefault(){prevented=true;}});
  return prevented;
 };
 const snapshot=()=>({
  stored:values.get('hcode:todos')??null,
  tasks:nodes.get('#todo-list').children.map(x=>x.textContent),
  status:nodes.get('#status').textContent,
  summary:nodes.get('#summary').textContent
 });
 return {domHost,storageHost,click,snapshot,values,nodes};
}
function exercise(launch){
 const state=new Map();let f=ui(state);
 launch(f);
 assert.deepEqual(f.snapshot().tasks,[]);
 assert.equal(f.snapshot().summary,'0 tasks remaining');
 assert.equal(f.click('#add',''),true,'empty title blocked');
 assert.equal(f.click('#add','Buy milk'),false);
 assert.deepEqual(f.snapshot().tasks,['○ Buy milk']);
 assert.equal(f.click('#add','Walk dog'),false);
 assert.deepEqual(f.snapshot().tasks,['○ Buy milk','○ Walk dog']);
 assert.equal(f.click('#add','Buy milk'),true,'duplicate title blocked');
 assert.equal(f.click('#complete','Buy milk'),false);
 assert.deepEqual(f.snapshot().tasks,['✓ Buy milk','○ Walk dog']);
 assert.equal(f.snapshot().summary,'1 tasks remaining');
 assert.equal(f.click('#remove','Walk dog'),false);
 assert.deepEqual(f.snapshot().tasks,['✓ Buy milk']);
 assert.equal(f.snapshot().summary,'0 tasks remaining');
 const before=JSON.parse(state.get('hcode:todos'));
 assert.deepEqual(before,[{title:'Buy milk',done:true}]);
 f=ui(state);
 launch(f);
 assert.deepEqual(f.snapshot().tasks,['✓ Buy milk'],'restart must load persisted tasks');
 assert.equal(f.click('#add','<img src=x onerror=alert(1)>'),false);
 assert.deepEqual(f.snapshot().tasks,['✓ Buy milk','○ <img src=x onerror=alert(1)>']);
 assert.equal(f.nodes.get('#todo-list').children.length,2);
 assert.equal(f.nodes.get('#todo-list').children[1].textContent,'○ <img src=x onerror=alert(1)>');
 assert.equal(f.click('#remove','<img src=x onerror=alert(1)>'),false);
 assert.deepEqual(f.snapshot().tasks,['✓ Buy milk']);
 return f.snapshot();
}
test('⟘ general list glyph is lexically identical to ASCII alias',()=>{
 assert.equal(RESERVED_USER_GLYPHS.has('⟘'),true);
 const a=tokenize('⟘("#tasks",⟦"first"⟧);');
 const b=tokenize('dom_list("#tasks",⟦"first"⟧);');
 assert.deepEqual(a.map(x=>[x.type,x.value]),b.map(x=>[x.type,x.value]));
});
test('source-authored H-Code todo operations persist and update accessible lists in independent reference',()=>{
 const snapshot=exercise(f=>execute(source,{domHost:f.domHost,storageHost:f.storageHost}));
 assert.deepEqual(JSON.parse(snapshot.stored),[{title:'Buy milk',done:true}]);
});
test('Rust-generated H-Code browser app and independent JS interpreter produce the same behavior',()=>{
 const temp=mkdtempSync(join(tmpdir(),'hcode14-todo-'));
 try{
  const out=join(temp,'todo.mjs');
  const compiled=spawnSync('cargo',['run','--quiet','--manifest-path','compiler/Cargo.toml','--',
   'build',sourceFile,'--out',out],{cwd:root,encoding:'utf8',windowsHide:true,timeout:180000,maxBuffer:1024*1024});
  assert.equal(compiled.status,0,compiled.stderr||compiled.stdout||String(compiled.error));
  const js=readFileSync(out,'utf8');
  assert.ok(js.includes('replaceChildren'),'Must emit actual semantic list rendering');
  assert.ok(!js.includes('__hc_todo_app'),'No hardcoded task-specific runtime macro');
  const native=exercise(f=>runInNewContext(js,{
     document:f.domHost,localStorage:f.storageHost,TextEncoder,console
   },{timeout:10000}));
  const interpreted=exercise(f=>execute(source,{domHost:f.domHost,storageHost:f.storageHost}));
  assert.deepEqual(native,interpreted);
 }finally{rmSync(temp,{recursive:true,force:true});}
});
test('safe native list rendering fails closed without a real ul/ol element and never parses HTML',()=>{
 const f=ui();
 const nonlist=f.nodes.get('#todo-list');
 nonlist.tagName='DIV';
 assert.throws(()=>execute('⟘("#todo-list",⟦"x"⟧);',{domHost:f.domHost}),/ul or ol/);
 nonlist.tagName='UL';
 execute('⟘("#todo-list",⟦"<script>alert(1)</script>"⟧);',{domHost:f.domHost});
 assert.equal(nonlist.children[0].textContent,'<script>alert(1)</script>');
 assert.equal(nonlist.children[0].innerHTML,undefined);
});
