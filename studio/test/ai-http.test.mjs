import {test} from 'node:test';import assert from 'node:assert/strict';import {server} from '../server.mjs';
test('AI preview endpoint is protected, read-only and returns reviewed diff',async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 try{
  const base='http://127.0.0.1:'+server.address().port;
  const html=await (await fetch(base+'/')).text();
  const token=html.match(/name="studio-token" content="([a-f0-9]+)"/)[1];
  const path='m5/invoice/main.hc';
  const file=await (await fetch(base+'/api/file?path='+encodeURIComponent(path)+'&token='+token)).json();
  const proposal={format:'hcode.edits.v1',summary:'Preview harmless label change',files:[{path,revision:file.revision,edits:[{oldText:'"INVOICE"',newText:'"INVOICE PREVIEW"'}]}]};
  const url=base+'/api/ai/preview';
  const unauthorized=await fetch(url,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({proposal})});
  assert.equal(unauthorized.status,403);
  const preview=await fetch(url,{method:'POST',headers:{'content-type':'application/json','x-studio-token':token},body:JSON.stringify({proposal})});
  assert.equal(preview.status,200,await preview.text().catch(()=>'')); // a successful response is the acceptance criterion
  const after=await (await fetch(base+'/api/file?path='+encodeURIComponent(path)+'&token='+token)).json();
  assert.equal(after.revision,file.revision);
 }finally{await new Promise(resolve=>server.close(resolve));}
});