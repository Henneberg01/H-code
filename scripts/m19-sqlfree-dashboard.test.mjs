// M19.15 B4: full SQL-free H-Code dashboard; SHA-locked original and TS preserved.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {DatabaseSync} from 'node:sqlite';
import {execute} from '../prototype/src/hcode.mjs';
import {seedDatabase} from './canonical20-db-oracle.ts';
import {queryDashboard} from '../compact/canonical20/idiomatic/15-db-dashboard-backend.ts';

const root=fileURLToPath(new URL('../',import.meta.url));
const sourcePaths={
 legacy:'compact/canonical20/programs/15-db-dashboard-b2b.hc',
 candidate:'compact/canonical20/candidates/15-db-dashboard-sqlfree-b4.hc',
 ui:'compact/canonical20/programs/15-db-dashboard-ui.hc',
 tsBackend:'compact/canonical20/idiomatic/15-db-dashboard-backend.ts',
 tsBrowser:'compact/canonical20/idiomatic/15-db-dashboard-browser.ts'
};
const locks={
 legacy:'096d248c3c6d42f7e430d7e53a6b191a3560e52f',
 candidate:'250bfa1c78da2f6e4affb23f478fd421ba3ef6cc',
 ui:'ebfe4116989491cd28bc46ecdf56d910c4280773',
 tsBackend:'6a38199524ce4b25a1476859d7817c6751006579',
 tsBrowser:'537236ac89b9eba6e4c9c188f33d1b34637ca1b0'
};
const fixture=JSON.parse(readFileSync(join(root,'compact/canonical20/cases/15-db-dashboard.json'),'utf8'));
function frozen(which){
 const bytes=readFileSync(join(root,sourcePaths[which]));
 const got=createHash('sha1').update('blob '+bytes.length+'\0').update(bytes).digest('hex');
 assert.equal(got,locks[which],'Frozen source changed: '+which);
 const text=new TextDecoder('utf-8',{fatal:true}).decode(bytes);
 return {codepoints:[...text].length,bytes:bytes.length,text};
}
function database(run,seed=fixture.seed){
 const dir=mkdtempSync(join(tmpdir(),'hcode15-b4-'));
 try{seedDatabase(join(dir,'orders.sqlite'),seed);return run(dir);}
 finally{rmSync(dir,{recursive:true,force:true});}
}
function build(which,dir,name){
 const out=join(dir,name+'.mjs');
 const result=spawnSync('cargo',['run','--quiet','--manifest-path','compiler/Cargo.toml','--',
   'build',join(root,sourcePaths[which]),'--out',out],{
    cwd:root,encoding:'utf8',windowsHide:true,timeout:180000,maxBuffer:1048576
   });
 assert.equal(result.status,0,result.stderr||result.stdout||String(result.error));
 return {out,generated:readFileSync(out,'utf8')};
}
function interpret(text,dir,period){
 const results=[];
 execute(text,{readStdin:()=>JSON.stringify({from:period.from,to:period.to}),
  stdout:v=>results.push(v),
  dbHost:{query(name,sql,params){
   assert.equal(name,'orders.sqlite');
   const db=new DatabaseSync(join(dir,name),{readOnly:true,allowExtension:false});
   try{return db.prepare(sql).all(...params);}
   finally{db.close();}
  }}
 });
 assert.equal(results.length,1);
 return JSON.parse(results[0]);
}
function compiled(file,dir,period){
 const r=spawnSync(process.execPath,['--experimental-sqlite',file],{
  cwd:root,encoding:'utf8',windowsHide:true,timeout:25000,maxBuffer:1048576,
  input:JSON.stringify({from:period.from,to:period.to}),
  env:{...process.env,HCODE_SQLITE_READ_ROOT:dir}
 });
 assert.equal(r.status,0,r.stderr||r.stdout||String(r.error));
 return JSON.parse(r.stdout.trim());
}
const expected=c=>({paidOrders:c.expected.paidOrders,revenueCents:c.expected.revenueCents,
  byRegion:c.expected.byRegion});
