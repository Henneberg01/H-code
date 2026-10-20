import test from 'node:test';
import assert from 'node:assert/strict';
import {execute} from '../src/hcode.mjs';
function run(source){const lines=[];execute(source,{stdout:x=>lines.push(x)});return lines;}
test('typed empty JSON sequence fields can grow and shrink without losing element constraints',()=>{
 const start='≔r←⤓⦃items:⟦Number⟧⦄'+JSON.stringify('{"items":[]}')+';';
 assert.deepEqual(run(start+'≔a←r⊞items:⟦1⟧;≔empty:⟦Number⟧←⟦⟧;≔b←a⊞items:empty;print(⤒a,⤒b);'),['{"items":[1]} {"items":[]}']);
 assert.throws(()=>run(start+'≔bad←r⊞items:⟦"wrong"⟧;'),/type|mismatch/i);
 assert.throws(()=>run(start+'≔a←r⊞items:⟦1⟧;≔empty:⟦Number⟧←⟦⟧;≔b←a⊞items:empty;≔bad←b⊞items:⟦"wrong"⟧;'),/type|mismatch/i);
});
test('ordinary typed functions provide empty sequence context like package functions',()=>{
 assert.deepEqual(run('ƒ count(xs:⟦Number⟧)→Number↩⌗xs;print(count(⟦⟧));'),['0']);
 assert.deepEqual(run('ƒ take(r:⦃items:⟦Number⟧⦄)→Number↩⌗r·items;print(take(⦃items:⟦⟧⦄));'),['0']);
 assert.throws(()=>run('ƒ count(xs:⟦Number⟧)→Number↩⌗xs;count(⟦"wrong"⟧);'),/type|mismatch/i);
});
