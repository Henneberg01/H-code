type Person={age:number;name:string};
function isPerson(value:unknown):value is Person{
  if(!value||typeof value!=="object"||Array.isArray(value))return false;
  if(Object.keys(value).sort().join(",")!=="age,name")return false;
  const p=value as Record<string,unknown>;
  return typeof p.age==="number"&&Number.isFinite(p.age)&&typeof p.name==="string";
}
const s='{"name":"Ada","age":42}';
if(new TextEncoder().encode(s).length>1048576)throw Error("JSON input size exceeded");
const p:unknown=JSON.parse(s);
if(!isPerson(p))throw Error("JSON type mismatch");
console.log(p.name);
console.log(JSON.stringify({age:p.age,name:p.name}));
