import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execute} from '../prototype/src/hcode.mjs';
const source=()=>readFileSync(new URL('../compact/canonical20/chat17/hcode/main.hc',import.meta.url),'utf8');
const record=x=>Object.assign(Object.create(null),x);
test('authored chat policy routes by room, numbers accepted messages and removes disconnects',()=>{
 let callback,state;
 execute(source(),{websocketServe:(fn,initial)=>{callback=fn;state=initial;}});
 assert.equal(typeof callback,'function','chat registers a generic event reducer');
 function event(client,kind,data=''){
  const output=callback(record({client,kind,data}),state);state=output.state;
  return JSON.parse(JSON.stringify(output.messages)).map(x=>({client:x.client,data:JSON.parse(x.data)}));
 }
 event('a','open');event('b','open');
 event('a','message',JSON.stringify({kind:'join',value:'one'}));
 event('b','message',JSON.stringify({kind:'join',value:'two'}));
 assert.deepEqual(event('a','message',JSON.stringify({kind:'say',value:'hi'})),[{client:'a',data:{kind:'message',room:'one',sender:'a',sequence:1,text:'hi'}}]);
 event('b','close');
 assert.deepEqual(JSON.parse(state),{members:[{client:'a',room:'one'}],sequence:1});
 const prior=state;event('a','message','{');assert.equal(state,prior);
});
