// Independent language evaluator, shared generic maintained WebSocket transport.
import {readFileSync} from 'node:fs';
import {execute} from '../prototype/src/hcode.mjs';
import {serveWebSocket} from '../runtime/websocket.mjs';
execute(readFileSync(process.argv[2],'utf8'),{websocketServe:serveWebSocket});
