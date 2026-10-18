import test from 'node:test';
import assert from 'node:assert/strict';
import {tokenize,parse,execute,RESERVED_USER_GLYPHS} from '../src/hcode.mjs';

function run(source){
  const output=[];
  execute(source,{stdout:value=>output.push(String(value))});
  return output.join('\n');
}
test('◇ is a real core sign with identical ASCII token and AST',()=>{
  const glyph='ƒ f(x) ↩ x≤1 ◇ x : x+2; print(f(5));';
  const ascii='fn f(x) return x<=1 ? x : x+2; print(f(5));';
  assert.deepEqual(parse(glyph),parse(ascii));
  assert.deepEqual(tokenize('⊤ ◇ 1 : 2;').map(x=>x.type),tokenize('true ? 1 : 2;').map(x=>x.type));
  assert.equal(run(glyph),'7');
  assert.equal(run(ascii),'7');
  assert.equal('◇'.normalize('NFC'),'◇');
  assert.equal('◇'.normalize('NFKC'),'◇');
  assert.equal(RESERVED_USER_GLYPHS.has('◇'),true);
});
test('◇ represents actual lazy conditional semantics and recursive functions',()=>{
  assert.equal(run('ƒ fib(n) ↩ n≤1 ◇ n : fib(n-1)+fib(n-2); print(fib(7));'),'13');
  assert.equal(run('ƒ fact(n) ↩ n≤1 ◇ 1 : n*fact(n-1); print(fact(5));'),'120');
  assert.equal(run('ƒ sign(n) ↩ n<0 ◇ "negative" : "nonnegative"; print(sign(-5));'),'negative');
  assert.equal(run('print(⊤ ◇ 42 : 1/0); print(⊥ ◇ 1/0 : 42);'),'42\n42');
});
test('condition evaluates once and unused branch has zero side effects',()=>{
  const c='ƒ check() {print("condition");↩ ⊤;} ƒ unused() {print("never");↩ 0;} print(check() ◇ 42 : unused());';
  assert.equal(run(c),'condition\n42');
});
test('choice associates to the right and composes with pipelines and ∘',()=>{
  assert.equal(run('print(⊥ ◇ 1 : ⊤ ◇ 2 : 3);'),'2');
  assert.equal(run('print(⊤ ◇ ⊥ ◇ 4 : 5 : 6);'),'5');
  assert.equal(run('ƒ twice(n) ↩ n*2; print(⊤ ◇ 21 ▷ twice : 0);'),'42');
  assert.equal(run('ƒ inc(n) ↩ n+1; ƒ twice(n) ↩ n*2; print(⊤ ◇ (twice ∘ inc)(20) : 0);'),'42');
  assert.equal(run('print((⊤ ◇ 2 : 3)+40);'),'42');
});
test('invalid conditions, missing arms and invisible Unicode fail loudly',()=>{
  assert.throws(()=>run('print(2 ◇ 3 : 4);'),/Condition must be Boolean/);
  assert.throws(()=>parse('print(⊤ ◇ 1);'),/Expected :/);
  assert.throws(()=>parse('print(⊤ ◇ : 4);'),/Expected expression/);
  assert.throws(()=>parse('print(⊤ ◇ 1 :);'),/Expected expression/);
  assert.throws(()=>tokenize('print(⊤ ◇ 1 : \u200b 2);'),/Forbidden control/);
});
