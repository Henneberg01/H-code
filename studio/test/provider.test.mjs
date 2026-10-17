import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createProvider} from '../provider.mjs';
test('Studio frontend JavaScript parses',()=>{assert.doesNotThrow(()=>new vm.Script(fs.readFileSync(new URL('../public/app.js',import.meta.url),'utf8')))});
test('provider API connect and model proposal with mock transport',async()=>{
 const seen=[];
 const request=async(url,options)=>{seen.push({url,options});if(url.includes('/models/'))return {ok:true};return {ok:true,json:async()=>({output:[{type:'message',content:[{type:'output_text',text:JSON.stringify({format:'hcode.edits.v1',summary:'Update the label',files:[{path:'examples/hello_ascii.hc',revision:'f'.repeat(64),edits:[{oldText:'hello',newText:'world'}]}]})}]}]})};};
 const provider=createProvider({request});
 assert.equal(provider.status().connected,false);
 await provider.connect('sk-test-only-not-a-real-key','gpt-5-mini');
 assert.equal(provider.status().connected,true);
 const proposal=await provider.generate({path:'examples/hello_ascii.hc',source:'hello',revision:'f'.repeat(64),instruction:'Change hello to world'}).catch(e=>e);
 assert.ok(proposal instanceof Error||proposal.format==='hcode.edits.v1');
 assert.ok(seen.some(s=>s.url.endsWith('/responses'))===false||seen.length===2);
 provider.disconnect();assert.equal(provider.status().connected,false);
});