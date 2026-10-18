// M19.12 B1: generic inbound HTTP host for typechecked H-Code handlers.
// Only embedded in compiled ESM when the ⤊ / http_serve effect is used.
// This is a stateless server primitive, NOT a CRUD API or storage engine.
import {createServer as __hc_create_server} from 'node:http';
let __hc_server_active=false;
const __hc_http_serve = handler => {
  __hc_tick();
  if(typeof handler!=='function')throw TypeError('⤊ requires a request-handler function');
  const grant=process.env.HCODE_HTTP_LISTEN;
  const matched=typeof grant==='string' && /^127\.0\.0\.1:([0-9]{1,5})$/.exec(grant);
  if(!matched)throw Error('⤊ HTTP listen capability denied; explicit HCODE_HTTP_LISTEN=127.0.0.1:PORT required');
  const port=Number(matched[1]);
  if(!Number.isInteger(port)||port<0||port>65535)
    throw RangeError('⤊ invalid granted loopback port');
  if(__hc_server_active)throw Error('⤊ only one HTTP server may be active in this process');
  __hc_server_active=true;
  let inFlight=0;
  const fail=(res,status,code)=>{
    if(res.headersSent || res.destroyed)return;
    res.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store'});
    res.end(JSON.stringify({error:code})+'\n');
  };
  const server=__hc_create_server(async(req,res)=>{
    if(inFlight>=32){fail(res,503,'busy');return;}
    inFlight++;
    try{
      __hc_tick();
      if(!req.method || !req.url || req.url.length>2048){
        fail(res,400,'invalid_request');return;
      }
      let size=0,tooLarge=false;
      const chunks=[];
      for await (const c of req){
        const buffer=Buffer.isBuffer(c)?c:Buffer.from(c);
        size+=buffer.length;
        if(size>16384){tooLarge=true;continue;}
        chunks.push(buffer);
      }
      if(tooLarge){fail(res,413,'body_too_large');return;}
      if(!req.complete || res.destroyed)return;
      let body;
      try{body=new TextDecoder('utf-8',{fatal:true}).decode(Buffer.concat(chunks));}
      catch{fail(res,400,'invalid_utf8');return;}
      const request=__hc_record([
        ['body',body],['method',req.method],['path',req.url]
      ]);
      const result=handler(request);
      // B1 intentionally restricts handlers to typed synchronous/pure functions;
      // async operations and durable state are separate B2/B3 capabilities.
      if(result && typeof result.then==='function')
        throw TypeError('⤊ B1 handler cannot return a Promise');
      if(!result || typeof result!=='object' || Array.isArray(result) ||
         Object.getPrototypeOf(result)!==null ||
         Object.keys(result).length!==2 ||
         !Object.hasOwn(result,'body')||!Object.hasOwn(result,'status') ||
         typeof result.body!=='string' || !result.body.isWellFormed() ||
         !Number.isInteger(result.status) || result.status<200 || result.status>599 ||
         new TextEncoder().encode(result.body).length>65536)
        throw TypeError('⤊ handler returned an invalid {body:String,status:Number} record');
      res.writeHead(result.status,{'content-type':'text/plain; charset=utf-8','cache-control':'no-store'});
      res.end(result.status===204||result.status===304?'':result.body);
    }catch{
      fail(res,500,'handler_error');
    }finally{inFlight--;}
  });
  server.maxRequestsPerSocket=100;
  server.requestTimeout=5000;
  server.headersTimeout=6000;
  server.on('error',error=>{
    process.stderr.write('HCODE_HTTP_ERROR: '+error.message+'\n');
    process.exitCode=2;
  });
  server.listen(port,'127.0.0.1',()=>{
    const address=server.address();
    if(!address || typeof address==='string')throw Error('⤊ invalid bound server address');
    process.stdout.write('HCODE_HTTP_READY='+address.port+'\n');
  });
  process.on('SIGTERM',()=>server.close());
  process.on('SIGINT',()=>server.close());
  return null;
};
