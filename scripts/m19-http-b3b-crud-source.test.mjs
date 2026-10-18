import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execute} from '../prototype/src/hcode.mjs';
const source=readFileSync(new URL('../compact/canonical20/programs/12-crud-api.hc',import.meta.url),'utf8');
test('B3b-2 genuine H-Code CRUD function registers and handles representative typed routes',()=>{
 let handler;execute(source,{httpServeState:(h,initial)=>{assert.equal(initial,'[]');handler=h;}});
 assert.equal(typeof handler,'function');
 let state='[]';
 function send(method,path,body='',contentType='application/json'){
  const request=Object.assign(Object.create(null),{method,path,body,contentType});
  const result=handler(request,state);state=result.state;return result;
 }
 const first=send('POST','/items','{"id":"alpha","name":"First","qty":3}');
 assert.equal(first.status,201);assert.equal(JSON.parse(first.body).version,1);
 assert.equal(send('GET','/items/alpha').status,200);
 const updated=send('PUT','/items/alpha','{"name":"Second","qty":0,"version":1}');
 assert.equal(updated.status,200);assert.equal(JSON.parse(updated.body).version,2);
 assert.equal(send('PUT','/items/alpha','{"name":"Stale","qty":0,"version":1}').status,409);
 assert.equal(send('POST','/items','{"id":"alpha","name":"Bad","qty":1}').status,409);
 assert.equal(send('POST','/items','{"id":"bad","name":"Bad","qty":"1"}').status,400);
 assert.equal(send('DELETE','/items/alpha').status,204);
 assert.equal(send('GET','/items/alpha').status,404);
 assert.equal(state,'[]');
});
