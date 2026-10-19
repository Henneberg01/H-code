// Canonical15 B2b real Chromium/browser proof; H-Code owns query and UI.
// No browser fake, no iframe, and no hardcoded data from the original oracle.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {spawn,spawnSync} from 'node:child_process';
import {readFileSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {DatabaseSync} from 'node:sqlite';
import {seedDatabase} from './canonical20-db-oracle.ts';

const root=fileURLToPath(new URL('../',import.meta.url));
const read=p=>readFileSync(join(root,p),'utf8');
const html=read('compact/canonical20/programs/15-db-dashboard.html');
const probe=read('scripts/m19-db-dashboard-browser-probe.js');
const fixture=JSON.parse(read('compact/canonical20/cases/15-db-dashboard.json'));
const chrome=()=>process.env.HCODE_CHROME||process.env.CHROME_BIN||'google-chrome';
const escaped=x=>String(x).replace(/[&<>"']/g,c=>({
  '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
})[c]);
const validDate=s=>typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&
  Number.isFinite(Date.parse(s+'T00:00:00Z'))&&
  new Date(s+'T00:00:00Z').toISOString().slice(0,10)===s;
function build(source,target){
 const run=spawnSync('cargo',['run','--quiet','--manifest-path','compiler/Cargo.toml',
  '--','build',join(root,source),'--out',target],{
  cwd:root,encoding:'utf8',windowsHide:true,timeout:180000,maxBuffer:1024*1024
 });
 assert.equal(run.status,0,run.stderr||run.stdout||String(run.error));
 return readFileSync(target,'utf8');
}
function browse(url,profile){
 return new Promise((resolve,reject)=>{
  const child=spawn(chrome(),['--headless=new','--disable-gpu','--no-first-run',
   '--no-sandbox','--disable-dev-shm-usage','--virtual-time-budget=6000',
   '--user-data-dir='+profile,'--dump-dom',url],{
    windowsHide:true,stdio:['ignore','pipe','pipe']
   });
  let text='',stderr='',done=false;
  const timeout=setTimeout(()=>finish(Error('Chromium timed out: '+stderr.slice(-2000))),30000);
  function finish(error,value){
   if(done)return;done=true;clearTimeout(timeout);
   if(error){child.kill('SIGKILL');reject(error);}else resolve(value);
  }
  child.on('error',finish);
  child.stdout.on('data',x=>{
   text+=String(x);
   if(text.length>2097152)finish(Error('Browser DOM output >2 MiB'));
  });
  child.stderr.on('data',x=>{if(stderr.length<16384)stderr+=String(x);});
  child.on('exit',code=>code===0?finish(null,text):
   finish(Error('Chrome exited '+code+': '+stderr.slice(-2000))));
 });
}
function parseProof(dom){
 const found=/<output id="hcode-db-proof"[^>]*>([^<]*)<\/output>/.exec(dom);
 assert.ok(found,'Missing real Chromium DOM proof: '+dom.slice(-1300));
 const value=JSON.parse(decodeURIComponent(found[1].replaceAll('&amp;','&')));
 assert.ok(!value.fatal,'Browser H-Code error: '+JSON.stringify(value));
 return value;
}
test('Rust-compiled backend and H-Code UI render five real SQLite cases in Chromium',async()=>{
 const folder=mkdtempSync(join(tmpdir(),'hcode15-chrome-'));
 let server;
 try{
  const dbfile=join(folder,'orders.sqlite');
  seedDatabase(dbfile,fixture.seed);
  const backend=join(folder,'backend.mjs'),frontend=join(folder,'frontend.mjs');
  const nodeBackend=build('compact/canonical20/programs/15-db-dashboard-b2b.hc',backend);
  const nodeFrontend=build('compact/canonical20/programs/15-db-dashboard-ui.hc',frontend);
  assert.match(nodeBackend,/node:sqlite/);
  assert.doesNotMatch(nodeFrontend,/node:sqlite/,'Browser H-Code must not access OS DB');
  assert.match(nodeFrontend,/__hc_dom_table/,'Typed H-Code table must be native');
  let queries=0;
  server=createServer((req,res)=>{
   const url=new URL(req.url||'/', 'http://127.0.0.1');
   const common={
    'cache-control':'no-store',
    'x-content-type-options':'nosniff',
    'content-security-policy':"default-src 'none'; script-src 'self'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'"
   };
   if(url.pathname==='/hcode-ui.mjs'){
    res.writeHead(200,{...common,'content-type':'text/javascript; charset=utf-8'});
    res.end(nodeFrontend);return;
   }
   if(url.pathname==='/probe.js'){
    res.writeHead(200,{...common,'content-type':'text/javascript; charset=utf-8'});
    res.end(probe);return;
   }
   if(url.pathname!=='/dashboard'){
    res.writeHead(404,common);res.end('Not found');return;
   }
   const from=url.searchParams.get('from')||'2026-01-01';
   const to=url.searchParams.get('to')||'2026-02-01';
   if(!validDate(from)||!validDate(to)||from>=to){
    res.writeHead(400,{...common,'content-type':'text/plain; charset=utf-8'});
    res.end('Invalid half-open ISO date range');return;
   }
   ++queries;
   const executed=spawnSync(process.execPath,['--experimental-sqlite',backend],{
    cwd:root,windowsHide:true,encoding:'utf8',timeout:20000,maxBuffer:1048576,
    input:JSON.stringify({from,to}),
    env:{...process.env,HCODE_SQLITE_READ_ROOT:folder}
   });
   if(executed.status!==0){
    res.writeHead(500,common);
    res.end('H-Code backend failed');return;
   }
   const records=JSON.parse(executed.stdout.trim());
   // The browser only receives escaped attribute text, never generated JS
   // from SQL results. H-Code's generic ⟙ writes each label as textContent.
   const page=html.replace('__FROM__',escaped(from))
    .replace('__TO__',escaped(to))
    .replace('__PAYLOAD__',escaped(JSON.stringify(records)));
   res.writeHead(200,{...common,'content-type':'text/html; charset=utf-8'});
   res.end(page);
  });
  await new Promise((ok,fail)=>{
   server.once('error',fail);
   server.listen(0,'127.0.0.1',()=>{server.off('error',fail);ok();});
  });
  const addr=server.address();
  assert.ok(addr&&typeof addr!=='string');
  const host='http://127.0.0.1:'+addr.port;
  for(const c of fixture.cases){
   const params=new URLSearchParams({from:c.from,to:c.to});
   const doc=await browse(host+'/dashboard?'+params.toString(),
    join(folder,'chrome-'+c.id));
   const proof=parseProof(doc);
   assert.equal(proof.summary,c.expected.paidOrders+' paid orders, '+
     c.expected.revenueCents+' minor units',c.id+' summary');
   assert.equal(proof.caption,'Paid orders and revenue by region');
   assert.deepEqual(proof.columns.map(x=>x.text),
     ['Region','Paid orders','Revenue (minor units)']);
   assert.ok(proof.columns.every(x=>x.tag==='TH'&&x.scope==='col'));
   assert.equal(proof.cells.length,c.expected.byRegion.length,c.id+' rows');
   assert.deepEqual(proof.cells.map(row=>row.map(x=>x.text)),
    c.expected.byRegion.map(x=>[x.region,String(x.paidOrders),String(x.revenueCents)]),
    c.id+' real Chromium cell parity');
   assert.ok(proof.cells.every(row=>row[0].tag==='TH'&&row[0].scope==='row'&&
     row.slice(1).every(c=>c.tag==='TD')));
   assert.equal(proof.images,0,'Hostile HTML must never create image elements');
   assert.equal(proof.scripts,0,'Hostile HTML must never inject executable scripts');
   assert.equal(proof.from,c.from);
   assert.equal(proof.to,c.to);
   assert.equal(proof.empty,c.expected.paidOrders===0?'No paid orders in this period.':'');
  }
  assert.equal(queries,fixture.cases.length,'Every case must execute real H-Code SQL');
  // Changing the underlying SQLite file must be visible on a new browser load.
  const db=new DatabaseSync(dbfile);
  try{db.prepare('INSERT INTO orders(id,region,amount_cents,status,day) VALUES(?,?,?,?,?)')
    .run(99,'North',500,'paid','2026-03-12');}
  finally{db.close();}
  const march=fixture.cases.find(c=>c.id==='march');
  const refreshed=parseProof(await browse(host+'/dashboard?'+new URLSearchParams({
    from:march.from,to:march.to}),join(folder,'chrome-march-reloaded')));
  assert.equal(refreshed.summary,'2 paid orders, 833 minor units');
  assert.deepEqual(refreshed.cells.map(row=>row.map(x=>x.text)),[['North','2','833']]);
  assert.equal(queries,fixture.cases.length+1);
  const bad=await fetch(host+'/dashboard?from=2026-13-40&to=2026-02-01');
  assert.equal(bad.status,400);
  const sqlLike=await fetch(host+'/dashboard?from=2026-01-01%27%20OR%201%3D1--&to=2026-02-01');
  assert.equal(sqlLike.status,400);
  assert.equal(queries,fixture.cases.length+1,
   'Invalid user range must be rejected before any H-Code DB effects');
 }finally{
  if(server)await new Promise(resolve=>server.close(resolve));
  rmSync(folder,{recursive:true,force:true});
 }
});
