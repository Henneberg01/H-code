// Real native/reference/TS servers; independent Node built-in WebSocket clients.
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {readFileSync,writeFileSync,mkdtempSync,rmSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {compiler,invoke,success} from './canonical20-project-tools.mjs';
const root=fileURLToPath(new URL('../',import.meta.url)),folder='compact/canonical20/chat17';
const fixture=JSON.parse(readFileSync(join(root,folder,'fixtures.json')));
const engines=['native','reference','typescript'];
const hc=join(root,folder,'hcode/main.hc'),ts=join(root,folder,'typescript/main.ts');
async function start(engine,built,source=hc,typescript=ts){
 const args=engine==='native'?[built]:engine==='reference'?[join(root,'scripts/canonical20-chat-reference-host.mjs'),source]:['--experimental-strip-types',typescript];
 const env={...process.env,HCODE_WS_LISTEN:'127.0.0.1:0',HCODE_WS_HOST_IPC:'1'};
 delete env.NODE_TEST_CONTEXT;delete env.NODE_TEST_REPORTER;
 const child=spawn(process.execPath,args,{cwd:root,env,stdio:['ignore','pipe','pipe','ipc'],windowsHide:true});
 let stderr='',stdout='';child.stderr.on('data',chunk=>{if(stderr.length<8192)stderr+=chunk;});
 const port=await new Promise((resolve,reject)=>{
  let settled=false;
  const timer=setTimeout(()=>done(Error(`${engine} startup timeout ${stderr}`)),10000);
  const onError=e=>done(e),onExit=code=>done(Error(`${engine} exited before listening ${code}: ${stderr}`));
  const onData=data=>{stdout+=data;const found=/^HCODE_WS_READY=(\d+)$/m.exec(stdout);if(found)done(null,Number(found[1]));else if(stdout.length>8192)done(Error('Unexpected server output'));};
  function done(error,value){if(settled)return;settled=true;clearTimeout(timer);child.off('error',onError);child.off('exit',onExit);child.stdout.off('data',onData);if(error){child.kill('SIGKILL');reject(error);}else resolve(value);}
  child.once('error',onError);child.once('exit',onExit);child.stdout.on('data',onData);
 });
 return {child,port};
}
async function stop(host){
 if(host.child.exitCode!==null||host.child.signalCode!==null)return;
 await new Promise((resolve,reject)=>{
  const timer=setTimeout(()=>{host.child.kill('SIGKILL');reject(Error('Host shutdown timeout'));},5000);
  host.child.once('exit',()=>{clearTimeout(timer);resolve();});
  host.child.send({hcodeHostCommand:'close'},error=>{if(error)host.child.kill('SIGTERM');});
 });
}
async function connect(port){
 const socket=new WebSocket(`ws://127.0.0.1:${port}/`),received=[],listeners=new Set();
 let closed=false;
 socket.addEventListener('message',e=>{received.push(String(e.data));for(const fn of listeners)fn();});
 socket.addEventListener('close',()=>{closed=true;for(const fn of listeners)fn();});
 await new Promise((resolve,reject)=>{
  const timer=setTimeout(()=>{socket.close();reject(Error('Client open timeout'));},5000);
  socket.addEventListener('open',()=>{clearTimeout(timer);resolve();},{once:true});
  socket.addEventListener('error',()=>{clearTimeout(timer);reject(Error('Client open failed'));},{once:true});
 });
 async function count(expected,label){
  if(received.length<expected&&!closed)await new Promise(resolve=>{
   const timer=setTimeout(done,5000);
   const check=()=>{if(received.length>=expected||closed)done();};
   function done(){clearTimeout(timer);listeners.delete(check);resolve();}
   listeners.add(check);check();
  });
  assert.ok(received.length>=expected,`${label}: expected ${expected} wire messages, received ${received.length}, closed=${closed}`);
 }
 async function close(){
  if(closed)return;
  await new Promise((resolve,reject)=>{
   const timer=setTimeout(()=>reject(Error('Client close timeout')),5000);
   socket.addEventListener('close',()=>{clearTimeout(timer);resolve();},{once:true});socket.close();
  });
 }
 return {socket,received,count,close};
}
async function isolatedConnect(port){
 const env={...process.env};delete env.NODE_TEST_CONTEXT;delete env.NODE_TEST_REPORTER;
 const child=spawn(process.execPath,[join(root,'scripts/canonical20-chat-client.mjs'),`ws://127.0.0.1:${port}/`],{env,stdio:['ignore','ignore','pipe','ipc'],windowsHide:true});
 const received=[],listeners=new Set();let closed=false;
 const ready=new Promise((resolve,reject)=>{
  const timer=setTimeout(()=>{child.kill('SIGKILL');reject(Error('Isolated client open timeout'));},5000);
  child.once('error',error=>{clearTimeout(timer);reject(error);});
  child.on('message',message=>{
   if(message.kind==='open'){clearTimeout(timer);resolve();}
   else if(message.kind==='message'){received.push(message.data);for(const fn of listeners)fn();}
   else if(message.kind==='error'){clearTimeout(timer);reject(Error('Isolated client connection failed'));}
  });
  child.once('exit',()=>{clearTimeout(timer);closed=true;for(const fn of listeners)fn();reject(Error('Isolated client exited before open'));});
 });
 child.stderr.on('data',()=>{});await ready;
 async function finish(abrupt){
  if(closed)return;
  await new Promise((resolve,reject)=>{
   const timer=setTimeout(()=>{child.kill('SIGKILL');reject(Error('Isolated client close timeout'));},5000);
   child.once('exit',()=>{clearTimeout(timer);resolve();});
   if(abrupt)child.kill('SIGKILL');else child.send({kind:'close'});
  });
 }
 return {received,isolated:true,socket:{send:data=>child.send({kind:'send',data})},close:()=>finish(false),abort:()=>finish(true),async count(expected,label){
  if(received.length<expected&&!closed)await new Promise(resolve=>{
   const timer=setTimeout(done,5000),check=()=>{if(received.length>=expected||closed)done();};
   function done(){clearTimeout(timer);listeners.delete(check);resolve();}
   listeners.add(check);check();
  });
  assert.ok(received.length>=expected,`${label}: expected ${expected} wire messages, received ${received.length}`);
 }};
}
const serialized=value=>JSON.stringify(value);
function expectedInput(kind,value){
 if(!['join','say'].includes(kind)||typeof value!=='string'||!value.isWellFormed()||[...value].length<1||[...value].length>(kind==='join'?32:1024))return 'invalid';
 return null;
}
async function scenario(engine,trace,built,source=hc,typescript=ts){
 const host=await start(engine,built,source,typescript),peers=new Map(),usedIds=new Set();
 let sequence=trace.initialSequence??0,checks=0,sent=0,disconnects=0,reconnects=0,concurrentSends=0,forcedDisconnects=0,isolatedClientProcesses=0;
 const live=()=>[...peers.values()].filter(p=>!p.closed);
 function expect(peer,message){peer.expected.push(serialized(message));}
 async function verify(peer,label){await peer.count(peer.expected.length,label);assert.deepEqual(peer.received,peer.expected,label);checks++;}
 async function command(label,kind,value){
  const p=peers.get(label);assert.ok(p&&!p.closed);
  const error=expectedInput(kind,value)||(kind==='say'&&!p.room?'not_joined':kind==='say'&&sequence===Number.MAX_SAFE_INTEGER?'exhausted':null);
  if(error)expect(p,{error,kind:'error'});
  else if(kind==='join'){
   p.room=value;expect(p,{kind:'joined',members:live().filter(x=>x.room===value).length,room:value});
  }else{
   const message={kind:'message',room:p.room,sender:p.id,sequence:++sequence,text:value};
   for(const recipient of live().filter(x=>x.room===p.room))expect(recipient,message);
  }
  p.socket.send(serialized({kind,value}));sent++;await verify(p,`${trace.id}/${label}/${kind}`);
 }
 try{
  for(const [action,label,value,expectedError] of trace.steps){
   if(action==='open'||action==='open-isolated'){
    if(disconnects>0)reconnects++;
    const p=await (action==='open-isolated'?isolatedConnect(host.port):connect(host.port));if(p.isolated)isolatedClientProcesses++;await p.count(1,`${engine}/${trace.id}/initial ready`);
    const ready=JSON.parse(p.received[0]);assert.deepEqual(Object.keys(ready).sort(),['client','kind']);
    assert.equal(ready.kind,'ready');assert.equal(typeof ready.client,'string');assert.ok(ready.client&&!usedIds.has(ready.client));
    usedIds.add(ready.client);Object.assign(p,{id:ready.client,room:'',closed:false,expected:[serialized({client:ready.client,kind:'ready'})]});
    peers.set(label,p);await verify(p,'private ready');
   }else if(action==='close'||action==='abort'){
    const p=peers.get(label);if(action==='abort'){await p.abort();forcedDisconnects++;}else await p.close();p.closed=true;disconnects++;
    // Close acknowledgement can precede the server's close callback. Observe
    // live member count through bounded same-connection response barriers.
    const observer=live().find(x=>x.room&&x.room===p.room);
    if(observer){
     const members=live().filter(x=>x.room===observer.room).length;
     let observed=false;
     for(let attempt=0;attempt<100;attempt++){
      observer.socket.send(serialized({kind:'join',value:observer.room}));sent++;
      await observer.count(observer.expected.length+1,'disconnect membership barrier');
      const response=JSON.parse(observer.received[observer.expected.length]);
      assert.ok(response.members===members||response.members===members+1,'membership count during close');
      expect(observer,{kind:'joined',members:response.members,room:observer.room});await verify(observer,'disconnect barrier');
      if(response.members===members){observed=true;break;}
     }
     assert.ok(observed,'closed peer must leave room membership within 100 wire barriers');checks++;
    }
   }else if(action==='raw'){
    const p=peers.get(label);expect(p,{error:expectedError,kind:'error'});p.socket.send(value);sent++;await verify(p,'malformed input rejection');
   }else if(action==='barrier'){
    const p=peers.get(label);await command(label,p.room?'join':'say',p.room||'barrier');
   }else if(action==='burst'){
    const items=value.map((entry,index)=>({label:entry[0],text:entry[1],index})),members=live().filter(x=>x.room===peers.get(items[0].label).room);
    assert.equal(members.length,2);assert.ok(items.every(x=>peers.get(x.label).room===members[0].room));
    for(const item of items){peers.get(item.label).socket.send(serialized({kind:'say',value:item.text}));sent++;}
    const first=members[0];await first.count(first.expected.length+items.length,'concurrent burst');
    const observed=first.received.slice(first.expected.length).map(x=>JSON.parse(x));
    assert.equal(observed.length,items.length);assert.deepEqual(observed.map(x=>x.text).sort(),items.map(x=>x.text).sort());
    const byText=new Map(items.map(x=>[x.text,x]));assert.equal(byText.size,items.length);
    for(const actual of observed){
     const item=byText.get(actual.text),sender=peers.get(item.label);
     const expected={kind:'message',room:sender.room,sender:sender.id,sequence:++sequence,text:item.text};
     for(const recipient of members)expect(recipient,expected);
    }
    for(const recipient of members)await verify(recipient,'identical complete burst order');
    concurrentSends+=items.length;
   }else await command(label,action,value);
  }
  for(const [label,p] of peers)if(!p.closed){await command(label,p.room?'join':'say',p.room||'barrier');await verify(p,'final complete transcript');}
  return {engine,scenario:trace.id,wireAssertions:checks,sentMessages:sent,acceptedChatMessages:sequence-(trace.initialSequence??0),disconnects,reconnects,concurrentSends,forcedDisconnects,isolatedClientProcesses};
 }catch(error){error.stack=`${engine}/${trace.id}: ${error.stack}`;throw error;}finally{await stop(host);for(const p of peers.values())if(p.isolated)await p.abort();}
}
function generated(){
 return Array.from({length:8},(_,i)=>({id:`generated-${i}`,steps:[
  ['open','a'],['open','b'],['say','a','unjoined'],['join','a',`room-${i}`],['join','b',`room-${i}`],
  ['join','a','ø'.repeat(33)],['say','b','🙂'.repeat(1025)],['say','a','🙂'.repeat(1024)],
  ['raw','a','null','invalid'],['raw','b','{"kind":1,"value":"x"}','invalid'],['raw','a','{"kind":"no","value":"x"}','invalid'],
  ['burst',null,Array.from({length:i===0?600:16+i*3},(_,j)=>[j%2?'a':'b',`burst-${i}-${j}`])],
  ['close','b'],['join','a',`room-${i}`],['say','a','after close'],['open','c'],['say','c','fresh unjoined'],
  ['join','c',`other-${i}`],['say','c','isolated'],['join','c',`room-${i}`],['say','c','switched'],['barrier','a'],['barrier','c']
 ]}));
}
async function faults(temporary,binary){
 const definitions=[
  ['room-leak','state·members⌕λm:m·room≡own·room','state·members⌕λm:⊤','if (member.room === peer.room) send(member, message)','if (true) send(member, message)',1],
  ['sequence-reuse','state·sequence+1','state·sequence','sequence: ++sequence','sequence: sequence',0],
  ['disconnect-retained','state·members⌕λm:m·client≠e·client','state·members⌕λm:⊤','peers.delete(client);','void client;',2]
 ];
 const results=[];
 for(const engine of engines)for(const [id,hcBefore,hcAfter,tsBefore,tsAfter,trace] of definitions){
  const isTS=engine==='typescript',original=readFileSync(isTS?ts:hc,'utf8'),before=isTS?tsBefore:hcBefore,after=isTS?tsAfter:hcAfter;
  assert.equal(original.split(before).length,2,'fault replaces exactly one application expression');
  const source=join(temporary,`${engine}-${id}.${isTS?'ts':'hc'}`),built=join(temporary,`${engine}-${id}.mjs`);
  writeFileSync(source,original.replace(before,after));
  if(engine==='native')success(invoke(binary,['build',source,'--out',built]),'fault compilation');
  let rejected=false;
  try{await scenario(engine,fixture.scenarios[trace],built,isTS?hc:source,isTS?source:ts);}
  catch(error){if(error.code!=='ERR_ASSERTION')throw error;rejected=true;}
  assert.ok(rejected,`${engine}/${id} fault escaped actual wire assertions`);results.push({engine,id,rejectedByWireAssertions:true});
 }
 return results;
}
export async function runChatProof(){
 const binary=compiler(),temporary=mkdtempSync(join(root,'.chat17-proof-')),built=join(temporary,'chat.mjs');
 try{
  success(invoke(binary,['build',hc,'--out',built]),'actual chat compiler');
  const fixed=[],extra=[],abruptRuns=[],counterBoundaryRuns=[],generatedCases=generated();
  for(const engine of engines){
   for(const trace of fixture.scenarios)fixed.push(await scenario(engine,trace,built));
   for(const trace of generatedCases)extra.push(await scenario(engine,trace,built));
   abruptRuns.push(await scenario(engine,{id:'abrupt-process-disconnect',steps:[
    ['open','a'],['open-isolated','b'],['join','a','room'],['join','b','room'],['say','b','before kill'],
    ['abort','b'],['join','a','room'],['say','a','after kill'],['open','c'],['say','c','fresh'],
    ['join','c','room'],['say','c','reconnected'],['barrier','a'],['barrier','c']
   ]},built));
  }
  for(const engine of engines){
   const isTS=engine==='typescript',original=readFileSync(isTS?ts:hc,'utf8');
   const before=isTS?'sequence = 0':'sequence:0';
   assert.equal(original.split(before).length,2,'counter initialization variant changes exactly one source expression');
   const source=join(temporary,`maximum-${engine}.${isTS?'ts':'hc'}`),variant=join(temporary,`maximum-${engine}.mjs`);
   writeFileSync(source,original.replace(before,isTS?'sequence = 9007199254740991':'sequence:9007199254740991'));
   if(engine==='native')success(invoke(binary,['build',source,'--out',variant]),'maximum counter initialization');
   counterBoundaryRuns.push(await scenario(engine,{id:'maximum-sequence',initialSequence:Number.MAX_SAFE_INTEGER,steps:[
    ['open','a'],['join','a','room'],['say','a','must not wrap'],['join','a','room'],['say','a','still exhausted'],['barrier','a']
   ]},variant,isTS?hc:source,isTS?source:ts));
  }
  const runs=[...fixed,...extra,...abruptRuns,...counterBoundaryRuns],bytes=readFileSync(built);
  return {kind:'full-compiler-evidence',engines,fixedRuns:fixed,generatedRuns:extra,abruptRuns,counterBoundaryRuns,
   wireAssertions:runs.reduce((n,r)=>n+r.wireAssertions,0),sentMessages:runs.reduce((n,r)=>n+r.sentMessages,0),
   acceptedChatMessages:runs.reduce((n,r)=>n+r.acceptedChatMessages,0),
   disconnects:runs.reduce((n,r)=>n+r.disconnects,0),concurrentSends:runs.reduce((n,r)=>n+r.concurrentSends,0),
   forcedDisconnects:runs.reduce((n,r)=>n+r.forcedDisconnects,0),isolatedClientProcesses:runs.reduce((n,r)=>n+r.isolatedClientProcesses,0),
   seededFaultsRejected:await faults(temporary,binary),independentNodeWebSocketClients:true,
   sharedReferenceTransport:true,independentTypeScriptPolicy:true,
   compiledJavaScript:{utf8Bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')},
   globallyVerified70Percent:false};
 }finally{rmSync(temporary,{recursive:true,force:true});}
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))console.log(JSON.stringify(await runChatProof(),null,2));
