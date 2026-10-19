import test from 'node:test';
import assert from 'node:assert/strict';
import {stripTypeScriptTypes} from 'node:module';
import {createServer} from 'node:http';
import {spawn,spawnSync} from 'node:child_process';
import {readFileSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=fileURLToPath(new URL('../',import.meta.url));
const HC='compact/canonical20/programs/14-todo-app.hc';
const TS='compact/canonical20/idiomatic/14-todo-app.ts';
const HTML='compact/canonical20/programs/14-todo-app.html';
const PROBE='scripts/m19-todo-browser-probe.js';
const bytes=p=>readFileSync(join(root,p));
const cp=s=>[...s].length;
const chrome=()=>process.env.HCODE_CHROME||process.env.CHROME_BIN||'google-chrome';
function browse(url,profile){
 return new Promise((resolve,reject)=>{
  const child=spawn(chrome(),['--headless=new','--disable-gpu','--no-first-run',
   '--no-sandbox','--disable-dev-shm-usage','--virtual-time-budget=5000',
   '--user-data-dir='+profile,'--dump-dom',url],{windowsHide:true,stdio:['ignore','pipe','pipe']});
  let done=false,stdout='',stderr='';
  const timeout=setTimeout(()=>finish(Error('Chrome timed out: '+stderr.slice(-2000))),30000);
  function finish(e,value){
   if(done)return;done=true;clearTimeout(timeout);
   if(e){child.kill('SIGKILL');reject(e);}else resolve(value);
  }
  child.on('error',finish);
  child.stdout.on('data',v=>{stdout+=String(v);if(stdout.length>2*1024*1024)finish(Error('Chrome output >2MB'));});
  child.stderr.on('data',v=>{if(stderr.length<16384)stderr+=String(v);});
  child.on('exit',code=>code===0?finish(null,stdout):
   finish(Error('Chrome exited '+code+': '+stderr.slice(-2000))));
 });
}
async function run(){
 const temp=mkdtempSync(join(tmpdir(),'hcode14-todo-chrome-'));
 let server;
 try{
  const compiled=join(temp,'todo.mjs');
  const result=spawnSync('cargo',['run','--quiet','--manifest-path','compiler/Cargo.toml','--',
   'build',join(root,HC),'--out',compiled],{cwd:root,windowsHide:true,encoding:'utf8',timeout:180000,maxBuffer:1048576});
  assert.equal(result.status,0,result.stderr||result.stdout||String(result.error));
  const emitted=readFileSync(compiled,'utf8');
  const competitor=stripTypeScriptTypes(bytes(TS).toString('utf8'),{mode:'strip'});
  const html=bytes(HTML).toString('utf8');
  const probe=bytes(PROBE);
  server=createServer((req,res)=>{
   const url=new URL(req.url??'/', 'http://localhost');
   if(url.pathname==='/todo'){
    const app=url.searchParams.get('engine')==='hcode'?'hcode':'typescript';
    const page=html.replace('./14-todo-app.mjs','/'+app+'.mjs')
      .replace('</body>','<script defer src="/probe.js"></script></body>');
    res.writeHead(200,{'content-type':'text/html; charset=utf-8','cache-control':'no-store'});res.end(page);return;
   }
   if(url.pathname==='/hcode.mjs'||url.pathname==='/typescript.mjs'){
    res.writeHead(200,{'content-type':'text/javascript; charset=utf-8','cache-control':'no-store'});
    res.end(url.pathname==='/hcode.mjs'?emitted:competitor);return;
   }
   if(url.pathname==='/probe.js'){
    res.writeHead(200,{'content-type':'text/javascript; charset=utf-8','cache-control':'no-store'});
    res.end(probe);return;
   }
   res.writeHead(404);res.end('Not found');
  });
  await new Promise((ok,fail)=>{
   server.once('error',fail);
   server.listen(0,'127.0.0.1',()=>{server.off('error',fail);ok();});
  });
  const address=server.address();assert.ok(address&&typeof address!=='string');
  const host='http://127.0.0.1:'+address.port;
  async function runEngine(name){
   const profile=join(temp,'profile-'+name),traces=[];
   for(const phase of ['one','two','three']){
    const dom=await browse(host+'/todo?engine='+name+'&phase='+phase,profile);
    const marker=/<output id="hcode-todo-proof">([^<]+)<\/output>/.exec(dom);
    assert.ok(marker,'Missing real browser probe '+name+'/'+phase+': '+dom.slice(-2000));
    const value=JSON.parse(decodeURIComponent(marker[1].replaceAll('&amp;','&')));
    assert.ok(value.length>0&&!value.some(x=>'fatal'in x),
     'Browser app error '+name+'/'+phase+': '+JSON.stringify(value));
    traces.push(value);
   }
   return traces;
  }
  const rust=await runEngine('hcode');
  const ts=await runEngine('typescript');
  assert.deepEqual(rust,ts,'Real Chrome todo DOM+storage semantic traces differ');
  assert.equal(rust[0][0].stored,null,'Fresh profile must start empty');
  assert.equal(rust[0][0].listRole,'UL','True semantic list required');
  assert.equal(rust[0][0].statusRole,'status');
  assert.equal(rust[0][0].statusAria,'polite');
  assert.equal(rust[0][1].cancelled,true,'Invalid task must be rejected');
  assert.equal(rust[0][4].cancelled,true,'Duplicate task must be rejected');
  assert.equal(rust[0][8].htmlInjectionCreatedNode,false,'Task HTML must remain text');
  assert.deepEqual(rust[0].at(-1).stored,[{title:'Buy milk',done:true}]);
  assert.deepEqual(rust[1][0].stored,rust[0].at(-1).stored,'Durability over browser restart');
  assert.deepEqual(rust[2][0].stored,[{title:'🚀 Launch',done:true}],
   'Unicode, completion and removal persisted over second browser restart');
  const h=bytes(HC).toString('utf8'),t=bytes(TS).toString('utf8');
  const report={hcode:{codepoints:cp(h),utf8Bytes:Buffer.byteLength(h)},
   idiomaticTypescript:{codepoints:cp(t),utf8Bytes:Buffer.byteLength(t)},
   generatedHCodeESMBytes:Buffer.byteLength(emitted),
   reductionCodepointPct:Number((100*(1-cp(h)/cp(t))).toFixed(2)),
   reductionBytePct:Number((100*(1-Buffer.byteLength(h)/Buffer.byteLength(t))).toFixed(2)),
   globallyVerified70Percent:false};
  console.log('M19_14_SOURCE_AND_RUNTIME='+JSON.stringify(report));
  console.log('M19_14_REAL_CHROME_SCENARIOS='+rust.reduce((n,x)=>n+x.length,0));
  return report;
 }finally{
  if(server)await new Promise(resolve=>server.close(()=>resolve()));
  rmSync(temp,{recursive:true,force:true});
 }
}
test('source-authored H-Code and idiomatic TypeScript todo apps match three actual Chromium process lifetimes',async()=>{
 await run();
});
