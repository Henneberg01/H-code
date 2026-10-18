import test from 'node:test';
import assert from 'node:assert/strict';
import {execute} from '../src/hcode.mjs';

test('record field filter + map lambda with generic sequence semantics',()=>{
 const lines=[];
 execute('≔rs←⟦⦃name:"A",t:1⦄,⦃name:"B",t:0⦄⟧;print(⤒(rs⌕λe:e·t>0));print(⤒(rs⇢λe:e·name));',
   {stdout:x=>lines.push(x)});
 assert.deepEqual(lines,['[{"name":"A","t":1}]','["A","B"]']);
});
test('runtime lambda body cannot launch forbidden HTTP effects',()=>{
 let called=0;
 assert.throws(()=>execute('≔xs←⟦⦃url:"https://example.invalid"⦄⟧;print(⌗(xs⌕λe:(⤋e·url)·ok));',{
   httpGet:()=>{called++;throw Error('unexpected host egress');}
 }),/effect|asynchronous H-Code interpreter/);
 assert.equal(called,0);
});
