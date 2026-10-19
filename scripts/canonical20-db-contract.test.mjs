// Canonical15 B0: independently verifiable SQLite/TypeScript correctness contract.
// NO H-Code compiler/database capability or canonical benchmark coverage is asserted.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdtempSync,readFileSync,rmSync,existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {seedDatabase,queryDashboard,renderDashboard} from './canonical20-db-oracle.ts';

const read=path=>readFileSync(new URL('../'+path,import.meta.url));
const blob=b=>createHash('sha1').update('blob '+b.length+'\0').update(b).digest('hex');
const registrySHA='46653ef90ffb3e420fba4ddfbfac3c4cfd57f3b3';
const caseSHA='184266b6e49cb8e328e868e6ebc3f1a9bec78b58';
const oracleSHA='82654f315c7d967228f5a0670b28265a185822b6';
const data=JSON.parse(read('compact/canonical20/cases/15-db-dashboard.json'));

function withDb(callback,seed=data.seed){
  const dir=mkdtempSync(join(tmpdir(),'hcode-c15-'));
  const file=join(dir,'real-dashboard.sqlite');
  try{seedDatabase(file,seed);return callback(file);}finally{rmSync(dir,{recursive:true,force:true});}
}

test('immutable canonical15 registry and independent baseline inputs',()=>{
  assert.equal(blob(read('compact/canonical20/workloads.json')),registrySHA);
  assert.equal(blob(read('compact/canonical20/cases/15-db-dashboard.json')),caseSHA);
  assert.equal(blob(read('scripts/canonical20-db-oracle.ts')),oracleSHA);
  const original=JSON.parse(read('compact/canonical20/workloads.json'));
  assert.equal(original.workloads.length,20);
  const task=original.workloads[14];
  assert.equal(task.id,'15-db-dashboard');
  assert.equal(task.acceptance,'query seeded data, aggregate metrics and render result views');
  assert.deepEqual(task.requiredCapabilities,['database','records','ui']);
  assert.equal(task.status,'unsupported');
  assert.equal(task.evidence,null);
  assert.equal(data.id,task.id);
  assert.equal(data.originalAcceptance,task.acceptance);
  assert.equal(data.registryBlobSha,registrySHA);
  assert.deepEqual(data.requiredCapabilities,task.requiredCapabilities);
  assert.equal(data.phase,'B0-independent-contract-not-H-Code-verified');
  assert.equal(data.databaseEngine,'SQLite');
  assert.equal(data.cases.length,5);
});

test('real disk-backed SQLite aggregates all five fixed cases exactly',()=>withDb(file=>{
  assert.equal(readFileSync(file).subarray(0,16).toString('ascii'),'SQLite format 3\0');
  for(const c of data.cases){
    const result=queryDashboard(file,c.from,c.to);
    assert.deepEqual(result,c.expected,c.id);
    assert.equal(result.byRegion.reduce((n,row)=>n+row.paidOrders,0),result.paidOrders);
    assert.equal(result.byRegion.reduce((n,row)=>n+row.revenueCents,0),result.revenueCents);
    assert.ok(renderDashboard(result,c.from,c.to).includes('<table id="results">'));
  }
}));

test('stable ordered aggregation is independent of seed insertion order',()=>{
  for(const shift of [1,3,7,11]){
    const rows=data.seed.slice(shift).concat(data.seed.slice(0,shift));
    withDb(file=>{
      for(const c of data.cases)assert.deepEqual(queryDashboard(file,c.from,c.to),c.expected);
    },rows);
  }
});

test('accessible HTML presents the actual query results and treats hostile values as text',()=>withDb(file=>{
  const period=data.cases.find(c=>c.id==='february');
  const result=queryDashboard(file,period.from,period.to);
  const html=renderDashboard(result,period.from,period.to);
  assert.match(html,/<main><h1>Paid orders dashboard<\/h1>/);
  assert.match(html,/<table id="results"><caption>Paid orders and revenue by region<\/caption>/);
  assert.match(html,/<th scope="col">Region<\/th>/);
  assert.match(html,/<th scope="row">South<\/th><td>1<\/td><td>2000<\/td>/);
  assert.match(html,/&lt;img src=x onerror=1&gt;/);
  assert.doesNotMatch(html,/<img\b/i);
  assert.doesNotMatch(html,/<script\b/i);
  assert.match(html,/id="summary" role="status" aria-live="polite"/);
  assert.equal((html.match(/<tr>/g)||[]).length,result.byRegion.length+1);
  const empty=data.cases.find(c=>c.id==='empty');
  const none=renderDashboard(queryDashboard(file,empty.from,empty.to),empty.from,empty.to);
  assert.match(none,/id="empty">No paid orders in this period/);
  assert.equal((none.match(/<tr>/g)||[]).length,1);
}));

test('real SQLite changes persist after closing and reopening the file',()=>withDb(file=>{
  const before=queryDashboard(file,'2026-03-01','2026-04-01');
  assert.equal(before.revenueCents,333);
  const db=new DatabaseSync(file);
  try{db.prepare('INSERT INTO orders (id,region,amount_cents,status,day) VALUES (?,?,?,?,?)')
    .run(15,'North',500,'paid','2026-03-03');}finally{db.close();}
  assert.deepEqual(queryDashboard(file,'2026-03-01','2026-04-01'),{
    paidOrders:2,revenueCents:833,byRegion:[{region:'North',paidOrders:2,revenueCents:833}]
  });
}));

test('invalid ranges, SQL-like input and malformed seed rows fail closed',()=>{
  withDb(file=>{
    for(const [from,to] of [
      ['2026-02-01','2026-02-01'],['2026-03-01','2026-02-01'],
      ["2026-02-01' OR 1=1 --",'2026-03-01'],['2026-02-30','2026-03-01'],
      ['2026-02-01','2026-03-99']
    ])assert.throws(()=>queryDashboard(file,from,to),/Invalid half-open ISO date range/);
  });
  for(const row of [
    {...data.seed[0],id:0},
    {...data.seed[0],amountCents:-1},
    {...data.seed[0],amountCents:Number.MAX_SAFE_INTEGER+1},
    {...data.seed[0],status:'paid" OR 1=1'},
    {...data.seed[0],day:'2026-13-01'}
  ]){
    const dir=mkdtempSync(join(tmpdir(),'hcode-c15-bad-'));
    try{assert.throws(()=>seedDatabase(join(dir,'invalid.sqlite'),[row]),/Invalid seed row/);}finally{rmSync(dir,{recursive:true,force:true});}
  }
});

test('duplicate primary keys cannot commit a partly seeded database',()=>{
  const dir=mkdtempSync(join(tmpdir(),'hcode-c15-dup-'));
  const file=join(dir,'dup.sqlite');
  try{
    assert.throws(()=>seedDatabase(file,[data.seed[0],data.seed[0]]));
    assert.equal(existsSync(file),true);
    assert.deepEqual(queryDashboard(file,'2026-01-01','2026-02-01'),{
      paidOrders:0,revenueCents:0,byRegion:[]
    });
  }finally{rmSync(dir,{recursive:true,force:true});}
});
