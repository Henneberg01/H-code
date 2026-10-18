// Canonical12 independent TypeScript correctness oracle.
// This is NOT H-Code runtime code and is NOT the competitive idiomatic TS baseline.
// A real HTTP server, schema validation, and restart-persistent atomic state.
import {createServer, type IncomingMessage, type ServerResponse} from 'node:http';
import {closeSync, existsSync, fsyncSync, lstatSync, mkdirSync, openSync, readFileSync, realpathSync, renameSync, unlinkSync, writeFileSync} from 'node:fs';
import {isAbsolute, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

type Item = {id:string; name:string; qty:number; version:number};
type NewItem = {id:string; name:string; qty:number};
type Change = {name:string; qty:number; version:number};
const MAX_BODY=16384;
const ID=/^[a-z][a-z0-9-]{0,31}$/;
const forbidden=(value:unknown)=>typeof value==='string' && !value.isWellFormed();
const plain=(value:unknown):value is Record<string,unknown> =>
  value!==null && typeof value==='object' && !Array.isArray(value) &&
  Object.getPrototypeOf(value)===Object.prototype;
const exact=(v:Record<string,unknown>,keys:string[]) =>
  Object.keys(v).sort().join(',')===keys.slice().sort().join(',');
const titleOk=(v:unknown):v is string =>
  typeof v==='string' && v.length>0 && v.length<=128 && v.trim().length>0 && !forbidden(v);
const qtyOk=(v:unknown):v is number=>Number.isInteger(v) && (v as number)>=0 && (v as number)<=10000;
const newItem=(v:unknown):v is NewItem=>plain(v) && exact(v,['id','name','qty']) &&
  typeof v.id==='string' && ID.test(v.id) && titleOk(v.name) && qtyOk(v.qty);
const change=(v:unknown):v is Change=>plain(v) && exact(v,['name','qty','version']) &&
  titleOk(v.name) && qtyOk(v.qty) && Number.isSafeInteger(v.version) && (v.version as number)>0;
const fail=(res:ServerResponse,status:number,error:string)=>{
  res.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store'});
  res.end(JSON.stringify({error})+'\n');
};
const ok=(res:ServerResponse,status:number,value:Item)=>{
  res.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store'});
  res.end(JSON.stringify(value)+'\n');
};
function verifiedRoot(root:string){
  if(!isAbsolute(root) || resolve(root)!==root) throw Error('Storage root must be explicit canonical absolute path');
  const st=lstatSync(root);
  if(!st.isDirectory() || st.isSymbolicLink() || realpathSync(root)!==root)
    throw Error('Storage root must be a real directory, not a symlink');
  return root;
}
class AtomicStore {
  root:string;
  filename:string;
  items:Map<string,Item>;
  nextTemp=0;
  constructor(root:string){
    this.root=verifiedRoot(root);
    this.filename=join(this.root,'items-state.json');
    this.items=new Map();
    if(existsSync(this.filename)){
      const st=lstatSync(this.filename);
      if(!st.isFile() || st.isSymbolicLink() || st.size>1024*1024)
        throw Error('Invalid persistent state target');
      const parsed:unknown=JSON.parse(readFileSync(this.filename,'utf8'));
      if(!Array.isArray(parsed) || parsed.length>4096)throw Error('Invalid persistent state shape');
      for(const entry of parsed){
        if(!plain(entry) || !exact(entry,['id','name','qty','version']) ||
           !newItem({id:entry.id,name:entry.name,qty:entry.qty}) ||
           !Number.isSafeInteger(entry.version) || (entry.version as number)<1 ||
           this.items.has(entry.id as string))
          throw Error('Invalid persisted entry');
        this.items.set(entry.id as string,entry as Item);
      }
    }
  }
  commit(next:Map<string,Item>){
    if(next.size>4096)throw Error('Store quota exceeded');
    const data=JSON.stringify([...next.values()].sort((a,b)=>a.id.localeCompare(b.id)))+'\n';
    if(Buffer.byteLength(data)>1024*1024)throw Error('Store byte quota exceeded');
    // A process crash before rename leaves the old fully committed file intact.
    const tmp=join(this.root,'.items-'+process.pid+'-'+(++this.nextTemp)+'.tmp');
    let fd:number|undefined;
    try{
      fd=openSync(tmp,'wx',0o600);
      writeFileSync(fd,data,'utf8');
      fsyncSync(fd);closeSync(fd);fd=undefined;
      if(existsSync(this.filename)){
        const st=lstatSync(this.filename);
        if(!st.isFile()||st.isSymbolicLink())throw Error('State target replaced');
      }
      renameSync(tmp,this.filename);
      // Directory fsync is supported on POSIX; on Windows the file fsync is used.
      if(process.platform!=='win32'){
        const directory=openSync(this.root,'r');
        try{fsyncSync(directory);}finally{closeSync(directory);}
      }
      this.items=next;
    }finally{
      if(fd!==undefined)closeSync(fd);
      try{unlinkSync(tmp);}catch(error:unknown){
        if((error as NodeJS.ErrnoException)?.code!=='ENOENT')throw error;
      }
    }
  }
}
async function input(req:IncomingMessage):Promise<unknown>{
  let length=0,tooLarge=false;
  const chunks:Buffer[]=[];
  for await(const chunk of req){
    const data=Buffer.isBuffer(chunk)?chunk:Buffer.from(chunk);
    length+=data.byteLength;
    // Drain the request without retaining excess bytes. Throwing inside the
    // async iterator would destroy the TCP socket before a real HTTP 413 reply.
    if(length>MAX_BODY){tooLarge=true;continue;}
    chunks.push(data);
  }
  if(tooLarge)throw Object.assign(Error('too_large'),{httpStatus:413});
  if(!req.headers['content-type']?.toLowerCase().startsWith('application/json'))
    throw Object.assign(Error('invalid'),{httpStatus:400});
  try{return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(Buffer.concat(chunks)));}
  catch{throw Object.assign(Error('invalid'),{httpStatus:400});}
}
export async function startOracle(root:string){
  const store=new AtomicStore(root);
  const server=createServer(async(req,res)=>{
    try{
      if(!req.method || !req.url || req.url.length>2048){fail(res,400,'invalid');return;}
      const method=req.method,path=req.url;
      const m=/^\/items\/([^/?#]+)$/.exec(path);
      if(path==='/items'){
        if(method!=='POST'){fail(res,405,'method_not_allowed');return;}
        const body=await input(req);
        if(!newItem(body)){fail(res,400,'invalid');return;}
        if(store.items.has(body.id)){fail(res,409,'conflict');return;}
        const item:Item={id:body.id,name:body.name,qty:body.qty,version:1};
        const next=new Map(store.items);next.set(item.id,item);store.commit(next);
        ok(res,201,item);return;
      }
      if(!m){fail(res,404,'not_found');return;}
      const id=m[1];
      if(!ID.test(id)){fail(res,400,'invalid');return;}
      if(!['GET','PUT','DELETE'].includes(method)){fail(res,405,'method_not_allowed');return;}
      const previous=store.items.get(id);
      if(method==='GET'){
        if(!previous){fail(res,404,'not_found');return;}
        ok(res,200,previous);return;
      }
      if(method==='PUT'){
        const body=await input(req);
        if(!change(body)){fail(res,400,'invalid');return;}
        if(!previous){fail(res,404,'not_found');return;}
        if(previous.version!==body.version){fail(res,409,'conflict');return;}
        const item:Item={id,name:body.name,qty:body.qty,version:previous.version+1};
        const next=new Map(store.items);next.set(id,item);store.commit(next);
        ok(res,200,item);return;
      }
      if(!previous){fail(res,404,'not_found');return;}
      const next=new Map(store.items);next.delete(id);store.commit(next);
      res.writeHead(204,{'cache-control':'no-store'});res.end();
    }catch(error:unknown){
      const e=error as Error & {httpStatus?:number};
      if(!res.headersSent)fail(res,e?.httpStatus===413?413:e?.httpStatus===400?400:500,
        e?.httpStatus===413?'too_large':e?.httpStatus===400?'invalid':'storage_error');
    }
  });
  server.maxRequestsPerSocket=100;
  server.requestTimeout=5000;
  server.headersTimeout=6000;
  await new Promise<void>((done,failStart)=>{
    server.once('error',failStart);
    server.listen(0,'127.0.0.1',()=>{server.off('error',failStart);done();});
  });
  const address=server.address();
  if(!address||typeof address==='string')throw Error('Invalid loopback bind');
  return {port:address.port,close:()=>new Promise<void>((done,reject)=>
    server.close(error=>error?reject(error):done()))};
}
if(process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  if(process.argv.length!==3)throw Error('Usage: node --experimental-strip-types 12-crud-api.ts ABSOLUTE_STORAGE_ROOT');
  const instance=await startOracle(process.argv[2]);
  process.stdout.write(JSON.stringify({ready:true,port:instance.port})+'\n');
  process.on('SIGTERM',()=>void instance.close().then(()=>process.exit(0)));
  process.on('SIGINT',()=>void instance.close().then(()=>process.exit(0)));
}
