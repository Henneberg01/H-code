// M19.14 B1: opt-in browser-only, same-origin bounded persistence.
// Three general-purpose H-Code operations, never a todo-specific macro.
// Each storage API call is synchronous and browser-managed; no claim of
// multi-key transactions, encrypted secret storage, or cross-tab serializability.
const __hc_store_key=key=>{
  __hc_tick();
  if(__hc_cas_reducer_active)throw Error('Browser storage effect denied in CAS reducer');
  if(typeof key!=='string'||!/^hcode:[a-z][a-z0-9._-]{0,63}$/.test(key))
    throw TypeError('Storage key must be a namespaced hcode: String');
  if(typeof globalThis.localStorage==='undefined'||
     !globalThis.localStorage||
     typeof globalThis.localStorage.getItem!=='function'||
     typeof globalThis.localStorage.setItem!=='function'||
     typeof globalThis.localStorage.removeItem!=='function')
    throw Error('Browser storage capability unavailable');
  return key;
};
const __hc_store_text=value=>{
  if(typeof value!=='string'||!value.isWellFormed()||
     new TextEncoder().encode(value).length>65536)
    throw TypeError('Storage value must be well-formed String of at most 65536 UTF-8 bytes');
  return value;
};
const __hc_store_get=key=>{
  const value=globalThis.localStorage.getItem(__hc_store_key(key));
  return value===null?'':__hc_store_text(value);
};
const __hc_store_put=(key,value)=>{
  const name=__hc_store_key(key);
  globalThis.localStorage.setItem(name,__hc_store_text(value));
  return null;
};
const __hc_store_del=key=>{
  globalThis.localStorage.removeItem(__hc_store_key(key));
  return null;
};
