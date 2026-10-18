import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {parse,linkProgram,execute} from '../src/hcode.mjs';
import {loadLockedPackages} from '../src/packages.mjs';

const root=fileURLToPath(new URL('../../',import.meta.url));
const fixture=id=>readFileSync(root+'compact/fixtures/'+id,'utf8');
const manifest=JSON.parse(fixture('manifest.json'));
const registry=loadLockedPackages(root+'hcode.lock.json');
const run=(source,reg)=>{
  const lines=[];
  execute(source,{registry:reg,stdout:value=>lines.push(String(value))});
  return lines.join('\n')+'\n';
};
const canonical=source=>JSON.stringify(linkProgram(parse(source),registry),(k,v)=>k==='line'||k==='column'?undefined:v);
test('all seven CSE-1 sign/ASCII fixture pairs match canonical AST and output',()=>{
  assert.equal(manifest.format,1);
  assert.equal(manifest.pairs.length,7);
  for(const item of manifest.pairs){
    const glyph=fixture(item.id+'.glyph.hc'),ascii=fixture(item.id+'.ascii.hc');
    assert.equal(canonical(glyph),canonical(ascii),item.id+' AST');
    const reg=item.locked?registry:new Map();
    assert.equal(run(glyph,reg),item.output,item.id+' glyph');
    assert.equal(run(ascii,reg),item.output,item.id+' ASCII');
  }
});
