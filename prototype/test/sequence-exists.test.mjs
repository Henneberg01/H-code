import test from 'node:test';
import assert from 'node:assert/strict';
import {execute,parse,tokenize,RESERVED_USER_GLYPHS} from '../src/hcode.mjs';
import {validatePurePackageV2} from '../src/package-v2-types.mjs';
const run=source=>{const lines=[];execute(source,{stdout:line=>lines.push(String(line))});return lines;};
test('existential glyph and ASCII alias execute generic predicates on typed data',()=>{
 const source='≔empty:⟦Number⟧←⟦⟧;⎙(empty∃λn:n>0);⎙(⟦1,2,3⟧∃(>2));⎙(⟦"a","b"⟧∃λs:s≡"b");⎙(⟦⦃done:⊥⦄,⦃done:⊤⦄⟧∃λr:r·done);';
 assert.deepEqual(run(source),['false','true','true','true']);
 assert.deepEqual(run(source.replaceAll('∃','@!')),run(source));
 assert.deepEqual(tokenize('xs∃f').map(t=>t.type),tokenize('xs@!f').map(t=>t.type));
 assert.equal(RESERVED_USER_GLYPHS.has('∃'),true);
});
test('existential search evaluates input and callback expression once and short circuits',()=>{
 const source='≔calls←0;≔visits←0;ƒ values()→⟦Number⟧{calls←calls+1;↩⟦1,2,3⟧}ƒ found(n:Number)→Bool{visits←visits+1;↩n≡2}⎙(values()∃found);⎙(calls);⎙(visits);⎙(⟦0,1⟧∃λn:n≡0∨1/n>0);';
 assert.deepEqual(run(source),['true','1','2','true']);
 assert.deepEqual(run('⎙(⟦1,2,3⟧∃λn:n>5);'),['false']);
});
test('existential runtime rejects invalid sequences, nonfunctions and nonboolean results',()=>{
 for(const source of ['1∃λx:⊤;','⟦1⟧∃λx:x+1;','⟦1⟧∃42;','⟦⟧∃λx:⊤;','⟦⟧∃(>0);','ƒ positive(n:Number)→Bool↩n>0;⟦⟧∃positive;'])assert.throws(()=>run(source),undefined,source);
});
test('pure package contracts statically check existential callback types and Bool results',()=>{
 const manifest={operations:[]};
 assert.equal(validatePurePackageV2(parse('ƒ has(xs:⟦Number⟧)→Bool↩xs∃(>0);'),manifest),true);
 for(const source of ['ƒ has(xs:⟦Number⟧)→Bool↩xs∃λx:x+1;',
  'ƒ has(xs:⟦Number⟧)→Number↩xs∃(>0);',
  'ƒ wrong(x:String)→Bool↩⊤;ƒ has(xs:⟦Number⟧)→Bool↩xs∃wrong;'])
  assert.throws(()=>validatePurePackageV2(parse(source),manifest));
});
test('predicate factory is evaluated once and a composed predicate is supported',()=>{
 const source='≔factories←0;ƒ found(n:Number)→Bool↩n>1;ƒ choose(){factories←factories+1;↩found}⎙(⟦1,2,3⟧∃choose());⎙(factories);ƒ twice(n:Number)→Number↩n*2;⎙(⟦1,2⟧∃(found∘twice));';
 assert.deepEqual(run(source),['true','1','true']);
});
