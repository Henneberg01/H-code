import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
const root=fileURLToPath(new URL('../../',import.meta.url));
test('TS comparison sources are explicit and not artificially bloated baseline fixtures',()=>{
  const dir=join(root,'compact/benchmarks/paired');
  const manifest=JSON.parse(readFileSync(join(dir,'manifest.json'),'utf8'));
  assert.equal(manifest.version,1);
  assert.equal(manifest.pairs.length,8);
  for(const pair of manifest.pairs){
    const hc=readFileSync(join(dir,pair.id+'.hc'),'utf8');
    const ts=readFileSync(join(dir,pair.id+'.ts'),'utf8');
    assert.ok(hc.includes('print('),pair.id);
    assert.ok(ts.includes('console.log('),pair.id);
    assert.ok(typeof pair.expected==='string' && pair.expected.endsWith('\n'));
    assert.ok(!/^\s*$/.test(pair.expected));
  }
});

test('eight-case corpus includes code-size regressions rather than only wins',()=>{
  const dir=join(root,'compact/benchmarks/paired');
  const manifest=JSON.parse(readFileSync(join(dir,'manifest.json'),'utf8'));
  const scores=manifest.pairs.map(pair=>{
    const hc=readFileSync(join(dir,pair.id+'.hc'),'utf8');
    const ts=readFileSync(join(dir,pair.id+'.ts'),'utf8');
    return {id:pair.id,reduction:100*(1-[...hc].length/[...ts].length)};
  });
  assert.ok(scores.some(s=>s.reduction<0),'must retain H-Code code-size losses');
  assert.ok(scores.some(s=>s.reduction>0),'must retain gains too');
  assert.ok(scores.some(s=>s.id==='counter-loop'));
  assert.ok(scores.some(s=>s.id==='recursive-fibonacci'));
});
