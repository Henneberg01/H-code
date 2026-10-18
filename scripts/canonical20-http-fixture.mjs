// Deterministic loopback-only HTTP fixture for canonical workload 06.
// This is test infrastructure, NOT H-Code HTTP support or compiler evidence.
import {createServer} from 'node:http';

const ID=/^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export async function startHttpFixture(cases,{maxRequests=128}={}) {
  if (!Array.isArray(cases)||cases.length===0||cases.length>32)
    throw Error('Cases must be a bounded nonempty array');
  if (!Number.isInteger(maxRequests)||maxRequests<1||maxRequests>4096)
    throw Error('Invalid maxRequests');
  const plans=new Map();
  for(const c of cases){
    if(!ID.test(c.id)||plans.has(c.id)||!Array.isArray(c.responses)||c.responses.length<1||c.responses.length>16)
      throw Error('Invalid or duplicate fixture case');
    for(const r of c.responses){
      if(!Number.isInteger(r.status)||r.status<200||r.status>599||typeof r.body!=='string'||Buffer.byteLength(r.body)>16384||
        (r.retryAfterSeconds!==undefined&&(!Number.isInteger(r.retryAfterSeconds)||r.retryAfterSeconds<0||r.retryAfterSeconds>10)))
        throw Error('Invalid fixture response');
    }
    plans.set(c.id,c.responses);
  }
  const hits=new Map(),received=[];
  const server=createServer((req,res)=>{
    const id=/^\/case\/([a-z0-9-]+)$/.exec(req.url??'')?.[1];
    if(req.method!=='GET'){res.writeHead(405);res.end('method not allowed');return;}
    if(!id||!plans.has(id)){res.writeHead(404);res.end('unknown case');return;}
    if(received.length>=maxRequests){res.writeHead(429);res.end('fixture request limit exceeded');return;}
    const position=hits.get(id)??0;
    const responses=plans.get(id);
    const reply=responses[Math.min(position,responses.length-1)];
    hits.set(id,position+1);
    received.push({id,attempt:position+1,status:reply.status});
    const headers={'content-type':'text/plain; charset=utf-8','cache-control':'no-store'};
    if(reply.retryAfterSeconds!==undefined)headers['retry-after']=String(reply.retryAfterSeconds);
    res.writeHead(reply.status,headers);res.end(reply.body);
  });
  try{
    await new Promise((resolve,reject)=>{
      server.once('error',reject);
      server.listen(0,'127.0.0.1',resolve);
    });
  }catch(e){server.close();throw e;}
  const address=server.address();
  if(!address||typeof address==='string')throw Error('Expected loopback TCP address');
  return Object.freeze({
    urlFor(id){if(!plans.has(id))throw Error('Unknown fixture case');return 'http://127.0.0.1:'+address.port+'/case/'+id;},
    hitsFor(id){return hits.get(id)??0;},
    get received(){return received.map(x=>({...x}));},
    close(){return new Promise((resolve,reject)=>server.close(err=>err?reject(err):resolve()));}
  });
}
