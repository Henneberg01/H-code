import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {measureSource,measurePair} from '../phase1-metrics.mjs';

const root=fileURLToPath(new URL('../../',import.meta.url));
const cli=fileURLToPath(new URL('../phase1-metrics.mjs',import.meta.url));

test('Unicode codepoints are not UTF-8 bytes',()=>{
 assert.deepEqual(measureSource('↩'),{codePoints:1,utf8Bytes:3,nonBlankLines:1});
 assert.deepEqual(measureSource('return'),{codePoints:6,utf8Bytes:6,nonBlankLines:1});
 assert.equal(measureSource('≡').utf8Bytes,3);
 assert.equal(measureSource('==').utf8Bytes,2);
 assert.equal(measureSource('🧮').codePoints,1);
 assert.equal(measureSource('🧮').utf8Bytes,4);
 assert.equal(measureSource('  \n\n').nonBlankLines,0);
});

test('source reductions preserve negative byte outcomes',()=>{
 const pair=measurePair('≡','==');
 assert.equal(pair.changes.codePointsPercent,50);
 assert.equal(pair.changes.utf8BytesPercent,-50);
 assert.throws(()=>measurePair('↩',''),/empty|nonempty|zero/i);
});

test('CLI emits four verified fixtures and never invents token savings',()=>{
 const run=spawnSync(process.execPath,[cli],{cwd:root,encoding:'utf8',timeout:10000});
 assert.equal(run.status,0,run.stderr);
 const doc=JSON.parse(run.stdout);
 assert.equal(doc.format,1);
 assert.deepEqual(doc.pairs.map(p=>p.id),['functions','booleans','recursion','package']);
 assert.equal(doc.meaningsVerified,true);
 assert.equal(doc.aiTokens,null);
 assert.equal(doc.developerTime,null);
 assert.equal(typeof doc.toolVersions.node,'string');
 for(const pair of doc.pairs){
   assert.equal(pair.glyph.codePoints>=0,true);
   assert.equal(pair.ascii.utf8Bytes>=0,true);
   assert.equal(pair.outputVerified,true);
 }
});

test('CLI only accepts an allowlisted report output path',()=>{
 for(const candidate of ['../outside.json','C:\\temp\\outside.json','phase1/results/../oops.json']){
   const run=spawnSync(process.execPath,[cli,'--output',candidate],{cwd:root,encoding:'utf8',timeout:10000});
   assert.notEqual(run.status,0,'must reject '+candidate);
   assert.match(run.stderr,/Invalid output path|Usage/i);
 }
});
