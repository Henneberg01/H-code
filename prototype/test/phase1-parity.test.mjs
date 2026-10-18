import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {parse,linkProgram,execute,tokenize} from '../src/hcode.mjs';
import {loadLockedPackages} from '../src/packages.mjs';

const root=fileURLToPath(new URL('../../',import.meta.url));
const dir=join(root,'phase1','fixtures');
const manifest=JSON.parse(readFileSync(join(dir,'manifest.json'),'utf8'));
const ids=['functions','booleans','recursion','package'];
const noLocations=(value)=>Array.isArray(value)?value.map(noLocations):value&&typeof value==='object'
  ?Object.fromEntries(Object.entries(value).filter(([k])=>!['line','column'].includes(k)).map(([k,v])=>[k,noLocations(v)]))
  :value;

test('phase1 fixture manifest defines four canonical symbol/ASCII pairs',()=>{
  assert.equal(manifest.format,1);
  assert.deepEqual(manifest.pairs.map(x=>x.id),ids);
  for(const pair of manifest.pairs){
    assert.equal(typeof pair.output,'string');
    assert.equal(typeof pair.lock,'boolean');
    assert.match(pair.id,/^[a-z]+$/);
  }
});

for(const pair of manifest.pairs){
  test('real H-Code symbols and ASCII are semantically identical: '+pair.id,()=>{
    const glyph=readFileSync(join(dir,pair.id+'.glyph.hc'),'utf8');
    const ascii=readFileSync(join(dir,pair.id+'.ascii.hc'),'utf8');
    const registry=pair.lock?loadLockedPackages(join(root,'hcode.lock.json')):new Map();
    const symbolProgram=linkProgram(parse(glyph),registry);
    const aliasProgram=linkProgram(parse(ascii),registry);
    assert.deepEqual(noLocations(symbolProgram),noLocations(aliasProgram));
    if(!pair.lock){
      const semanticTokens=s=>tokenize(s).map(t=>[t.type,t.value]);
      assert.deepEqual(semanticTokens(glyph),semanticTokens(ascii));
    }
    const outputOf=(src)=>{
      const lines=[];
      execute(src,{registry,stdout:s=>lines.push(String(s))});
      return lines.length?lines.join('\n')+'\n':'';
    };
    assert.equal(outputOf(glyph),pair.output);
    assert.equal(outputOf(ascii),pair.output);
  });
}
