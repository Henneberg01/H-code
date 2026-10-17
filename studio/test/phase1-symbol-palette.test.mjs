import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';

const app=new URL('../public/app.js',import.meta.url);
const body=fs.readFileSync(fileURLToPath(app),'utf8');
const start=body.indexOf('const symbols=');
const end=body.indexOf('function lines()',start);
assert.ok(start>=0&&end>start,'Extract the existing Studio palette initializer');
const palette=body.slice(start,end);
function loadPalette(){
 const host={children:[],append(node){this.children.push(node);}};
 const source={
  value:'xy',disabled:false,selectionStart:1,selectionEnd:2,focused:false,
  setRangeText(s,start,end,mode){assert.equal(mode,'end');this.value=this.value.slice(0,start)+s+this.value.slice(end);this.selectionStart=start+s.length;this.selectionEnd=this.selectionStart;},
  focus(){this.focused=true;}
 };
 let changed=0,cleared=0;
 const doc={createElement(tag){return {tag,attributes:{},children:[],listeners:{},append(...children){this.children.push(...children);},addEventListener(type,cb){this.listeners[type]=cb;},setAttribute(name,value){this.attributes[name]=value;}};}};
 vm.runInNewContext(palette,{document:doc,el:()=>host,source,changed:()=>changed++,clearApproval:()=>cleared++});
 return {buttons:host.children,source,changes:()=>changed,approvalsCleared:()=>cleared};
}
const pairs=[['ƒ','fn'],['≔','let'],['↩','return'],['→','->'],['←','='],['⊤','true'],['⊥','false'],['∧','and'],['∨','or'],['¬','not'],['≡','=='],['≠','!='],['≤','<='],['≥','>='],['∷','::'],['▷','|>'],['∘','<<'],['◇','?'],['⟦','[['],['⟧',']]'],['⌗','#'],['⧺','++']];
test('palette provides every existing language-level sign with correct accessible alias',()=>{
 const {buttons}=loadPalette();
 const found=buttons.map(b=>[b.children[0].textContent,b.children[1].textContent]);
 assert.deepEqual(found,pairs);
 assert.equal(new Set(found.map(p=>p[0])).size,22);
 for(const button of buttons){
  const sign=button.children[0].textContent,alias=button.children[1].textContent;
  assert.match(button.attributes['aria-label']??'',new RegExp(sign.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
  assert.ok((button.attributes['aria-label']??'').includes(alias));
  assert.ok((button.title??'').includes(alias));
 }
});

test('click inserts actual sign at cursor without replacing source with JS',()=>{
 const {buttons,source,changes}=loadPalette();
 const sign=buttons.find(b=>b.children[0].textContent==='≤');
 assert.ok(sign,'≤ must be selectable');
 sign.listeners.click();
 assert.equal(source.value,'x≤');
 assert.equal(source.focused,true);
 assert.equal(changes(),1);
 source.disabled=true;
 sign.listeners.click();
 assert.equal(source.value,'x≤');
 assert.equal(changes(),1);
});

test('inserting a sign invalidates stale AI edit approval even without an input event',()=>{
 const {buttons,source,approvalsCleared}=loadPalette();
 buttons[0].listeners.click();
 assert.equal(approvalsCleared(),1,'symbol insertion must clear prior AI approval');
 source.disabled=true;
 buttons[0].listeners.click();
 assert.equal(approvalsCleared(),1,'disabled editor must not clear again');
});
