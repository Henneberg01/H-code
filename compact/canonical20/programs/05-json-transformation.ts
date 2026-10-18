type Event={id:string;value:number};
type User={name:string;score:number;active:boolean};
type Payload={user:User;events:Event[]};

function record(value:unknown):value is Record<string,unknown>{
  return value!==null&&typeof value==="object"&&!Array.isArray(value);
}
function exact(value:Record<string,unknown>,keys:readonly string[]):boolean{
  return Object.keys(value).length===keys.length&&keys.every(key=>Object.hasOwn(value,key));
}
function event(value:unknown):value is Event{
  return record(value)&&exact(value,["id","value"])&&typeof value.id==="string"&&
    typeof value.value==="number"&&Number.isFinite(value.value);
}
function decode(raw:string):Payload{
  if(new TextEncoder().encode(raw).length>1048576)throw Error("Input exceeds 1 MiB");
  const value:unknown=JSON.parse(raw);
  if(!record(value)||!exact(value,["user","events"]))throw Error("Invalid payload shape");
  const user=value.user;
  if(!record(user)||!exact(user,["name","score","active"])||
     typeof user.name!=="string"||typeof user.score!=="number"||
     !Number.isFinite(user.score)||typeof user.active!=="boolean")throw Error("Invalid user");
  const events=value.events;
  if(!Array.isArray(events)||events.length>16384||!events.every(event))
    throw Error("Invalid events");
  return {user:{name:user.name,score:user.score,active:user.active},events};
}
function transform(raw:string):string{
  const value=decode(raw);
  const user={active:!value.user.active,name:value.user.name,score:value.user.score+3};
  return JSON.stringify({events:value.events,user});
}
/* CANONICAL05_CALLS */
console.log(transform("{\"user\":{\"name\":\"Ada\",\"score\":7,\"active\":true},\"events\":[{\"id\":\"A\",\"value\":4},{\"id\":\"B\",\"value\":-3}]}"));
console.log(transform("{\"events\":[{\"value\":0,\"id\":\"Ø\"}],\"user\":{\"active\":false,\"score\":-2,\"name\":\"Zoë\"}}"));
console.log(transform("{\"user\":{\"name\":\"Li\",\"score\":0,\"active\":true},\"events\":[]}"));
