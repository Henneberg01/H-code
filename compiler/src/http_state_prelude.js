// M19.12 B2a: capability-gated transactional state around the same generic
// inbound H-Code HTTP server. The entire reducer is USER-WRITTEN H-Code.
// No CRUD routes, schemas, IDs or request bodies are interpreted here.
const __hc_http_serve_state=(handler,initial)=>{
  __hc_tick();
  if(typeof handler!=='function' || typeof initial!=='string')
    throw TypeError('⤊(handler,initial) expects Function and String');
  const root=process.env.HCODE_HTTP_STATE_ROOT;
  if(typeof root!=='string' || !root)
    throw Error('⤊ persistent state capability denied: HCODE_HTTP_STATE_ROOT required');
  const store=createHttpStateStore({root,initial});
  try {
    return __hc_http_serve(request=>{
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
      if(result.state!==old)store.commit(result.state);
      return __hc_record([['body',result.body],['status',result.status]]);
    },()=>store.close());
  }catch(error){store.close();throw error;}
};
