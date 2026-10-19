import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {createHash} from 'node:crypto';
import {existsSync,mkdtempSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=fileURLToPath(new URL('../',import.meta.url));
const LOCK={
 registry:['compact/canonical20/workloads.json','46653ef90ffb3e420fba4ddfbfac3c4cfd57f3b3'],
 contract:['compact/canonical20/cases/12-crud-api.json','0383e7ed4c342cc39756822a2a6581d833c53a76'],
 hcode:['compact/canonical20/programs/12-crud-api.hc','b3ba6542ef27474390a7354c8c01a22464156179'],
 oracle:['compact/canonical20/programs/12-crud-api.ts','6ac016aaf88620578cfc36a82b6f4a94b3b72c9e'],
 competitor:['compact/canonical20/idiomatic/12-crud-api.ts','55c577b335e07877df365c96b8de1e7cb0ec41cb']
};
const blob=b=>createHash('sha1').update('blob '+b.length+'\0').update(b).digest('hex');
function source(k){
 const [path,sha]=LOCK[k],b=readFileSync(join(root,path));
 assert.equal(blob(b),sha,'Source SHA lock invalid: '+path);
 return b;
}
const fixtures=JSON.parse(source('contract')),manifest=JSON.parse(source('registry'));
assert.equal(fixtures.cases.length,6);
assert.equal(manifest.workloads[11].id,'12-crud-api');
source('oracle');
const comparator=join(root,LOCK.competitor[0]);
const dir=()=>mkdtempSync(join(tmpdir(),'hcode12-ts-competitive-'));
async function start(rootDir){
 const child=spawn(process.execPath,['--experimental-strip-types',comparator,rootDir],
  {cwd:root,windowsHide:true,stdio:['ignore','pipe','pipe']});
 let err='',out='';
 child.stderr.on('data',c=>{if(err.length<8000)err+=c;});
 const port=await new Promise((ok,fail)=>{
  let settled=false;
  const timeout=setTimeout(()=>finish(Error('Comparator readiness timeout: '+err)),12000);
  function finish(e,value){
   if(settled)return;settled=true;clearTimeout(timeout);
   child.stdout.off('data',onData);child.off('exit',onExit);child.off('error',onError);
   if(e){child.kill('SIGKILL');fail(e);}else ok(value);
  }
  function onData(data){
   out+=data;
   if(out.length>4096)return finish(Error('Unexpected comparator output'));
   const index=out.indexOf('\n');
   if(index===-1)return;
   try{
    const j=JSON.parse(out.slice(0,index));
    if(j.ready!==true||!Number.isInteger(j.port))throw Error('Bad comparator readiness');
    finish(null,j.port);
   }catch(e){finish(e);}
  }
  function onExit(code){finish(Error('Comparator exited '+code+': '+err));}
  function onError(e){finish(e);}
  child.stdout.on('data',onData);
  child.once('exit',onExit);child.once('error',onError);
 });
 return {child,url:'http://127.0.0.1:'+port};
}
async function stop(app){
 if(!app||app.child.exitCode!==null||app.child.signalCode!==null)return;
 await new Promise(resolve=>{
  const timeout=setTimeout(()=>{app.child.kill('SIGKILL');resolve();},5000);
  app.child.once('exit',()=>{clearTimeout(timeout);resolve();});
  app.child.kill('SIGTERM');
 });
}
async function send(app,step){
 const body='rawBody'in step?step.rawBody:'body'in step?JSON.stringify(step.body):undefined;
 const r=await fetch(app.url+step.path,{
  method:step.method,body,redirect:'manual',
  headers:{...(body!==undefined?{'content-type':'application/json'}:{}),...(step.headers||{})}
 });
 return {status:r.status,body:await r.text(),mime:r.headers.get('content-type')};
}
test('idiomatic competitive TypeScript independently passes all six original frozen CRUD contracts',async()=>{
 for(const scenario of fixtures.cases){
  const storage=dir();let app;
  try{
   app=await start(storage);
   for(const step of scenario.steps){
    if(step.restart){await stop(app);app=await start(storage);continue;}
    const got=await send(app,step);
    assert.equal(got.status,step.status,scenario.id+' status');
    assert.equal(got.body,step.response===null?'':JSON.stringify(step.response)+'\n',
     scenario.id+' exact body');
    assert.equal(got.mime,step.response===null?null:'application/json; charset=utf-8',
     scenario.id+' mime');
   }
   const file=join(storage,'items-state.json');
   const actual=existsSync(file)?JSON.parse(readFileSync(file,'utf8')):[];
   assert.deepEqual(actual,scenario.snapshot,scenario.id+' snapshot');
  }finally{await stop(app);rmSync(storage,{recursive:true,force:true});}
 }
});
test('separate SHA-locked competitive comparison, with no global 70-percent claim',()=>{
 const hc=source('hcode'),ts=source('competitor');
 const cp=b=>[...new TextDecoder('utf8',{fatal:true}).decode(b)].length;
 const metrics={hcodeCodepoints:cp(hc),typescriptCodepoints:cp(ts),
  hcodeBytes:hc.length,typescriptBytes:ts.length,
  codepointReductionPct:Number((100*(1-cp(hc)/cp(ts))).toFixed(2)),
  byteReductionPct:Number((100*(1-hc.length/ts.length)).toFixed(2))};
 assert.equal(metrics.hcodeCodepoints,3098);
 assert.ok(metrics.typescriptCodepoints>0&&metrics.typescriptBytes>0);
 console.log('CANONICAL12_IDIOMATIC_TS_REPORT='+JSON.stringify(metrics));
});
