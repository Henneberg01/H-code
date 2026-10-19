// Canonical15 B2 candidate: a genuine user-authored H-Code SQLite-backed dashboard.
// B0 immutable SQLite/TypeScript oracle, not a production/15-of-20 proof.
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {DatabaseSync} from 'node:sqlite';
import {execute} from '../prototype/src/hcode.mjs';
import {seedDatabase,queryDashboard,renderDashboard} from './canonical20-db-oracle.ts';

const root=fileURLToPath(new URL('../',import.meta.url));
const sourcePath=join(root,'compact/canonical20/programs/15-db-dashboard-b2.hc');
const source=readFileSync(sourcePath,'utf8');
const cases=JSON.parse(readFileSync(join(root,'compact/canonical20/cases/15-db-dashboard.json'),'utf8'));
function withDb(callback){
 const directory=mkdtempSync(join(tmpdir(),'hcode15-dashboard-'));
 try{
  seedDatabase(join(directory,'orders.sqlite'),cases.seed);
  return callback(directory);
 }finally{rmSync(directory,{recursive:true,force:true});}
}
const host=dir=>({
 query:(filename,sql,params)=>{
  assert.equal(filename,'orders.sqlite');
  const db=new DatabaseSync(join(dir,filename),{readOnly:true,allowExtension:false});
  try{return [...db.prepare(sql).iterate(...params)];}
  finally{db.close();}
 }
});
const input=c=>JSON.stringify({from:c.from,to:c.to});
function reference(dir,c){
 const output=[];
 execute(source,{readStdin:()=>input(c),dbHost:host(dir),stdout:x=>output.push(x)});
 assert.equal(output.length,1);
 return output[0];
}
function build(dir){
 const out=join(dir,'dashboard.mjs');
 const result=spawnSync('cargo',['run','--quiet','--manifest-path','compiler/Cargo.toml','--',
  'build',sourcePath,'--out',out],{cwd:root,windowsHide:true,encoding:'utf8',timeout:180000,maxBuffer:1024*1024});
 assert.equal(result.status,0,result.stderr||result.stdout||String(result.error));
 const emitted=readFileSync(out,'utf8');
 assert.match(emitted,/node:sqlite/);
 assert.match(emitted,/HCODE_SQLITE_READ_ROOT/);
 assert.doesNotMatch(emitted,/__hc_dashboard/,'No compiler-specific dashboard macro allowed');
 return out;
}
function compiled(dir,program,c){
 const run=spawnSync(process.execPath,['--experimental-sqlite',program],{
  cwd:root,env:{...process.env,HCODE_SQLITE_READ_ROOT:dir},
  input:input(c),windowsHide:true,encoding:'utf8',timeout:25000,maxBuffer:1048576
 });
 assert.equal(run.status,0,run.stderr||run.stdout||String(run.error));
 return run.stdout.replace(/\r\n/g,'\n').trimEnd();
}

test('the full H-Code program compiles and renders all five B0 SQLite/TS cases',()=>withDb(dir=>{
 const esm=build(dir);
 for(const c of cases.cases){
  const expected=renderDashboard(queryDashboard(join(dir,'orders.sqlite'),c.from,c.to),c.from,c.to);
  const generated=compiled(dir,esm,c);
  const interpreted=reference(dir,c);
  assert.equal(generated,expected,c.id+' Rust/TS exact accessible HTML parity');
  assert.equal(interpreted,expected,c.id+' H-Code JS/TS exact accessible HTML parity');
 }
}));

test('all business logic and safe HTML escaping belong to authored H-Code source',()=>withDb(dir=>{
 const c=cases.cases.find(x=>x.id==='february');
 const generated=reference(dir,c);
 assert.match(generated,/<table id="results"><caption>/);
 assert.match(generated,/&lt;img src=x onerror=1&gt;/);
 assert.doesNotMatch(generated,/<img\b/i);
 assert.doesNotMatch(generated,/<script\b/i);
 assert.match(generated,/role="status" aria-live="polite"/);
 const empty=reference(dir,cases.cases.find(x=>x.id==='empty'));
 assert.match(empty,/<p id="empty">No paid orders in this period\.<\/p>/);
 assert.equal((empty.match(/<tr>/g)??[]).length,1);
 assert.match(source,/ƒ escape\(s:String\)→String/);
 assert.match(source,/⧈⦃paidOrders:Number,region:String,revenueCents:Number⦄/);
 assert.match(source,/⟳/);
 assert.doesNotMatch(source,/__hc_dashboard|javascript|eval\s*\(/i);
}));

test('generated SQLite dashboard fails closed without its explicit DB read permission',()=>withDb(dir=>{
 const esm=build(dir);
 const period=cases.cases[0];
 const run=spawnSync(process.execPath,['--experimental-sqlite',esm],{
  cwd:root,env:{...process.env,HCODE_SQLITE_READ_ROOT:''},input:input(period),
  windowsHide:true,encoding:'utf8',timeout:25000,maxBuffer:1048576
 });
 assert.notEqual(run.status,0);
 assert.match(run.stderr,/Database read capability denied/);
 assert.doesNotMatch(run.stdout,/<table|Paid orders dashboard/);
}));
