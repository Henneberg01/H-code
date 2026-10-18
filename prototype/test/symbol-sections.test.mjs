import test from 'node:test';
import assert from 'node:assert/strict';
import {parse,execute,tokenize} from '../src/hcode.mjs';

const run=code=>{
  const out=[];
  execute(code,{stdout:v=>out.push(String(v))});
  return out.join('\n');
};
test('ordinary parenthesized numeric and comparison operator sections are real closures',()=>{
  assert.equal(run('print((+2)(40));'),'42');
  assert.equal(run('print((*2)(21));'),'42');
  assert.equal(run('print((/2)(84));'),'42');
  assert.equal(run('print((%3)(11));'),'2');
  assert.equal(run('print((>0)(1));'),'true');
  assert.equal(run('print((<=3)(4));'),'false');
  assert.equal(run('print((>=1)(1));'),'true');
  assert.equal(run('print((≡42)(42));'),'true');
  assert.equal(run('print((≠42)(41));'),'true');
  assert.equal(run('print((+"b")("a"));'),'ab');
});
test('sections replace boilerplate user callbacks in exactly the same map/filter workloads',()=>{
  const m='≔y←⟦10,11⟧⇢(*2);print(y⟦0⟧);print(y⟦1⟧);';
  const f='≔y←⟦-1,2,3,-2⟧⌕(>0);print(⌗y);print(y⟦0⟧);print(y⟦1⟧);';
  assert.equal(run(m),'20\n22');
  assert.equal(run(f),'2\n2\n3');
  assert.equal(run('print(∑(⟦-1,2,3,-2⟧⌕(>0)⇢(*2)));'),'10');
  assert.equal(run('≔y←⟦1,2,3⟧⇢(*2)⌕(>4);print(⌗y);print(y⟦0⟧);'),'1\n6');
  assert.equal(run('print(((*2)∘(+1))(20));'),'42');
});
test('section captures its right-hand value exactly once and respects lexical scope',()=>{
  const code='≔n←0;ƒ next(){n←n+1;↩n;}≔f←(*next());print(f(3));print(f(4));print(n);';
  assert.equal(run(code),'3\n4\n1');
  assert.equal(run('≔n←2;≔f←(*n);n←8;print(f(5));'),'10');
});
test('operator sections have strict errors and do not change unary negative syntax',()=>{
  assert.equal(run('print((-2)+3);'),'1');
  assert.throws(()=>run('print((>0)("x"));'),/Operator section expects Numbers/);
  assert.throws(()=>run('print((/0)(2));'),/Division by zero/);
  assert.throws(()=>run('print((+⊤)(1));'),/Operator section \+ expects Number or String/);
  assert.throws(()=>run('print(⟦1⟧⌕(*2));'),/⌕ predicate must return Bool/);
  assert.throws(()=>run('print((*2)(1,2));'),/Operator section expects exactly one argument/);
  assert.throws(()=>tokenize('print((*\u200b2)(4));'),/Forbidden control/);
});
