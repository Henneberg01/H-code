import test from 'node:test';
import assert from 'node:assert/strict';
import {parse,tokenize,execute,RESERVED_USER_GLYPHS,CORE_GLYPHS} from '../src/hcode.mjs';

const run=code=>{
  const out=[];
  execute(code,{stdout:x=>out.push(String(x))});
  return out.join('\n');
};
test('λ is an actual canonical H-Code token, ASCII is only its fallback',()=>{
  assert.equal(CORE_GLYPHS['λ'],'lambda');
  assert.equal(RESERVED_USER_GLYPHS.has('λ'),true);
  assert.equal('λ'.normalize('NFC'),'λ');
  assert.equal('λ'.normalize('NFKC'),'λ');
  assert.deepEqual(parse('print((λx:x+1)(41));'),parse('print((lambda x:x+1)(41));'));
  assert.deepEqual(tokenize('λx:x*2;').map(t=>t.type),tokenize('lambda x:x*2;').map(t=>t.type));
});
test('λ makes actual reusable typed higher-order sequence operations compact',()=>{
  assert.equal(run('≔y←⟦10,11⟧⇢λx:x*2;print(y⟦0⟧);print(y⟦1⟧);'),'20\n22');
  assert.equal(run('≔y←⟦-1,2,3,-2⟧⌕λx:x>0;print(⌗y);print(y⟦0⟧);print(y⟦1⟧);'),'2\n2\n3');
  assert.equal(run('print(∑(⟦-1,2,3,-2⟧⌕(λx:x>0)⇢(λx:x*2)));'),'10');
});
test('λ creates a real lexical closure over outer H-Code variables',()=>{
  assert.equal(run('≔n←4;≔f←λx:x+n;print(f(5));n←10;print(f(5));'),'9\n15');
  assert.equal(run('≔f←λx:x*2;print(f(21));'),'42');
  assert.equal(run('print((λx:x+1)(41));'),'42');
  assert.equal(run('≔square←λx:x*x;print(∑(⟦1,2,3⟧⇢square));'),'14');
  assert.equal(run('≔add←λx:λy:x+y;print(add(2)(3));'),'5');
});
test('λ respects arity, input types, and same-glyph Unicode safety',()=>{
  assert.throws(()=>run('print((λx:x+1)());'),/λ expects exactly one argument/);
  assert.throws(()=>run('print((λx:x+1)(1,2));'),/λ expects exactly one argument/);
  assert.throws(()=>run('print(⟦1,2⟧⌕λx:x+1);'),/⌕ predicate must return Bool/);
  assert.throws(()=>run('print((λx:x*2)("bad"));'),/expects Numbers/);
  assert.throws(()=>tokenize('print(λx:x+\u200b1);'),/Forbidden control/);
});
test('λ callback is invoked once per element in predictable source order',()=>{
  assert.equal(run('≔n←0;ƒ bump(x){n←n+1;↩x*2;}print(∑(⟦1,2,3⟧⇢(λx:bump(x))));print(n);'),'12\n3');
});
