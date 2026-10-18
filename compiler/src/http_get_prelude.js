// M19.06 ⤋: generic, bounded, host-gated HTTP(S) GET; no retry policy hidden here.
const __hc_http_get=async raw=>{
  __hc_tick();
  if(typeof raw!=='string')throw TypeError('⤋ expects String URL');
  let url;
  try{url=new URL(raw);}catch{throw TypeError('H-Code HTTP URL is invalid');}
  if(!['http:','https:'].includes(url.protocol)||url.username||url.password)
    throw TypeError('H-Code HTTP(S) URL required without embedded credentials');
  // Origin allowlist is mandatory; no ambient network privilege.
  const allowed=(process.env.HCODE_HTTP_ALLOWED_ORIGINS||'').split(',').map(x=>x.trim()).filter(Boolean);
  if(!allowed.includes(url.origin))throw Error('H-Code HTTP capability denied for origin');
  let response;
  try{response=await fetch(url,{method:'GET',redirect:'error',signal:AbortSignal.timeout(2000)});}
  catch{
    return __hc_record([['body',''],['ok',false],['retryAfter',0],['status',0]]);
  }
  if(!response.body)throw Error('H-Code HTTP response has no body');
  const reader=response.body.getReader(),pieces=[];let length=0;
  try{
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
