import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {runInNewContext} from 'node:vm';
import {execute,tokenize,RESERVED_USER_GLYPHS} from '../prototype/src/hcode.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
function ui(){
 const target=element('table');
 function element(tag){
   return {tagName:String(tag).toUpperCase(),textContent:'',attributes:{},children:[],
     replaceChildren(...items){this.children=[...items];},
     setAttribute(key,value){this.attributes[key]=value;}};
 }
 const doc={querySelector:s=>s==='#results'?target:null,createElement:element};
 const snapshot=()=>JSON.stringify(target);
 return {doc,target,snapshot};
}
const source='⟙("#results","Regional metrics",⟦"Region","Orders","Revenue"⟧,'+
 '⟦⟦"North","2","1700"⟧,⟦"<img src=x onerror=1>","1","250"⟧⟧);';
test('⟙ and dom_table are native aliases, and source glyph cannot be stolen',()=>{
 assert.equal(RESERVED_USER_GLYPHS.has('⟙'),true);
 assert.deepEqual(tokenize(source).map(t=>t.type),
  tokenize(source.replace('⟙','dom_table')).map(t=>t.type));
});
test('independent H-Code reference emits semantic accessible table without evaluating HTML',()=>{
 const f=ui();execute(source,{domHost:f.doc});
 const [caption,head,body]=f.target.children;
 assert.equal(caption.tagName,'CAPTION');
 assert.equal(caption.textContent,'Regional metrics');
 assert.equal(head.tagName,'THEAD');
 assert.deepEqual(head.children[0].children.map(c=>c.textContent),['Region','Orders','Revenue']);
 assert.ok(head.children[0].children.every(c=>c.tagName==='TH'&&c.attributes.scope==='col'));
 assert.equal(body.tagName,'TBODY');
 assert.equal(body.children.length,2);
 assert.equal(body.children[1].children[0].tagName,'TH');
 assert.equal(body.children[1].children[0].attributes.scope,'row');
 assert.equal(body.children[1].children[0].textContent,'<img src=x onerror=1>');
 assert.equal(f.snapshot().includes('innerHTML'),false);
});
test('Rust ESM and independent JS interpreter render identical semantic DOM for general table',()=>{
 const folder=mkdtempSync(join(tmpdir(),'hcode15-table-'));
 try{
   const src=join(root,'compact/canonical20/programs/15-generic-table-b2a.hc');
   const path=join(folder,'table.mjs');
   const build=spawnSync('cargo',['run','--quiet','--manifest-path','compiler/Cargo.toml','--',
    'build',src,'--out',path],{cwd:root,windowsHide:true,encoding:'utf8',timeout:180000,maxBuffer:1048576});
   assert.equal(build.status,0,build.stderr||build.stdout||String(build.error));
   const esm=readFileSync(path,'utf8');
   assert.match(esm,/__hc_dom_table/);
   assert.doesNotMatch(esm,/node:sqlite/);
   const a=ui(),b=ui();
   runInNewContext(esm,{document:a.doc,TextEncoder,console},{timeout:10000});
   execute(readFileSync(src,'utf8'),{domHost:b.doc});
   assert.equal(a.snapshot(),b.snapshot());
 }finally{rmSync(folder,{recursive:true,force:true});}
});
test('atomic runtime failure leaves existing table unchanged',()=>{
 const f=ui();execute(source,{domHost:f.doc});
 const saved=f.snapshot();
 assert.throws(()=>execute('⟙("#results","Oops",⟦"A","B"⟧,⟦⟦"one"⟧⟧);',{domHost:f.doc}),/rectangular/);
 assert.equal(f.snapshot(),saved);
 assert.throws(()=>execute('⟙("#results","Oops",⟦⟧,⟦⟦"x"⟧⟧);',{domHost:f.doc}),/headers/);
 assert.equal(f.snapshot(),saved);
});
test('general table rejects non-table targets and never interprets hostile HTML',()=>{
 const f=ui();f.target.tagName='DIV';
 assert.throws(()=>execute(source,{domHost:f.doc}),/target must be table/);
 f.target.tagName='TABLE';
 execute(source,{domHost:f.doc});
 assert.equal(f.target.children[2].children[1].children[0].textContent,'<img src=x onerror=1>');
 assert.equal(f.target.children[2].children[1].children[0].children.length,0);
});
