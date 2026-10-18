import test from 'node:test';
import assert from 'node:assert/strict';
import {tokenize,parse,execute,CORE_GLYPHS} from '../src/hcode.mjs';
import {readMarkdownTokens} from '../src/markdown-reference.mjs';

test('≋ Unicode sign and markdown_tokens alias parse identically',()=>{
 assert.equal(CORE_GLYPHS['≋'],'markdown-tokens');
 assert.deepEqual(parse('print(⤒(≋"# T"));'),parse('print(⤒(markdown_tokens("# T")));'));
 const out=[];
 execute('print(⤒(≋"# Hello\n[Docs](https://example.com)"));',{stdout:x=>out.push(x)});
 assert.deepEqual(JSON.parse(out[0]),[
  {href:'',kind:'heading',level:1,text:'Hello'},
  {href:'https://example.com',kind:'link',level:0,text:'Docs'}
 ]);
});
test('pure Markdown extractor rejects bad Unicode and oversized inputs',()=>{
 assert.throws(()=>readMarkdownTokens(5),/String/);
 assert.throws(()=>readMarkdownTokens('\ud800'),/Unicode surrogate/);
 assert.throws(()=>readMarkdownTokens('a'.repeat(1048577)),/exceeds 1 MiB/);
 assert.throws(()=>readMarkdownTokens('# x\n'.repeat(9000)),/8192 lines/);
});
test('no hidden URLs fetched or HTML execution; fences and indented code are excluded',()=>{
 const events=readMarkdownTokens('~~~md\n# false\n[evil](javascript:alert(1))\n~~~\n## Real\n[plain](javascript:alert(1))\n    [ignored](https://evil.test)\n');
 assert.deepEqual(events.map(x=>x.kind),['heading','link']);
 assert.equal(events[1].href,'javascript:alert(1)');
});
