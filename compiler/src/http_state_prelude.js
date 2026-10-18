// M19.12 B2a: capability-gated transactional state around the same generic
// inbound H-Code HTTP server. The entire reducer is USER-WRITTEN H-Code.
// No CRUD routes, schemas, IDs or request bodies are interpreted here.
const __hc_http_serve_state=(handler,initial,expanded=false)=>{
  __hc_tick();
  if(typeof handler!=='function' || typeof initial!=='string')
    throw TypeError('⤊(handler,initial) expects Function and String');
  const root=process.env.HCODE_HTTP_STATE_ROOT;
  if(typeof root!=='string' || !root)
    throw Error('⤊ persistent state capability denied: HCODE_HTTP_STATE_ROOT required');
  const mode=process.env.HCODE_HTTP_STATE_MODE??'legacy';
  if(mode!=='legacy'&&mode!=='cas-v1')throw Error('⤊ unknown persistence mode');
  const cas=mode==='cas-v1';
  // Expanded typed HTTP responses require CAS v1 receipts to persist MIME
  // headers together with response bodies. Legacy journal remains unchanged.
  if(expanded&&!cas)
    throw Error('⤊ extended HTTP response requires opt-in cas-v1 persistent state');
  const store=cas?createHttpCasStateStore({root,initial}):createHttpStateStore({root,initial});
  try {
    return __hc_http_serve((request,metadata)=>{
      const requestId=metadata.requestId;
      if(requestId&&!__hc_state_receipt_id.test(requestId))
        return expanded?
          __hc_record([['body','invalid_request_id'],['contentType','text/plain; charset=utf-8'],['status',400]]):
          __hc_record([['body','invalid_request_id'],['status',400]]);
      const digest=requestId?__hc_state_request_digest(
        request.method,request.path,request.body,metadata.contentType):null;
      if(cas){
        const typedRequest=expanded?__hc_record([
          ['body',request.body],['contentType',metadata.contentType],
          ['method',request.method],['path',request.path]
        ]):request;
        const result=executeHttpCasTransaction({
          store,handler,request:typedRequest,metadata,digest,expanded,
          invoke:(fn,r,state)=>{
            __hc_cas_reducer_active=true;
            try{return fn(r,state);}
            finally{__hc_cas_reducer_active=false;}
          }
        });
        return expanded?
          __hc_record([['body',result.body],['contentType',result.contentType],
                       ['status',result.status]]):
          __hc_record([['body',result.body],['status',result.status]]);
      }
      const previous=requestId?store.receiptFor(requestId):null;
      if(previous){
        if(previous.digest!==digest)
          return __hc_record([['body','idempotency_conflict'],['status',409]]);
        return __hc_record([['body',previous.body],['status',previous.status]]);
      }
      // Do not silently evict receipts and thereby resurrect old effects.
      if(requestId&&!['GET','HEAD','OPTIONS'].includes(request.method)&&store.receiptSlots()===0)
        return __hc_record([['body','idempotency_journal_full'],['status',507]]);
      __hc_tick();
      const old=store.read();
      // Node synchronous functions are serialized on the event loop. This
      // provides request-scoped isolation within ONE host process only.
      const result=handler(request,old);
      if(!result || typeof result!=='object' || Array.isArray(result) ||
         Object.getPrototypeOf(result)!==null ||
         Object.keys(result).sort().join(',')!=='body,state,status' ||
         typeof result.body!=='string'||!result.body.isWellFormed() ||
         new TextEncoder().encode(result.body).length>65536 ||
         typeof result.state!=='string'||!result.state.isWellFormed() ||
         new TextEncoder().encode(result.state).length>1048576 ||
         !Number.isInteger(result.status) || result.status<200 || result.status>599)
        throw TypeError('⤊ stateful handler returned invalid body/status/state');
      // Do not return HTTP success until the committed state has been
      // atomically published. Invalid records cannot mutate durable data.
      const changed=result.state!==old;
      if(changed&&['GET','HEAD','OPTIONS'].includes(request.method))
        return __hc_record([['body','unsafe_state_transition'],['status',405]]);
      if(metadata.isCancelled())
        throw Error('⤊ state transaction canceled before commit');
      const receipt=requestId&&!['GET','HEAD','OPTIONS'].includes(request.method)?
        {id:requestId,digest,status:result.status,body:result.body}:null;
      if(changed||receipt)store.commit(result.state,receipt);
      return __hc_record([['body',result.body],['status',result.status]]);
    },()=>store.close());
  }catch(error){store.close();throw error;}
};
