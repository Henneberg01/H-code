import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,mkdtempSync,rmSync} from 'node:fs';
import {createServer,request} from 'node:http';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {once} from 'node:events';
import {createHash} from 'node:crypto';
import {createHttpCasStateStore} from '../runtime/http-state-cas.mjs';
import {executeHttpCasTransaction} from '../runtime/http-state-cas-adapter.mjs';

test('generic HTTP transport preserves duplicate raw headers with lowercase names',async()=>{
 const source=readFileSync(new URL('../compiler/src/http_serve_prelude.js',import.meta.url),'utf8');
 const stateSource=readFileSync(new URL('../compiler/src/http_state_prelude.js',import.meta.url),'utf8');
 // Execute the actual runtime preludes with a lightweight server constructor;
 // request parsing and the real HTTP socket remain production code.
 let server;const make=handler=>(server=createServer(handler));
 const functions=new Function('__hc_create_server','__hc_tick','__hc_record','createHttpCasStateStore','createHttpStateStore','executeHttpCasTransaction','__hc_state_receipt_id','__hc_state_request_digest',
  'const __hc_seq=items=>Object.freeze(items);let __hc_cas_reducer_active=false;\n'+source.replace(/^import .*;$/m,'')+'\n'+stateSource+'\nreturn __hc_http_serve_state;');
 const digestSource=readFileSync(new URL('../runtime/http-state.mjs',import.meta.url),'utf8').match(/const __hc_state_request_digest=[\s\S]*?(?=const __hc_state_plain)/)[0];
 const digest=new Function('__hc_state_hash',digestSource+'return __hc_state_request_digest;')(createHash);
 const root=mkdtempSync(join(tmpdir(),'hcode-headers-'));
 const previous={listen:process.env.HCODE_HTTP_LISTEN,root:process.env.HCODE_HTTP_STATE_ROOT,mode:process.env.HCODE_HTTP_STATE_MODE};
 process.env.HCODE_HTTP_LISTEN='127.0.0.1:0';process.env.HCODE_HTTP_STATE_ROOT=root;process.env.HCODE_HTTP_STATE_MODE='cas-v1';
 try{
  const serve=functions(make,()=>{},pairs=>Object.freeze(Object.assign(Object.create(null),Object.fromEntries(pairs))),createHttpCasStateStore,()=>{throw Error('unexpected legacy store');},executeHttpCasTransaction,/^[a-z0-9_-]+$/i,digest);
  serve((r,state)=>Object.assign(Object.create(null),{body:JSON.stringify(r.headers),contentType:'application/json',state,status:200}),'0',true,true);
  await once(server,'listening');
  const port=server.address().port;
  async function send(method,extra=[]){
   return new Promise((resolve,reject)=>{
    const req=request({host:'127.0.0.1',port,path:'/',method,headers:['Host','127.0.0.1','X-Session-Signature','one','x-session-signature','two',...extra]},res=>{
     let body='';res.setEncoding('utf8');res.on('data',v=>body+=v);res.on('end',()=>resolve({body,status:res.statusCode}));
    });req.on('error',reject);req.end();
   });
  }
  const first=await send('GET');assert.equal(first.status,200);
  const headers=JSON.parse(first.body).filter(h=>h.name==='x-session-signature');
  assert.deepEqual(headers,[{name:'x-session-signature',value:'one'},{name:'x-session-signature',value:'two'}]);
  const saved=await send('POST',['X-HCode-Request-Id','headers_01']);assert.equal(saved.status,200);
  const replay=await send('POST',['X-HCode-Request-Id','headers_01']);assert.deepEqual(replay,saved);
  const changed=await send('POST',['X-HCode-Request-Id','headers_01','X-Extra','changed']);
  assert.equal(changed.status,409,'request receipts must bind every observable header');
  const overBudget=await send('GET',Array.from({length:128},()=>['a','b']).flat());
  assert.equal(overBudget.status,431,'new raw-header envelope has an explicit 128-pair budget');
  const excessive=await send('GET',[...Array.from({length:2001},()=>['a','b']).flat(),'X-Session-Signature','late']);
  assert.equal(excessive.status,431,'oversized header lists cannot hide a late duplicate');
 }finally{
  if(server){server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
  for(const [name,key] of [['HCODE_HTTP_LISTEN','listen'],['HCODE_HTTP_STATE_ROOT','root'],['HCODE_HTTP_STATE_MODE','mode']]){
   if(previous[key]===undefined)delete process.env[name];else process.env[name]=previous[key];
  }
  rmSync(root,{recursive:true,force:true});
 }
});
