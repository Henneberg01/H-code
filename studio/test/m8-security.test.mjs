import {test} from 'node:test';import assert from 'node:assert/strict';import {server} from '../server.mjs';
test('Studio rejects forged Origin, Host and simple cross-site POST',async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 try{
  const port=server.address().port;const host='http://127.0.0.1:'+port;
  const html=await(await fetch(host+'/')).text();const token=html.match(/name="studio-token" content="([a-f0-9]+)"/)[1];
  const forged=await fetch(host+'/api/files?token='+token,{headers:{Origin:'http://evil.example'}});
  assert.equal(forged.status,403);
  const post=await fetch(host+'/api/ai/disconnect',{method:'POST',headers:{'x-studio-token':token,'content-type':'text/plain',Origin:host},body:'{}'});
  assert.equal(post.status,415);
  const {request}=await import('node:http');
  const status=await new Promise((resolve,reject)=>{const req=request(host+'/api/files?token='+token,{headers:{Host:'evil.example'}},res=>{res.resume();resolve(res.statusCode)});req.on('error',reject);req.end();});
  assert.equal(status,403);
 }finally{await new Promise(resolve=>server.close(resolve));}
});