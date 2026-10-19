import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,mkdtempSync,rmSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {runInNewContext} from 'node:vm';
import {fileURLToPath} from 'node:url';
import {execute,tokenize,RESERVED_USER_GLYPHS} from '../prototype/src/hcode.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
const program=join(root,'compact/canonical20/programs/13-form-validation-ui.hc');
const source=readFileSync(program,'utf8');
function fixture(){
 const nodes=new Map();
 const makeNode=(selector)=>({
  value:'',textContent:'',attributes:new Map(),events:new Map(),
  setAttribute(k,v){this.attributes.set(k,v);},
  addEventListener(k,handler){this.events.set(k,handler);}
 });
 for(const id of ['#email','#email-preview','#email-error','#contact-form'])
  nodes.set(id,makeNode(id));
 const input=nodes.get('#email');
 input.checkValidity=function(){
  return /^(?!.*\s)[^@]+@[^@]+\.[^@]+$/.test(this.value);
 };
 const domHost={querySelector:s=>nodes.get(s)??null};
 const fire=(selector,eventName,cancelable=true)=>{
  const node=nodes.get(selector),handler=node.events.get(eventName);
  assert.equal(typeof handler,'function',selector+' event '+eventName);
  let cancelled=false;
  handler({target:node,cancelable,preventDefault(){cancelled=true;}});
  return cancelled;
 };
 const snapshot=()=>Object.fromEntries([...nodes].map(([id,node])=>
  [id,{value:node.value,text:node.textContent,
    attributes:Object.fromEntries([...node.attributes]),listeners:[...node.events.keys()]}]));
 return {domHost,nodes,fire,snapshot};
}
function exercise(runtime){
 const f=fixture();
 runtime(f.domHost);
 const email=f.nodes.get('#email');
 email.value='wrong';
 f.fire('#email','input');
 assert.equal(f.nodes.get('#email-error').textContent,'Enter a valid email address');
 assert.equal(email.attributes.get('aria-invalid'),'true');
 assert.equal(f.nodes.get('#email-preview').textContent,'wrong');
 assert.equal(f.fire('#contact-form','submit'),true,'invalid submit cancelled');
 email.value='person@example.net';
 f.fire('#email','input');
 assert.equal(f.nodes.get('#email-error').textContent,'');
 assert.equal(email.attributes.get('aria-invalid'),'false');
 assert.equal(f.fire('#contact-form','submit'),false,'valid submit allowed');
 return f.snapshot();
}
test('DOM signs tokenize exactly like equivalent ASCII fallback calls',()=>{
 for(const [glyph,ascii] of [
  ['⟐','dom_value'],['⟑','dom_text'],['⟒','dom_valid'],
  ['⟓','dom_on'],['⟔','dom_attr']]){
   assert.equal(RESERVED_USER_GLYPHS.has(glyph),true);
   const a=tokenize(glyph+'("#id");');
   const b=tokenize(ascii+'("#id");');
   assert.deepEqual(a,b,glyph);
 }
});
test('source-authored HTML5-style required/email validation with accessible feedback in independent JS reference',()=>{
 const observed=exercise(domHost=>execute(source,{domHost}));
 assert.equal(observed['#email'].attributes['aria-invalid'],'false');
});
test('Rust-generated DOM JavaScript matches independent reference event and text semantics',()=>{
 const temp=mkdtempSync(join(tmpdir(),'hcode-m19-dom-'));
 try{
  const out=join(temp,'program.mjs');
  const built=spawnSync('cargo',['run','--quiet','--manifest-path','compiler/Cargo.toml','--',
     'build',program,'--out',out],{cwd:root,windowsHide:true,encoding:'utf8',timeout:180000});
  assert.equal(built.status,0,built.stderr||built.stdout||String(built.error));
  const js=readFileSync(out,'utf8');
  assert.ok(js.includes('__hc_dom_valid'));
  assert.ok(!js.includes('node:fs'),'browser ESM must not depend on Node APIs');
  const actual=exercise(domHost=>
    runInNewContext(js,{document:domHost,TextEncoder,console},{timeout:10000}));
  const reference=exercise(domHost=>execute(source,{domHost}));
  assert.deepEqual(actual,reference);
 }finally{rmSync(temp,{recursive:true,force:true});}
});
test('DOM capabilities fail closed on absent host, dangerous attribute and HTML injection',()=>{
 assert.throws(()=>execute('⟐("#email");'),/capability unavailable/);
 const f=fixture();
 assert.throws(()=>execute('⟔("#email","onclick","alert(1)");',{domHost:f.domHost}),/allowlist/);
 assert.throws(()=>execute('⟔("#email","href","javascript:evil");',{domHost:f.domHost}),/allowlist/);
 execute('⟑("#email-error","<img src=x onerror=alert(1)>");',{domHost:f.domHost});
 assert.equal(f.nodes.get('#email-error').textContent,'<img src=x onerror=alert(1)>');
 assert.equal(f.nodes.get('#email-error').attributes.size,0);
 assert.throws(()=>execute('⟐("#missing");',{domHost:f.domHost}),/not found/);
});

test('real browser fixture supplies required/email controls and accessible error output',()=>{
 const html=readFileSync(join(root,'compact/canonical20/programs/13-form-validation-ui.html'),'utf8');
 assert.match(html,/<form id="contact-form"[^>]*novalidate>/);
 assert.match(html,/<input id="email"[^>]*type="email" required/);
 assert.match(html,/aria-describedby="email-error"/);
 assert.match(html,/id="email-error" role="alert" aria-live="polite"/);
 assert.match(html,/script type="module" src="\.\/13-form-validation-ui\.mjs"/);
});
