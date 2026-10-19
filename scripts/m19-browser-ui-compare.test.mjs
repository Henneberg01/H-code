import test from 'node:test';
import assert from 'node:assert/strict';
import {stripTypeScriptTypes} from 'node:module';
import {createServer} from 'node:http';
import {createHash} from 'node:crypto';
import {spawn,spawnSync} from 'node:child_process';
import {readFileSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const at=path=>readFileSync(join(root,path),'utf8');
const HC='compact/canonical20/programs/13-form-validation-ui.hc';
const TS='compact/canonical20/idiomatic/13-form-validation-ui.ts';
const HTML='compact/canonical20/programs/13-form-validation-ui.html';
const PROBE='scripts/m19-browser-ui-probe.js';
const html=at(HTML).replace('./13-form-validation-ui.mjs','./module.mjs')
  .replace('</body>','<script defer src="/probe.js"></script></body>');
const probe=at(PROBE);
// Git blob source locks forbid changing either program or acceptance page
// to manufacture compression savings or make the comparison easier.
const SOURCE_LOCKS={
 [HC]:'67d5766dd1624fb9780639d574a13d15f8a55e6f',
 [TS]:'716aeede97a7cda7a0e45b0ea638e842f0684ef9',
 [HTML]:'376e62dbc511d8feb137d4c8d05a8e8461b8703a',
 [PROBE]:'58bfe367b7f26926e360b9045ae28624fd2fb0b8',
 'compact/canonical20/workloads.json':'46653ef90ffb3e420fba4ddfbfac3c4cfd57f3b3'
};
function assertLockedSources(){
 for(const [path,expected] of Object.entries(SOURCE_LOCKS)){
   const bytes=readFileSync(join(root,path));
   const actual=createHash('sha1').update('blob '+bytes.length+'\0').update(bytes).digest('hex');
   assert.equal(actual,expected,'Canonical13 source lock mismatch: '+path);
 }
 const original=JSON.parse(at('compact/canonical20/workloads.json'));
 assert.equal(original.workloads[12].id,'13-form-validation-ui');
 assert.equal(original.workloads[12].status,'unsupported');
 assert.equal(original.workloads[12].acceptance,
   'interactive required/email validation with accessible error feedback');
}
function count(text){return [...text].length;}
async function runBrowser(moduleSource,temp,label){
 let server;
 try{
  server=createServer((req,res)=>{
   if(req.url==='/form'){
    res.writeHead(200,{'content-type':'text/html; charset=utf-8','cache-control':'no-store'});res.end(html);return;
   }
   if(req.url==='/module.mjs'){
    res.writeHead(200,{'content-type':'text/javascript; charset=utf-8','cache-control':'no-store'});res.end(moduleSource);return;
   }
   if(req.url==='/probe.js'){
    res.writeHead(200,{'content-type':'text/javascript; charset=utf-8','cache-control':'no-store'});res.end(probe);return;
   }
   res.writeHead(404);res.end('not found');
  });
  await new Promise((ok,fail)=>{
   server.once('error',fail);
   server.listen(0,'127.0.0.1',()=>{server.off('error',fail);ok();});
  });
  const address=server.address();
  assert.ok(address&&typeof address!=='string');
  const chrome=process.env.HCODE_CHROME||process.env.CHROME_BIN||'google-chrome';
  const args=['--headless=new','--disable-gpu','--no-sandbox','--no-first-run',
    '--disable-dev-shm-usage','--virtual-time-budget=5000',
    '--user-data-dir='+join(temp,'chrome-'+label),'--dump-dom',
    'http://127.0.0.1:'+address.port+'/form'];
  const output=await new Promise((resolve,reject)=>{
   const child=spawn(chrome,args,{stdio:['ignore','pipe','pipe'],windowsHide:true});
   let done=false,stdout='',stderr='';
   const deadline=setTimeout(()=>finish(Error('Chrome timeout: '+stderr.slice(-1500))),30000);
   function finish(error,value){
    if(done)return;done=true;clearTimeout(deadline);
    if(error){child.kill('SIGKILL');reject(error);}else resolve(value);
   }
   child.on('error',finish);
   child.stdout.on('data',v=>{stdout+=String(v);if(stdout.length>2*1024*1024)finish(Error('Chrome output exceeds cap'));});
   child.stderr.on('data',v=>{if(stderr.length<16000)stderr+=String(v);});
   child.on('exit',c=>c===0?finish(null,stdout):finish(Error('Chrome failed '+c+': '+stderr.slice(-2000))));
  });
  const trace=/<output id="browser-parity-trace">([^<]+)<\/output>/.exec(output);
  assert.ok(trace,'Missing actual Chrome DOM trace for '+label+': '+output.slice(-3000));
  return JSON.parse(decodeURIComponent(trace[1].replaceAll('&amp;','&')));
 }finally{
  if(server)await new Promise(resolve=>server.close(()=>resolve()));
 }
}
test('Canonical13 B2: native Rust H-Code and independent idiomatic TS produce EXACT same real browser form behavior',async()=>{
 assertLockedSources();
 const temp=mkdtempSync(join(tmpdir(),'hcode13-browser-parity-'));
 try{
  const generated=join(temp,'hcode.mjs');
  const built=spawnSync('cargo',['run','--quiet','--manifest-path','compiler/Cargo.toml','--',
    'build',join(root,HC),'--out',generated],{
     cwd:root,windowsHide:true,encoding:'utf8',timeout:180000,maxBuffer:1048576
  });
  assert.equal(built.status,0,built.stderr||built.stdout||String(built.error));
  const hcode=readFileSync(generated,'utf8');
  const idiomatic=stripTypeScriptTypes(at(TS),{mode:'strip'});
  assert.equal(hcode.includes('node:fs'),false,'Browser ESM must not include Node dependency');
  const actual=await runBrowser(hcode,temp,'hcode');
  const expected=await runBrowser(idiomatic,temp,'typescript');
  assert.equal(actual.length,9);
  assert.deepEqual(actual,expected,'All HTML5 events, accessible updates and DOM text differ');
  assert.deepEqual(actual.map(x=>x.stage),['invalid','html-injection','valid','required-empty','missing-at','missing-domain','plus-address','hyphen-host','embedded-space']);
  assert.equal(actual[0].aria,'true');
  assert.equal(actual[0].cancelled,true);
  assert.equal(actual[0].nativeValid,false);
  assert.equal(actual[1].createdImage,false);
  assert.match(actual[1].html,/&lt;img/);
  assert.equal(actual[2].aria,'false');
  assert.equal(actual[2].cancelled,false);
  assert.equal(actual[2].nativeValid,true);
  for(const [index,valid] of [false,false,false,true,true,false].entries()){
    const stage=actual[3+index];
    assert.equal(stage.nativeValid,valid,stage.stage+' native HTML5 validity');
    assert.equal(stage.cancelled,!valid,stage.stage+' form submit prevention');
    assert.equal(stage.aria,valid?'false':'true',stage.stage+' aria-invalid feedback');
  }
  console.log('CANONICAL13_GENERATED_ESM_UTF8_BYTES='+Buffer.byteLength(hcode));
 }finally{rmSync(temp,{recursive:true,force:true});}
});
test('Canonical13 B2: count developer-authored source separately from emitted ESM and do NOT infer global 70 percent',()=>{
 assertLockedSources();
 const h=at(HC),t=at(TS);
 const report={
  hcode:{codepoints:count(h),utf8Bytes:Buffer.byteLength(h)},
  typescriptIdiomatic:{codepoints:count(t),utf8Bytes:Buffer.byteLength(t)},
  codepointReductionPct:Number((100*(1-count(h)/count(t))).toFixed(2)),
  byteReductionPct:Number((100*(1-Buffer.byteLength(h)/Buffer.byteLength(t))).toFixed(2)),
  globallyVerified70Percent:false
 };
 assert.ok(report.hcode.codepoints>0&&report.typescriptIdiomatic.codepoints>0);
 assert.equal(report.globallyVerified70Percent,false);
 console.log('CANONICAL13_IDIOMATIC_SOURCE_REPORT='+JSON.stringify(report));
});
