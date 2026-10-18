import test from 'node:test';
import assert from 'node:assert/strict';
import {tokenize,parse,execute,RESERVED_USER_GLYPHS} from '../src/hcode.mjs';

function output(source){
  const lines=[];
  execute(source,{stdout:v=>lines.push(String(v))});
  return lines.join('\n');
}
const twice='ƒ twice(x) ↩ x*2;';
const inc='ƒ inc(x) ↩ x+1;';

test('∘ is an actual core token with canonical ASCII spelling; not a package glyph',()=>{
  assert.deepEqual(tokenize('twice ∘ inc;').map(t=>t.type),
                   tokenize('twice << inc;').map(t=>t.type));
  assert.equal(RESERVED_USER_GLYPHS.has('∘'),true);
  assert.equal('∘'.normalize('NFC'),'∘');
  assert.equal('∘'.normalize('NFKC'),'∘');
});

test('glyph and accessible alias produce identical AST, compose arbitrary unary functions',()=>{
  const glyph=twice+' '+inc+' print((twice ∘ inc)(20));';
  const ascii='fn twice(x) return x*2; fn inc(x) return x+1; print((twice << inc)(20));';
  assert.deepEqual(parse(glyph),parse(ascii));
  assert.equal(output(glyph),'42');
  assert.equal(output(ascii),'42');
});

test('composition works as a higher-order function in the real pipeline',()=>{
  assert.equal(output(twice+' '+inc+' print(20 ▷ (twice ∘ inc));'),'42');
  assert.equal(output(twice+' '+inc+' print(20 |> (twice << inc));'),'42');
  assert.equal(output(twice+' '+inc+' ≔ transform ← twice ∘ inc; print(transform(20));'),'42');
});

test('composition preserves input/output types when functions cross domains',()=>{
  const boolean='ƒ positive(x) ↩ x>0; ƒ invert(b) ↩ ¬b;';
  assert.equal(output(boolean+' print((invert ∘ positive)(-1));'),'true');
  const word='ƒ nonzero(x) ↩ x>0; ƒ yes(b) → String {if(b){↩ "yes";}else{↩ "no";}}';
  assert.equal(output(word+' print((yes ∘ nonzero)(5));'),'yes');
});

test('nested composition and precedence are deterministic',()=>{
  const prefix='ƒ inc(x) ↩ x+1; ƒ double(x) ↩ x*2; ƒ minus(x) ↩ x-2;';
  assert.equal(output(prefix+' print((minus ∘ double ∘ inc)(20));'),'40');
  assert.equal(output(prefix+' print(((minus ∘ double) ∘ inc)(20));'),'40');
  assert.equal(output(prefix+' print((minus ∘ (double ∘ inc))(20));'),'40');
});

test('composition evaluates function construction once, and left-to-right',()=>{
  const source='ƒ addOne(x) ↩ x+1; ƒ double(x) ↩ x*2; '
    +'ƒ outer() {print("outer");↩ double;} ƒ inner() {print("inner");↩ addOne;} '
    +'≔ f ← outer() ∘ inner(); print(f(20)); print(f(2));';
  assert.equal(output(source),'outer\ninner\n42\n6');
});

test('invalid operands reject at runtime; bad Unicode remains forbidden',()=>{
  assert.throws(()=>output('≔ x ← 2 ∘ 3;'),/Composition expects unary functions/);
  assert.throws(()=>output('≔ x ← 2 << 3;'),/Composition expects unary functions/);
  assert.throws(()=>parse('ƒ f() ↩ 1; print(3 ∘ \u200b f);'),/Forbidden control/);
  assert.throws(()=>parse('ƒ f() ↩ 1; print(3 < < f);'),/Expected/);
});
