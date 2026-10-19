// Canonical15 B5: real Chromium parity for the full SQL-FREE H-Code backend
// and untouched idiomatic TypeScript frontend/backend on the SAME SQLite file.
import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn,spawnSync} from 'node:child_process';
import {createServer} from 'node:http';
import {stripTypeScriptTypes} from 'node:module';
import {readFileSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {DatabaseSync} from 'node:sqlite';
import {seedDatabase} from './canonical20-db-oracle.ts';
import {queryDashboard} from '../compact/canonical20/idiomatic/15-db-dashboard-backend.ts';

const root=fileURLToPath(new URL('../',import.meta.url));
const read=p=>readFileSync(join(root,p),'utf8');
const fixture=JSON.parse(read('compact/canonical20/cases/15-db-dashboard.json'));
const shell=read('compact/canonical20/programs/15-db-dashboard.html');
const probe=read('scripts/m19-db-dashboard-browser-probe.js');
const tsUI=stripTypeScriptTypes(read('compact/canonical20/idiomatic/15-db-dashboard-browser.ts'),{mode:'strip'});
const escapeAttribute=s=>s.replace(/[&<>"']/g,c=>({
  '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
})[c]);
const chrome=()=>process.env.HCODE_CHROME||process.env.CHROME_BIN||'google-chrome';
function buildHCode(file,out){
 const x=spawnSync('cargo',['run','--quiet','--manifest-path','compiler/Cargo.toml','--',
  'build',join(root,file),'--out',out],{cwd:root,encoding:'utf8',windowsHide:true,timeout:180000,maxBuffer:1048576});
 assert.equal(x.status,0,x.stderr||x.stdout||String(x.error));
 return readFileSync(out,'utf8');
}
function chromeDOM(url,profile){
 return new Promise((resolve,reject)=>{
  const child=spawn(chrome(),['--headless=new','--disable-gpu','--no-first-run','--no-sandbox',
    '--disable-dev-shm-usage','--virtual-time-budget=6000',
    '--user-data-dir='+profile,'--dump-dom',url],{stdio:['ignore','pipe','pipe'],windowsHide:true});
  let out='',err='',done=false;
  const timeout=setTimeout(()=>complete(Error('Chromium timed out: '+err.slice(-1400))),30000);
  function complete(error,value){
   if(done)return;done=true;clearTimeout(timeout);
   if(error){child.kill('SIGKILL');reject(error);}else resolve(value);
  }
  child.on('error',complete);
  child.stdout.on('data',b=>{out+=String(b);if(out.length>2097152)complete(Error('Chromium stdout overflow'));});
  child.stderr.on('data',b=>{if(err.length<16000)err+=String(b);});
  child.on('exit',code=>code===0?complete(null,out):
    complete(Error('Chromium exit '+code+': '+err.slice(-1400))));
 });
}
function extract(dom){
 const m=/<output id="hcode-db-proof"[^>]*>([^<]*)<\/output>/.exec(dom);
 assert.ok(m,'Real browser proof was not rendered: '+dom.slice(-1200));
 const result=JSON.parse(decodeURIComponent(m[1].replaceAll('&amp;','&')));
 assert.ok(!result.fatal,'Browser exception: '+JSON.stringify(result));
 return result;
}
test('independent TS and SQL-free full H-Code dashboard match in actual Chromium and SQLite',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'hcode15-b3-chrome-'));let server;
 try{
  const dbfile=join(dir,'orders.sqlite');
  seedDatabase(dbfile,fixture.seed);
  const hcBackend=join(dir,'hc-backend.mjs'),hcBrowser=join(dir,'hc-browser.mjs');
  const backend=buildHCode('compact/canonical20/candidates/15-db-dashboard-sqlfree-b4.hc',hcBackend);
  const frontend=buildHCode('compact/canonical20/programs/15-db-dashboard-ui.hc',hcBrowser);
  assert.match(backend,/node:sqlite/);
  assert.doesNotMatch(frontend,/node:sqlite/);
  assert.ok(!tsUI.includes("from 'node:sqlite'"),'TS browser must not use OS database');
  let hcCalls=0,tsCalls=0;
  server=createServer((req,res)=>{
   const url=new URL(req.url||'/', 'http://127.0.0.1');
   const security={'cache-control':'no-store','x-content-type-options':'nosniff',
    'content-security-policy':"default-src 'none'; script-src 'self'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'"};
   if(url.pathname==='/probe.js'||url.pathname==='/hcode-ui.mjs'||url.pathname==='/typescript-ui.mjs'){
    res.writeHead(200,{...security,'content-type':'text/javascript; charset=utf-8'});
    res.end(url.pathname==='/probe.js'?probe:url.pathname==='/typescript-ui.mjs'?tsUI:frontend);
    return;
   }
   if(url.pathname!=='/dashboard'){
    res.writeHead(404,security);res.end('Not found');return;
   }
   const engine=url.searchParams.get('engine');
   const from=url.searchParams.get('from')||'2026-01-01',to=url.searchParams.get('to')||'2026-02-01';
   const valid=d=>/^\d{4}-\d{2}-\d{2}$/.test(d)&&
    Number.isFinite(Date.parse(d+'T00:00:00Z'))&&new Date(d+'T00:00:00Z').toISOString().slice(0,10)===d;
   if(!['hcode','typescript'].includes(engine)||!valid(from)||!valid(to)||from>=to){
    res.writeHead(400,security);res.end('Invalid engine/date');return;
   }
   let data;
   if(engine==='typescript'){
    ++tsCalls;data=queryDashboard(dbfile,from,to);
   }else{
    ++hcCalls;
    const x=spawnSync(process.execPath,['--experimental-sqlite',hcBackend],{
     cwd:root,input:JSON.stringify({from,to}),windowsHide:true,encoding:'utf8',
     timeout:20000,maxBuffer:1048576,env:{...process.env,HCODE_SQLITE_READ_ROOT:dir}
    });
    if(x.status!==0){
     res.writeHead(500,security);res.end('H-Code SQLite failed');return;
    }
    data=JSON.parse(x.stdout.trim());
   }
   const page=shell.replace('__FROM__',escapeAttribute(from)).replace('__TO__',escapeAttribute(to))
    .replace('__PAYLOAD__',escapeAttribute(JSON.stringify(data)))
    .replace('/hcode-ui.mjs',engine==='typescript'?'/typescript-ui.mjs':'/hcode-ui.mjs');
   res.writeHead(200,{...security,'content-type':'text/html; charset=utf-8'});res.end(page);
  });
  await new Promise((ok,fail)=>{
    server.once('error',fail);
    server.listen(0,'127.0.0.1',()=>{server.off('error',fail);ok();});
  });
  const addr=server.address();assert.ok(addr&&typeof addr!=='string');
  const origin='http://127.0.0.1:'+addr.port;
  for(const c of fixture.cases){
    const params=new URLSearchParams({from:c.from,to:c.to});
    const results=[];
    for(const engine of ['hcode','typescript']){
      const url=origin+'/dashboard?'+params.toString()+'&engine='+engine;
      const proof=extract(await chromeDOM(url,join(dir,'profile-'+engine+'-'+c.id)));
      results.push(proof);
    }
    assert.deepEqual(results[0],results[1],'Real Chromium H-Code/TS disagree for '+c.id);
    const proof=results[0];
    assert.equal(proof.summary,c.expected.paidOrders+' paid orders, '+
      c.expected.revenueCents+' minor units');
    assert.deepEqual(proof.cells.map(r=>r.map(cell=>cell.text)),
      c.expected.byRegion.map(r=>[r.region,String(r.paidOrders),String(r.revenueCents)]));
    assert.equal(proof.images,0,'SQL-stored markup must stay inert text');
    assert.equal(proof.scripts,0,'SQL-stored scripts must not execute');
    assert.ok(proof.columns.every(x=>x.scope==='col'&&x.tag==='TH'));
    assert.ok(proof.cells.every(row=>row[0]?.scope==='row'&&row[0]?.tag==='TH')||
      proof.cells.length===0);
  }
  assert.equal(hcCalls,fixture.cases.length);
  assert.equal(tsCalls,fixture.cases.length);
  // Backend mutation/reopen must affect both independent engines identically.
  const db=new DatabaseSync(dbfile);
  try{db.prepare('INSERT INTO orders(id,region,amount_cents,status,day) VALUES(?,?,?,?,?)')
    .run(99,'North',500,'paid','2026-03-12');}
  finally{db.close();}
  const date='from=2026-03-01&to=2026-04-01';
  const h=extract(await chromeDOM(origin+'/dashboard?'+date+'&engine=hcode',join(dir,'refresh-h')));
  const t=extract(await chromeDOM(origin+'/dashboard?'+date+'&engine=typescript',join(dir,'refresh-t')));
  assert.deepEqual(h,t);
  assert.equal(h.summary,'2 paid orders, 833 minor units');
 }finally{
   if(server)await new Promise(ok=>server.close(ok));
   rmSync(dir,{recursive:true,force:true});
 }
});
