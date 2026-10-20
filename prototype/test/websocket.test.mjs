import test from 'node:test';
import assert from 'node:assert/strict';
import {execute,parse,RESERVED_USER_GLYPHS} from '../src/hcode.mjs';
const handler='ƒ handle(e:⦃client:String,data:String,kind:String⦄,s:String)→⦃messages:⟦⦃client:String,data:String⦄⟧,state:String⦄↩⦃messages:⟦⦃client:e·client,data:e·data⦄⟧,state:s⦄;';
const record=x=>Object.assign(Object.create(null),x);
test('generic WebSocket callback and readable alias register real interpreted policy',()=>{
 for(const op of ['⇄','websocket_serve']){
  let callback,initial;
  execute(`${handler}${op}(handle,"seed");`,{websocketServe:(fn,state)=>{callback=fn;initial=state;}});
  assert.equal(typeof callback,'function');assert.equal(initial,'seed');
  assert.deepEqual(JSON.parse(JSON.stringify(callback(record({client:'opaque',data:'Møbel 🙂',kind:'message'}),'next'))),{messages:[{client:'opaque',data:'Møbel 🙂'}],state:'next'});
 }
 assert.ok(RESERVED_USER_GLYPHS.has('⇄'));
});
test('WebSocket effect denies absent capability, malformed arguments and nested I/O',()=>{
 assert.throws(()=>execute(`${handler}⇄(handle,"");`),/WebSocket capability denied/);
 assert.throws(()=>execute('⇄(1,"");',{websocketServe:()=>{}}),/Function/);
 for(const s of ['⇄(1);','⇄(1,"",0);'])assert.throws(()=>parse(s));
 let callback;
 const bad=handler.replace('↩⦃messages:','{⎙(e·data);↩⦃messages:').replace('state:s⦄;','state:s⦄}');
 execute(`${bad}⇄(handle,"");`,{websocketServe:fn=>{callback=fn;}});
 assert.throws(()=>callback(record({client:'a',data:'x',kind:'message'}),''),/effect|pure/i);
});
