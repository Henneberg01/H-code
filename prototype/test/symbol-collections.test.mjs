import test from 'node:test';
import assert from 'node:assert/strict';
import {CORE_GLYPHS,RESERVED_USER_GLYPHS,tokenize,parse,execute} from '../src/hcode.mjs';

const run=(source,options={})=>{
  const output=[];
  execute(source,{stdout:value=>output.push(String(value)),...options});
  return output.join('\n');
};

test('∑ ⌕ ⇢ are real core tokens with accessible, identical AST aliases',()=>{
  for(const [glyph,alias] of [['∑','@+'],['⌕','@?'],['⇢','@>']]){
    assert.equal(CORE_GLYPHS[glyph],alias);
    assert.equal(RESERVED_USER_GLYPHS.has(glyph),true);
    assert.equal(glyph.normalize('NFC'),glyph);
    assert.equal(glyph.normalize('NFKC'),glyph);
  }
  const sign='ƒ twice(n)↩n*2;print(∑(⟦2,3⟧⇢twice));';
  const ascii='fn twice(n) return n*2;print(@+([[2,3]] @> twice));';
  assert.deepEqual(parse(sign),parse(ascii));
  assert.deepEqual(tokenize('⟦1⟧⌕p⇢f;').map(t=>t.type),
                   tokenize('[[1]] @? p @> f;').map(t=>t.type));
  assert.equal(run(sign),'10');
  assert.equal(run(ascii),'10');
});

test('∑ executes numeric reduction and supports contextually empty sequences',()=>{
  assert.equal(run('print(∑⟦2,3,5⟧);'),'10');
  assert.equal(run('print(@+[[2,3,5]]);'),'10');
  assert.equal(run('print(∑⟦⟧);'),'0');
  assert.equal(run('≔ xs:⟦Number⟧←⟦⟧;print(∑xs);'),'0');
  assert.equal(run('≔ xs←⟦2,3,5⟧;print(∑xs);'),'10');
});

test('⇢ is a generic stable transform and ⌕ a stable, type-preserving filter',()=>{
  const transform='ƒ twice(n)↩n*2;≔ys←⟦10,11⟧⇢twice;print(ys⟦0⟧);print(ys⟦1⟧);';
  const filter='ƒ positive(n)↩n>0;≔ys←⟦-1,2,3,-2⟧⌕positive;print(⌗ys);print(ys⟦0⟧);print(ys⟦1⟧);';
  assert.equal(run(transform),'20\n22');
  assert.equal(run(filter),'2\n2\n3');
  assert.equal(run('ƒ tag(n: Number)→String ↩ "x";≔s←⟦1,2⟧⇢tag;print(s⟦0⟧);print(⌗s);'),'x\n2');
  assert.equal(run('ƒ twice(n)↩n*2;print((⟦1,2⟧⇢twice)⟦1⟧);'),'4');
  assert.equal(run('ƒ twice(n)↩n*2;≔xs←⟦1,2⟧;≔ys←xs⇢twice;print(xs⟦0⟧);print(ys⟦0⟧);'),'1\n2');
});

test('operators compose left-to-right with identical output for full collection pipeline',()=>{
  const src='ƒ positive(n)↩n>0;ƒ twice(n)↩n*2;print(∑(⟦-1,2,3,-2⟧⌕positive⇢twice));';
  assert.equal(run(src),'10');
  const ascii='fn positive(n) return n>0;fn twice(n) return n*2;print(@+([[-1,2,3,-2]] @? positive @> twice));';
  assert.equal(run(ascii),'10');
  assert.deepEqual(parse(src),parse(ascii));
  assert.equal(run('ƒ twice(n)↩n*2;ƒ plusOne(n)↩n+1;print(∑(⟦1,2⟧⇢(twice∘plusOne)));'),'10');
});

test('filter/map call H-Code callbacks exactly once per input in source order',()=>{
  const filtering='ƒ pred(n) {print(n);↩n>0;}≔out←⟦-1,2,3⟧⌕pred;print(⌗out);';
  const mapping='ƒ times(n) {print(n);↩n*2;}≔out←⟦1,2⟧⇢times;print(out⟦1⟧);';
  assert.equal(run(filtering),'-1\n2\n3\n2');
  assert.equal(run(mapping),'1\n2\n4');
});

test('static contracts have corresponding descriptive dynamic errors in the reference',()=>{
  assert.throws(()=>run('print(∑⟦"bad"⟧);'),/∑ requires a numeric sequence/);
  assert.throws(()=>run('print(∑42);'),/Expected sequence/);
  assert.throws(()=>run('print(⟦1⟧⌕42);'),/⌕ requires a unary predicate/);
  assert.throws(()=>run('ƒ twice(n)↩n*2;print(⟦1⟧⌕twice);'),/⌕ predicate must return Bool/);
  assert.throws(()=>run('print(⟦1⟧⇢42);'),/⇢ requires a unary transform/);
  assert.throws(()=>run('ƒ bad(n)↩n>0 ◇ n : "x";print(⟦-1,1⟧⇢bad);'),/Sequence elements must have matching types/);
  assert.throws(()=>tokenize('print(∑⟦1,\u200b2⟧);'),/Forbidden control/);
});

test('execution fuel and allocation boundaries apply to symbolic reductions and transforms',()=>{
  assert.throws(()=>run('print(∑⟦1,2,3⟧);',{maxSteps:3}),/Execution step limit exceeded/);
  assert.throws(()=>run('ƒ id(n)↩n;print(⌗(⟦1,2,3⟧⇢id));',{maxSequenceItems:2}),/Sequence allocation limit exceeded/);
  assert.throws(()=>run('ƒ keep(n)↩⊤;print(⌗(⟦1,2,3⟧⌕keep));',{maxSequenceItems:2}),/Sequence allocation limit exceeded/);
});
