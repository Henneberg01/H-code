// M19.12 B2c-2: generic synchronous, replay-safe H-Code HTTP state transactions.
// No CRUD routes or application logic. Only a pure caller-supplied reducer is retried.
const __hc_cas_read_methods=new Set(['GET','HEAD','OPTIONS']);
const __hc_cas_max_retries=256;
const __hc_cas_reply=(status,body)=>Object.freeze({status,body});

export function executeHttpCasTransaction({store,handler,request,metadata,digest,invoke}){
  if(typeof handler!=='function'||typeof invoke!=='function'||
     !metadata||typeof metadata.isCancelled!=='function')
    throw TypeError('Invalid H-Code CAS transaction handler/capability');
  const requestId=metadata.requestId||'';
  const readOnly=__hc_cas_read_methods.has(request.method);
  for(let attempt=0;attempt<__hc_cas_max_retries;attempt++){
    const current=store.snapshot();
    const previous=requestId?current.receipts.find(x=>x.id===requestId):null;
    if(previous){
      if(previous.digest!==digest)return __hc_cas_reply(409,'idempotency_conflict');
      return __hc_cas_reply(previous.status,previous.body);
    }
    // A new request ID can never displace an older receipt. All committed
    // receipts remain intact until an explicit versioned migration.
    if(requestId&&!readOnly&&current.receipts.length>=128)
      return __hc_cas_reply(507,'idempotency_journal_full');
    if(!readOnly&&current.revision>=256)
      return __hc_cas_reply(507,'state_revision_quota_full');
    if(metadata.isCancelled())throw Error('CAS request canceled before reducer');
    // This is intentionally called inside the retry loop. The runtime and
    // compiler must prevent observable effects inside the reducer or helpers.
    const result=invoke(handler,request,current.state);
    if(!result||typeof result!=='object'||Array.isArray(result)||
       Object.getPrototypeOf(result)!==null||
       Object.keys(result).sort().join(',')!=='body,state,status'||
       typeof result.body!=='string'||!result.body.isWellFormed()||
       new TextEncoder().encode(result.body).length>65536||
       typeof result.state!=='string'||!result.state.isWellFormed()||
       new TextEncoder().encode(result.state).length>1048576||
       !Number.isInteger(result.status)||result.status<200||result.status>599)
      throw TypeError('Invalid H-Code CAS reducer response');
    if(readOnly){
      if(result.state!==current.state)
        return __hc_cas_reply(405,'unsafe_state_transition');
      return __hc_cas_reply(result.status,result.body);
    }
    if(metadata.isCancelled())throw Error('CAS request canceled before commit');
    const receipt=requestId?{id:requestId,digest,status:result.status,body:result.body}:null;
    // Requests without IDs keep their legacy at-least-once semantics; they
    // still use CAS for isolation but CANNOT promise crash-safe replay.
    if(result.state===current.state&&!receipt)
      return __hc_cas_reply(result.status,result.body);
    const outcome=store.tryCommit({expectedRevision:current.revision,next:result.state,receipt});
    if(outcome.committed)return __hc_cas_reply(result.status,result.body);
    // Conflict: reread durable receipt/state and recompute from current state.
    // A duplicate request ID will take the replay path on the next iteration.
  }
  return __hc_cas_reply(503,'state_contention_retry_limit');
}
