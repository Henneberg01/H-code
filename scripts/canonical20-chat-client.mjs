// Isolated standard client for genuine abrupt TCP disconnects via process kill.
const socket=new WebSocket(process.argv[2]);
socket.addEventListener('open',()=>process.send({kind:'open'}));
socket.addEventListener('message',event=>process.send({kind:'message',data:String(event.data)}));
socket.addEventListener('error',()=>process.send?.({kind:'error'}));
socket.addEventListener('close',()=>{if(process.connected)process.send({kind:'close'},()=>process.disconnect());});
process.on('message',message=>{
  if(message.kind==='send')socket.send(message.data);
  else if(message.kind==='close')socket.close();
});
process.on('disconnect',()=>socket.close());
