import {test} from 'node:test';import assert from 'node:assert/strict';import {server} from '../server.mjs';
test('Studio serves UI and guards API by token',async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 try{
  const base='http://127.0.0.1:'+server.address().port;
  const page=await fetch(base+'/');assert.equal(page.status,200);const html=await page.text();
  assert.match(html,/H-CODE/);const token=html.match(/name="studio-token" content="([a-f0-9]+)"/)?.[1];assert.ok(token);
  const denied=await fetch(base+'/api/files');assert.equal(denied.status,403);
  const files=await (await fetch(base+'/api/files?token='+token)).json();assert.ok(files.files.includes('m5/invoice/main.hc'));
  const file=await (await fetch(base+'/api/file?path=m5%2Finvoice%2Fmain.hc&token='+token)).json();assert.ok(file.content.includes('INVOICE'));assert.match(file.revision,/^[a-f0-9]{64}$/);
  const invalid=await fetch(base+'/api/file?path=..%2Fpackage.json&token='+token);assert.equal(invalid.status,400);
  const unknown=await fetch(base+'/unlisted.js');assert.equal(unknown.status,404);
 }finally{await new Promise(resolve=>server.close(resolve));}
});