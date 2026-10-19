// M19.15 B3: independent idiomatic TypeScript correctness competitor.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {DatabaseSync} from 'node:sqlite';
import {queryDashboard} from '../compact/canonical20/idiomatic/15-db-dashboard-backend.ts';
import {parseDashboard} from '../compact/canonical20/idiomatic/15-db-dashboard-browser.ts';
import {seedDatabase} from './canonical20-db-oracle.ts';
const root=fileURLToPath(new URL('../',import.meta.url));
const fixture=JSON.parse(readFileSync(join(root,'compact/canonical20/cases/15-db-dashboard.json'),'utf8'));
function withDb(run,seed=fixture.seed){
 const folder=mkdtempSync(join(tmpdir(),'hcode15-ts-')),dbPath=join(folder,'orders.sqlite');
 try{seedDatabase(dbPath,seed);return run(dbPath);}
 finally{rmSync(folder,{recursive:true,force:true});}
}
function expected(c){
 return {byRegion:c.expected.byRegion,paidOrders:c.expected.paidOrders,
  revenueCents:c.expected.revenueCents};
}
test('independent idiomatic TypeScript computes all five preregistered SQLite cases',()=>withDb(dbPath=>{
 for(const c of fixture.cases){
  const actual=queryDashboard(dbPath,c.from,c.to);
  assert.deepEqual(actual,expected(c),c.id);
  assert.deepEqual(parseDashboard(JSON.parse(JSON.stringify(actual))),expected(c));
 }
}));
test('TypeScript query aggregation remains stable under four seed permutations',()=>{
 for(const shift of [1,3,7,11]){
  const seed=fixture.seed.slice(shift).concat(fixture.seed.slice(0,shift));
  withDb(dbPath=>{
    for(const c of fixture.cases)
      assert.deepEqual(queryDashboard(dbPath,c.from,c.to),expected(c),c.id);
  },seed);
 }
});
test('TypeScript recognizes real disk writes on separate SQLite connections',()=>withDb(dbPath=>{
 const march=fixture.cases.find(c=>c.id==='march');
 assert.deepEqual(queryDashboard(dbPath,march.from,march.to),expected(march));
 const db=new DatabaseSync(dbPath);
 try{db.prepare('INSERT INTO orders (id,region,amount_cents,status,day) VALUES (?,?,?,?,?)')
   .run(99,'North',500,'paid','2026-03-12');}
 finally{db.close();}
 assert.deepEqual(queryDashboard(dbPath,march.from,march.to),{
  byRegion:[{paidOrders:2,region:'North',revenueCents:833}],
  paidOrders:2,revenueCents:833
 });
}));
test('independent TypeScript date boundary rejects invalid values without SQL interpolation',()=>withDb(dbPath=>{
 for(const [from,to] of [
  ['2026-02-01','2026-02-01'],['2026-03-01','2026-02-01'],
  ["2026-01-01' OR 1=1--",'2026-02-01'],['2026-02-30','2026-03-01'],
  ['2026-13-40','2026-02-01'],['2026-01-01','2026-03-99']]) {
  assert.throws(()=>queryDashboard(dbPath,from,to),/Invalid half-open ISO date range/);
 }
}));
test('strict JSON boundary rejects extra fields, wrong number types and malicious records',()=>{
 const valid={byRegion:[{region:'<img src=x onerror=1>',paidOrders:1,revenueCents:250}],
  paidOrders:1,revenueCents:250};
 assert.deepEqual(parseDashboard(valid),valid);
 assert.throws(()=>parseDashboard({...valid,additional:'bad'}),/Unexpected dashboard/);
 assert.throws(()=>parseDashboard({...valid,paidOrders:'1'}),/metric/);
 assert.throws(()=>parseDashboard({...valid,byRegion:[{...valid.byRegion[0],evil:'bad'}]}),/Unexpected region fields/);
 assert.throws(()=>parseDashboard({...valid,revenueCents:Infinity}),/metric/);
});