test('locked fair source metrics for full backend+UI against unmodified idiomatic TS',()=>{
 const old=frozen('legacy'),cur=frozen('candidate'),ui=frozen('ui'),
       tb=frozen('tsBackend'),tu=frozen('tsBrowser');
 const pct=(a,b)=>Number((100*(1-a/b)).toFixed(2));
 const hchars=cur.codepoints+ui.codepoints,tchars=tb.codepoints+tu.codepoints,
       hbytes=cur.bytes+ui.bytes,tbytes=tb.bytes+tu.bytes;
 assert.ok(cur.codepoints<old.codepoints);
 assert.ok(hchars<tchars);
 assert.doesNotMatch(cur.text,/SELECT\s|GROUP\s+BY\s|ORDER\s+BY\s/i);
 console.log('# HCODE15_SQLFREE_LOCKED_SIZE '+JSON.stringify({
  backend:{previous:old.codepoints,sqlFree:cur.codepoints},
  codepoints:{hcode:hchars,typescript:tchars,reductionPct:pct(hchars,tchars)},
  utf8Bytes:{hcode:hbytes,typescript:tbytes,reductionPct:pct(hbytes,tbytes)},
  excluded:['compiler','generated ESM','Node SQLite dependency','test harness'],
  globalTwentyWorkloadsProven:false
 }));
});
test('five frozen SQLite scenarios agree in SQL-free H-Code, Rust ESM, original H-Code and independent TS',()=>{
 database(dir=>{
  const newSrc=frozen('candidate').text,oldSrc=frozen('legacy').text,
    newBuild=build('candidate',dir,'sqlfree'),oldBuild=build('legacy',dir,'original');
  assert.match(newBuild.generated,/__hc_db_table/);
  assert.match(newBuild.generated,/__hc_sort_text/);
  for(const c of fixture.cases){
   const goal=expected(c);
   assert.deepEqual(interpret(newSrc,dir,c),goal,'JS SQL-free '+c.id);
   assert.deepEqual(compiled(newBuild.out,dir,c),goal,'Rust SQL-free '+c.id);
   assert.deepEqual(interpret(oldSrc,dir,c),goal,'JS original '+c.id);
   assert.deepEqual(compiled(oldBuild.out,dir,c),goal,'Rust original '+c.id);
   assert.deepEqual(queryDashboard(join(dir,'orders.sqlite'),c.from,c.to),goal,'TS '+c.id);
  }
 });
});
test('stable Unicode tie breaks are correct even when row insertion order changes',()=>{
 const extra=[
  {id:100,region:'Zoo',amountCents:100,status:'paid',day:'2026-06-01'},
  {id:101,region:'Zoo',amountCents:200,status:'paid',day:'2026-06-02'},
  {id:102,region:'Alpha',amountCents:300,status:'paid',day:'2026-06-03'},
  {id:103,region:'😀',amountCents:200,status:'paid',day:'2026-06-04'},
  {id:104,region:'\uE000',amountCents:200,status:'paid',day:'2026-06-05'}
 ];
 const period={from:'2026-06-01',to:'2026-07-01'},
   goal={paidOrders:5,revenueCents:1000,byRegion:[
    {region:'Alpha',paidOrders:1,revenueCents:300},
    {region:'Zoo',paidOrders:2,revenueCents:300},
    {region:'\uE000',paidOrders:1,revenueCents:200},
    {region:'😀',paidOrders:1,revenueCents:200}
   ]};
 for(const shift of [0,3]){
  database(dir=>{
   const app=build('candidate',dir,'tiebreak');
   assert.deepEqual(interpret(frozen('candidate').text,dir,period),goal);
   assert.deepEqual(compiled(app.out,dir,period),goal);
   assert.deepEqual(queryDashboard(join(dir,'orders.sqlite'),period.from,period.to),goal);
  },extra.slice(shift).concat(extra.slice(0,shift)));
 }
});
test('compiled SQL-free source cannot read an ungranted SQLite database',()=>{
 database(dir=>{
  const app=build('candidate',dir,'denied');
  const env={...process.env};delete env.HCODE_SQLITE_READ_ROOT;
  const denied=spawnSync(process.execPath,['--experimental-sqlite',app.out],{
   cwd:root,env,encoding:'utf8',windowsHide:true,timeout:20000,
   input:JSON.stringify({from:'2026-01-01',to:'2026-02-01'})
  });
  assert.notEqual(denied.status,0);
  assert.match(denied.stderr,/Database read capability denied/);
 });
});
