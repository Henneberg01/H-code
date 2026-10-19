import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {spawn,spawnSync} from 'node:child_process';
import {readFileSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const base='compact/canonical20/programs/14-browser-storage-demo';
const html=readFileSync(join(root,base+'.html'),'utf8');
function chromePath(){return process.env.HCODE_CHROME||process.env.CHROME_BIN||
 (process.platform==='win32'?'chrome':'google-chrome');}
function browse(chrome,url,profile){
 return new Promise((resolve,reject)=>{
  const child=spawn(chrome,['--headless=new','--disable-gpu','--no-sandbox',
   '--no-first-run','--disable-dev-shm-usage','--virtual-time-budget=3500',
   '--user-data-dir='+profile,'--dump-dom',url],
   {windowsHide:true,stdio:['ignore','pipe','pipe']});
  let stdout='',stderr='',done=false;
  const timeout=setTimeout(()=>finish(Error('Chrome timed out: '+stderr.slice(-3000))),30000);
  function finish(err,value){
   if(done)return;done=true;clearTimeout(timeout);
   if(err){child.kill('SIGKILL');reject(err);}else resolve(value);
  }
  child.on('error',finish);
  child.stdout.on('data',v=>{stdout+=String(v);if(stdout.length>2*1024*1024)
   finish(Error('Unexpected browser output >2MB'));});
  child.stderr.on('data',v=>{if(stderr.length<16384)stderr+=String(v);});
  child.on('exit',code=>code===0?finish(null,stdout):
   finish(Error('Chrome exit '+code+': '+stderr.slice(-2000))));
 });
}
test('real Chrome same-origin localStorage survives full browser restart with native compiled H-Code',async()=>{
 const temp=mkdtempSync(join(tmpdir(),'hcode14-storage-chrome-'));
 let server;
 try{
  const compiled=join(temp,'14-browser-storage-demo.mjs');
  const built=spawnSync('cargo',['run','--quiet','--manifest-path','compiler/Cargo.toml','--',
   'build',join(root,base+'.hc'),'--out',compiled],{
    cwd:root,windowsHide:true,encoding:'utf8',timeout:180000,maxBuffer:1024*1024
   });
  assert.equal(built.status,0,built.stderr||built.stdout||String(built.error));
  const js=readFileSync(compiled);
  assert.ok(js.includes(Buffer.from('globalThis.localStorage')),'real browser storage API must be generated');
  assert.equal(js.includes(Buffer.from('node:fs')),false,'browser app must not import server FS');
  server=createServer((req,res)=>{
   if(req.url==='/14-browser-storage-demo.html'){
    res.writeHead(200,{'content-type':'text/html; charset=utf-8'});res.end(html);return;
   }
   if(req.url==='/14-browser-storage-demo.mjs'){
    res.writeHead(200,{'content-type':'text/javascript; charset=utf-8'});res.end(js);return;
   }
   res.writeHead(404);res.end('not found');
  });
  await new Promise((resolve,reject)=>{
   server.once('error',reject);
   server.listen(0,'127.0.0.1',()=>{server.off('error',reject);resolve();});
  });
  const info=server.address();
  assert.ok(info&&typeof info!=='string');
  const url='http://127.0.0.1:'+info.port+'/14-browser-storage-demo.html';
  const profile=join(temp,'profile');
  function output(dom,id){
   const match=new RegExp('<output id="'+id+'"[^>]*>([^<]*)</output>').exec(dom);
   assert.ok(match,'Chrome rendered no '+id+' node: '+dom.slice(-1400));
   return match[1];
  }
  const first=await browse(chromePath(),url,profile);
  assert.equal(output(first,'before'),'','first visit must see absent storage');
  assert.equal(output(first,'after'),'persisted','first write must be visible');
  const second=await browse(chromePath(),url,profile);
  assert.equal(output(second,'before'),'persisted','a new browser process must read durable state');
  assert.equal(output(second,'after'),'persisted');
  console.log('M19_14_PERSISTENT_BROWSER_ROUNDTRIPS=2');
 }finally{
  if(server)await new Promise(resolve=>server.close(()=>resolve()));
  rmSync(temp,{recursive:true,force:true});
 }
});
