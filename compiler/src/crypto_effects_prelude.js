// JFH-CODE generic crypto effects, not session policy. Captures host keys once.
import {createHmac as __hc_hmac,timingSafeEqual as __hc_equal,randomBytes as __hc_random_bytes} from 'node:crypto';
const __hc_crypto_capability=(()=>{
  const keys=new Map();let random=false;
  const plain=v=>v!==null&&typeof v==='object'&&!Array.isArray(v)&&
    [Object.prototype,null].includes(Object.getPrototypeOf(v));
  const shape=(v,names)=>plain(v)&&Object.keys(v).every(k=>names.includes(k));
  const serialized=process.env.HCODE_CRYPTO_GRANTS;
  if(serialized!==undefined){
    try{
      const grant=JSON.parse(serialized);
      if(!shape(grant,['version','keys','random'])||!Object.hasOwn(grant,'version')||grant.version!==1)
        throw Error();
      const entries=Object.hasOwn(grant,'keys')?grant.keys:{};
      if(!plain(entries)||Object.keys(entries).length>32)throw Error();
      if(Object.hasOwn(grant,'random')){
        if(typeof grant.random!=='boolean')throw Error();
        random=grant.random;
      }
      for(const [name,item] of Object.entries(entries)){
        if(!/^[A-Za-z][A-Za-z0-9_.-]{0,63}$/.test(name)||!shape(item,['hex','sign','verify'])||
           !Object.hasOwn(item,'hex')||!Object.hasOwn(item,'sign')||!Object.hasOwn(item,'verify')||
           typeof item.sign!=='boolean'||typeof item.verify!=='boolean'||
           typeof item.hex!=='string'||!/^(?:[0-9a-fA-F]{2}){16,128}$/.test(item.hex))throw Error();
        keys.set(name,{bytes:Buffer.from(item.hex,'hex'),sign:item.sign,verify:item.verify});
      }
    }catch{throw TypeError('Invalid crypto grant');}
  }
  return {
    key(alias,operation){
      if(__hc_cas_reducer_active)throw Error('crypto effect denied in pure evaluation');
      if(typeof alias!=='string')throw TypeError('crypto key alias requires String');
      const entry=keys.get(alias);
      if(!entry||!entry[operation])throw Error('crypto capability denied');
      return entry.bytes;
    },
    entropy(){
      if(__hc_cas_reducer_active)throw Error('crypto effect denied in pure evaluation');
      if(!random)throw Error('crypto capability denied');
    }
  };
})();
const __hc_crypto_sign=(alias,message)=>{
  __hc_tick();
  const key=__hc_crypto_capability.key(alias,'sign');
  return __hc_hmac('sha256',key).update(__hc_crypto_text(message),'utf8').digest('base64url');
};
const __hc_crypto_verify=(alias,message,mac)=>{
  __hc_tick();
  const key=__hc_crypto_capability.key(alias,'verify');
  __hc_crypto_text(message);
  if(typeof mac!=='string')throw TypeError('crypto MAC requires String');
  if(!/^[A-Za-z0-9_-]{43}$/.test(mac))return false;
  const bytes=Buffer.from(mac,'base64url');
  if(bytes.length!==32||bytes.toString('base64url')!==mac)return false;
  return __hc_equal(bytes,__hc_hmac('sha256',key).update(message,'utf8').digest());
};
let __hc_entropy_calls=0,__hc_entropy_bytes=0;
const __hc_crypto_random=bytes=>{
  __hc_tick();
  if(!Number.isInteger(bytes)||bytes<16||bytes>64)throw RangeError('Invalid random byte count');
  __hc_crypto_capability.entropy();
  if(__hc_entropy_calls>=64||__hc_entropy_bytes+bytes>4096)throw Error('crypto entropy budget exceeded');
  let result;
  try{result=__hc_random_bytes(bytes).toString('base64url');}
  catch{throw Error('crypto entropy host failed');}
  __hc_entropy_calls++;__hc_entropy_bytes+=bytes;
  return result;
};
