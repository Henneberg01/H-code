// Independent idiomatic TypeScript comparison, not the SHA-frozen correctness oracle.
// Application behavior, validation and durable storage are user-written TypeScript.
// Runtime is Node standard library only; no H-Code code, symbols or macros.
import {createServer, type ServerResponse, type IncomingMessage} from 'node:http';
import {closeSync,existsSync,fsyncSync,lstatSync,openSync,readFileSync,realpathSync,renameSync,unlinkSync,writeFileSync} from 'node:fs';
import {isAbsolute,join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
type Item={id:string;name:string;qty:number;version:number};
type Create=Pick<Item,'id'|'name'|'qty'>;
type Update=Pick<Item,'name'|'qty'|'version'>;
const ID=/^[a-z][a-z0-9-]{0,31}$/;
const MIME='application/json; charset=utf-8';
const object=(v:unknown):v is Record<string,unknown>=>v!==null&&typeof v==='object'&&!Array.isArray(v)&&Object.getPrototypeOf(v)===Object.prototype;
const keys=(v:Record<string,unknown>,k:string[])=>Object.keys(v).sort().join()===k.slice().sort().join();
const title=(v:unknown):v is string=>typeof v==='string'&&v.isWellFormed()&&v.length>0&&v.length<=128&&v.trim().length>0;
const qty=(v:unknown):v is number=>Number.isInteger(v)&&Number(v)>=0&&Number(v)<=10000;
const create=(v:unknown):v is Create=>object(v)&&keys(v,['id','name','qty'])&&typeof v.id==='string'&&ID.test(v.id)&&title(v.name)&&qty(v.qty);
const update=(v:unknown):v is Update=>object(v)&&keys(v,['name','qty','version'])&&title(v.name)&&qty(v.qty)&&Number.isSafeInteger(v.version)&&Number(v.version)>0;
function storeRoot(dir:string){
 if(!isAbsolute(dir)||resolve(dir)!==dir)throw Error('Unsafe root');
 const st=lstatSync(dir);
 if(!st.isDirectory()||st.isSymbolicLink()||realpathSync(dir)!==dir)throw Error('Unsafe root');
 return dir;
}
class Store{
 file:string;
 data=new Map<string,Item>();
 private counter=0;
 private dir:string;
 constructor(dir:string){
  this.dir=dir;
  this.file=join(storeRoot(dir),'items-state.json');
  if(!existsSync(this.file))return;
  const st=lstatSync(this.file);
  if(!st.isFile()||st.isSymbolicLink()||st.size>1048576)throw Error('Unsafe file');
  const records:unknown=JSON.parse(readFileSync(this.file,'utf8'));
  if(!Array.isArray(records)||records.length>4096)throw Error('Corrupt store');
  for(const row of records){
   if(!object(row)||!keys(row,['id','name','qty','version'])||
      !create({id:row.id,name:row.name,qty:row.qty})||
      !Number.isSafeInteger(row.version)||Number(row.version)<1||
      this.data.has(row.id as string))throw Error('Corrupt record');
   this.data.set(row.id as string,row as Item);
  }
 }
 commit(next:Map<string,Item>){
  if(next.size>4096)throw Error('Store quota');
  const bytes=JSON.stringify([...next.values()].sort((a,b)=>a.id.localeCompare(b.id)))+'\n';
  if(Buffer.byteLength(bytes)>1048576)throw Error('Store quota');
  const tmp=join(this.dir,'.items-'+process.pid+'-'+(++this.counter)+'.tmp');
  let fd:number|undefined;
  try{
   fd=openSync(tmp,'wx',0o600);writeFileSync(fd,bytes);fsyncSync(fd);closeSync(fd);fd=undefined;
   if(existsSync(this.file)){const st=lstatSync(this.file);if(!st.isFile()||st.isSymbolicLink())throw Error('Unsafe replacement');}
   renameSync(tmp,this.file);
   if(process.platform!=='win32'){const d=openSync(this.dir,'r');try{fsyncSync(d);}finally{closeSync(d);}}
   this.data=next;
  }finally{
   if(fd!==undefined)closeSync(fd);
   try{unlinkSync(tmp);}catch(e){if((e as NodeJS.ErrnoException)?.code!=='ENOENT')throw e;}
  }
 }
}
const reply=(res:ServerResponse,status:number,value:Item|{error:string}|null)=>{
 res.writeHead(status,value===null?{'cache-control':'no-store'}:{'cache-control':'no-store','content-type':MIME});
 res.end(value===null?'':JSON.stringify(value)+'\n');
};
async function readBody(req:IncomingMessage):Promise<unknown>{
 let size=0,tooLarge=false;const chunks:Buffer[]=[];
 for await(const data of req){
  const buf=Buffer.isBuffer(data)?data:Buffer.from(data);
  size+=buf.length;if(size>16384){tooLarge=true;continue;}chunks.push(buf);
 }
 if(tooLarge)throw Object.assign(Error('too_large'),{status:413});
 if(!req.headers['content-type']?.toLowerCase().startsWith('application/json'))
  throw Object.assign(Error('invalid'),{status:400});
 try{return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(Buffer.concat(chunks)));}
 catch{throw Object.assign(Error('invalid'),{status:400});}
}
export async function start(dir:string){
 const store=new Store(dir);
 const server=createServer(async(req,res)=>{
  try{
   if(!req.method||!req.url||req.url.length>2048){reply(res,400,{error:'invalid'});return;}
   const method=req.method,path=req.url;
   if(path==='/items'){
    if(method!=='POST'){reply(res,405,{error:'method_not_allowed'});return;}
    const body=await readBody(req);
    if(!create(body)){reply(res,400,{error:'invalid'});return;}
    if(store.data.has(body.id)){reply(res,409,{error:'conflict'});return;}
    const item:Item={...body,version:1},next=new Map(store.data);
    next.set(item.id,item);store.commit(next);reply(res,201,item);return;
   }
   const m=/^\/items\/([^/?#]+)$/.exec(path);
   if(!m){reply(res,404,{error:'not_found'});return;}
   const id=m[1];
   if(!ID.test(id)){reply(res,400,{error:'invalid'});return;}
   if(!['GET','PUT','DELETE'].includes(method)){reply(res,405,{error:'method_not_allowed'});return;}
   const previous=store.data.get(id);
   if(method==='GET'){reply(res,previous?200:404,previous??{error:'not_found'});return;}
   if(method==='PUT'){
    const body=await readBody(req);
    if(!update(body)){reply(res,400,{error:'invalid'});return;}
    if(!previous){reply(res,404,{error:'not_found'});return;}
    if(previous.version!==body.version){reply(res,409,{error:'conflict'});return;}
    const item:Item={id,name:body.name,qty:body.qty,version:previous.version+1};
    const next=new Map(store.data);next.set(id,item);store.commit(next);reply(res,200,item);return;
   }
   if(!previous){reply(res,404,{error:'not_found'});return;}
   const next=new Map(store.data);next.delete(id);store.commit(next);reply(res,204,null);
  }catch(e){
   const status=(e as {status?:number})?.status;
   if(!res.headersSent)reply(res,status===413?413:status===400?400:500,
    {error:status===413?'too_large':status===400?'invalid':'storage_error'});
  }
 });
 server.requestTimeout=5000;server.headersTimeout=6000;
 await new Promise<void>((ok,fail)=>{
  server.once('error',fail);
  server.listen(0,'127.0.0.1',()=>{server.off('error',fail);ok();});
 });
 const address=server.address();if(!address||typeof address==='string')throw Error('Bad bind');
 return {port:address.port,close:()=>new Promise<void>((ok,fail)=>server.close(e=>e?fail(e):ok()))};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 if(process.argv.length!==3)throw Error('Usage: idiomatic12.ts ABSOLUTE_STORAGE_ROOT');
 const instance=await start(process.argv[2]);
 process.stdout.write(JSON.stringify({ready:true,port:instance.port})+'\n');
 process.on('SIGTERM',()=>void instance.close().then(()=>process.exit(0)));
 process.on('SIGINT',()=>void instance.close().then(()=>process.exit(0)));
}
