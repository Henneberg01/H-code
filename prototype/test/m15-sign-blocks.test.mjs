import test from 'node:test';
import assert from 'node:assert/strict';
import {CORE_GLYPHS,RESERVED_USER_GLYPHS,tokenize,parse,execute,HCodeError} from '../src/hcode.mjs';

const run=source=>{
  const stdout=[];
  execute(source,{stdout:value=>stdout.push(String(value))});
  return stdout.join('\n');
};
const signs=[['⊢','if'],['⊣','else'],['⟳','while'],['⇒','=>']];

test('M15 control signs are canonical real tokens, NFKC stable and reserved',()=>{
  for(const [glyph,alias] of signs){
    assert.equal(CORE_GLYPHS[glyph],alias);
    assert.equal(RESERVED_USER_GLYPHS.has(glyph),true);
    assert.equal(glyph.normalize('NFC'),glyph);
    assert.equal(glyph.normalize('NFKC'),glyph);
    assert.deepEqual(tokenize(glyph).map(t=>t.type),tokenize(alias).map(t=>t.type));
  }
  const g='≔n←0⟳(n<3)⇒n←n+1\n⊢(n≡3)⇒print(n)⊣⇒print(0)';
  const a='let n=0;while(n<3){n=n+1;}if(n==3){print(n);}else{print(0);};';
  // There is no if-statement trailing semicolon in the grammar, so the final
  // extra ; in this accessibility example should remain a syntax error.
  assert.throws(()=>parse(a),HCodeError);
  assert.deepEqual(parse(g),parse(a.slice(0,-1)));
  assert.equal(run(g),'3');
});

test('⇒ single-statement control blocks execute with standard lexical scoping',()=>{
  assert.equal(run('⊢(⊤)⇒print(1)⊣⇒print(2)'),'1');
  assert.equal(run('⊢(⊥)⇒print(1)⊣⇒print(2)'),'2');
  assert.equal(run('if(false)=>print(1)\nelse=>print(2)'),'2');
  assert.equal(run('≔n←0⟳(n<3)⇒n←n+1\nprint(n)'),'3');
  assert.equal(run('≔n←0\n⟳(n<3){n←n+1}\nprint(n)'),'3');
  assert.equal(run('≔x←1\n⊢(⊤)⇒≔x←2\nprint(x)'),'1');
  assert.equal(run('ƒabs(n){⊢(n<0)⇒↩-n\n↩n}\nprint(abs(-5))'),'5');
  assert.equal(run('⊢(⊤)⇒⊢(⊥)⇒print(1)⊣⇒print(2)'),'2');
});

test('implicit separator works at newline, block end, EOF, and known next-statement sign',()=>{
  assert.equal(run('≔x←1≔y←2\nprint(x+y)'),'3');
  assert.equal(run('ƒtwice(x)↩x*2≔v←21\nprint(twice(v))'),'42');
  assert.equal(run('⊢(⊤){≔x←2\nprint(x)}'),'2');
  assert.equal(run('≔y←⟦10,11⟧⇢(*2)\nprint(y⟦0⟧)\nprint(y⟦1⟧)'),'20\n22');
  assert.equal(run('≔x←2+\n3\nprint(x)'),'5');
  assert.equal(run('≔x←2\n+3\nprint(x)'),'5');
  assert.equal(run('≔x←1/* comment with\nnewline */ print(x)'),'1');
  assert.equal(run('≔x←2'),'');
  assert.equal(run('print("a;b")'),'a;b');
});
test('M15 rejects ambiguous same-line boundaries and unsafe malformed glyph blocks',()=>{
  for(const source of [
    'print(1)print(2)',
    '≔x←1 x←2',
    '⊢(⊤)⇒',
    '⟳(⊤)⇒',
    '⊣⇒print(1)',
    '⊢(⊤)⇒print(1)⊣print(2)',
    '⊢(⊤)print(1)',
    '⊢(⊤)⇒print(1) print(2)',
    '≔x←1\n*',
    '⊢(⊤)⇒print(1)\u200b'
  ]){
    assert.throws(()=>parse(source),HCodeError,source);
  }
  assert.throws(()=>execute('⊢(1)⇒print(1)'),/Condition must be Boolean/);
  assert.throws(()=>execute('⟳(1)⇒print(1)'),/Condition must be Boolean/);
  assert.throws(()=>execute('⟳(⊤)⇒print(1)',{maxSteps:12}),/Execution step limit exceeded/);
});

test('old braces, semicolons, ASCII aliases and M14 closures remain equivalent',()=>{
  const full='let a=0;while(a<2){a=a+1;}if(a==2){print(a);}else{print(0);}';
  const sign='≔a←0⟳(a<2)⇒a←a+1⊢(a≡2)⇒print(a)⊣⇒print(0)';
  assert.equal(run(full),'2');
  assert.equal(run(sign),'2');
  assert.deepEqual(parse(sign),parse(full));
  assert.equal(run('print(∑(⟦-1,2,3,-2⟧⌕(>0)⇢(*2)))'),'10');
  assert.equal(run('ƒf(x)↩x+1\nprint((λn:n*2)(f(20)))'),'42');
});
