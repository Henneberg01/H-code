// M19.13 B1: generic browser DOM effects, never an application/form macro.
// Browser ESM only. No eval, innerHTML, dynamic script execution, network I/O.
const __hc_dom_target=selector=>{
  __hc_tick();
  if(__hc_cas_reducer_active)throw Error('DOM effect denied in CAS reducer');
  if(typeof selector!=='string'||selector.length<1||selector.length>256||!selector.isWellFormed())
    throw TypeError('DOM selector must be well-formed String (1..256)');
  if(typeof document==='undefined'||typeof document.querySelector!=='function')
    throw Error('Browser DOM capability unavailable');
  const element=document.querySelector(selector);
  if(!element)throw Error('DOM target not found');
  return element;
};
const __hc_dom_bounded=(value,max=16384)=>{
  if(typeof value!=='string'||!value.isWellFormed()||
     new TextEncoder().encode(value).length>max)
    throw TypeError('DOM text must be bounded well-formed String');
  return value;
};
const __hc_dom_value=selector=>{
  const element=__hc_dom_target(selector);
  const value=typeof element.value==='string'?element.value:element.textContent;
  return __hc_dom_bounded(value??'');
};
const __hc_dom_text=(selector,value)=>{
  const element=__hc_dom_target(selector);
  element.textContent=__hc_dom_bounded(value);
  return null;
};
const __hc_dom_valid=selector=>{
  const element=__hc_dom_target(selector);
  if(typeof element.checkValidity!=='function')
    throw TypeError('DOM target has no native constraint validation');
  const valid=element.checkValidity();
  if(typeof valid!=='boolean')throw TypeError('DOM validity must be Bool');
  return valid;
};
const __hc_dom_attr=(selector,attribute,value)=>{
  const element=__hc_dom_target(selector);
  if(typeof attribute!=='string'||
     !/^(?:aria-[a-z][a-z0-9-]*|role|title|data-hcode-[a-z0-9-]+)$/.test(attribute))
    throw TypeError('DOM attribute not in safe accessibility/data allowlist');
  if(typeof element.setAttribute!=='function')throw TypeError('DOM attribute setter unavailable');
  element.setAttribute(attribute,__hc_dom_bounded(value,2048));
  return null;
};
let __hc_dom_listener_count=0;
const __hc_dom_on=(selector,eventName,handler)=>{
  const element=__hc_dom_target(selector);
  if(!['input','change','submit','click','blur','focus'].includes(eventName))
    throw TypeError('DOM event name is not permitted');
  if(typeof handler!=='function')throw TypeError('DOM event handler must be a function');
  if(typeof element.addEventListener!=='function')throw TypeError('DOM target cannot receive events');
  if(__hc_dom_listener_count>=256)throw RangeError('DOM listener budget exceeded');
  element.addEventListener(eventName,event=>{
    __hc_tick();
    const raw=event?.target;
    const value=raw&&typeof raw.value==='string'?raw.value:'';
    const accepted=handler(__hc_dom_bounded(value));
    if(typeof accepted!=='boolean')throw TypeError('DOM event handler must return Bool');
    if(!accepted&&event?.cancelable&&typeof event.preventDefault==='function')
      event.preventDefault();
  },{passive:false});
  __hc_dom_listener_count++;
  return null;
};
