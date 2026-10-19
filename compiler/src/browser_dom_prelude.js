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

const __hc_dom_list=(selector,labels)=>{
  const element=__hc_dom_target(selector);
  if(typeof element.tagName!=='string'||
     !['UL','OL'].includes(element.tagName.toUpperCase()))
    throw TypeError('DOM list target must be ul or ol');
  if(!Array.isArray(labels)||labels.length>1024)
    throw TypeError('DOM list requires at most 1024 String items');
  if(typeof element.replaceChildren!=='function'||
     typeof document.createElement!=='function')
    throw TypeError('DOM list host lacks safe element APIs');
  const children=labels.map(label=>{
    const li=document.createElement('li');
    li.textContent=__hc_dom_bounded(label,2048);
    return li;
  });
  element.replaceChildren(...children);
  return null;
};


// General-purpose accessible table rendering. All values are inserted through
// textContent, never innerHTML or source interpolation. Validation is atomic:
// an invalid table must not modify the already-rendered DOM.
const __hc_dom_table=(selector,caption,headers,rows)=>{
  const target=__hc_dom_target(selector);
  if(typeof target.tagName!=='string'||target.tagName.toUpperCase()!=='TABLE')
    throw TypeError('DOM table target must be table');
  if(typeof target.replaceChildren!=='function'||typeof document.createElement!=='function')
    throw TypeError('DOM table host lacks safe element APIs');
  const title=__hc_dom_bounded(caption,2048);
  if(!Array.isArray(headers)||headers.length<1||headers.length>16||
     !Array.isArray(rows)||rows.length>1000)
    throw TypeError('DOM table requires 1..16 headers and at most 1000 rows');
  let bytes=new TextEncoder().encode(title).length;
  const columns=headers.map(h=>{
    const label=__hc_dom_bounded(h,2048);
    bytes+=new TextEncoder().encode(label).length;
    return label;
  });
  const matrix=rows.map(row=>{
    __hc_tick();
    if(!Array.isArray(row)||row.length!==columns.length)
      throw TypeError('DOM table rows must be rectangular String sequences');
    return row.map(cell=>{
      const label=__hc_dom_bounded(cell,2048);
      bytes+=new TextEncoder().encode(label).length;
      if(bytes>262144)throw RangeError('DOM table text budget exceeded');
      return label;
    });
  });
  if(bytes>262144)throw RangeError('DOM table text budget exceeded');
  const textNode=(tag,value,scope)=>{
    const node=document.createElement(tag);
    node.textContent=value;
    if(scope){
      if(typeof node.setAttribute!=='function')
        throw TypeError('DOM table header lacks attribute API');
      node.setAttribute('scope',scope);
    }
    return node;
  };
  const captionNode=textNode('caption',title);
  const head=document.createElement('thead');
  const body=document.createElement('tbody');
  const headRow=document.createElement('tr');
  headRow.replaceChildren(...columns.map(c=>textNode('th',c,'col')));
  head.replaceChildren(headRow);
  const rowNodes=matrix.map(row=>{
    const tr=document.createElement('tr');
    tr.replaceChildren(...row.map((value,i)=>textNode(i===0?'th':'td',value,i===0?'row':null)));
    return tr;
  });
  body.replaceChildren(...rowNodes);
  target.replaceChildren(captionNode,head,body);
  return null;
};
