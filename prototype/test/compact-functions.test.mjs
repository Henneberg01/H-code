import test from 'node:test';
import assert from 'node:assert/strict';
import {parse,execute} from '../src/hcode.mjs';

function output(source){
  const lines=[];
  execute(source,{stdout:value=>lines.push(String(value))});
  return lines.join('\n');
}

test('short Unicode and ASCII function bodies lower to the existing Return AST',()=>{
  const glyph='ƒ square(n: Number) → Number ↩ n*n;';
  const ascii='fn square(n: Number) -> Number return n*n;';
  const block='fn square(n: Number) -> Number { return n*n; }';
  assert.deepEqual(parse(glyph),parse(ascii));
  assert.deepEqual(parse(glyph),parse(block));
  assert.equal(output(glyph+' print(square(5));'),'25');
  assert.equal(output(ascii+' print(square(5));'),'25');
});

test('unannotated functions, calls and legacy brace bodies still execute',()=>{
  assert.equal(output('ƒ double(n) ↩ n*2; print(double(21));'),'42');
  assert.equal(output('fn double(n) return n*2; print(double(21));'),'42');
  assert.equal(output('fn twice(n) { return n*2; } print(twice(21));'),'42');
  assert.equal(output('fn factorial(n){if(n<=1){return 1;}return n*factorial(n-1);} print(factorial(5));'),'120');
});

test('compact functions reject malformed signatures and missing semicolons',()=>{
  assert.throws(()=>parse('ƒ f() ↩ 1'),/Expected ;/);
  assert.throws(()=>parse('ƒ f() → ↩ 1;'),/Expected ident/);
  assert.throws(()=>parse('ƒ f() 1;'),/Expected return/);
  assert.throws(()=>parse('fn f(x) return ;'),/Expected expression/);
});
