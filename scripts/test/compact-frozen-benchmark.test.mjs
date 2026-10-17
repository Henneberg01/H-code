import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../../',import.meta.url));
const baseline=JSON.parse(readFileSync(join(root,'compact/results/frozen-baseline-m10-eight.json'),'utf8'));
const gitBlobSha=bytes=>createHash('sha1').update('blob '+bytes.length+'\0').update(bytes).digest('hex');
test('benchmark source is immutable unless a fresh corpus version is declared',()=>{
  assert.equal(baseline.id,'M10-EIGHT-2026-10-18-v1');
  assert.equal(baseline.pairs.length,8);
  for(const pair of baseline.pairs){
    for(const [path,sha] of [[pair.hcodePath,pair.hcodeBlobSha],[pair.tsPath,pair.tsBlobSha]]){
      assert.match(path,/^compact\/benchmarks\/paired\/[a-z0-9-]+\.(hc|ts)$/);
      assert.match(sha,/^[a-f0-9]{40}$/);
      assert.equal(gitBlobSha(readFileSync(join(root,path))),sha,path+' changed; create new version instead');
    }
  }
});
