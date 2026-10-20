// Separate reference adapter over the standard crypto implementation.
import {createHmac,timingSafeEqual} from 'node:crypto';
function mac(key,message){
  for(const [text,maximum] of [[key,4096],[message,65536]]){
    if(typeof text!=='string'||!text.isWellFormed()||new TextEncoder().encode(text).length>maximum)
      throw new TypeError('HMAC requires bounded well-formed UTF-8 String arguments');
  }
  return createHmac('sha256',key).update(message,'utf8').digest();
}
export function signMAC(key,message){return mac(key,message).toString('hex');}
export function verifyMAC(key,message,tag){
  const expected=mac(key,message);
  if(typeof tag!=='string')throw new TypeError('HMAC tag requires String');
  return /^[0-9a-f]{64}$/.test(tag)&&timingSafeEqual(Buffer.from(tag,'hex'),expected);
}
