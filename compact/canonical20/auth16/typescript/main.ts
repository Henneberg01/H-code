import {createServer} from 'node:http';
import {createHmac, timingSafeEqual} from 'node:crypto';
import {readFileSync, lstatSync, realpathSync, existsSync} from 'node:fs';
import {resolve, join} from 'node:path';
import {DatabaseSync} from 'node:sqlite';

type State = {generation: number; revoked: boolean};
type Header = {name: string; value: string};
type Request = {body: string; contentType: string; headers: Header[]; method: string; path: string};
type Response = {status: number; body: string; state: State};
const identity = 'fixture-alice';
if (process.env.HCODE_ALLOW_FILE_READ !== '1') throw new Error('File-read capability denied');
const dataRoot = resolve('data'), keyPath = join(dataRoot, 'signing-key.txt');
if (lstatSync(dataRoot).isSymbolicLink() || lstatSync(keyPath).isSymbolicLink()) throw new Error('Symlinked key path denied');
const key = new TextDecoder('utf-8', {fatal: true, ignoreBOM: true}).decode(readFileSync(keyPath));
if ([...key].length < 32 || [...key].length > 1024) throw new Error('Invalid signing-key length');
const root = process.env.HCODE_HTTP_STATE_ROOT;
if (!root || !lstatSync(root).isDirectory() || lstatSync(root).isSymbolicLink() || realpathSync(root) !== root) throw new Error('Invalid explicit state root');
const databasePath = join(root, 'sessions.sqlite');
if (existsSync(databasePath) && lstatSync(databasePath).isSymbolicLink()) throw new Error('Symlinked database denied');
const grant = /^127\.0\.0\.1:([0-9]{1,5})$/.exec(process.env.HCODE_HTTP_LISTEN ?? '');
if (!grant || Number(grant[1]) > 65535) throw new Error('Explicit loopback listen grant required');
const db = new DatabaseSync(databasePath);
db.exec('PRAGMA synchronous=FULL; PRAGMA busy_timeout=5000; CREATE TABLE IF NOT EXISTS session (id INTEGER PRIMARY KEY CHECK(id=1), generation INTEGER NOT NULL, revoked INTEGER NOT NULL); INSERT OR IGNORE INTO session VALUES (1,0,1);');
const read = db.prepare('SELECT generation, revoked FROM session WHERE id=1');
const write = db.prepare('UPDATE session SET generation=?, revoked=? WHERE id=1');
const claims = (generation: number) => JSON.stringify({generation, identity});
const signature = (generation: number) => createHmac('sha256', key).update(claims(generation), 'utf8').digest('hex');
const reply = (state: State, status: number, value: unknown): Response => ({state, status, body: status === 204 ? '' : JSON.stringify(value) + '\n'});
const error = (state: State, status: number, message: string) => reply(state, status, {error: message});
function issued(generation: number, status: number): Response {
  return reply({generation, revoked: false}, status, {generation, identity, signature: signature(generation)});
}
function reduce(r: Request, state: State): Response {
  if (r.headers.some(h => h.name === 'x-hcode-request-id')) return error(state, 400, 'idempotency_not_supported');
  if (!['/session', '/session/rotate', '/session/revoke'].includes(r.path)) return error(state, 404, 'not_found');
  if (r.path === '/session' ? !['GET', 'POST'].includes(r.method) : r.method !== 'POST') return error(state, 405, 'method_not_allowed');
  if (!Number.isSafeInteger(state.generation) || state.generation < 0) return error(state, 500, 'invalid_state');
  if (r.path === '/session' && r.method === 'POST') {
    if (!['application/json', 'application/json; charset=utf-8'].includes(r.contentType) || r.headers.filter(h => h.name === 'content-type').length !== 1) return error(state, 400, 'invalid');
    let input: unknown;
    try { input = JSON.parse(r.body); } catch { return error(state, 400, 'invalid'); }
    if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).sort().join(',') !== 'credential,identity') return error(state, 400, 'invalid');
    const credentials = input as Record<string, unknown>;
    if (typeof credentials.credential !== 'string' || typeof credentials.identity !== 'string' || !credentials.credential.isWellFormed() || !credentials.identity.isWellFormed()) return error(state, 400, 'invalid');
    if (credentials.identity !== identity || credentials.credential !== 'fixture-password') return error(state, 401, 'unauthorized');
    if (state.generation === Number.MAX_SAFE_INTEGER) return error(state, 409, 'generation_exhausted');
    return issued(state.generation + 1, 201);
  }
  if (r.body !== '') return error(state, 400, 'invalid');
  const tags = r.headers.filter(h => h.name === 'x-session-signature');
  if (tags.length !== 1 || state.revoked || !/^[0-9a-f]{64}$/.test(tags[0].value)) return error(state, 401, 'unauthorized');
  if (!timingSafeEqual(Buffer.from(signature(state.generation), 'hex'), Buffer.from(tags[0].value, 'hex'))) return error(state, 401, 'unauthorized');
  if (r.method === 'GET') return reply(state, 200, {generation: state.generation, identity});
  if (r.path === '/session/rotate') {
    if (state.generation === Number.MAX_SAFE_INTEGER) return error(state, 409, 'generation_exhausted');
    return issued(state.generation + 1, 200);
  }
  return reply({...state, revoked: true}, 204, null);
}
const server = createServer(async (req, res) => {
  const send = (status: number, body: string) => {
    res.writeHead(status, status === 204 ? {'cache-control': 'no-store'} : {'cache-control': 'no-store', 'content-type': 'application/json; charset=utf-8'});
    res.end(body);
  };
  try {
    if (!req.method || !req.url || req.url.length > 2048) { send(400, '{"error":"invalid_request"}\n'); return; }
    if (req.rawHeaders.length > 256) { send(431, '{"error":"too_many_headers"}\n'); return; }
    let bytes = 0, tooLarge = false;
    const chunks: Buffer[] = [];
    for await (const chunk of req) {
      const value = Buffer.from(chunk); bytes += value.length;
      if (bytes > 16384) tooLarge = true; else chunks.push(value);
    }
    if (tooLarge) { send(413, '{"error":"body_too_large"}\n'); return; }
    let body: string;
    try { body = new TextDecoder('utf-8', {fatal: true}).decode(Buffer.concat(chunks)); }
    catch { send(400, '{"error":"invalid_utf8"}\n'); return; }
    const headers: Header[] = [];
    for (let i = 0; i < req.rawHeaders.length; i += 2) headers.push({name: req.rawHeaders[i].toLowerCase(), value: req.rawHeaders[i + 1]});
    db.exec('BEGIN IMMEDIATE');
    try {
      const row = read.get() as {generation: number; revoked: number};
      const state = {generation: row.generation, revoked: Boolean(row.revoked)};
      const result = reduce({method: req.method ?? '', path: req.url ?? '', contentType: String(req.headers['content-type'] ?? ''), body, headers}, state);
      if (result.state.generation !== state.generation || result.state.revoked !== state.revoked) write.run(result.state.generation, Number(result.state.revoked));
      db.exec('COMMIT');
      send(result.status, result.body);
    } catch (failure) { db.exec('ROLLBACK'); throw failure; }
  } catch { if (!res.headersSent && !res.destroyed) send(500, '{"error":"handler_error"}\n'); }
});
server.maxHeadersCount = 0;
server.requestTimeout = 5000;
server.headersTimeout = 6000;
server.on('error', () => { db.close(); process.exitCode = 2; });
server.listen(Number(grant[1]), '127.0.0.1', () => {
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Invalid bound address');
  console.log('HCODE_HTTP_READY=' + address.port);
});
const close = () => { server.close(() => { db.close(); if (process.connected) process.disconnect(); }); server.closeIdleConnections(); };
process.on('SIGTERM', close);
process.on('SIGINT', close);
if (process.env.HCODE_HTTP_HOST_IPC === '1') process.on('message', message => {
  if (message && typeof message === 'object' && 'hcodeHostCommand' in message && message.hcodeHostCommand === 'close') close();
});
