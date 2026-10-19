// JFH-CODE native pure UTF-8 SHA-256. No host key/entropy grants linked here.
import {createHash as __hc_create_hash} from 'node:crypto';
const __hc_crypto_text=value=>{
  if(typeof value!=='string')throw TypeError('crypto input requires String');
  if(!value.isWellFormed()||Buffer.byteLength(value,'utf8')>65536)
    throw RangeError('Invalid crypto input');
  return value;
};
const __hc_crypto_hash=value=>{
  __hc_tick();
  return __hc_create_hash('sha256').update(__hc_crypto_text(value),'utf8').digest('hex');
};
