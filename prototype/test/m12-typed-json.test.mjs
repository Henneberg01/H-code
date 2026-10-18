import test from 'node:test';
import assert from 'node:assert/strict';
import {execute,parse,tokenize,RESERVED_USER_GLYPHS} from '../src/hcode.mjs';

const literal=text=>JSON.stringify(text); // Escape JSON text as a valid H-Code string literal.
const decode=(schema,text)=>'print(⤓'+schema+' '+literal(text)+');';
function output(source,options={}){
  const lines=[];
  execute(source,{stdout:value=>lines.push(String(value)),...options});
  return lines.join('\n')+'\n';
}

test('⤓ ⤒ and json_in json_out are identical first-class parser operators',()=>{
  for(const [glyph,alias,kind] of [
    ['⤓','json_in','json-read'],
    ['⤒','json_out','json-write']
  ]){
    assert.equal(tokenize(glyph)[0].type,kind);
    assert.equal(tokenize(alias)[0].type,kind);
    assert.equal(RESERVED_USER_GLYPHS.has(glyph),true);
  }
  const raw=literal('{"name":"Ada","age":42}');
  const glyph='≔raw←'+raw+';≔p←⤓⦃name:String,age:Number⦄raw;print(p·name);print(⤒p);';
  const ascii='let raw='+raw+';let p=json_in{name:String,age:Number}raw;print(p.name);print(json_out p);';
  assert.deepEqual(parse(glyph),parse(ascii));
  assert.equal(output(glyph),'Ada\n{"age":42,"name":"Ada"}\n');
  assert.equal(output(ascii),'Ada\n{"age":42,"name":"Ada"}\n');
});

test('native typed JSON supports nested exact records, arrays and deterministic key order',()=>{
  const scenarios=[
    [
      '≔s←'+literal('[{"v":2},{"v":3}]')+';≔xs←⤓⟦⦃v:Number⦄⟧s;print(xs⟦1⟧·v);print(⤒xs);',
      '3\n[{"v":2},{"v":3}]\n'
    ],
    [
      '≔s←'+literal('{"ok":true,"parts":[{"x":"a"}]}')+';≔p←⤓⦃parts:⟦⦃x:String⦄⟧,ok:Bool⦄s;print(p·ok);print(p·parts⟦0⟧·x);print(⤒p);',
      'true\na\n{"ok":true,"parts":[{"x":"a"}]}\n'
    ],
    ['≔p←⦃name:"Ada",age:42⦄;print(⤒p);','{"age":42,"name":"Ada"}\n'],
    [
      decode('Number','42')+decode('Bool','true')+decode('String','"hello"'),
      '42\ntrue\nhello\n'
    ],
    [
      '≔p←⤓⦃age:Number⦄'+literal('{"age":42}')+';≔q←p⊞age:p·age+1;print(⤒q);print(⤒p);',
      '{"age":43}\n{"age":42}\n'
    ],
    [
      '≔p←⤓⦃__proto__:Number,constructor:String⦄'+literal('{"__proto__":2,"constructor":"good"}')+';print(p·__proto__);print(p·constructor);',
      '2\ngood\n'
    ],
    ['≔p←⤓⦃⦄'+literal('{}')+';print(⤒p);≔xs:⟦Number⟧←⟦⟧;print(⤒xs);','{}\n[]\n']
  ];
  for(const [source,expected] of scenarios)assert.equal(output(source),expected,source);
});

test('⤓ rejects invalid scalar types, missing/extra fields and invalid JSON',()=>{
  for(const [source,reason] of [
    [decode('⦃age:Number⦄','{"age":"wrong"}'),/JSON Number type mismatch/],
    [decode('⦃age:Number⦄','{"age":42,"extra":1}'),/JSON Record shape mismatch/],
    [decode('⦃age:Number⦄','{"name":"Ada"}'),/JSON Record missing field/],
    [decode('⟦Number⟧','[1,"bad"]'),/JSON Number type mismatch/],
    [decode('Number','null'),/JSON Number type mismatch/],
    [decode('Number','1e309'),/JSON Number type mismatch/],
    [decode('Number','{bad}'),/Invalid JSON text/],
    [decode('Unit','null'),/concrete JSON-compatible type/],
    [decode('T','42'),/concrete JSON-compatible type/],
    ['print(⤓Number 42);',/expects JSON String/],
    ['print(⤒print(1));',/typed JSON-compatible data/],
    ['≔f←λx:x+1;print(⤒f);',/typed JSON-compatible data/],
    [decode('⦃data:⟦Number⟧⦄','{"data":[1,"bad"]}'),/JSON Number type mismatch/]
  ])assert.throws(()=>output(source),reason,source);
});

test('⤓ enforces a nesting limit and 1 MiB UTF-8 input size',()=>{
  let type='Number';
  for(let i=0;i<34;i++)type='⟦'+type+'⟧';
  assert.throws(()=>output(decode(type,'1')),/JSON schema nesting depth exceeded/);
  const large=JSON.stringify({name:'x'.repeat(1048577)});
  assert.throws(()=>output(decode('⦃name:String⦄',large)),/JSON input size exceeded/);
});

test('⤒ safely rejects functions/Unit and preserves __proto__ as ordinary data',()=>{
  assert.throws(()=>output('≔f←λx:x+1;print(⤒f);'),/typed JSON-compatible data/);
  assert.throws(()=>output('print(⤒print(1));'),/typed JSON-compatible data/);
  assert.equal(output('≔p←⦃__proto__:3,constructor:"value"⦄;print(⤒p);'),
    '{"__proto__":3,"constructor":"value"}\n');
});
