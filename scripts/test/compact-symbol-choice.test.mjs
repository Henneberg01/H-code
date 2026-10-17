import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {execute} from '../../prototype/src/hcode.mjs';
const root=fileURLToPath(new URL('../../',import.meta.url));
const baseline=JSON.parse(readFileSync(join(root,'compact/benchmarks/symbol-choice/manifest.json'),'utf8'));
const gitBlob=content=>createHash('sha1').update('blob '+content.length+'\0').update(content).digest('hex');
const textAt=path=>readFileSync(join(root,path),'utf8');
const utf8=source=>Buffer.byteLength(source,'utf8');
const points=source=>[...source].length;
function result(source){
 const out=[];execute(source,{stdout:x=>out.push(String(x))});
 return out.join('\n')+'\n';
}
test('three exact same-task original files and sign-first updates are locked to distinct Git blobs',()=>{
 assert.equal(baseline.version,1);
 assert.equal(baseline.cases.length,3);
 assert.equal(new Set(baseline.cases.map(x=>x.id)).size,3);
 for(const p of baseline.cases){
  for(const [path,sha] of [[p.oldPath,p.oldBlob],[p.glyphPath,p.glyphBlob],[p.typeScriptPath,p.typeScriptBlob]]){
   assert.match(path,/^compact\/benchmarks\/(paired|symbol-choice)\/[a-z0-9-]+\.(hc|ts)$/);
   assert.equal(gitBlob(readFileSync(join(root,path))),sha,path+' changed; use a new corpus version');
  }
 }
});
test('symbolic conditional sources preserve all original H-Code program results',()=>{
 for(const p of baseline.cases){
  const original=result(textAt(p.oldPath));
  const symbols=result(textAt(p.glyphPath));
  assert.equal(original,p.expected,p.id+' original behavior');
  assert.equal(symbols,p.expected,p.id+' symbol behavior');
  const oldPoints=points(textAt(p.oldPath)),newPoints=points(textAt(p.glyphPath));
  assert.ok(newPoints<oldPoints,p.id+' choice symbol must be smaller, without changing old source');
  assert.ok(utf8(textAt(p.glyphPath))<utf8(textAt(p.oldPath)),p.id+' source byte regression');
 }
});
test('idiomatic TypeScript baselines have not been modified and produce the same outputs',()=>{
 for(const p of baseline.cases){
  const ts=join(root,p.typeScriptPath);
  const run=spawnSync(process.execPath,['--experimental-strip-types',ts],{cwd:root,encoding:'utf8',timeout:5000});
  assert.equal(run.error,undefined,run.error?.message);
  assert.equal(run.status,0,run.stderr);
  assert.equal(run.stdout.replace(/\r\n/g,'\n'),p.expected,p.id);
 }
});
