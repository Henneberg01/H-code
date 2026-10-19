// Independent idiomatic TypeScript, no H-Code imports or task-specific runtime.
type Task={title:string;done:boolean};
const key='hcode:todos';
const input=document.querySelector<HTMLInputElement>('#todo-input')!;
const list=document.querySelector<HTMLUListElement>('#todo-list')!;
const status=document.querySelector<HTMLElement>('#status')!;
const summary=document.querySelector<HTMLElement>('#summary')!;
let tasks:Task[]=JSON.parse(localStorage.getItem(key)??'[]');
function draw(){
 list.replaceChildren(...tasks.map(t=>{
  const li=document.createElement('li');
  li.textContent=(t.done?'✓ ':'○ ')+t.title;
  return li;
 }));
 summary.textContent=JSON.stringify(tasks.filter(t=>!t.done).length)+' tasks remaining';
}
function save(next:Task[]){
 localStorage.setItem(key,JSON.stringify(next));
 tasks=next;
 draw();
}
function valid(name:string):boolean{
 return [...name].length>=1&&[...name].length<=128&&/[^ \t\n\r]/u.test(name);
}
function add():boolean{
 const name=input.value;
 if(!valid(name)){status.textContent='Enter a task name (up to 128 characters)';return false;}
 if(tasks.some(t=>t.title===name)){status.textContent='Task already exists';return false;}
 save([...tasks,{title:name,done:false}]);
 status.textContent='Added '+name;
 return true;
}
function complete():boolean{
 const name=input.value;
 if(!tasks.some(t=>t.title===name)){status.textContent='Task not found';return false;}
 save(tasks.map(t=>t.title===name?{title:t.title,done:true}:t));
 status.textContent='Completed '+name;
 return true;
}
function remove():boolean{
 const name=input.value;
 if(!tasks.some(t=>t.title===name)){status.textContent='Task not found';return false;}
 save(tasks.filter(t=>t.title!==name));
 status.textContent='Removed '+name;
 return true;
}
for(const [selector,run] of [['#add',add],['#complete',complete],['#remove',remove]] as const){
 document.querySelector<HTMLButtonElement>(selector)!.addEventListener('click',event=>{
  if(!run())event.preventDefault();
 });
}
draw();
