import test from 'node:test';
import assert from 'node:assert/strict';
import {execute,parse,tokenize,RESERVED_USER_GLYPHS} from '../src/hcode.mjs';

function run(source) {
  const lines=[];
  execute(source,{stdout:value=>lines.push(String(value))});
  return lines.join('\n')+'\n';
}

test('symbolic and ASCII record expressions have the exact same parsed semantics',()=>{
  const glyph='≔x←⦃name:"Ada",age:42⦄;print(x·age);';
  const ascii='let x={name:"Ada",age:42};print(x.age);';
  assert.deepEqual(parse(glyph),parse(ascii));
  assert.equal(run(glyph),'42\n');
  assert.equal(run(ascii),'42\n');
  assert.equal(tokenize('⦃')[0].type,'record-open');
  assert.equal(tokenize('⦄')[0].type,'record-close');
  assert.equal(tokenize('·')[0].type,'field');
  for(const glyph of ['⦃','⦄','·'])assert.equal(RESERVED_USER_GLYPHS.has(glyph),true);
});

test('real immutable records support nested fields, sequences and typed function parameters',()=>{
  const examples=[
    ['≔x←⦃inner:⦃n:42⦄,list:⟦1,2⟧⦄;print(x·inner·n);print(x·list⟦1⟧);','42\n2\n'],
    ['≔x:⦃age:Number,name:String⦄←⦃name:"Ada",age:42⦄;print(x·name);print(x·age);','Ada\n42\n'],
    ['ƒ get(r:⦃age:Number,name:String⦄)→Number ↩ r·age;print(get(⦃age:42,name:"Ada"⦄));','42\n'],
    ['ƒ get(r:{age:Number}) -> Number return r.age;print(get({age:42}));','42\n'],
    ['≔x←⦃constructor:1,__proto__:2⦄;print(x·constructor);print(x·__proto__);','1\n2\n'],
    ['≔x:⦃⦄←⦃⦄;print(⊤);','true\n'],
    ['≔xs←⟦⦃v:1⦄,⦃v:2⦄⟧;print(xs⟦1⟧·v);','2\n'],
    ['≔x:⦃inner:⦃n:Number⦄,items:⟦String⟧⦄←⦃inner:⦃n:5⦄,items:⟦"a"⟧⦄;print(x·inner·n);','5\n']
  ];
  for(const [source,expected] of examples)assert.equal(run(source),expected,source);
});

test('duplicate, missing and unsafe fields fail closed instead of consulting the JS prototype',()=>{
  for(const source of [
    '≔x←⦃a:1,a:2⦄;',
    '≔x←{a:1,a:2};',
    '≔x:⦃a:Number,a:String⦄←⦃a:1⦄;',
    '≔x←⦃a:1⦄;print(x·missing);',
    '≔x←⦃a:1⦄;print(x·toString);',
    'print(42·age);',
    '≔x:⦃a:Number⦄←⦃a:"wrong"⦄;',
    '≔x:⦃a:Number⦄←⦃b:1⦄;',
    '≔x:⦃a:Number⦄←⦃a:1,b:2⦄;',
    '≔x←⟦⦃a:1⦄,⦃a:"wrong"⦄⟧;',
    'ƒ get(x:⦃a:Number⦄)→Number ↩ x·a;print(get(⦃a:"wrong"⦄));',
    'ƒ get(x:⦃a:Number⦄)→Number ↩ x·a;print(get(⦃b:1⦄));'
  ])assert.throws(()=>run(source),undefined,source);
});

test('record annotations are checked on assignment and on returned nested values',()=>{
  assert.equal(run('≔x:⦃n:Number⦄←⦃n:3⦄;x←⦃n:4⦄;print(x·n);'),'4\n');
  assert.throws(()=>run('≔x:⦃n:Number⦄←⦃n:3⦄;x←⦃n:"bad"⦄;'),/Annotated type mismatch/);
  assert.throws(()=>run('ƒ f()→⦃n:Number⦄ ↩ ⦃n:"bad"⦄;print(f()·n);'),/return expects/);
});
