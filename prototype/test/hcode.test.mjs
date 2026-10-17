import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {parse,execute,tokenize,HCodeError} from '../src/hcode.mjs';
import {loadLockedPackages} from '../src/packages.mjs';
const folder=resolve('examples');
const registry=loadLockedPackages(resolve('hcode.lock.json'));
function out(source,config){const lines=[];execute(source,{registry,...config,stdout:v=>lines.push(v)});return lines;}

test('glyphs and ASCII spellings result in exactly the same AST',()=>{
 const glyphs='\u0192 add(a: Number, b: Number) \u2192 Number { \u21a9 a + b; } \u2254 n \u2190 add(2, 3); print(n);';
 const ascii='fn add(a: Number, b: Number) -> Number { return a + b; } let n = add(2, 3); print(n);';
 assert.deepEqual(parse(glyphs),parse(ascii));
 assert.deepEqual(out(glyphs),['5']);
});
test('all example files parse and execute under the M1 reference runtime',()=>{
 for(const file of readdirSync(folder).filter(f=>f.endsWith('.hc'))){
  const content=readFileSync(join(folder,file),'utf8');
  assert.doesNotThrow(()=>parse(content),`${file} syntax`);
  assert.doesNotThrow(()=>out(content),`${file} runtime`);
 }
});
test('operator canonicalization and Boolean precedence',()=>{
 assert.deepEqual(out('print(2 \u2264 3 \u2227 4 \u2260 5); print(1 \u2261 1 \u2228 \u22a5);'),['true','true']);
});
test('recursion and scopes are supported',()=>{
 assert.deepEqual(out('fn f(n){if(n <= 1){return n;} return f(n-1)+f(n-2);} print(f(7));'),['13']);
});
test('unknown variable is reported',()=>{
 assert.throws(()=>out('print(missing);'),/Unknown name missing/);
});
test('duplicate scope declaration is rejected',()=>{
 assert.throws(()=>out('let value = 1; let value = 2;'),/Duplicate name value/);
});
test('unsupported and invisible characters are rejected',()=>{
 assert.throws(()=>tokenize('let x = \u200B1;'),HCodeError);
 assert.throws(()=>out('let x = \u2295;'),/Unbound glyph/);
});
test('invalid incomplete expression is rejected',()=>{
 assert.throws(()=>parse('let x = ;'),/Expected expression/);
});
test('unclosed block and string are rejected',()=>{
 assert.throws(()=>parse('if(true) { print(1);'),/Expected \}/);
 assert.throws(()=>parse('print("abc);'),/Unterminated string/);
});
test('invalid escape sequences are rejected',()=>{
 assert.throws(()=>parse('print("hi\\q");'),/Unsupported string escape/);
});
test('type errors detected by runtime prototype',()=>{
 assert.throws(()=>out('print(2 + "3");'),/expects Numbers/);
 assert.throws(()=>out('if (7) { print(1); }'),/Condition must be Boolean/);
});
test('loop limits protect the reference interpreter from runaway input',()=>{
 assert.throws(()=>out('while (true) {}',{maxSteps:100}),/Execution step limit/);
});
test('short-circuit Boolean evaluation',()=>{
 assert.deepEqual(out('print(false and missing); print(true or missing);'),['false','true']);
});
test('left-associative arithmetic',()=>{
 assert.deepEqual(out('print(10 - 3 - 2); print(2+3*4);'),['5','14']);
});


test('every M1 implemented core glyph has the same canonical token kind as its alias',()=>{
 const pairs=[
  ['\u0192','fn'], ['\u2254','let'], ['\u21a9','return'],
  ['\u2192','->'], ['\u2190','='], ['\u22a4','true'],
  ['\u22a5','false'], ['\u2227','and'], ['\u2228','or'],
  ['\u00ac','not'], ['\u2261','=='], ['\u2260','!='],
  ['\u2264','<='], ['\u2265','>='], ['\u2237','::']
 ];
 for(const [glyph,alias] of pairs){
   const gt=tokenize(glyph)[0],at=tokenize(alias)[0];
   assert.equal(gt.type,at.type,`${glyph} vs ${alias}`);
   assert.equal(gt.value,at.value,`${glyph} vs ${alias}`);
 }
});

test('reference examples produce their specified outputs',()=>{
 const expected={
  'hello_ascii.hc':['Hello world'],
  'hello_symbols.hc':['Hello world'],
  'fibonacci.hc':['13'],
  'counter.hc':['0','1','2','3','4'],
  'boolean.hc':['allowed'],
  'conditions.hc':['low'],
  'recursion.hc':['120'],
  'logic.hc':['true','true','true'],
  'scopes.hc':['9','7'],
  'strings.hc':['H-Code'],
  'user_symbols.hc':['42','42','11','hihi','true','120']
 };
 for(const [file,wanted] of Object.entries(expected)){
  const src=readFileSync(join(folder,file),'utf8');
  assert.deepEqual(out(src),wanted,`${file} output`);
 }
});

test('explicitly missing M1 features never silently appear supported',()=>{
 assert.throws(()=>parse('let xs = [1,2,3];'),/Unexpected character/);
 assert.throws(()=>parse('symbol \u2295 as lists.add;'),/Unexpected character/);
});
