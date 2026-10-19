// M19.15 B1: true SQLite host I/O, independent H-Code reference and Rust ESM parity.
// This is not full dashboard acceptance and does not claim 15/20.
import test from 'node:test';
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
   const source=authored.replace('"2026-01-01"','"'+c.from+'"')
                         .replace('"2026-02-01"','"'+c.to+'"');
   assert.deepEqual(reference(source,dir),c.expected.byRegion,c.id);
 }
}));
test('Rust-generated ESM and independent JS interpreter query real SQLite identically',()=>withDatabase(dir=>{
 const {run}=compiled(authored,dir);
 assert.equal(run.status,0,run.stderr||String(run.error));
 assert.deepEqual(JSON.parse(run.stdout.trim()),reference(authored,dir));
 assert.deepEqual(JSON.parse(run.stdout.trim()),fixture.cases[0].expected.byRegion);
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
