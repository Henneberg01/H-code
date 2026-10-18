import test from 'node:test';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {parse,execute,linkProgram} from '../src/hcode.mjs';
import {loadLockedPackages} from '../src/packages.mjs';

const root=fileURLToPath(new URL('../../',import.meta.url));
const locked=loadLockedPackages(root+'hcode.lock.json');
const out=(source,registry=new Map())=>{
  const lines=[];
  execute(source,{registry,stdout:value=>lines.push(String(value))});
  return lines.join('\n');
};

test('pipeline ▷ / |> lowers to the existing Call AST, left to right',()=>{
  const f='ƒ double(x) ↩ x*2;';
  const a=f+' print(21 ▷ double);';
  const b='fn double(x) return x*2; print(21 |> double);';
  const c=f+' print(double(21));';
  assert.deepEqual(parse(a),parse(b));
  assert.deepEqual(parse(a),parse(c));
  assert.equal(out(a),'42');
  assert.equal(out(b),'42');
  assert.equal(out('ƒ inc(x) ↩ x+1; ƒ double(x) ↩ x*2; print(20 ▷ inc ▷ double);'),'42');
});

test('pipeline prepends arguments and uses locked package operations',()=>{
  const prefix='ƒ add(a: Number,b: Number) → Number ↩ a+b;';
  assert.equal(out(prefix+' print(20 ▷ add(22));'),'42');
  const glyph='use "demo.math@1.0.0" as math; print(20 ▷ math∷⊕(22));';
  const ascii='use "demo.math@1.0.0" as math; print(20 |> math::add(22));';
  assert.equal(out(glyph,locked),'42');
  assert.equal(out(ascii,locked),'42');
  const scrub=source=>JSON.stringify(linkProgram(parse(source),locked),(k,v)=>k==='line'||k==='column'?undefined:v);
  assert.equal(scrub(glyph),scrub(ascii));
});

test('pipeline has low precedence and evaluates the input only once',()=>{
  assert.equal(out('ƒ double(x) ↩ x*2; print(1+20 ▷ double);'),'42');
  assert.equal(out('ƒ double(x) ↩ x*2; print((1 ▷ double)+20);'),'22');
  const source='ƒ next() → Number {print(1);↩ 21;} ƒ twice(x) ↩ x*2; print(next() ▷ twice);';
  assert.equal(out(source),'1\n42');
  const chain='ƒ next() → Number {print(1);↩ 20;} ƒ inc(x) ↩ x+1; ƒ twice(x) ↩ x*2; print(next() ▷ inc ▷ twice);';
  assert.equal(out(chain),'1\n42');
});

test('pipeline rejects ambiguous right hand expressions and bad targets',()=>{
  const bad=[
    'print(1 ▷ 2);',
    'print(1 ▷ double + 1);',
    'print(1 ▷ double and true);',
    'print(1 |>);',
    'print(1 | > double);'
  ];
  for(const source of bad)assert.throws(()=>parse(source),{name:'HCodeError'},source);
  assert.throws(()=>parse('print(1 ▷ f + 2);'),/Parenthesize pipeline/);
  // First-class grouped functions and sign sections are now valid pipeline targets.
  assert.equal(out('ƒ double(x) ↩ x*2; print(21 ▷ (double));'),'42');
  assert.equal(out('print(21 ▷ (*2));'),'42');
  assert.throws(()=>out('print(21 ▷ (2));'),/not callable/);
});

test('callability, package arity, and unknown operations are not silently accepted',()=>{
  assert.throws(()=>out('≔ f ← 2; print(1 ▷ f);'),/not callable/);
  assert.throws(()=>out('use "demo.math@1.0.0" as math; print(1 ▷ math∷⊕(2,3));',locked),/expects 2 argument/);
  assert.throws(()=>out('print(1 ▷ ⊕(2));'),/Unbound glyph/);
});
