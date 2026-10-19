// Canonical15 B2b: real, developer-authored H-Code grouping and summary.
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {DatabaseSync} from 'node:sqlite';
import {execute} from '../prototype/src/hcode.mjs';
import {seedDatabase} from './canonical20-db-oracle.ts';

const root=fileURLToPath(new URL('../',import.meta.url));
const sourceFile=join(root,'compact/canonical20/programs/15-db-dashboard-b2b.hc');
const source=readFileSync(sourceFile,'utf8');
const fixture=JSON.parse(readFileSync(join(root,'compact/canonical20/cases/15-db-dashboard.json'),'utf8'));
function withDb(fn,rows=fixture.seed){
 const dir=mkdtempSync(join(tmpdir(),'hcode15-b2b-'));
 try{seedDatabase(join(dir,'orders.sqlite'),rows);return fn(dir);}
 finally{rmSync(dir,{recursive:true,force:true});}
}
function host(dir){
 return {query(name,sql,params){
   assert.equal(name,'orders.sqlite');
   const db=new DatabaseSync(join(dir,name),{readOnly:true,allowExtension:false});
   try{return db.prepare(sql).all(...params);}
   finally{db.close();}
 }};
}
const request=c=>JSON.stringify({from:c.from,to:c.to});
function interpret(dir,c){
 const output=[];
 const state=execute(source,{dbHost:host(dir),readStdin:()=>request(c),stdout:s=>output.push(s)});
 assert.ok(state.steps>0);
 assert.equal(output.length,1);
 return JSON.parse(output[0]);
}
function compile(dir){
 const target=join(dir,'dashboard.mjs');
 const build=spawnSync('cargo',['run','--quiet','--manifest-path','compiler/Cargo.toml','--',
  'build',sourceFile,'--out',target],{cwd:root,windowsHide:true,encoding:'utf8',timeout:180000,maxBuffer:1048576});
 assert.equal(build.status,0,build.stderr||build.stdout||String(build.error));
 const output=readFileSync(target,'utf8');
 assert.match(output,/node:sqlite/);
 assert.match(output,/__hc_hist/);
 assert.match(output,/__hc_filter/);
 assert.match(output,/__hc_map/);
 assert.doesNotMatch(output,/__hc_dashboard/);
 return target;
}
function executeNative(target,dir,c,permission=true){
 const env={...process.env};
 if(permission)env.HCODE_SQLITE_READ_ROOT=dir;
 else delete env.HCODE_SQLITE_READ_ROOT;
 return spawnSync(process.execPath,['--experimental-sqlite',target],{
  cwd:root,env,input:request(c),windowsHide:true,encoding:'utf8',timeout:20000,maxBuffer:1048576
 });
}
function assertExpected(actual,c){
 assert.deepEqual(actual,{byRegion:c.expected.byRegion,paidOrders:c.expected.paidOrders,
  revenueCents:c.expected.revenueCents},c.id);
}
test('H-Code genuinely aggregates seeded records with map/filter/sum and not dashboard macros',()=>withDb(dir=>{
 const native=compile(dir);
 for(const c of fixture.cases){
   const interpreted=interpret(dir,c);
   assertExpected(interpreted,c);
   const result=executeNative(native,dir,c);
   assert.equal(result.status,0,result.stderr||String(result.error));
   assertExpected(JSON.parse(result.stdout.trim()),c);
   assert.deepEqual(JSON.parse(result.stdout.trim()),interpreted,c.id+' native/reference parity');
 }
}));
test('sorting and totals are invariant to database seed order',()=>{
 for(const shift of [1,3,7,11]){
   const rotated=fixture.seed.slice(shift).concat(fixture.seed.slice(0,shift));
   withDb(dir=>{
     for(const c of fixture.cases)assertExpected(interpret(dir,c),c);
   },rotated);
 }
});
test('an actual changed SQLite file is reflected after the DB is reopened',()=>withDb(dir=>{
 const march=fixture.cases.find(c=>c.id==='march');
 const native=compile(dir);
 const before=JSON.parse(executeNative(native,dir,march).stdout.trim());
 assert.equal(before.revenueCents,333);
 const db=new DatabaseSync(join(dir,'orders.sqlite'));
 try{db.prepare('INSERT INTO orders (id,region,amount_cents,status,day) VALUES (?,?,?,?,?)')
  .run(99,'North',500,'paid','2026-03-12');}
 finally{db.close();}
 const after=JSON.parse(executeNative(native,dir,march).stdout.trim());
 assert.deepEqual(after,{byRegion:[{paidOrders:2,region:'North',revenueCents:833}],
  paidOrders:2,revenueCents:833});
 assert.deepEqual(after,interpret(dir,march),'reference and ESM must observe reopened DB changes');
}));
test('denied SQLite capability is a hard error, never synthetic fixture data',()=>withDb(dir=>{
 const native=compile(dir);
 const noPermission=executeNative(native,dir,fixture.cases[0],false);
 assert.notEqual(noPermission.status,0);
 assert.match(noPermission.stderr,/Database read capability denied/);
 assert.throws(()=>execute(source,{readStdin:()=>request(fixture.cases[0])}),/database capability denied/);
}));
test('untrusted user date strings remain bound query values',()=>withDb(dir=>{
 // Bound upper-limit SQL-like text must not turn into executable OR 1=1.
 const bad={from:'2026-01-01',to:"2026-01-01' OR 1=1 --"};
 const native=compile(dir);
 const response=executeNative(native,dir,bad);
 assert.equal(response.status,0,response.stderr||String(response.error));
 assert.equal(JSON.parse(response.stdout.trim()).paidOrders,0);
 assert.equal(interpret(dir,bad).paidOrders,0);
}));
test('malformed input record fails before any SQLite query',()=>withDb(dir=>{
 const queries=[];
 assert.throws(()=>execute(source,{dbHost:{query(...args){queries.push(args);return [];}},
   readStdin:()=>JSON.stringify({from:100,to:'2026-02-01'})}),/JSON Number type mismatch|JSON String type mismatch/);
 assert.equal(queries.length,0);
}));
