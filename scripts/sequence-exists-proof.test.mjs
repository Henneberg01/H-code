import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFileSync,existsSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {dumpDOM} from './chromium-driver.mjs';
import {execute} from '../prototype/src/hcode.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
const before='compact/canonical20/programs/14-todo-app.hc';
const after='compact/canonical20/candidates/14-todo-exists.hc';
const read=path=>readFileSync(join(root,path),'utf8');
function compile(path,dest){
 const result=spawnSync('cargo',['run','--quiet','--manifest-path','compiler/Cargo.toml','--','build',join(root,path),'--out',dest],{cwd:root,encoding:'utf8',timeout:180000});
 assert.ifError(result.error);assert.equal(result.status,0,result.stderr);
 return readFileSync(dest,'utf8');
}
test('new JFH-CODE source uses real existential computation and is smaller than its unchanged predecessor',()=>{
 assert.ok(existsSync(join(root,after)),'shorter JFH-CODE application candidate exists');
 const old=read(before),current=read(after);
 assert.equal((current.match(/∃/g)||[]).length,4);
 assert.ok([...current].length<[...old].length);
 assert.ok(Buffer.byteLength(current)<Buffer.byteLength(old));
 assert.ok(!current.includes('tasks⌕λx:x·title≡name'));
});
test('original and shorter Rust-compiled JFH-CODE match every frozen browser trace across three launches',async()=>{
 assert.ok(existsSync(join(root,after)),'shorter JFH-CODE application candidate exists');
 const temp=mkdtempSync(join(tmpdir(),'jfh-exists-browser-'));
 let server;
 try{
  const apps={before:compile(before,join(temp,'before.mjs')),after:compile(after,join(temp,'after.mjs'))};
  assert.ok(apps.after.includes('__hc_exists('));assert.ok(!apps.before.includes('__hc_exists'));
  const html=read('compact/canonical20/programs/14-todo-app.html'),probe=read('scripts/m19-todo-browser-probe.js');
  server=createServer((req,res)=>{
   const url=new URL(req.url,'http://localhost');
   if(url.pathname==='/proof'){
    res.setHeader('content-type','text/html; charset=utf-8');
    res.end(html.replace('./14-todo-app.mjs','/app.mjs?engine='+url.searchParams.get('engine')).replace('</body>','<script defer src="/probe.js"></script></body>'));return;
   }
   if(url.pathname==='/app.mjs'){res.setHeader('content-type','text/javascript');res.end(apps[url.searchParams.get('engine')]);return;}
   if(url.pathname==='/probe.js'){res.setHeader('content-type','text/javascript');res.end(probe);return;}
   res.writeHead(404);res.end();
  });
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
  const traces={};
  for(const engine of ['before','after']){
   traces[engine]=[];
   for(const phase of ['one','two','three']){
    const dom=await dumpDOM({binary:process.env.HCODE_CHROME_BINARY||process.env.HCODE_CHROME||'/usr/bin/chromium',
     url:'http://127.0.0.1:'+server.address().port+'/proof?engine='+engine+'&phase='+phase,profile:join(temp,engine)});
    const marker=/<output id="hcode-todo-proof">([^<]+)<\/output>/.exec(dom);
    assert.ok(marker,engine+'/'+phase+' actual browser evidence missing');
    const trace=JSON.parse(decodeURIComponent(marker[1].replaceAll('&amp;','&')));
    assert.ok(trace.length>0&&!trace.some(row=>'fatal'in row),engine+'/'+phase+' failed');
    traces[engine].push(trace);
   }
  }
  assert.deepEqual(traces.after,traces.before);
  assert.equal(traces.after.flat().length,15);
  assert.equal(traces.after[0][4].cancelled,true);
  assert.equal(traces.after[0][8].htmlInjectionCreatedNode,false);
  assert.deepEqual(traces.after[2][0].stored,[{title:'🚀 Launch',done:true}]);
 }finally{
  if(server){server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
  rmSync(temp,{recursive:true,force:true});
 }
});
test('independent reference executes the shorter JFH-CODE and preserves missing/duplicate handling',()=>{
 assert.ok(existsSync(join(root,after)),'shorter JFH-CODE application candidate exists');
 const nodes=new Map(),store=new Map();
 const element=tagName=>({tagName,textContent:'',value:'',children:[],listeners:new Map(),
  addEventListener(event,fn){this.listeners.set(event,fn);},setAttribute(){},replaceChildren(...items){this.children=items;}});
 for(const id of ['todo-input','todo-list','status','summary','add','complete','remove'])nodes.set('#'+id,element(id==='todo-list'?'UL':'INPUT'));
 execute(read(after),{domHost:{querySelector:id=>nodes.get(id),createElement:tag=>element(tag.toUpperCase())},
  storageHost:{getItem:key=>store.get(key)??null,setItem:(key,value)=>store.set(key,value),removeItem:key=>store.delete(key)}});
 function hit(button,value){nodes.get('#todo-input').value=value;let cancelled=false;nodes.get('#'+button).listeners.get('click')({cancelable:true,preventDefault(){cancelled=true;}});return cancelled;}
 assert.equal(hit('add',' '),true);assert.equal(hit('add','JFH'),false);assert.equal(hit('add','JFH'),true);
 assert.equal(hit('complete','Missing'),true);assert.equal(hit('complete','JFH'),false);assert.equal(hit('remove','Missing'),true);
 assert.deepEqual(JSON.parse(store.get('hcode:todos')),[{title:'JFH',done:true}]);
});
