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
  assert.equal(manifest.pairs.length,2);
  for(const pair of manifest.pairs){
    const hc=readFileSync(join(dir,pair.id+'.hc'),'utf8');
    const ts=readFileSync(join(dir,pair.id+'.ts'),'utf8');
    assert.ok(hc.includes('print('),pair.id);
    assert.ok(ts.includes('console.log('),pair.id);
    assert.equal(pair.expected,'42\n');
  }
});
