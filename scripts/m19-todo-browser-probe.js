// Neutral observer: identical DOM events against H-Code and TypeScript.
// This file contains NO todo business logic or source-specific shortcuts.
window.addEventListener('load',()=>{
 const input=document.querySelector('#todo-input');
 const list=document.querySelector('#todo-list');
 const summary=document.querySelector('#summary');
 const status=document.querySelector('#status');
 const trace=[];
 const snapshot=(stage,cancelled=null)=>({
  stage,
  cancelled,
  items:[...list.children].map(li=>({tag:li.tagName,text:li.textContent})),
  status:status.textContent,
  summary:summary.textContent,
  stored:localStorage.getItem('hcode:todos')===null?null:JSON.parse(localStorage.getItem('hcode:todos')),
  htmlInjectionCreatedNode:document.querySelector('img')!==null,
  listRole:list.tagName,
  statusRole:status.getAttribute('role'),
  statusAria:status.getAttribute('aria-live')
 });
 function hit(stage,selector,name){
  input.value=name;
  const e=new Event('click',{bubbles:true,cancelable:true});
  document.querySelector(selector).dispatchEvent(e);
  trace.push(snapshot(stage,e.defaultPrevented));
 }
 try{
  const phase=new URLSearchParams(location.search).get('phase');
  trace.push(snapshot('load-'+phase));
  if(phase==='one'){
   hit('empty','#add','');
   hit('add-one','#add','Buy milk');
   hit('add-two','#add','Walk dog');
   hit('duplicate','#add','Buy milk');
   hit('complete-one','#complete','Buy milk');
   hit('remove-two','#remove','Walk dog');
   hit('missing','#remove','Missing');
   hit('malicious-as-text','#add','<img src=x onerror=alert(1)>');
   hit('malicious-removed','#remove','<img src=x onerror=alert(1)>');
  }else if(phase==='two'){
   hit('unicode-add','#add','🚀 Launch');
   hit('unicode-complete','#complete','🚀 Launch');
   hit('remove-old','#remove','Buy milk');
  }
 }catch(e){trace.push({fatal:String(e)});}
 const output=document.createElement('output');
 output.id='hcode-todo-proof';
 output.textContent=encodeURIComponent(JSON.stringify(trace));
 document.body.append(output);
},{once:true});
