import test from 'node:test';
import assert from 'node:assert/strict';
import {audit,inspect,codeOnly,activeSources} from './hcode-symbol-first-audit.mjs';
test('audit covers entire H-Code inventory and enforces active candidates without changing frozen tests',()=>{
 const report=audit();
 assert.ok(report.scanned>=95,'Audit must discover the source corpus');
 assert.deepEqual(report.active,activeSources.slice().sort());
 assert.ok(report.preserved>=80,'Historical benchmark and accessibility source must stay available');
 assert.equal(report.legacyCount,107);
 assert.ok(report.changedOrNew.includes('examples/symbol-first-ranking.hc'));
 assert.ok(report.changedOrNew.includes('compact/canonical20/candidates/15-db-dashboard-sign-first.hc'));
 assert.ok(!report.changedOrNew.includes('examples/hello_ascii.hc'),
   'Frozen ASCII accessibility samples must remain unchanged');
 assert.deepEqual(report.failing,[]);
});
test('keyword-like text inside SQL/HTML strings and comments is not developer syntax',()=>{
 const executable=codeOnly('// print while\n⎙("print while SELECT");');
 assert.ok(executable.includes('⎙'));
 assert.ok(!executable.includes('while'));
});
test('↧ cuts at least 30 percent of developer source on exactly the same B2b task',()=>{
 const before=inspect('compact/canonical20/candidates/15-db-dashboard-b2b-before-symbol-sort.hc');
 const after=inspect('compact/canonical20/candidates/15-db-dashboard-sign-first.hc');
 assert.equal(before.gitBlob,'096d248c3c6d42f7e430d7e53a6b191a3560e52f');
 assert.ok(after.codepoints/before.codepoints<0.7);
 assert.ok(after.utf8Bytes<before.utf8Bytes);
 console.log('# HCODE_SYMBOL_FIRST_B2B '+JSON.stringify({
  before:{codepoints:before.codepoints,utf8Bytes:before.utf8Bytes},
  after:{codepoints:after.codepoints,utf8Bytes:after.utf8Bytes},
  codepointReductionPct:Number((100*(1-after.codepoints/before.codepoints)).toFixed(2)),
  utf8ReductionPct:Number((100*(1-after.utf8Bytes/before.utf8Bytes)).toFixed(2)),
  provenGlobal70Percent:false
 }));
});
