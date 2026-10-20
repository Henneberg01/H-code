// Generic bounded transport. Application protocols and routing belong to the reducer.
import {createServer as wsCreateServer} from 'node:http';
import {WebSocketServer} from 'ws';

const wsRecord=fields=>Object.freeze(Object.assign(Object.create(null),fields));
const wsText=(value,limit)=>typeof value==='string'&&value.isWellFormed()&&Buffer.byteLength(value,'utf8')<=limit;
const wsShape=(value,keys)=>value!==null&&typeof value==='object'&&!Array.isArray(value)&&
  [null,Object.prototype].includes(Object.getPrototypeOf(value))&&Object.keys(value).sort().join(',')===keys;

export function serveWebSocket(handler,initial,{listen=process.env.HCODE_WS_LISTEN}={}){
  if(typeof handler!=='function'||!wsText(initial,1048576))throw TypeError('WebSocket handler/state must be Function and bounded String');
  const grant=typeof listen==='string'&&/^127\.0\.0\.1:([0-9]{1,5})$/.exec(listen);
  if(!grant||Number(grant[1])>65535)throw Error('WebSocket listen capability denied: explicit HCODE_WS_LISTEN required');
  let state=initial,nextClient=0,closing=false;
  const peers=new Map();
  const server=wsCreateServer((_req,res)=>{res.writeHead(404);res.end();});
  server.maxHeadersCount=0;server.requestTimeout=5000;server.headersTimeout=6000;
  const websocketServer=new WebSocketServer({noServer:true,maxPayload:16384,perMessageDeflate:false});
  function event(client,kind,data=''){
    if(closing)return;
    try{
      const result=handler(wsRecord({client,data,kind}),state);
      if(!wsShape(result,'messages,state')||!wsText(result.state,1048576)||
          !Array.isArray(result.messages)||result.messages.length>64)throw TypeError('Invalid WebSocket reducer output');
      const messages=Array.from(result.messages,message=>{
        if(!wsShape(message,'client,data')||!wsText(message.client,128)||!message.client||!wsText(message.data,16384))
          throw TypeError('Invalid WebSocket output message');
        return {client:message.client,data:message.data};
      });
      // No state or outgoing message changes until every output has been validated.
      state=result.state;
      for(const message of messages){
        const socket=peers.get(message.client);
        if(!socket||socket.readyState!==1)continue;
        if(socket.bufferedAmount+Buffer.byteLength(message.data,'utf8')>65536){socket.close(1013,'Outgoing queue limit');continue;}
        socket.send(message.data,error=>{if(error)socket.terminate();});
      }
    }catch{
      const socket=peers.get(client);
      if(socket?.readyState===1)socket.close(1011,'Reducer rejected event');
    }
  }
  server.on('upgrade',(req,socket,head)=>{
    const status=closing?503:req.rawHeaders.length>256?431:req.url!=='/'?404:peers.size>=64?503:0;
    if(status){socket.end(`HTTP/1.1 ${status} Rejected\r\nConnection: close\r\nContent-Length: 0\r\n\r\n`);return;}
    websocketServer.handleUpgrade(req,socket,head,peer=>websocketServer.emit('connection',peer,req));
  });
  websocketServer.on('connection',socket=>{
    const client=`c${++nextClient}`;peers.set(client,socket);
    socket.on('error',()=>{}); // ws closes malformed frames; isolate the peer.
    socket.on('message',(data,binary)=>{
      if(socket.readyState!==1)return;
      if(binary){socket.close(1003,'Only text messages supported');return;}
      event(client,'message',data.toString('utf8'));
    });
    socket.once('close',()=>{peers.delete(client);event(client,'close');});
    event(client,'open');
  });
  let closed;
  function close(){
    if(closed)return closed;
    closing=true;
    closed=new Promise(resolve=>{
      for(const socket of peers.values())socket.terminate();
      websocketServer.close(()=>server.close(()=>{process.off('SIGTERM',onSignal);process.off('SIGINT',onSignal);process.off('message',onMessage);resolve();}));
      server.closeIdleConnections();
    });
    return closed;
  }
  const onSignal=()=>{void close().then(()=>{if(process.connected)process.disconnect();});};
  const onMessage=message=>{if(message&&typeof message==='object'&&message.hcodeHostCommand==='close')onSignal();};
  process.on('SIGTERM',onSignal);process.on('SIGINT',onSignal);
  if(process.env.HCODE_WS_HOST_IPC==='1')process.on('message',onMessage);
  server.on('error',()=>{process.exitCode=2;});
  server.listen(Number(grant[1]),'127.0.0.1',()=>console.log('HCODE_WS_READY='+server.address().port));
  return {server,websocketServer,close};
}
