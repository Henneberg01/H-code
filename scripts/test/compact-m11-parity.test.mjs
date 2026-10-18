import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {execute} from '../../prototype/src/hcode.mjs';
const root=fileURLToPath(new URL('../../',import.meta.url));
const manifest=JSON.parse(readFileSync(join(root,'compact/benchmarks/m11/manifest.json'),'utf8'));
const blobId=buffer=>createHash('sha1').update('blob '+buffer.length+'\0').update(buffer).digest('hex');
const size=s=>({codePoints:[...s].length,utf8Bytes:Buffer.byteLength(s,'utf8')});
function hcodeOutput(source){
 const out=[];
 execute(source,{stdout:v=>out.push(String(v))});
 return out.join('\n')+'\n';
}
test('M11 source and TypeScript program pairs are a separately frozen dataset',()=>{
 assert.equal(manifest.format,1);
 assert.equal(manifest.corpusId,'M11-SEQ-SUM-MAP-FILTER-2026-10-18-v1');
 assert.equal(manifest.pairs.length,3);
 for(const p of manifest.pairs){
  for(const [path,sha] of [[p.hcodePath,p.hcodeBlobSha],[p.typescriptPath,p.typescriptBlobSha]]){
   assert.match(path,/^compact\/benchmarks\/m11\/[a-z0-9-]+\.(hc|ts)$/);
   const source=readFileSync(join(root,path));
   assert.equal(blobId(source),sha,'Source changed: '+path+'; create a fresh dataset version');
  }
 }
});
test('M11 symbolic sum/map/filter match unpadded TypeScript stdout in Node22',()=>{
 for(const p of manifest.pairs){
  const hc=readFileSync(join(root,p.hcodePath),'utf8');
  const ts=readFileSync(join(root,p.typescriptPath),'utf8');
  const tsPath=join(root,p.typescriptPath);
  const cp=spawnSync(process.execPath,['--experimental-strip-types',tsPath],{cwd:root,encoding:'utf8',timeout:15000});
  assert.equal(cp.error,undefined,cp.error?.message);
  assert.equal(cp.status,0,cp.stderr);
  assert.equal(hcodeOutput(hc),p.expected,p.id+' H-Code');
  assert.equal(cp.stdout.replace(/\r\n/g,'\n'),p.expected,p.id+' TypeScript');
 }
});
test('do not cherry-pick: all M11 cases retain and disclose source length losses',()=>{
 for(const p of manifest.pairs){
  const hc=size(readFileSync(join(root,p.hcodePath),'utf8'));
  const ts=size(readFileSync(join(root,p.typescriptPath),'utf8'));
  assert.ok(hc.codePoints>0&&ts.codePoints>0);
  assert.ok(hc.utf8Bytes>0&&ts.utf8Bytes>0);
  assert.ok(hc.codePoints>ts.codePoints,'Retain an honest baseline loss: '+p.id);
 }
});
