// Actual Chromium DOM capture through CDP, independent of --dump-dom CLI completion.
import {spawn} from 'node:child_process';
import {existsSync,readFileSync,mkdirSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {setTimeout as delay} from 'node:timers/promises';

async function connectCDP(url,signal){
 signal.throwIfAborted();
 const socket=new WebSocket(url),pending=new Map(),listeners=new Map();let next=0,failure,rejectConnection;
 const rejectAll=error=>{failure??=error;rejectConnection?.(failure);for(const item of pending.values())item.reject(failure);pending.clear();for(const item of listeners.values())item.reject(failure);listeners.clear();};
 // Reject immediately: a stopped browser cannot finish a graceful WS close.
 const aborted=()=>{rejectAll(signal.reason);socket.close();};signal.addEventListener('abort',aborted,{once:true});
 socket.addEventListener('close',()=>rejectAll(Error('Chromium CDP connection closed')));
 socket.addEventListener('error',()=>rejectAll(Error('Chromium CDP connection failed')));
 socket.addEventListener('message',event=>{
  if(Buffer.byteLength(String(event.data))>8*1024*1024){rejectAll(Error('Chromium CDP message exceeds cap'));socket.close();return;}
  let message;try{message=JSON.parse(event.data);}catch{rejectAll(Error('Malformed Chromium CDP message'));socket.close();return;}
  if(process.env.HCODE_BROWSER_DEBUG==='1')console.error('CDP receive',message.id??message.method);
  if(message.id){const item=pending.get(message.id);if(!item)return;pending.delete(message.id);message.error?item.reject(Error(`Chromium ${item.method}: ${message.error.message}`)):item.resolve(message.result);}
  else if(message.method){const item=listeners.get(message.method);if(item){listeners.delete(message.method);item.resolve(message.params);}}
 });
 try{
  await new Promise((resolve,reject)=>{
   rejectConnection=reject;
   if(signal.aborted){aborted();return;}
   socket.addEventListener('open',resolve,{once:true});
  });
 }catch(error){signal.removeEventListener('abort',aborted);socket.close();throw error;}
 rejectConnection=null;
 return {
  call(method,params={}){if(failure)return Promise.reject(failure);if(process.env.HCODE_BROWSER_DEBUG==='1')console.error('CDP send',method);return new Promise((resolve,reject)=>{const id=++next;pending.set(id,{resolve,reject,method});socket.send(JSON.stringify({id,method,params}));});},
  event(method){const promise=new Promise((resolve,reject)=>failure?reject(failure):listeners.set(method,{resolve,reject}));promise.catch(()=>{});return promise;},
  close(){signal.removeEventListener('abort',aborted);socket.close();rejectAll(Error('Chromium driver closed'));}
 };
}
function killBrowser(child,signal){
 if(!child.pid||child.exitCode!==null||child.signalCode!==null)return;
 try{if(process.platform==='win32')child.kill(signal);else process.kill(-child.pid,signal);}catch(error){if(error.code!=='ESRCH')throw error;}
}
export async function waitForPageTarget(port,signal){
 // Chromium publishes the debug port before its initial page is necessarily
 // created. Wait for that page under the same bounded capture deadline.
 for(;;){
  const targets=await fetch(`http://127.0.0.1:${port}/json/list`,{signal}).then(response=>{
   if(!response.ok)throw Error('Chromium target discovery failed');return response.json();
  });
  const page=targets.find(target=>target.type==='page'&&target.webSocketDebuggerUrl);
  if(page)return page;
  await delay(25,undefined,{signal});
 }
}
export async function dumpDOM({binary,url,profile,virtualTimeBudget=5000,timeout=22000,args=[]}){
 if(!binary||!profile||!Number.isSafeInteger(virtualTimeBudget)||virtualTimeBudget<0||virtualTimeBudget>60000)throw Error('Invalid Chromium driver configuration');
 const target=new URL(url);
 if(target.protocol!=='http:'||!['127.0.0.1','localhost','[::1]'].includes(target.hostname))throw Error('Chromium proof driver requires a local HTTP fixture');
 mkdirSync(profile,{recursive:true});
 // Old profiles retain this file after a clean close; never attach to its stale port.
 rmSync(join(profile,'DevToolsActivePort'),{force:true});
 const signal=AbortSignal.timeout(timeout);
 const child=spawn(binary,[...args,'--headless=new','--disable-gpu','--no-sandbox','--no-first-run','--disable-dev-shm-usage',
  '--remote-debugging-port=0','--user-data-dir='+profile,'about:blank'],{
  detached:process.platform!=='win32',windowsHide:true,stdio:['ignore','ignore','pipe']
 });
 let failure=null,stderr='',client,phase='port discovery';
 const exited=new Promise(resolve=>{child.once('exit',(code,termination)=>resolve({code,termination}));child.once('error',error=>{failure=error;resolve({code:null,termination:null});});});
 child.stderr.on('data',chunk=>{stderr=(stderr+chunk).slice(-12000);});
 try{
  while(!existsSync(join(profile,'DevToolsActivePort'))){
   if(failure)throw failure;
   if(child.exitCode!==null||child.signalCode!==null)throw Error(`Chromium launch failed: ${stderr}`);
   await delay(25,undefined,{signal});
  }
  const port=Number(readFileSync(join(profile,'DevToolsActivePort'),'utf8').split('\n')[0]);
  if(!Number.isInteger(port)||port<1||port>65535)throw Error('Invalid actual Chromium DevTools port');
  phase='target discovery';
  const page=await waitForPageTarget(port,signal);
  phase='CDP attach';
  client=await connectCDP(page.webSocketDebuggerUrl,signal);
  phase='Page.enable';await client.call('Page.enable');
  const loaded=client.event('Page.loadEventFired');
  phase='navigation';const navigation=await client.call('Page.navigate',{url});
  if(navigation.errorText)throw Error('Chromium navigation failed: '+navigation.errorText);
  phase='page load';await loaded;
  // Modern Chromium can exhaust an about:blank budget before Page.navigate;
  // start the bounded virtual-time window only after the actual page loads.
  const budget=client.event('Emulation.virtualTimeBudgetExpired');
  phase='virtual time policy';await client.call('Emulation.setVirtualTimePolicy',{policy:'pauseIfNetworkFetchesPending',budget:Math.max(1,virtualTimeBudget)});
  phase='virtual time completion';await budget;
  phase='DOM snapshot';const document=await client.call('DOM.getDocument');
  const {outerHTML}=await client.call('DOM.getOuterHTML',{nodeId:document.root.nodeId});
  if(typeof outerHTML!=='string'||Buffer.byteLength(outerHTML)>2*1024*1024)throw Error('Chromium DOM output exceeds cap');
  // The managed browser restores open tabs on its next launch. Retire our
  // test page first so reopening the profile cannot execute the app twice.
  phase='test page cleanup';
  await client.call('Emulation.setScriptExecutionDisabled',{value:true});
  const retired=client.event('Page.loadEventFired');
  await client.call('Page.navigate',{url:'about:blank'});
  await client.call('Emulation.setVirtualTimePolicy',{policy:'advance'});
  await retired;
  phase='browser close';await client.call('Browser.close').catch(()=>{});
  signal.throwIfAborted();
  const outcome=await Promise.race([exited,delay(4000,undefined,{ref:false,signal}).then(()=>{throw Error('Chromium clean close timeout');})]);
  if(outcome.code!==0)throw Error('Chromium did not exit cleanly: '+stderr);
  return outerHTML+'\n';
 }catch(error){
  if(signal.aborted)throw Error(`Chromium timeout during ${phase} after ${timeout}ms: ${stderr.slice(-1500)}`,{cause:error});
  throw error;
 }finally{
  client?.close();
  if(child.exitCode===null&&child.signalCode===null){
   killBrowser(child,'SIGTERM');await Promise.race([exited,delay(500,undefined,{ref:false})]);
   killBrowser(child,'SIGKILL');await Promise.race([exited,delay(500,undefined,{ref:false})]);
  }
 }
}
