import test from 'node:test';
import assert from 'node:assert/strict';
import {CORE_GLYPHS, RESERVED_USER_GLYPHS, execute, parse} from '../src/hcode.mjs';

test('assertion sign and accessible alias have the same semantics', () => {
  assert.equal(CORE_GLYPHS['⊨'], 'assert');
  assert.ok(RESERVED_USER_GLYPHS.has('⊨'));
  assert.deepEqual(parse('⊨(⊤);'), parse('assert(true);'));
  for (const source of ['⊨(⊤);', 'assert(true);']) {
    assert.equal(execute(source).assertions, 1);
  }
});

test('assertion returns Unit and only counts executed assertions', () => {
  const output = [];
  const result = execute('⊢(⊥)⇒⊨(⊥);⎙(⊨(2+2≡4));', {stdout: value => output.push(value)});
  assert.equal(result.assertions, 1);
  assert.deepEqual(output, ['none']);
});

test('false assertions stop execution rather than printing a passing result', () => {
  const output = [];
  assert.throws(() => execute('⊨(⊥);⎙("unreachable");', {stdout: value => output.push(value)}), /JFH-CODE assertion failed/);
  assert.deepEqual(output, []);
});

test('assertions require exactly one Bool without truthiness coercion', () => {
  for (const source of ['⊨(1)', 'assert("true")', '⊨()', '⊨(⊤,⊤)', '⊨(⟦⊤⟧)']) {
    assert.throws(() => execute(source), /assert.*one Bool/);
  }
});

test('assertion aliases work as values and respect lexical shadowing', () => {
  const output = [];
  const result = execute('≔verify←⊨;verify(⊤);ƒ apply(f){↩f(⊤);}apply(⊨);ƒ wrapped(){ƒ assert(x)↩x+1;↩assert(41);}⎙(wrapped());', {stdout: value => output.push(value)});
  assert.equal(result.assertions, 2);
  assert.deepEqual(output, ['42']);
});

test('indirect assertions remain forbidden in runtime-enforced pure callbacks', () => {
  for (const source of [
    'ƒ key(x){⊨(x>0);↩x;}⎙(⟦1,2⟧↧key);',
    '≔verify←⊨;ƒ key(x){verify(x>0);↩x;}⎙(⟦1,2⟧↧key);',
  ]) {
    assert.throws(() => execute(source), /Assertion effect denied in pure callback/);
  }
});

test('computed callees and reassigned assertion aliases keep ordinary evaluation semantics', () => {
  assert.throws(() => execute('ƒ factory(){⊨(⊥);↩⊨;}factory()(⊤);'), /JFH-CODE assertion failed/);
  for (const source of [
    'ƒ noop(x){}≔verify←⊨;verify←noop;verify(⊥);',
    'ƒ noop(x){}ƒ wrapped(){≔assert←⊨;assert←noop;assert(⊥);}wrapped();',
  ]) {
    assert.equal(execute(source).assertions, 0);
  }
});
