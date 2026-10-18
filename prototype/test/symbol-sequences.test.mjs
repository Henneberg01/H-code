import test from 'node:test';
import assert from 'node:assert/strict';
import {parse,tokenize,execute,RESERVED_USER_GLYPHS} from '../src/hcode.mjs';

const run=(source,options={})=>{
  const output=[];
  execute(source,{stdout:value=>output.push(String(value)),...options});
  return output.join('\n');
};
const cases=[
  ['≔ xs ← ⟦1,2,3⟧;print(xs⟦0⟧);print(⌗xs);','1\n3'],
  ['≔ xs ← [[1,2,3]];print(xs[[0]]);print(#xs);','1\n3'],
  ['≔ xs ← ⟦1,2⟧;≔ ys ← xs ⧺ ⟦3,4⟧;print(⌗xs);print(ys⟦3⟧);','2\n4'],
  ['≔ xs ← [[1,2]];≔ ys ← xs ++ [[3,4]];print(#xs);print(ys[[3]]);','2\n4'],
  ['≔ xs ← ⟦⟦1,2⟧,⟦3,4⟧⟧;print(xs⟦1⟧⟦0⟧);','3'],
  ['ƒ head(xs:⟦Number⟧) → Number ↩ xs⟦0⟧;print(head(⟦42⟧));','42'],
  ['fn head(xs:[[Number]]) -> Number return xs[[0]];print(head([[42]]));','42'],
  ['ƒ empty() → ⟦Number⟧ ↩ ⟦⟧;print(⌗empty());','0'],
  ['≔ a:⟦Number⟧ ← ⟦⟧;print(⌗a);','0'],
  ['≔ a:[[Number]] = [[]];print(#a);','0'],
  ['ƒ empty() → ⟦⟦Number⟧⟧ ↩ ⟦⟦⟧⟧;print(⌗empty());','1'],
  ['ƒ twice(n) ↩ n*2;print(⟦20,21⟧⟦1⟧ ▷ twice);','42'],
  ['print(⊤ ◇ ⌗⟦1,2,3⟧ : 1/0);','3']
];
test('M11 glyphs are real tokens and not package-level aliases',()=>{
  for(const glyph of ['⟦','⟧','⌗','⧺']){
    assert.equal(glyph.normalize('NFC'),glyph);
    assert.equal(glyph.normalize('NFKC'),glyph);
    assert.equal(RESERVED_USER_GLYPHS.has(glyph),true);
  }
  assert.deepEqual(tokenize('⟦1,2⟧ ⧺ ⟦3⟧;').map(t=>t.type),
                   tokenize('[[1,2]] ++ [[3]];').map(t=>t.type));
  const unicode='ƒ first(xs:⟦Number⟧) → Number ↩ xs⟦0⟧;print(first(⟦42⟧));';
  const ascii='fn first(xs:[[Number]]) -> Number return xs[[0]];print(first([[42]]));';
  assert.deepEqual(parse(unicode),parse(ascii));
});
test('13 real M11 sequence examples execute in the JS reference',()=>{
  for(const [source,expected] of cases) assert.equal(run(source),expected,source);
});
test('ordinary user-written H-Code can sum, map and filter arbitrary numbers',()=>{
  const sum='ƒ sum(xs:⟦Number⟧) → Number {≔ i←0;≔ total←0;while(i<⌗xs){total←total+xs⟦i⟧;i←i+1;}↩ total;}print(sum(⟦2,3,5⟧));';
  assert.equal(run(sum),'10');
  const map='ƒ twiceEach(xs:⟦Number⟧) → ⟦Number⟧ {≔ out:⟦Number⟧←⟦⟧;≔ i←0;while(i<⌗xs){out←out ⧺ ⟦xs⟦i⟧*2⟧;i←i+1;}↩ out;}≔ ys←twiceEach(⟦10,11⟧);print(ys⟦0⟧);print(ys⟦1⟧);';
  assert.equal(run(map),'20\n22');
  const filter='ƒ positives(xs:⟦Number⟧) → ⟦Number⟧ {≔ out:⟦Number⟧←⟦⟧;≔ i←0;while(i<⌗xs){if(xs⟦i⟧>0){out←out ⧺ ⟦xs⟦i⟧⟧;}i←i+1;}↩ out;}≔ ys←positives(⟦-1,2,3,-2⟧);print(⌗ys);print(ys⟦0⟧);print(ys⟦1⟧);';
  assert.equal(run(filter),'2\n2\n3');
});
test('indexes are checked and sequence concatenation is immutable',()=>{
  assert.equal(run('≔ a←⟦1⟧;≔ b←a ⧺ ⟦2⟧;print(⌗a);print(⌗b);'), '1\n2');
  for(const sample of ['print(⟦1⟧⟦-1⟧);','print(⟦1⟧⟦1⟧);','print(⟦1⟧⟦0.5⟧);','print(⟦1⟧⟦"0"⟧);']){
    assert.throws(()=>run(sample),/Sequence index out of bounds or not an integer/,sample);
  }
  assert.throws(()=>run('print(⌗1);'),/Expected sequence/);
  assert.throws(()=>run('print(⟦1⟧ ⧺ ⟦"a"⟧);'),/Sequence elements must have matching types/);
});
test('mixed type and unannotated empty sequences are not accepted silently',()=>{
  assert.throws(()=>run('≔ xs ← ⟦1,"bad"⟧;'),/Sequence elements must have matching types/);
  assert.throws(()=>run('≔ xs ← ⟦⟧;'),/Cannot infer empty sequence/);
  assert.throws(()=>run('print(⌗⟦⟧);'),/Cannot infer empty sequence/);
  assert.throws(()=>run('ƒ f() → Number ↩ ⟦⟧;print(f());'),/Cannot infer empty sequence/);
  assert.throws(()=>tokenize('print(⟦1,\u200b2⟧);'),/Forbidden control/);
});
test('nested empty sequences unify against sibling element types rather than failing prematurely',()=>{
  assert.equal(run('≔ xs←⟦⟦⟧,⟦1⟧⟧;print(⌗xs);print(⌗xs⟦0⟧);'),'2\n0');
  assert.equal(run('≔ xs:⟦⟦Number⟧⟧←⟦⟦⟧⟧;print(⌗xs);'),'1');
  assert.throws(()=>run('≔ xs←⟦⟦⟧⟧;'),/Cannot infer empty sequence/);
  assert.throws(()=>run('≔ xs←⟦⟦1⟧,⟦"bad"⟧⟧;'),/Sequence elements must have matching types/);
});
test('new symbols respect sequence allocation budgets and do not expose host JavaScript',()=>{
  assert.throws(()=>run('print(⟦1,2,3⟧);',{maxSequenceItems:2}),/Sequence allocation limit exceeded/);
  assert.throws(()=>run('≔ x←⟦1,2⟧;print(x ⧺ ⟦3⟧);',{maxSequenceItems:2}),/Sequence allocation limit exceeded/);
});
