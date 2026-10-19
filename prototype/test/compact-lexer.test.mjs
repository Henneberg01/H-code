import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,cpSync,mkdirSync,readFileSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {tokenize,CORE_GLYPHS,RESERVED_USER_GLYPHS} from '../src/hcode.mjs';
import {loadLockedPackages} from '../src/packages.mjs';

const root=fileURLToPath(new URL('../../',import.meta.url));
const sha=content=>createHash('sha256').update(content).digest('hex');

test('▷ and |> are one real pipeline token in the reference lexer',()=>{
  assert.equal(CORE_GLYPHS['▷'],'|>');
  assert.equal(RESERVED_USER_GLYPHS.has('▷'),true);
  assert.equal(RESERVED_USER_GLYPHS.has('⤔'),true);
  assert.equal(CORE_GLYPHS['⤔'],'json-valid');
  for(const source of ['1 ▷ f;','1 |> f;']){
    assert.deepEqual(tokenize(source).map(t=>t.type),['number','|>','ident',';','eof']);
  }
  assert.deepEqual(tokenize('1 ▷ f;').map(t=>t.value),tokenize('1 |> f;').map(t=>t.value));
  assert.throws(()=>tokenize('1 | > f;'),/Unexpected character/);
  assert.throws(()=>tokenize('1 | f;'),/Unexpected character/);
  assert.throws(()=>tokenize('1 ▷ \u200b f;'),/Forbidden control/);
});

test('signed package manifests may not shadow the reserved pipeline glyph',()=>{
  const dir=mkdtempSync(join(tmpdir(),'hcode-cse1-lexer-'));
  try {
    mkdirSync(join(dir,'packages'),{recursive:true});
    cpSync(join(root,'packages/demo.math'),join(dir,'packages/demo.math'),{recursive:true});
    const manifestPath=join(dir,'packages/demo.math/manifest.json');
    const lockPath=join(dir,'hcode.lock.json');
    const manifest=JSON.parse(readFileSync(manifestPath,'utf8'));
    const lock=JSON.parse(readFileSync(join(root,'hcode.lock.json'),'utf8'));
    for(const glyph of ['▷','⤔']){
      manifest.operations[0].glyph=glyph;
      writeFileSync(manifestPath,JSON.stringify(manifest));
      lock.packages[0].manifestSha256=sha(readFileSync(manifestPath));
      lock.packages[0].sourceSha256=sha(readFileSync(join(dir,'packages/demo.math/lib.hc')));
      writeFileSync(lockPath,JSON.stringify(lock));
      assert.throws(()=>loadLockedPackages(lockPath),/reserved core glyph/,glyph);
    }
  } finally {rmSync(dir,{recursive:true,force:true});}
});
