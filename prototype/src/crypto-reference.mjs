// Independent JFH-CODE reference host. Key bytes never enter language values.
import {createHash,createHmac,timingSafeEqual,randomBytes} from 'node:crypto';

export function cryptoText(text){
  if(typeof text!=='string')throw TypeError('crypto input requires String');
  if(!text.isWellFormed()||Buffer.byteLength(text,'utf8')>65536)
    throw RangeError('Invalid crypto input');
  return text;
}
export function canonicalMac(text){
  if(typeof text!=='string'||!/^[A-Za-z0-9_-]{43}$/.test(text))return false;
  const bytes=Buffer.from(text,'base64url');
  return bytes.length===32&&bytes.toString('base64url')===text;
}
export function randomByteCount(bytes){
  if(!Number.isInteger(bytes)||bytes<16||bytes>64)throw RangeError('Invalid random byte count');
  return bytes;
}
export function entropyValue(value,bytes){
  if(typeof value!=='string'||value.length!==Math.ceil(bytes*8/6)||!/^[A-Za-z0-9_-]+$/.test(value))
    throw Error('Invalid crypto entropy result');
  const data=Buffer.from(value,'base64url');
  if(data.length!==bytes||data.toString('base64url')!==value)throw Error('Invalid crypto entropy result');
  return value;
}
export const sha256Text=text=>createHash('sha256').update(cryptoText(text),'utf8').digest('hex');
function denied(){const e=Error('crypto capability denied');e.code='JFH_CRYPTO_DENIED';return e;}
const plain=x=>x!==null&&typeof x==='object'&&!Array.isArray(x)&&[null,Object.prototype].includes(Object.getPrototypeOf(x));
const exact=(x,names)=>plain(x)&&Object.keys(x).every(k=>names.includes(k));

export function createCryptoReferenceHost(grants){
  const keys=new Map();let allowRandom=false;
  try{
    if(!exact(grants,['version','keys','random'])||!Object.hasOwn(grants,'version')||grants.version!==1)
      throw Error();
    const source=Object.hasOwn(grants,'keys')?grants.keys:{};
    if(!plain(source)||Object.keys(source).length>32)throw Error();
    if(Object.hasOwn(grants,'random')){
      if(typeof grants.random!=='boolean')throw Error();
      allowRandom=grants.random;
    }
    for(const alias of Object.keys(source)){
      const item=source[alias];
      if(!/^[A-Za-z][A-Za-z0-9_.-]{0,63}$/.test(alias)||!exact(item,['hex','sign','verify'])||
        !Object.hasOwn(item,'hex')||!Object.hasOwn(item,'sign')||!Object.hasOwn(item,'verify')||
        typeof item.sign!=='boolean'||typeof item.verify!=='boolean'||typeof item.hex!=='string'||
        !/^(?:[A-Fa-f0-9]{2}){16,128}$/.test(item.hex))throw Error();
      keys.set(alias,{key:Buffer.from(item.hex,'hex'),sign:item.sign,verify:item.verify});
    }
  }catch{throw TypeError('Invalid crypto grant');}
  const permission=(alias,operation)=>{
    if(typeof alias!=='string')throw TypeError('crypto key alias requires String');
    const entry=keys.get(alias);
    if(!entry||!entry[operation])throw denied();
    return entry.key;
  };
  return Object.freeze({
    sign(alias,message){
      const key=permission(alias,'sign');
      return createHmac('sha256',key).update(cryptoText(message),'utf8').digest('base64url');
    },
    verify(alias,message,mac){
      const key=permission(alias,'verify');cryptoText(message);
      if(typeof mac!=='string')throw TypeError('crypto MAC requires String');
      if(!canonicalMac(mac))return false;
      const actual=Buffer.from(mac,'base64url');
      const expected=createHmac('sha256',key).update(message,'utf8').digest();
      return timingSafeEqual(actual,expected);
    },
    random(bytes){
      if(!allowRandom)throw denied();
      return randomBytes(randomByteCount(bytes)).toString('base64url');
    }
  });
}
