import test from 'node:test';
import assert from 'node:assert/strict';
import {execute,parse,RESERVED_USER_GLYPHS} from '../src/hcode.mjs';
const tag='5bdcc146bf60754e6a042426089575c75a003f089d2739839dec58b964ec3843';
function run(source){const lines=[];execute(source,{stdout:x=>lines.push(String(x))});return lines;}
test('generic MAC signs and ASCII aliases implement RFC4231 independently',()=>{
 for(const [sign,verify] of [['✍','✓'],['hmac_sign','hmac_verify']]){
  assert.deepEqual(run(`⎙(${sign}("Jefe","what do ya want for nothing?"));⎙(${verify}("Jefe","what do ya want for nothing?","${tag}"));`),[tag,'true']);
 }
 assert.ok(RESERVED_USER_GLYPHS.has('✍'));assert.ok(RESERVED_USER_GLYPHS.has('✓'));
});
test('wrong key/message, tampered, short, long and uppercase tags never verify',()=>{
 for(const t of ['',tag.toUpperCase(),tag.slice(2),tag+'00','0'+tag.slice(1),tag.slice(0,-1)+'0','z'.repeat(64)])assert.deepEqual(run(`⎙(✓("Jefe","what do ya want for nothing?","${t}"));`),['false']);
 assert.deepEqual(run(`⎙(✓("wrong","what do ya want for nothing?","${tag}"));⎙(✓("Jefe","changed","${tag}"));`),['false','false']);
});
test('MAC arguments have exact arity and String contracts',()=>{
 for(const source of ['✍(1,"data");','✓("key","data",1);','✍("key",⊤);'])assert.throws(()=>run(source),/String|HMAC/);
 for(const source of ['✍("key");','✓("key","data");','✍("key","data","extra");'])assert.throws(()=>parse(source));
});
test('UTF8 MAC byte bounds reject oversized keys and messages',()=>{
 for(const [key,data] of [['k'.repeat(4097),'data'],['key','ø'.repeat(32769)]])assert.throws(()=>run(`✍("${key}","${data}");`),/HMAC/);
 assert.deepEqual(run(`⎙(⌗(⫶✍("${'k'.repeat(4096)}","${'ø'.repeat(32768)}")));`),['64']);
});

test('pure package validation admits MAC computation while retaining operand type checks',async()=>{
 const {validatePurePackageV2}=await import('../src/package-v2-types.mjs');
 assert.doesNotThrow(()=>validatePurePackageV2(parse('ƒ sign(k:String,m:String)→String↩✍(k,m);'),{operations:[]}));
 assert.throws(()=>validatePurePackageV2(parse('ƒ sign(k:Number,m:String)→String↩✍(k,m);'),{operations:[]}),/HMAC key/);
});
test('the reference crypto adapter rejects malformed Unicode key/message text',async()=>{
 const {signMAC,verifyMAC}=await import('../src/hmac-reference.mjs');
 assert.throws(()=>signMAC('\ud800','message'),/HMAC/);
 assert.throws(()=>signMAC('key','\udc00'),/HMAC/);
 assert.equal(verifyMAC('key','message','\ud800'),false);
 assert.notEqual(signMAC('key','é'),signMAC('key','e\u0301'));
});
