// Trusted test host: independent H-Code language evaluator, shared generic HTTP/CAS
// runtime. This is explicitly not an independent third persistence implementation.
import {readFileSync} from 'node:fs';
import {createServer} from 'node:http';
import {createHash} from 'node:crypto';
import {join} from 'node:path';
import {execute} from '../prototype/src/hcode.mjs';
import {createHttpCasStateStore} from '../runtime/http-state-cas.mjs';
import {createHttpStateStore} from '../runtime/http-state.mjs';
import {executeHttpCasTransaction} from '../runtime/http-state-cas-adapter.mjs';
const serverSource=readFileSync(new URL('../compiler/src/http_serve_prelude.js',import.meta.url),'utf8');
const stateSource=readFileSync(new URL('../compiler/src/http_state_prelude.js',import.meta.url),'utf8');
const digestSource=readFileSync(new URL('../runtime/http-state.mjs',import.meta.url),'utf8')
  .match(/const __hc_state_request_digest=[\s\S]*?(?=const __hc_state_plain)/)[0];
const digest=new Function('__hc_state_hash',digestSource+'return __hc_state_request_digest;')(createHash);
const record=pairs=>Object.freeze(Object.assign(Object.create(null),Object.fromEntries(pairs)));
const serve=new Function('__hc_create_server','__hc_tick','__hc_record','createHttpCasStateStore','createHttpStateStore','executeHttpCasTransaction','__hc_state_receipt_id','__hc_state_request_digest',
  'const __hc_seq=items=>Object.freeze(items);let __hc_cas_reducer_active=false;\n'+
  serverSource.replace(/^import .*;$/m,'')+'\n'+stateSource+'\nreturn __hc_http_serve_state;')(
    createServer,()=>{},record,createHttpCasStateStore,createHttpStateStore,executeHttpCasTransaction,/^[A-Za-z0-9_-]{1,64}$/,digest);
execute(readFileSync(process.argv[2],'utf8'),{
  readFile:name=>{
    if(process.env.HCODE_ALLOW_FILE_READ!=='1'||name!=='signing-key.txt')throw Error('Reference file capability denied');
    return new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(readFileSync(join(process.cwd(),'data','signing-key.txt')));
  },
  httpServeState:(handler,initial)=>serve(handler,initial,true,true)
});
