import test from 'node:test';
import assert from 'node:assert/strict';
import {execute,tokenize,CORE_GLYPHS,RESERVED_USER_GLYPHS} from '../src/hcode.mjs';
import {safeArithmetic,ArithmeticInputError} from '../src/arithmetic-pure.mjs';

function output(source,input){
 const lines=[];
 execute(source,{stdout:x=>lines.push(String(x)),readStdin:input===undefined?undefined:()=>input});
 return lines.join('\n')+(lines.length?'\n':'');
}
test('stdin and arithmetic glyphs are genuine core syntax with ASCII accessibility',()=>{
 for(const [glyph,word,kind] of [['⌨','stdin_text','stdin-text'],['⩚','arith_eval','arith-eval']]){
  assert.equal(CORE_GLYPHS[glyph],kind);
  assert.equal(RESERVED_USER_GLYPHS.has(glyph),true);
  assert.equal(tokenize(glyph)[0].type,kind);
  assert.equal(tokenize(word)[0].type,kind);
 }
 assert.equal(output('print(⩚⌨);','(2+3)*4\n'),'20\n');
 assert.equal(output('print(arith_eval stdin_text);','2+3*4'),'14\n');
});
test('general parser has precedence, exponent numbers, grouping and unary signs',()=>{
 const valid=[['2+3*4',14],['(2+3)*4',20],['1e2/4',25],['2+-3',-1],
  ['-.5 * 8',-4],['8/4/2',1],['0.1+0.2',0.30000000000000004]];
 for(const [source,result] of valid)assert.equal(safeArithmetic(source),result,source);
});
test('invalid source fails closed, including division zero, malformed syntax and oversize',()=>{
 for(const s of ['2^3','1++','', '()','3/0','8/(-0)','1.5e309','a+1','(2+3']){
  assert.throws(()=>safeArithmetic(s),ArithmeticInputError);
 }
 assert.throws(()=>safeArithmetic('1'.repeat(65537)),/64 KiB/);
 assert.throws(()=>output('print(⩚⌨);'),/stdin capability denied/);
 assert.throws(()=>output('print(⩚42);'),/String/);
});
test('stdin must be consumed at most once and is explicit host authority',()=>{
 assert.throws(()=>output('print(⌨);print(⌨);','1+2'),/stdin already consumed/);
 assert.equal(output('print(⩚"2+3");'),'5\n');
});
