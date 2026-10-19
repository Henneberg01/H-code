// M19.12 B4 candidate: THREE REAL INDEPENDENT ENGINES on one frozen contract.
// 1) Rust-compiled H-Code -> Node HTTP, 2) JS H-Code reference interpreter,
// 3) source-SHA-frozen independent TypeScript HTTP oracle.
// Nothing in here is allowed to edit the six preregistered Canonical12 fixtures.
import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import {spawn,spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {existsSync,mkdtempSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {execute} from '../prototype/src/hcode.mjs';
import {createHttpCasStateStore} from '../runtime/http-state-cas.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
const frozen={
 registry:['compact/canonical20/workloads.json','46653ef90ffb3e420fba4ddfbfac3c4cfd57f3b3'],
 cases:['compact/canonical20/cases/12-crud-api.json','0383e7ed4c342cc39756822a2a6581d833c53a76'],
 ts:['compact/canonical20/programs/12-crud-api.ts','6ac016aaf88620578cfc36a82b6f4a94b3b72c9e']
};
const file=p=>readFileSync(join(root,p));
function locked(kind){
 const [path,expected]=frozen[kind],bytes=file(path);
 assert.equal(createHash('sha1').update('blob '+bytes.length+'\0').update(bytes).digest('hex'),expected,
  'Original Canonical12 source lock changed: '+path);
 return bytes.toString('utf8');
}
const cases=JSON.parse(locked('cases')).cases;
const registry=JSON.parse(locked('registry'));
locked('ts');
assert.equal(registry.workloads[11].id,'12-crud-api');
assert.equal(registry.workloads[11].status,'unsupported');
assert.equal(cases.length,6);
const HCODE=file('compact/canonical20/programs/12-crud-api.hc').toString('utf8');
const ORACLE=join(root,frozen.ts[0]);
const temp=()=>mkdtempSync(join(tmpdir(),'hcode12-three-'));
const sorted=items=>[...items].sort((a,b)=>a.id<b.id?-1:a.id>b.id?1:0);
let build=null;
function compile(){
 if(build)return build;
 const dir=temp(),output=join(dir,'crud.mjs');
 const result=spawnSync('cargo',['run','--quiet','--manifest-path','compiler/Cargo.toml','--',
  'build',join(root,'compact/canonical20/programs/12-crud-api.hc'),'--out',output],{
  cwd:root,encoding:'utf8',windowsHide:true,timeout:180000,maxBuffer:1048576
 });
 if(result.error||result.status!==0){
  rmSync(dir,{recursive:true,force:true});
  throw Error('Native H-Code source compiler failed: '+(result.error?.message??result.stderr));
 }
 const emitted=readFileSync(output);
 console.log('CANONICAL12_GENERATED_JS_BYTES='+emitted.length);
 console.log('CANONICAL12_GENERATED_JS_SHA256='+createHash('sha256').update(emitted).digest('hex'));
 build={dir,output};return build;
}
after(()=>{if(build)rmSync(build.dir,{recursive:true,force:true});});
function reference(){
 let fn=null,initial;
 execute(HCODE,{httpServeState:(handler,state)=>{fn=handler;initial=state;}});
 assert.equal(initial,'[]');
 assert.equal(typeof fn,'function');
 return fn;
}
async function launch(kind,storage){
 const args=kind==='hcode'?[compile().output]:['--experimental-strip-types',ORACLE,storage];
 const env=kind==='hcode'?{...process.env,HCODE_HTTP_LISTEN:'127.0.0.1:0',
  HCODE_HTTP_STATE_ROOT:storage,HCODE_HTTP_STATE_MODE:'cas-v1',HCODE_HTTP_HOST_IPC:'1'}:process.env;
 const child=spawn(process.execPath,args,{
  cwd:root,env,windowsHide:true,stdio:kind==='hcode'?['ignore','pipe','pipe','ipc']:['ignore','pipe','pipe']
 });
 let stderr='',stdout='';
 child.stderr.on('data',d=>{if(stderr.length<8192)stderr+=d;});
 const port=await new Promise((resolve,reject)=>{
  let settled=false;
  const deadline=setTimeout(()=>finish(Error(kind+' server timeout '+stderr)),15000);
  function done(){child.stdout.off('data',onData);child.off('error',onError);child.off('exit',onExit);}
  function finish(error,p){
   if(settled)return;
   settled=true;clearTimeout(deadline);done();
   if(error){child.kill('SIGKILL');reject(error);}else resolve(p);
  }
  function onData(d){
   stdout+=d;
   if(stdout.length>4096)return finish(Error(kind+' unbounded ready output'));
   const newline=stdout.indexOf('\n');
   if(newline===-1)return;
   const first=stdout.slice(0,newline);
   if(kind==='hcode'){
    const match=/^HCODE_HTTP_READY=(\d+)$/.exec(first);
    if(!match)return finish(Error('Bad H-Code readiness '+first));
    finish(null,Number(match[1]));
   }else{
    let info;
    try{info=JSON.parse(first);}catch{return finish(Error('Bad TS readiness '+first));}
    if(info.ready!==true||!Number.isInteger(info.port)||info.port<1)
      return finish(Error('Bad TS port'));
    finish(null,info.port);
   }
  }
  const onError=e=>finish(e);
  const onExit=code=>finish(Error(kind+' server exited '+code+': '+stderr));
  child.stdout.on('data',onData);child.once('error',onError);child.once('exit',onExit);
 });
 return {kind,child,url:'http://127.0.0.1:'+port};
}
async function stop(app){
 if(!app||app.child.exitCode!==null||app.child.signalCode!==null)return;
 await new Promise(resolve=>{
  const watchdog=setTimeout(()=>{app.child.kill('SIGKILL');resolve();},5000);
  app.child.once('exit',()=>{clearTimeout(watchdog);resolve();});
  if(app.kind==='hcode'&&app.child.connected)app.child.send({hcodeHostCommand:'close'});
  else app.child.kill('SIGTERM');
 });
}
function bodyOf(step){
 if(Object.hasOwn(step,'rawBody'))return step.rawBody;
 if(Object.hasOwn(step,'body'))return JSON.stringify(step.body);
 return '';
}
function hasBody(step){return Object.hasOwn(step,'rawBody')||Object.hasOwn(step,'body');}
async function wire(app,step){
 const headers={...(hasBody(step)?{'content-type':'application/json'}:{}),...(step.headers??{})};
 const res=await fetch(app.url+step.path,{method:step.method,
  body:hasBody(step)?bodyOf(step):undefined,redirect:'manual',headers});
 return {status:res.status,body:await res.text(),
  contentType:res.headers.get('content-type')};
}
function jsRequest(fn,old,step){
 const r=Object.assign(Object.create(null),{
  body:bodyOf(step),method:step.method,path:step.path,
  contentType:hasBody(step)?step.headers?.['content-type']??'application/json':''
 });
 const response=fn(r,old);
 return {
  state:response.state,
  status:response.status,
  body:response.status===204||response.status===304?'':response.body,
  contentType:response.status===204||response.status===304?null:response.contentType
 };
}
function logicalHCode(dir){
 const store=createHttpCasStateStore({root:dir,initial:'[]'});
 try{return JSON.parse(store.read());}finally{store.close();}
}
function logicalTS(dir){
 const path=join(dir,'items-state.json');
 return existsSync(path)?JSON.parse(readFileSync(path,'utf8')):[];
}
const verify=(actual,expected,label)=>assert.deepEqual(actual,expected,label);
async function scenario(scenario){
 const rustDir=temp(),tsDir=temp();let rust,ts,fn=reference(),state='[]';
 try{
  rust=await launch('hcode',rustDir);
  ts=await launch('ts',tsDir);
  for(const step of scenario.steps){
   if(step.restart){
    await Promise.all([stop(rust),stop(ts)]);
    rust=await launch('hcode',rustDir);
    ts=await launch('ts',tsDir);
    fn=reference();
    continue;
   }
   const [rustGot,tsGot]=await Promise.all([wire(rust,step),wire(ts,step)]);
   const jsGot=jsRequest(fn,state,step);state=jsGot.state;
   const exact={status:step.status,body:step.response===null?'':JSON.stringify(step.response)+'\n',
    contentType:step.response===null?null:'application/json; charset=utf-8'};
   const label=scenario.id+' '+step.method+' '+step.path;
   verify(rustGot,exact,'Rust HTTP '+label);
   verify(tsGot,exact,'TS HTTP '+label);
   verify({status:jsGot.status,body:jsGot.body,contentType:jsGot.contentType},
    exact,'Independent JS '+label);
   verify(rustGot,tsGot,'Rust vs TS '+label);
   verify(rustGot,{status:jsGot.status,body:jsGot.body,contentType:jsGot.contentType},
    'Rust vs JS '+label);
   const r=logicalHCode(rustDir),t=logicalTS(tsDir),j=JSON.parse(state);
   verify(sorted(r),sorted(t),'Rust vs TypeScript persisted state '+label);
   verify(sorted(j),sorted(t),'JS vs TypeScript state '+label);
  }
  verify(sorted(logicalHCode(rustDir)),sorted(scenario.snapshot),
    'Rust final state '+scenario.id);
  verify(sorted(logicalTS(tsDir)),sorted(scenario.snapshot),
    'TS final state '+scenario.id);
  verify(sorted(JSON.parse(state)),sorted(scenario.snapshot),
    'JS final state '+scenario.id);
 }finally{
  await Promise.all([stop(rust),stop(ts)]);
  rmSync(rustDir,{recursive:true,force:true});
  rmSync(tsDir,{recursive:true,force:true});
 }
}
test('Canonical12: THREE independent H-Code Rust, H-Code JS, TypeScript engines on all SIX frozen cases',async()=>{
 for(const s of cases)await scenario(s);
});
test('Canonical12: THREE engines support general multi-item records (not a hardcoded one-item API)',async()=>{
 await scenario({id:'extra-generalization-not-counted-in-frozen-six',steps:[
  {method:'POST',path:'/items',body:{id:'zeta',name:'Zeta',qty:4},status:201,
   response:{id:'zeta',name:'Zeta',qty:4,version:1}},
  {method:'POST',path:'/items',body:{id:'alpha',name:'Alpha',qty:2},status:201,
   response:{id:'alpha',name:'Alpha',qty:2,version:1}},
  {method:'GET',path:'/items/alpha',status:200,response:{id:'alpha',name:'Alpha',qty:2,version:1}},
  {method:'PUT',path:'/items/zeta',body:{name:'Changed',qty:0,version:1},
   status:200,response:{id:'zeta',name:'Changed',qty:0,version:2}},
  {restart:true},
  {method:'DELETE',path:'/items/zeta',status:204,response:null},
  {method:'GET',path:'/items/zeta',status:404,response:{error:'not_found'}},
  {method:'GET',path:'/items/alpha',status:200,response:{id:'alpha',name:'Alpha',qty:2,version:1}}
 ],snapshot:[{id:'alpha',name:'Alpha',qty:2,version:1}]});
});

test('Canonical12: generated multi-entity flows resist hardcoded fixture answers',async()=>{
  for(let seed=0;seed<4;seed++){
    const a='a'+seed,b='b'+seed;
    const first={id:a,name:'Café 🚀 '+seed,qty:seed+1,version:1};
    const second={id:b,name:'Tokyo 東京 '+seed,qty:10-seed,version:1};
    const changed={id:a,name:'Revised æøå '+seed,qty:0,version:2};
    await scenario({
      id:'generated-variation-'+seed,
      steps:[
        {method:'POST',path:'/items',body:{id:a,name:first.name,qty:first.qty},
          status:201,response:first},
        {method:'POST',path:'/items',body:{id:b,name:second.name,qty:second.qty},
          status:201,response:second},
        {method:'GET',path:'/items/'+a,status:200,response:first},
        {method:'PUT',path:'/items/'+a,
          body:{name:changed.name,qty:changed.qty,version:1},
          status:200,response:changed},
        {method:'PUT',path:'/items/'+a,
          body:{name:'Stale',qty:1,version:1},
          status:409,response:{error:'conflict'}},
        {method:'POST',path:'/items',
          body:{id:b,name:'Duplicate',qty:0},
          status:409,response:{error:'conflict'}},
        {method:'GET',path:'/items/'+b,status:200,response:second},
        {restart:true},
        {method:'DELETE',path:'/items/'+b,status:204,response:null},
        {method:'GET',path:'/items/'+b,status:404,response:{error:'not_found'}},
        {method:'GET',path:'/items/'+a,status:200,response:changed}
      ],
      snapshot:[changed]
    });
  }
});
