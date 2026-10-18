// Independent TypeScript correctness oracle for preregistered cache task09.
// A fake clock supplies each event's monotonic 'at' time in milliseconds.
// Not an idiomatic-competitiveness baseline for H-Code compression.
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';

type Event = {at:number,key:string,op:string,ttl:number,value:string};
type Trace = {hit:boolean,key:string,size:number,value:string};
type Entry = {expires:number,key:string,value:string};
export function runCache(events:Event[]):Trace[]{
 if(!Array.isArray(events)||events.length>256)throw new TypeError('Invalid event stream');
 const data=new Map<string,Entry>();
 const result:Trace[]=[];
 let lastTime=0;
 for(const entry of events){
  if(entry===null||typeof entry!=='object'||Array.isArray(entry)||
     Object.keys(entry).sort().join(',')!=='at,key,op,ttl,value'||
     typeof entry.key!=='string'||typeof entry.op!=='string'||typeof entry.value!=='string'||
     !Number.isSafeInteger(entry.at)||entry.at<lastTime||entry.at>1000000000||
     !Number.isSafeInteger(entry.ttl)||Math.abs(entry.ttl)>100000000||
     !['set','get','expire'].includes(entry.op))
     throw new TypeError('Invalid cache operation or regressing fake clock');
  const now=entry.at;
  lastTime=now;
  for(const [key,value] of data){
   if(value.expires<=now)data.delete(key);
  }
  let hit=false,value='';
  if(entry.op==='set'){
   // Replacing a key moves it to the back of FIFO, including TTL=0 invalidation.
   data.delete(entry.key);
   if(entry.ttl>0){
    if(data.size>=8)data.delete(data.keys().next().value!);
    data.set(entry.key,{expires:now+entry.ttl,key:entry.key,value:entry.value});
   }
  }else if(entry.op==='get'){
   const cached=data.get(entry.key);
   if(cached!==undefined){hit=true;value=cached.value;}
  }
  if(data.size>8)throw new Error('Unbounded cache memory');
  result.push({hit,key:entry.key,size:data.size,value});
 }
 return result;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const events=JSON.parse(readFileSync(0,'utf8')) as Event[];
 console.log(JSON.stringify(runCache(events)));
}
