import test from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import WS from 'ws';
let runtime;
try{runtime=await import('../runtime/websocket.mjs');}catch(error){if(error.code!=='ERR_MODULE_NOT_FOUND')throw error;}
const deadline=()=>AbortSignal.timeout(5000);
async function peer(port){
 const socket=new WebSocket(`ws://127.0.0.1:${port}/`),messages=[],waiting=[];
 socket.addEventListener('message',event=>{messages.push(event.data);waiting.shift()?.();});
 await once(socket,'open',{signal:deadline()});
 let consumed=0;
 return {socket,messages,async next(){if(messages.length<=consumed)await new Promise((resolve,reject)=>{
  const timer=setTimeout(()=>reject(Error('wire message timeout')),5000);waiting.push(()=>{clearTimeout(timer);resolve();});
 });return messages[consumed++];}};
}
async function server(handler,initial='seed'){
 assert.equal(typeof runtime?.serveWebSocket,'function','generic WebSocket transport is implemented');
 const host=runtime.serveWebSocket(handler,initial,{listen:'127.0.0.1:0'});
 await once(host.server,'listening',{signal:deadline()});
 return {...host,port:host.server.address().port};
}
test('real independent WebSocket clients receive Unicode echo in event order',async()=>{
 const seen=[];let closedCallback;
 const closeSeen=new Promise((resolve,reject)=>{closedCallback=resolve;deadline().addEventListener('abort',()=>reject(Error('close callback timeout')),{once:true});});
 const host=await server((e,state)=>{seen.push(e.kind);if(e.kind==='close')closedCallback();return {state,messages:e.kind==='close'?[]:[{client:e.client,data:e.kind==='open'?'ready':e.data}]};});
 try{
  const a=await peer(host.port),b=await peer(host.port);
  assert.equal(await a.next(),'ready');assert.equal(await b.next(),'ready');
  a.socket.send('Møbel 🙂');assert.equal(await a.next(),'Møbel 🙂');
  for(let i=0;i<120;i++)a.socket.send(String(i));
  for(let i=0;i<120;i++)assert.equal(await a.next(),String(i));
  const closed=once(b.socket,'close',{signal:deadline()});b.socket.close();await closed;await closeSeen;
  assert.equal(seen.filter(x=>x==='close').length,1);
 }finally{await host.close();}
});
test('complete callback output is validated before committing state or any sends',async()=>{
 const host=await server((e,state)=>({state:e.data==='bad'?'corrupt':state,messages:e.kind!=='message'?[]:
  e.data==='bad'?[{client:e.client,data:'leak'},{client:e.client,data:1}]:[{client:e.client,data:state}]}));
 try{
  const a=await peer(host.port),b=await peer(host.port);
  const closed=once(a.socket,'close',{signal:deadline()});a.socket.send('bad');
  const [event]=await closed;assert.equal(event.code,1011);assert.deepEqual(a.messages,[]);
  b.socket.send('ok');assert.equal(await b.next(),'seed');
 }finally{await host.close();}
});
test('binary, oversized and malformed UTF8 frames are rejected with protocol codes',async()=>{
 const host=await server((e,state)=>({state,messages:e.kind==='message'?[{client:e.client,data:e.data}]:[]}));
 try{
  const good=await peer(host.port);good.socket.send('ø'.repeat(8192));assert.equal((await good.next()).length,8192);
  for(const [data,code] of [[new Uint8Array([1]),1003],['x'.repeat(16385),1009]]){
   const p=await peer(host.port),closed=once(p.socket,'close',{signal:deadline()});p.socket.send(data);
   assert.equal((await closed)[0].code,code);
  }
  const raw=new WS(`ws://127.0.0.1:${host.port}/`);await once(raw,'open',{signal:deadline()});
  const closed=once(raw,'close',{signal:deadline()});raw.send(Buffer.from([255]),{binary:false});
  assert.equal((await closed)[0],1007);
  good.socket.send('still usable');assert.equal(await good.next(),'still usable');
 }finally{await host.close();}
});
test('missing explicit listen grant and malformed initial state fail before bind',()=>{
 assert.equal(typeof runtime?.serveWebSocket,'function');
 const previous=process.env.HCODE_WS_LISTEN;delete process.env.HCODE_WS_LISTEN;
 try{assert.throws(()=>runtime.serveWebSocket(()=>{},''),/WebSocket listen capability denied/);}
 finally{if(previous!==undefined)process.env.HCODE_WS_LISTEN=previous;}
 assert.throws(()=>runtime.serveWebSocket(()=>{},'\ud800',{listen:'127.0.0.1:0'}),/state/);
});
