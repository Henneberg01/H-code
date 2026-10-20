import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {mkdtempSync,rmSync,writeFileSync,readFileSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
let driver;
try{driver=await import('./chromium-driver.mjs');}catch(error){if(error.code!=='ERR_MODULE_NOT_FOUND')throw error;}
const binary=process.env.HCODE_CHROME_BINARY||'/usr/bin/chromium';
async function fixture(handler,run){
 assert.equal(typeof driver?.dumpDOM,'function','real Chromium CDP driver is implemented');
 const server=createServer(handler);await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const temporary=mkdtempSync(join(tmpdir(),'jfh-browser-driver-'));
 try{return await run('http://127.0.0.1:'+server.address().port,temporary);}
 finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));rmSync(temporary,{recursive:true,force:true});}
}
test('real Chrome executes modules, DOM events and delayed work before returning DOM',async()=>{
 await fixture((req,res)=>{
  if(req.url==='/app.mjs'){res.setHeader('content-type','text/javascript');res.end('document.querySelector("button").onclick=()=>document.body.dataset.event="yes";window.addEventListener("load",()=>setTimeout(()=>{document.querySelector("button").click();document.body.dataset.delayed="yes";},1000));');return;}
  res.setHeader('content-type','text/html');res.end('<!doctype html><html><head><script type="module" src="/app.mjs"></script></head><body><button>Run</button></body></html>');
 },async(url,temporary)=>{
  const result=await driver.dumpDOM({binary,url,profile:join(temporary,'profile'),virtualTimeBudget:5000});
  assert.match(result,/data-event="yes"/);assert.match(result,/data-delayed="yes"/);assert.match(result,/<!DOCTYPE html>/i);
 });
});
test('graceful browser close preserves actual localStorage across independent launches',async()=>{
 await fixture((_req,res)=>{res.setHeader('content-type','text/html');res.end('<body><script>const count=Number(localStorage.getItem("count")||0)+1;localStorage.setItem("count",String(count));document.body.dataset.count=count;</script></body>');},async(url,temporary)=>{
  const options={binary,url,profile:join(temporary,'profile'),virtualTimeBudget:100};
  assert.match(await driver.dumpDOM(options),/data-count="1"/);
  assert.match(await driver.dumpDOM(options),/data-count="2"/);
 });
});
test('missing browser and unfinished navigation fail rather than manufacture DOM evidence',async()=>{
 await fixture((_req,_res)=>{},async(url,temporary)=>{
  await assert.rejects(driver.dumpDOM({binary:'/missing/jfh-chromium',url,profile:join(temporary,'absent')}),/spawn|ENOENT|launch/i);
  await assert.rejects(driver.dumpDOM({binary,url,profile:join(temporary,'hanging'),timeout:3500}),/timeout|deadline/i);
 });
});
test('deadline rejects pending CDP and kills a stopped browser process', {skip:process.platform!=='linux'},async()=>{
 let browserPid,rescue,pidFile;
 try{
  await fixture((_req,_res)=>{
   if(browserPid)return;
   browserPid=Number(readFileSync(pidFile,'utf8'));
   process.kill(browserPid,'SIGSTOP');
   // Rescue only this test's browser if a broken driver never enters cleanup.
   rescue=setTimeout(()=>{try{process.kill(browserPid,'SIGCONT');}catch{}},8000);
  },async(url,temporary)=>{
   pidFile=join(temporary,'browser.pid');
   const launcher=join(temporary,'launch-browser');
   const quote=value=>"'"+value.replaceAll("'","'\\''")+"'";
   writeFileSync(launcher,`#!/bin/sh\nprintf '%s' "$$" > ${quote(pidFile)}\nexec ${quote(binary)} "$@"\n`,{mode:0o755});
   const started=performance.now();
   await assert.rejects(driver.dumpDOM({binary:launcher,url,profile:join(temporary,'stopped'),timeout:3500}),/timeout/i);
   assert.ok(browserPid,'the actual browser was stopped during navigation');
   assert.ok(performance.now()-started<6000,'deadline includes bounded process cleanup');
   assert.throws(()=>process.kill(browserPid,0),{code:'ESRCH'},'owned stopped browser was killed');
  });
 }finally{clearTimeout(rescue);if(browserPid){try{process.kill(browserPid,'SIGKILL');}catch{}}}
});
