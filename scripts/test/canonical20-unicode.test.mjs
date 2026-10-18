import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {execute} from '../../prototype/src/hcode.mjs';
import {FROZEN} from '../canonical20-verify-03.mjs';

test('all original and new canonical task03 sources are Git blob SHA-locked',()=>{
  for(const [key,[path,expected]] of Object.entries(FROZEN)){
    const bytes=readFileSync(new URL('../../'+path,import.meta.url));
    const sha=createHash('sha1').update('blob '+bytes.length+'\0').update(bytes).digest('hex');
    assert.equal(sha,expected,key+' source SHA drift');
  }
  assert.equal(FROZEN.registry[1],'46653ef90ffb3e420fba4ddfbfac3c4cfd57f3b3');
});
test('full developer-authored Unicode program is shorter and its ten outputs match the unchanged acceptance',()=>{
  const hc=readFileSync(new URL('../../'+FROZEN.hc[0],import.meta.url),'utf8');
  const ts=readFileSync(new URL('../../'+FROZEN.ts[0],import.meta.url),'utf8');
  const fixture=JSON.parse(readFileSync(new URL('../../'+FROZEN.fixture[0],import.meta.url),'utf8'));
  assert.equal(fixture.id,'03-text-frequency-counter');
  assert.equal(fixture.acceptance,'normalize and count tokens; deterministic frequency ordering including Unicode cases');
  assert.equal(fixture.positives.length,10);
  assert.equal(fixture.negatives.length,6);
  assert.equal([...hc].length,437);
  assert.equal([...ts].length,1541);
  assert.equal(Buffer.byteLength(hc,'utf8'),499);
  assert.equal(Buffer.byteLength(ts,'utf8'),1592);
  const output=[];
  execute(hc,{stdout:value=>output.push(String(value))});
  assert.equal(output.join('\n')+'\n',fixture.positives.map(x=>x.expected).join('\n')+'\n');
  assert.equal(Number((100*(1-437/1541)).toFixed(2)),71.64);
  assert.equal(Number((100*(1-499/1592)).toFixed(2)),68.66);
});
