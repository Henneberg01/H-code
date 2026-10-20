import {createServer} from 'node:http';
import {WebSocketServer, WebSocket} from 'ws';

type Peer = {socket: WebSocket; room: string};
const grant = /^127\.0\.0\.1:([0-9]{1,5})$/.exec(process.env.HCODE_WS_LISTEN ?? '');
if (!grant || Number(grant[1]) > 65535) throw new Error('WebSocket listen capability denied');
const peers = new Map<string, Peer>();
let nextClient = 0, sequence = 0, closing = false;
const server = createServer((_req, res) => { res.writeHead(404); res.end(); });
server.maxHeadersCount = 0;
server.requestTimeout = 5000;
server.headersTimeout = 6000;
const transport = new WebSocketServer({noServer: true, maxPayload: 16384, perMessageDeflate: false});
function send(peer: Peer, value: unknown) {
  if (peer.socket.readyState !== WebSocket.OPEN) return;
  const body = JSON.stringify(value);
  if (peer.socket.bufferedAmount + Buffer.byteLength(body, 'utf8') > 65536) { peer.socket.close(1013, 'Outgoing queue limit'); return; }
  peer.socket.send(body, error => { if (error) peer.socket.terminate(); });
}
server.on('upgrade', (req, socket, head) => {
  const status = closing ? 503 : req.rawHeaders.length > 256 ? 431 : req.url !== '/' ? 404 : peers.size >= 64 ? 503 : 0;
  if (status) { socket.end(`HTTP/1.1 ${status} Rejected\r\nConnection: close\r\nContent-Length: 0\r\n\r\n`); return; }
  transport.handleUpgrade(req, socket, head, ws => transport.emit('connection', ws, req));
});
transport.on('connection', socket => {
  const client = `c${++nextClient}`, peer: Peer = {socket, room: ''};
  peers.set(client, peer);
  socket.on('error', () => {});
  socket.once('close', () => { peers.delete(client); });
  socket.on('message', (bytes, binary) => {
    if (socket.readyState !== WebSocket.OPEN) return;
    if (binary) { socket.close(1003, 'Only text messages supported'); return; }
    const fail = (error: string) => send(peer, {error, kind: 'error'});
    let input: unknown;
    try { input = JSON.parse(bytes.toString('utf8')); } catch { fail('invalid'); return; }
    if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).sort().join(',') !== 'kind,value') { fail('invalid'); return; }
    const data = input as Record<string, unknown>;
    if (typeof data.kind !== 'string' || typeof data.value !== 'string' || !data.kind.isWellFormed() || !data.value.isWellFormed()) { fail('invalid'); return; }
    const length = [...data.value].length;
    if (!['join', 'say'].includes(data.kind) || length < 1 || length > (data.kind === 'join' ? 32 : 1024)) { fail('invalid'); return; }
    if (data.kind === 'join') {
      peer.room = data.value;
      const members = [...peers.values()].filter(member => member.room === peer.room).length;
      send(peer, {kind: 'joined', members, room: peer.room});
      return;
    }
    if (!peer.room) { fail('not_joined'); return; }
    if (sequence === Number.MAX_SAFE_INTEGER) { fail('exhausted'); return; }
    const message = {kind: 'message', room: peer.room, sender: client, sequence: ++sequence, text: data.value};
    for (const member of peers.values()) if (member.room === peer.room) send(member, message);
  });
  send(peer, {client, kind: 'ready'});
});
server.on('error', () => { process.exitCode = 2; });
server.listen(Number(grant[1]), '127.0.0.1', () => {
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Invalid listener');
  console.log('HCODE_WS_READY=' + address.port);
});
function close() {
  if (closing) return;
  closing = true;
  for (const peer of peers.values()) peer.socket.terminate();
  transport.close(() => server.close(() => { if (process.connected) process.disconnect(); }));
  server.closeIdleConnections();
}
process.on('SIGTERM', close);
process.on('SIGINT', close);
if (process.env.HCODE_WS_HOST_IPC === '1') process.on('message', message => {
  if (message && typeof message === 'object' && 'hcodeHostCommand' in message && message.hcodeHostCommand === 'close') close();
});
