import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execute,parse,tokenize,CORE_GLYPHS,RESERVED_USER_GLYPHS} from '../src/hcode.mjs';

const cases=JSON.parse(readFileSync(new URL('../../compact/canonical20/cases/03-text-frequency-counter.json',import.meta.url),'utf8'));
function output(code){
  const lines=[];execute(code,{stdout:value=>lines.push(String(value))});
  return lines.join('\n')+'\n';
}
const wordFrequency=s=>'print(⤒(⧉(⟟'+JSON.stringify(s)+')));';

test('⫶ ⟟ ⧉ are first-class lexical and AST signs with accessible ASCII aliases',()=>{
  for(const [glyph,alias,kind] of [
    ['⫶','text_scalars','text-scalars'],
    ['⟟','text_words','text-words'],
    ['⧉','text_hist','histogram'],
  ]){
    assert.equal(CORE_GLYPHS[glyph],kind);
    assert.equal(RESERVED_USER_GLYPHS.has(glyph),true);
    assert.equal(tokenize(glyph)[0].type,kind);
    assert.equal(tokenize(alias)[0].type,kind);
  }
  assert.deepEqual(parse('print(⤒(⧉(⟟"Hello HELLO")));'),
    parse('print(json_out(text_hist(text_words"Hello HELLO")));'));
  assert.deepEqual(parse('print(⤒(⧉(⫶"AaA")));'),
    parse('print(json_out(text_hist(text_scalars"AaA")));'));
});

test('all ten fixed pre-registered Unicode cases match exact independent output fixtures',()=>{
  assert.equal(cases.id,'03-text-frequency-counter');
  assert.equal(cases.positives.length,10);
  for(const x of cases.positives){
    assert.equal(output(wordFrequency(x.input)),x.expected+'\n',x.id);
  }
});

test('histogram is a general typed primitive across strings, finite numbers and Booleans',()=>{
  assert.equal(output('print(⤒(⧉⟦3,-2,3,0⟧));'),
    '[{"count":1,"value":-2},{"count":1,"value":0},{"count":2,"value":3}]\n');
  assert.equal(output('print(⤒(⧉⟦⊤,⊥,⊤⟧));'),
    '[{"count":1,"value":false},{"count":2,"value":true}]\n');
  assert.equal(output('print(⤒(⧉⟦"__proto__","constructor","__proto__"⟧));'),
    '[{"count":2,"value":"__proto__"},{"count":1,"value":"constructor"}]\n');
  assert.equal(output('≔xs:⟦String⟧←⟦⟧;print(⤒(⧉xs));'),'[]\n');
});

test('⫶ preserves complete Unicode scalars, including astral characters',()=>{
  assert.equal(output('print(⤒(⫶"a🙂字"));'),'["a","🙂","字"]\n');
  assert.equal(output('print(⤒(⧉(⫶"🦊a🦊")));'),
    '[{"count":1,"value":"a"},{"count":2,"value":"🦊"}]\n');
});

test('invalid scalar/record/heterogeneous histograms and non-String tokenizers reject input',()=>{
  assert.equal(cases.negatives.length,6);
  for(const x of cases.negatives)assert.throws(()=>output(x.source),undefined,x.id);
  assert.throws(()=>output('print(⧉⟦⟦1⟧⟧);'));
  assert.throws(()=>output('print(⫶"\uD800");'),/Unpaired/);
});

test('Unicode tokenizer enforces 16384-token allocation limit',()=>{
  const tooMany='a '.repeat(16385);
  assert.throws(()=>output(wordFrequency(tooMany)),/Sequence allocation limit exceeded/);
});
