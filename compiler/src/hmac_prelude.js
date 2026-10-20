// General deterministic UTF-8 MAC operations; no session policy or host secrets.
import {createHmac as __hc_create_hmac,timingSafeEqual as __hc_mac_equal} from 'node:crypto';
const __hc_hmac_text=(value,limit)=>{
  if(typeof value!=='string'||!value.isWellFormed()||Buffer.byteLength(value,'utf8')>limit)
    throw TypeError('HMAC expects well-formed bounded UTF-8 Strings');
  return value;
};
const __hc_hmac_bytes=(key,message)=>__hc_create_hmac('sha256',__hc_hmac_text(key,4096))
  .update(__hc_hmac_text(message,65536),'utf8').digest();
const __hc_hmac_sign=(key,message)=>{__hc_tick();return __hc_hmac_bytes(key,message).toString('hex');};
const __hc_hmac_verify=(key,message,tag)=>{
  __hc_tick();
  const expected=__hc_hmac_bytes(key,message);
  if(typeof tag!=='string')throw TypeError('HMAC tag expects String');
  if(!/^[0-9a-f]{64}$/.test(tag))return false;
  return __hc_mac_equal(expected,Buffer.from(tag,'hex'));
};
