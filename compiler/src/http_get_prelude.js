// M19.06 ⤋: generic, bounded, host-gated HTTP(S) GET; no retry policy hidden here.
const __hc_http_url=raw=>{
  __hc_tick();
  if(typeof raw!=='string')throw TypeError('⤋ expects String URL');
  let url;
  try{url=new URL(raw);}catch{throw TypeError('H-Code HTTP URL is invalid');}
  if(!['http:','https:'].includes(url.protocol)||url.username||url.password)
    throw TypeError('H-Code HTTP(S) URL required without embedded credentials');
  // Origin allowlist is mandatory; no ambient network privilege.
  const allowed=(process.env.HCODE_HTTP_ALLOWED_ORIGINS||'').split(',').map(x=>x.trim()).filter(Boolean);
  if(!allowed.includes(url.origin))throw Error('H-Code HTTP capability denied for origin');
  return url;
};
// Count actual network calls, including scalar and vector HTTP effects.
let __hc_http_request_count=0;
const __hc_http_get=async raw=>{
  const url=__hc_http_url(raw);
  if(++__hc_http_request_count>64)
    throw Error('H-Code HTTP effect budget exceeded');
  let response;
  try{response=await fetch(url,{method:'GET',redirect:'error',signal:AbortSignal.timeout(2000)});}
  catch{
    return __hc_record([['body',''],['ok',false],['retryAfter',0],['status',0]]);
  }
  // RFC no-content responses (e.g. 204/205) have no ReadableStream.
  const reader=response.body?.getReader(),pieces=[];let length=0;
  if(reader)try{
    while(true){
      const part=await reader.read();
      if(part.done)break;
      length+=part.value.byteLength;
      if(length>65536)throw Error('H-Code HTTP response exceeds 64 KiB');
      pieces.push(part.value);
    }
  }finally{reader.releaseLock();}
  const bytes=new Uint8Array(length);let offset=0;
  for(const part of pieces){bytes.set(part,offset);offset+=part.byteLength;}
  let body;
  try{body=new TextDecoder('utf-8',{fatal:true}).decode(bytes);}
  catch{throw Error('H-Code HTTP response is not UTF-8');}
  const rawAfter=response.headers.get('retry-after');
  const seconds=rawAfter!==null&&/^\d+$/.test(rawAfter)?Number(rawAfter):0;
  const retryAfter=Number.isSafeInteger(seconds)&&seconds<=120?seconds*1000:0;
  return __hc_record([['body',body],['ok',response.ok],['retryAfter',retryAfter],['status',response.status]]);
};

// Vectorization of the same generic typed ⤋ GET, not an application macro.
// Preflight EVERY URL before any request. Promise.all launches all GETs
// concurrently, retains input ordering and has a maximum fan-out of 16.
const __hc_http_batch=async urls=>{
  __hc_tick();
  if(!Array.isArray(urls)||urls.length>16)
    throw TypeError('⤋ batch expects at most 16 String URLs');
  for(const raw of urls)__hc_http_url(raw);
  if(__hc_http_request_count+urls.length>64)
    throw Error('H-Code HTTP effect budget exceeded');
  return __hc_seq(await Promise.all(urls.map(__hc_http_get)));
};
