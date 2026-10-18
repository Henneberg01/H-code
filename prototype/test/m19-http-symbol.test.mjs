import test from 'node:test';
import assert from 'node:assert/strict';
import {tokenize,parse,execute,CORE_GLYPHS} from '../src/hcode.mjs';

test('M19.06 HTTP core sign is intrinsic and lexically equivalent to textual fallback',()=>{
  assert.equal(CORE_GLYPHS['⤋'],'http-get');
  assert.deepEqual(tokenize('⤋"https://example.invalid"').map(x=>x.type),
    tokenize('http_get "https://example.invalid"').map(x=>x.type));
  assert.deepEqual(parse('≔r←⤋"https://example.invalid";'),
    parse('let r=http_get "https://example.invalid";'));
});
test('synchronous reference interpreter refuses async HTTP rather than faking I/O',()=>{
  assert.throws(()=>execute('print((⤋"https://example.invalid")·status);'),
    /requires asynchronous H-Code interpreter/);
});
