import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
import {parse,tokenize,execute,CORE_GLYPHS,RESERVED_USER_GLYPHS} from '../src/hcode.mjs';
import {readProjectText} from '../../scripts/canonical20-csv-host.mjs';

const root=fileURLToPath(new URL('../../',import.meta.url));
const schema='⦃active:Bool,age:Number,name:String,note:String⦄';
function output(code,allowed=true){
  const lines=[];
  execute(code,{stdout:s=>lines.push(String(s)),
    readFile:allowed?file=>readProjectText(file,{cwd:root,allowFileRead:true}):null});
  return lines.join('\n')+'\n';
}
test('⧄ and ⧇ are real core symbols with accessible ASCII forms',()=>{
  for(const [glyph,alias,kind] of [['⧄','file_read','file-read'],['⧇','csv_typed','csv-typed']]){
    assert.equal(CORE_GLYPHS[glyph],kind);
    assert.equal(RESERVED_USER_GLYPHS.has(glyph),true);
    assert.equal(tokenize(glyph)[0].type,kind);
    assert.equal(tokenize(alias)[0].type,kind);
  }
  assert.deepEqual(parse('print(⤒(⧇'+schema+'(⧄"canonical04/users.csv")));'),
    parse('print(json_out(csv_typed'+schema+'(file_read"canonical04/users.csv")));'));
});
test('CSV program validates quoted/multiline Unicode fields, BOM, CRLF, empty result',()=>{
  const cases=JSON.parse(readFileSync(join(root,'compact/canonical20/cases/04-csv-validation.json'),'utf8'));
  const source=readFileSync(join(root,'compact/canonical20/programs/04-csv-validation.hc'),'utf8');
  assert.equal(cases.positiveFiles.length,4);
  assert.equal(output(source),cases.positiveFiles.map(c=>c.expected).join('\n')+'\n');
  assert.throws(()=>output(source,false),/file-read capability denied/);
});
test('CSV parser is generic for declared Number Bool String fields',()=>{
  const csv='id,valid,caption\n1,true,first\n2,false,second';
  const program='print(⤒(⧇⦃id:Number,valid:Bool,caption:String⦄'+JSON.stringify(csv)+'));';
  assert.equal(output(program),'[{"caption":"first","id":1,"valid":true},{"caption":"second","id":2,"valid":false}]\n');
  for(const source of ['print(⧇⟦Number⟧"x");','print(⧇⦃a:Number⦄42);',
   'print(⧇⦃a:Unit⦄"x");','print(⧄42);'])assert.throws(()=>output(source));
});
test('six malformed fixed CSV inputs fail in the pure interpreter',()=>{
  const cases=JSON.parse(readFileSync(join(root,'compact/canonical20/cases/04-csv-validation.json'),'utf8'));
  for(const bad of cases.negativeFiles){
    const p='print(⤒(⧇'+schema+'(⧄'+JSON.stringify(bad.path)+')));';
    assert.throws(()=>output(p),undefined,bad.id);
  }
});
test('full source, each data file and all 20 acceptance task entries remain SHA locked',()=>{
  const cases=JSON.parse(readFileSync(join(root,'compact/canonical20/cases/04-csv-validation.json'),'utf8'));
  const registry=readFileSync(join(root,'compact/canonical20/workloads.json'));
  assert.equal(createHash('sha1').update('blob '+registry.length+'\0').update(registry).digest('hex'),
    '46653ef90ffb3e420fba4ddfbfac3c4cfd57f3b3');
  assert.equal(cases.acceptance,'parse quoted CSV, reject malformed rows and validate column types deterministically');
  for(const c of [...cases.positiveFiles,...cases.negativeFiles]){
    const buf=readFileSync(join(root,'data',c.path));
    assert.equal(createHash('sha1').update('blob '+buf.length+'\0').update(buf).digest('hex'),c.blobSha);
  }
});
