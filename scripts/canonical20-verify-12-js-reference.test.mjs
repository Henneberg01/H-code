// Canonical12: independent H-Code JS reference interpreter against the exact
// frozen TypeScript contract. No hardcoded routes, application behavior or
// generated JS substitutes: execute the same user-authored .hc source.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {execute} from '../prototype/src/hcode.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
const FROZEN={
 registry:['compact/canonical20/workloads.json','46653ef90ffb3e420fba4ddfbfac3c4cfd57f3b3'],
 cases:['compact/canonical20/cases/12-crud-api.json','0383e7ed4c342cc39756822a2a6581d833c53a76'],
 ts:['compact/canonical20/programs/12-crud-api.ts','6ac016aaf88620578cfc36a82b6f4a94b3b72c9e']
};
const bytes=path=>readFileSync(new URL('../'+path,import.meta.url));
const lock=name=>{
 const [path,sha]=FROZEN[name],b=bytes(path);
 const hash=createHash('sha1').update('blob '+b.length+'\0').update(b).digest('hex');
 assert.equal(hash,sha,'Source lock changed: '+path);
 return b.toString('utf8');
};
const fixtures=JSON.parse(lock('cases'));
const registry=JSON.parse(lock('registry'));
lock('ts');
assert.equal(registry.workloads.length,20);
assert.equal(registry.workloads[11].id,'12-crud-api');
assert.equal(fixtures.cases.length,6);
const hc=bytes('compact/canonical20/programs/12-crud-api.hc').toString('utf8');
function newHandler(){
 let handler=null,bootstrap=null;
 execute(hc,{httpServeState:(reducer,initial)=>{handler=reducer;bootstrap=initial;}});
 assert.equal(bootstrap,'[]','H-Code initial typed store must be deterministic');
 assert.equal(typeof handler,'function');
 return handler;
}
function process(handler,state,step){
 const request=Object.assign(Object.create(null),{
  method:step.method,path:step.path,
  body:Object.hasOwn(step,'rawBody')?step.rawBody:
    Object.hasOwn(step,'body')?JSON.stringify(step.body):'',
  contentType:Object.hasOwn(step,'body')||Object.hasOwn(step,'rawBody')?
    (step.headers?.['content-type']??'application/json'):''
 });
 return handler(request,state);
}
test('Canonical12: independent JS H-Code runtime executes ALL six immutable task12 scenarios',()=>{
 for(const scenario of fixtures.cases){
  let handler=newHandler(),state='[]';
  for(const step of scenario.steps){
   if(step.restart){
    handler=newHandler(); // interpreter process reinitializes, persisted String stays
    continue;
   }
   const result=process(handler,state,step);
   assert.equal(result.status,step.status,scenario.id+': '+step.method+' '+step.path);
   assert.equal(result.body,step.response===null?'':JSON.stringify(step.response)+'\n',
    scenario.id+' byte-exact response '+step.method+' '+step.path);
   assert.equal(result.contentType,'application/json; charset=utf-8');
   state=result.state;
   // All accepted state updates must remain typed JSON records.
   const items=JSON.parse(state);
   assert.ok(Array.isArray(items));
   for(const item of items)assert.deepEqual(Object.keys(item).sort(),['id','name','qty','version']);
  }
  assert.deepEqual(JSON.parse(state),scenario.snapshot,scenario.id+' persistence equivalence');
 }
});
test('Canonical12: JS H-Code optimistic stale versions reject without mutating state',()=>{
 const handler=newHandler();
 let state='[]';
 const create=process(handler,state,{method:'POST',path:'/items',body:{id:'same',name:'Original',qty:0}});
 assert.equal(create.status,201);state=create.state;
 const update={method:'PUT',path:'/items/same',body:{name:'Edited',qty:1,version:1}};
 const a=process(handler,state,update);
 const b=process(handler,a.state,{...update,body:{name:'Stale',qty:7,version:1}});
 assert.equal(a.status,200);
 assert.equal(b.status,409);
 assert.equal(b.state,a.state);
 assert.equal(JSON.parse(a.state)[0].version,2);
});
test('Canonical12: independent JS runtime never commits malformed request bodies',()=>{
 const handler=newHandler(),initial='[]';
 for(const invalid of [
  {method:'POST',path:'/items',rawBody:'{not-json'},
  {method:'POST',path:'/items',body:{id:'safe',name:'x',qty:1,unexpected:true}},
  {method:'POST',path:'/items',body:{id:'safe',name:'x',qty:'1'}},
  {method:'POST',path:'/items',body:{id:'bad',name:'\uD800',qty:1}},
  {method:'POST',path:'/items',body:{id:'Bad_ID',name:'x',qty:1}}
 ]){
  const result=process(handler,initial,invalid);
  assert.equal(result.status,400,JSON.stringify(invalid));
  assert.equal(result.state,initial,'invalid input must be read-only');
 }
});
