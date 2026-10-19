// M19.15 B1: true SQLite host I/O, independent H-Code reference and Rust ESM parity.
// This is not full dashboard acceptance and does not claim 15/20.
import test from 'node:test';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdtempSync,readFileSync,writeFileSync,rmSync,symlinkSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {DatabaseSync} from 'node:sqlite';
import {execute,tokenize,RESERVED_USER_GLYPHS} from '../prototype/src/hcode.mjs';
import {seedDatabase} from './canonical20-db-oracle.ts';

const root=fileURLToPath(new URL('../',import.meta.url));
const src=join(root,'compact/canonical20/programs/15-db-query-b1.hc');
const authored=readFileSync(src,'utf8');
const fixture=JSON.parse(readFileSync(join(root,'compact/canonical20/cases/15-db-dashboard.json'),'utf8'));
function withDatabase(run){
 const dir=mkdtempSync(join(tmpdir(),'hcode-db15-b1-'));
 try{
   seedDatabase(join(dir,'orders.sqlite'),fixture.seed);
   return run(dir);
 }finally{rmSync(dir,{recursive:true,force:true});}
}
function trustedHost(dir){
 return {query:(name,sql,params)=>{
   const db=new DatabaseSync(join(dir,name),{readOnly:true,allowExtension:false});
   try{return [...db.prepare(sql).iterate(...params)];}
   finally{db.close();}
 }};
}
function reference(source,dir,host=trustedHost(dir)){
 const output=[];
 execute(source,{dbHost:host,stdout:value=>output.push(value)});
 assert.equal(output.length,1);
 return JSON.parse(output[0]);
}
function compiled(source,dir,rootAllowed=true){
 const path=join(dir,'db15-b1.hc'),out=join(dir,'db15-b1.mjs');
 writeFileSync(path,source);
 const build=spawnSync('cargo',['run','--quiet','--manifest-path','compiler/Cargo.toml','--',
  'build',path,'--out',out],{cwd:root,windowsHide:true,encoding:'utf8',timeout:180000,maxBuffer:1024*1024});
 assert.equal(build.status,0,build.stderr||build.stdout||String(build.error));
 const esm=readFileSync(out,'utf8');
 assert.match(esm,/node:sqlite/,'Real DB host must only be linked when needed');
 assert.match(esm,/__hc_db_rows/);
 assert.doesNotMatch(esm,/__hc_dashboard/);
 const env={...process.env};
 if(rootAllowed)env.HCODE_SQLITE_READ_ROOT=dir;
 else delete env.HCODE_SQLITE_READ_ROOT;
 const run=spawnSync(process.execPath,['--experimental-sqlite',out],{
   cwd:root,env,encoding:'utf8',windowsHide:true,timeout:20000,maxBuffer:1024*1024
 });
 return {run,esm};
}
test('⧈ is a real reserved source glyph with an ASCII token counterpart',()=>{
 assert.equal(RESERVED_USER_GLYPHS.has('⧈'),true);
 const a=tokenize('⧈⦃x:Number⦄("x.sqlite","SELECT 1 AS x",⟦⟧);');
 const b=tokenize('db_rows⦃x:Number⦄("x.sqlite","SELECT 1 AS x",⟦⟧);');
 assert.deepEqual(a.map(x=>x.type),b.map(x=>x.type));
});
test('independent H-Code reference queries all five real seeded SQLite periods',()=>withDatabase(dir=>{
 for(const c of fixture.cases){
   // Replace both date operands atomically. Sequential replacements change the
   // newly inserted lower bound when it equals the original upper bound.
   const source=authored.replace('⟦"paid","2026-01-01","2026-02-01"⟧',
     '⟦"paid","'+c.from+'","'+c.to+'"⟧');
   assert.deepEqual(reference(source,dir),c.expected.byRegion,c.id);
 }
}));
test('Rust-generated ESM and independent JS interpreter query real SQLite identically',()=>withDatabase(dir=>{
 const {run}=compiled(authored,dir);
 assert.equal(run.status,0,run.stderr||String(run.error));
 assert.deepEqual(JSON.parse(run.stdout.trim()),reference(authored,dir));
 assert.deepEqual(JSON.parse(run.stdout.trim()),fixture.cases[0].expected.byRegion);
}));
test('generic SQL REAL and SQLite Bool values preserve native typed H-Code parity',()=>withDatabase(dir=>{
 const expression='print(⤒(⧈⦃active:Bool,metric:Number⦄("orders.sqlite","SELECT 2.5 AS metric,1 AS active",⟦⟧)));';
 const {run}=compiled(expression,dir);
 assert.equal(run.status,0,run.stderr||String(run.error));
 const expected=[{active:true,metric:2.5}];
 assert.deepEqual(JSON.parse(run.stdout.trim()),expected);
 assert.deepEqual(reference(expression,dir),expected);
}));
test('parameterized SQLite statement treats hostile bound text strictly as data',()=>withDatabase(dir=>{
 const source='print(⤒(⧈⦃amount:Number,region:String⦄("orders.sqlite",'+
   '"SELECT amount_cents AS amount,region FROM orders WHERE region=?",'+
   '⟦"North\u0027 OR 1=1 --"⟧)));';
 const {run}=compiled(source,dir);
 assert.equal(run.status,0,run.stderr||String(run.error));
 assert.deepEqual(JSON.parse(run.stdout.trim()),[],
   'A hostile bound parameter cannot select rows or mutate SQL semantics');
 assert.deepEqual(reference(source,dir),[]);
}));
test('compiled host denies ungranted roots and rejects SQLite mutation SQL',()=>withDatabase(dir=>{
 const missing=compiled(authored,dir,false).run;
 assert.notEqual(missing.status,0,'No ambient database access permitted');
 assert.match(missing.stderr,/Database read capability denied/);
 const mutation=authored.replace(
   /SELECT region,COUNT\(\*\)[^"]+/,
   'DELETE FROM orders'
 );
 const rejected=compiled(mutation,dir).run;
 assert.notEqual(rejected.status,0,'SQL mutation must fail closed');
 assert.match(rejected.stderr,/single bounded SELECT|one bounded SELECT/);
}));
test('JS reference refuses bad SQL, untrusted host, unbounded and invalid records',()=>withDatabase(dir=>{
 const malicious=authored.replace(/SELECT region,COUNT\(\*\)[^"]+/,'SELECT * FROM orders; DELETE FROM orders');
 assert.throws(()=>reference(malicious,dir),/SELECT statement/);
 assert.throws(()=>reference(authored,dir,null),/database capability denied/);
 const extra={query:()=>[{paidOrders:1,region:'North',revenueCents:8,secret:'not allowed'}]};
 assert.throws(()=>reference(authored,dir,extra),/unexpected columns/);
 const badNumber={query:()=>[{paidOrders:'one',region:'North',revenueCents:2}]};
 assert.throws(()=>reference(authored,dir,badNumber),/Number type mismatch/);
 const oversized={query:()=>Array.from({length:1001},()=>({paidOrders:1,region:'X',revenueCents:1}))};
 assert.throws(()=>reference(authored,dir,oversized),/row limit/);
}));
test('compiled host denies symlinked SQLite files rather than following them',()=>withDatabase(dir=>{
 const link=join(dir,'other.sqlite');
 try{symlinkSync(join(dir,'orders.sqlite'),link,'file');}
 catch(error){if(error?.code==='EPERM')return;throw error;}
 const source=authored.replace('"orders.sqlite"','"other.sqlite"');
 const {run}=compiled(source,dir);
 assert.notEqual(run.status,0);
 assert.match(run.stderr,/approved regular file/);
}));


test('native symbol-first ⧈ table projection executes without developer SQL',()=>withDatabase(dir=>{
 const source=readFileSync(join(root,'compact/canonical20/programs/15-db-symbol-first-b1.hc'),'utf8');
 assert.ok(source.includes('⧈')&&source.includes('⌕')&&source.includes('⇢'));
 assert.ok(!/SELECT|GROUP BY|ORDER BY|FROM orders/i.test(source));
 const {run,esm}=compiled(source,dir);
 assert.equal(run.status,0,run.stderr||String(run.error));
 assert.match(esm,/__hc_db_table/);
 const native=JSON.parse(run.stdout.trim()),js=reference(source,dir);
 assert.deepEqual(native,js,'Rust and independent JS H-Code must calculate identical typed data');
 const expected=fixture.seed.filter(x=>x.status==='paid'&&
    x.day>='2026-01-01'&&x.day<'2026-02-01')
    .sort((a,b)=>a.amountCents-b.amountCents||
      (a.day<b.day?-1:a.day>b.day?1:0)||
      (a.region<b.region?-1:a.region>b.region?1:0))
    .map(x=>({amount:x.amountCents,region:x.region}));
 assert.deepEqual(native,expected,'Actual SQLite rows must equal independent seeded data oracle');
}));
test('two-operand table read and ASCII alias have identical typed result',()=>withDatabase(dir=>{
 const source='print(⤒⧈⦃amount_cents:Number,day:String,region:String,status:String⦄("orders.sqlite","orders"));';
 const glyph=reference(source,dir);
 const alias=reference(source.replace('⧈','db_rows'),dir);
 assert.deepEqual(glyph,alias);
 assert.equal(glyph.length,fixture.seed.length);
 assert.equal(glyph[0].amount_cents,0);
}));
test('generic table projection denies injected identifiers and schema mismatches',()=>withDatabase(dir=>{
 // Dynamic table names compile as String but are refused by the host.
 // SQL-looking *literal* names are already rejected statically by Rust.
 const path='≔t←"orders;DELETE";print(⤒⧈⦃region:String⦄("orders.sqlite",t));';
 assert.throws(()=>reference(path,dir),/safe database identifier/);
 const compiledBad=compiled(path,dir).run;
 assert.notEqual(compiledBad.status,0);
 assert.match(compiledBad.stderr,/safe identifier/);
 const missing='print(⤒⧈⦃not_a_column:String⦄("orders.sqlite","orders"));';
 assert.throws(()=>reference(missing,dir),/no such column|no such table/);
 const built=compiled(missing,dir).run;
 assert.notEqual(built.status,0);
 assert.match(built.stderr,/no such column/);
 const badType='print(⤒⧈⦃amount_cents:String⦄("orders.sqlite","orders"));';
 assert.throws(()=>reference(badType,dir),/String/);
 assert.notEqual(compiled(badType,dir).run.status,0);
}));

test('source-locked sign-first H-Code and independent idiomatic TypeScript are executable equivalents',()=>withDatabase(dir=>{
 const source=readFileSync(join(root,'compact/canonical20/programs/15-db-symbol-first-b1.hc'),'utf8');
 const comparator=readFileSync(join(root,'compact/canonical20/idiomatic/15-db-table-symbol-first.ts'),'utf8');
 const gitBlob=text=>createHash('sha1').update('blob '+Buffer.byteLength(text)+'\0').update(text).digest('hex');
 assert.equal(gitBlob(source),'92909eb679fedc07a37501331d24a097a49242d2');
 assert.equal(gitBlob(comparator),'f753b7ec77bf5aff06025a618ef4a5df6e8a3451');
 const {run}=compiled(source,dir);
 assert.equal(run.status,0,run.stderr||String(run.error));
 const ts=spawnSync(process.execPath,['--experimental-sqlite','--experimental-strip-types',
   join(root,'compact/canonical20/idiomatic/15-db-table-symbol-first.ts')],{
   cwd:dir,encoding:'utf8',windowsHide:true,timeout:20000,maxBuffer:1024*1024
 });
 assert.equal(ts.status,0,ts.stderr||String(ts.error));
 const native=JSON.parse(run.stdout.trim());
 assert.deepEqual(native,JSON.parse(ts.stdout.trim()),'Do not compare non-equivalent workloads');
 assert.deepEqual(native,reference(source,dir),'Independent H-Code semantics mismatch');
 const hcPoints=[...source].length,tsPoints=[...comparator].length;
 assert.ok(hcPoints<tsPoints,'Symbol-first source must have fewer code points for this pair');
 console.log(JSON.stringify({pair:'15-db-table-scan-filter-map',
   hcodeCodePoints:hcPoints,typescriptCodePoints:tsPoints,
   codePointReductionPercent:Number((100*(1-hcPoints/tsPoints)).toFixed(2)),
   hcodeUtf8Bytes:Buffer.byteLength(source),typescriptUtf8Bytes:Buffer.byteLength(comparator),
   benchmarkScope:'one paired B1 primitive, not Canonical15 dashboard and not global 70%'}));
}));

test('source glyph comparisons order ISO date strings and Unicode code points, not UTF-16 code units',()=>{
 const output=[];
 execute('print("2026-01-01"<"2026-02-01");print("😀"<"é");print("é">"a");print(2<3);',
   {stdout:v=>output.push(v)});
 assert.deepEqual(output,['true','false','true','true']);
 assert.throws(()=>execute('print("a"<3);'),/expects Numbers|matching String|Number or String/);
});
