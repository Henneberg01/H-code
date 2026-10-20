// Actual HTTP policy proof: native, independent language reference/shared CAS host,
// and independent TypeScript/SQLite app. No route or MAC decision lives in host glue.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdtempSync,mkdirSync,rmSync} from 'node:fs';
import {spawn} from 'node:child_process';
import {createHash,createHmac} from 'node:crypto';
import {request} from 'node:http';
import {join,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';
import {compiler,invoke,success} from './canonical20-project-tools.mjs';
import {createHttpCasStateStore} from '../runtime/http-state-cas.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
const folder='compact/canonical20/auth16';
const fixture=JSON.parse(readFileSync(join(root,folder,'fixtures.json')));
const environments=['native','reference','typescript'];
const state=()=>({generation:0,revoked:true,tokens:{}});
const claims=g=>({generation:g,identity:fixture.identity});
const mac=(key,g)=>createHmac('sha256',key).update(JSON.stringify(claims(g)),'utf8').digest('hex');
function token(key,g){return {...claims(g),signature:mac(key,g)};}
function headerToken(model,step){
 let tag=step.signature??(step.token?model.tokens[step.token]:undefined);
 if(step.token)assert.equal(typeof tag,'string','fixture token label must already exist');
 if(step.tamper)tag=(tag[0]==='0'?'1':'0')+tag.slice(1);
 if(step.uppercase)tag=tag.toUpperCase();
 return tag;
}
async function start(kind,cwd,storage,built,source,tsSource=join(root,folder,'typescript/main.ts'),overrides={}){
 const args=kind==='native'?[built]:kind==='reference'?[join(root,'scripts/canonical20-auth-reference-host.mjs'),source]:['--experimental-strip-types',tsSource];
 const env={...process.env,HCODE_ALLOW_FILE_READ:'1',HCODE_HTTP_LISTEN:'127.0.0.1:0',HCODE_HTTP_STATE_ROOT:storage,HCODE_HTTP_STATE_MODE:'cas-v1',HCODE_HTTP_HOST_IPC:'1',...overrides};
 delete env.NODE_TEST_CONTEXT;delete env.NODE_TEST_REPORTER;
 const child=spawn(process.execPath,args,{cwd,env,windowsHide:true,stdio:['ignore','pipe','pipe','ipc']});
 let stdout='',stderr='';
 child.stderr.on('data',data=>{if(stderr.length<8192)stderr+=data;});
 const port=await new Promise((resolve,reject)=>{
  let settled=false;
  const timeout=setTimeout(()=>finish(Error(`${kind} startup timeout ${stderr}`)),10000);
  const onError=error=>finish(error);
  const onExit=code=>finish(Error(`${kind} exited before readiness (${code}) ${stderr}`));
  function onData(data){stdout+=data;if(stdout.length>8192)return finish(Error('Unexpected server output'));const found=/^HCODE_HTTP_READY=(\d+)$/m.exec(stdout);if(found)finish(null,Number(found[1]));}
  function finish(error,value){if(settled)return;settled=true;clearTimeout(timeout);child.off('exit',onExit);child.off('error',onError);child.stdout.off('data',onData);if(error){child.kill('SIGKILL');reject(error);}else resolve(value);}
  child.stdout.on('data',onData);child.once('error',onError);child.once('exit',onExit);
 });
 return {child,port};
}
async function stop(server,crash=false){
 if(!server||server.child.exitCode!==null||server.child.signalCode!==null)return;
 await new Promise((resolve,reject)=>{
  const timer=setTimeout(()=>{server.child.kill('SIGKILL');reject(Error('Server shutdown timeout'));},5000);
  server.child.once('exit',()=>{clearTimeout(timer);resolve();});
  if(crash)server.child.kill('SIGKILL');else server.child.send({hcodeHostCommand:'close'},error=>{if(error)server.child.kill('SIGTERM');});
 });
}
function send(port,step,model){
 const action=step.action==='race'?'rotate':step.action;
 const method=step.method??(action==='verify'?'GET':'POST');
 const path=step.path??(action==='rotate'?'/session/rotate':action==='revoke'?'/session/revoke':'/session');
 let body=Buffer.alloc(0);
 if(action==='issue')body=Buffer.from(JSON.stringify({identity:step.identity??fixture.identity,credential:step.credential??fixture.credential,...(step.extra?{extra:true}:{})}));
 if(step.raw!==undefined)body=Buffer.from(step.raw);
 if(step.inputHex)body=Buffer.from(step.inputHex,'hex');
 if(step.oversize)body=Buffer.alloc(16385,0x78);
 const headers=['Host',`127.0.0.1:${port}`];
 if(action==='issue')headers.push('Content-Type',step.contentType??'application/json');
 const tag=headerToken(model,step);
 if(tag!==undefined)headers.push('X-Session-Signature',tag);
 if(step.duplicate)headers.push('x-SeSSion-Signature','incorrect');
 if(step.receipt)headers.push('X-HCode-Request-Id',step.receipt);
 if(step.headerFlood)for(let i=0;i<128;i++)headers.push('a','b');
 headers.push('Content-Length',String(body.length));
 return new Promise((resolve,reject)=>{
  const req=request({host:'127.0.0.1',port,method,path,headers},res=>{
   let text='';res.setEncoding('utf8');res.on('data',chunk=>{text+=chunk;if(text.length>65536){req.destroy(Error('Response exceeds fixture bound'));}});
   res.on('end',()=>resolve({status:res.statusCode,body:text,contentType:res.headers['content-type'],cache:res.headers['cache-control']}));
   res.on('error',reject);
  });
  req.setTimeout(5000,()=>req.destroy(Error('Session HTTP timeout')));req.on('error',reject);req.end(body);
 });
}
function outcome(actual,status,value,label){
 assert.equal(actual.status,status,`${label}: status`);
 assert.equal(actual.body,status===204?'':JSON.stringify(value)+'\n',`${label}: body`);
 assert.equal(actual.cache,'no-store',`${label}: cache`);
 if(status===204)assert.equal(actual.contentType,undefined);
 else assert.equal(actual.contentType,'application/json; charset=utf-8');
}
function expectedError(step){
 return {error:step.error??({400:'invalid',401:'unauthorized',404:'not_found',405:'method_not_allowed'}[step.status])};
}
function generatedFlows(){
 return Array.from({length:8},(_,i)=>{
  const steps=[{action:'issue',status:400,raw:'{"identity":"fixture-alice","credential":"\\ud800"}'},
    {action:'verify',status:401},{action:'issue',status:201,save:'g0'}];
  let latest='g0';
  for(let j=0;j<3+i%3;j++){
   const next=`g${j+1}`;
   steps.push({action:'verify',token:latest,tamper:true,status:401});
   steps.push({action:j%2===0?'rotate':'race',token:latest,status:j%2===0?200:undefined,save:next});
   steps.push({action:'verify',token:latest,status:401},{action:'verify',token:next,status:200});
   latest=next;
  }
  if(i%2===0){
   steps.push({action:'rekey'},{action:'verify',token:latest,status:401},
     {action:'issue',status:201,save:'afterKeyChange'},{action:'verify',token:'afterKeyChange',status:200});
   latest='afterKeyChange';
  }
  steps.push({action:i%2?'restart':'crash'},{action:'verify',token:latest,status:200},
    {action:'revoke',token:latest,status:204},{action:'crash'},{action:'verify',token:latest,status:401},
    {action:'issue',status:201,save:'new'},{action:'verify',token:latest,status:401},{action:'verify',token:'new',status:200});
  return {id:`generated-${i}`,steps};
 });
}
async function flow(kind,scenario,temporary,built,source,key,tsSource=join(root,folder,'typescript/main.ts')){
 const cwd=join(temporary,`${kind}-${scenario.id}`),storage=join(cwd,'state');
 mkdirSync(join(cwd,'data'),{recursive:true});mkdirSync(storage);
 writeFileSync(join(cwd,'data/signing-key.txt'),key,{mode:0o600});
 if(scenario.initialGeneration!==undefined){
  if(kind==='typescript'){
   const {DatabaseSync}=await import('node:sqlite');
   const db=new DatabaseSync(join(storage,'sessions.sqlite'));
   try{
    db.exec('CREATE TABLE session (id INTEGER PRIMARY KEY, generation INTEGER NOT NULL, revoked INTEGER NOT NULL)');
    db.prepare('INSERT INTO session VALUES (1,?,0)').run(scenario.initialGeneration);
   }finally{db.close();}
  }else{
   const store=createHttpCasStateStore({root:storage,initial:JSON.stringify({generation:0,revoked:true})});
   try{assert.equal(store.tryCommit({expectedRevision:0,next:JSON.stringify({generation:scenario.initialGeneration,revoked:false})}).committed,true);}
   finally{store.close();}
  }
 }
 let server=await start(kind,cwd,storage,built,source,tsSource),model=state(),http=0,restarts=0,crashes=0,races=0,keyChanges=0,activeKey=key;
 if(scenario.initialGeneration!==undefined){
  model.generation=scenario.initialGeneration;model.revoked=false;
  model.tokens.maximum=mac(key,scenario.initialGeneration);
 }
 try{
  for(const [i,step] of scenario.steps.entries()){
   const label=`${kind}/${scenario.id}/${i}/${step.action}`;
   if(['restart','crash','rekey'].includes(step.action)){
    await stop(server,step.action==='crash');server=null;
    if(step.action==='rekey'){
     activeKey=createHash('sha256').update(`public replacement fixture ${scenario.id}`).digest('hex');
     writeFileSync(join(cwd,'data/signing-key.txt'),activeKey,{mode:0o600});keyChanges++;
    }
    server=await start(kind,cwd,storage,built,source,tsSource);restarts++;if(step.action==='crash')crashes++;
    continue;
   }
   if(step.action==='race'){
    const results=await Promise.all([send(server.port,step,model),send(server.port,step,model)]);http+=2;races++;
    assert.deepEqual(results.map(r=>r.status).sort(),[200,401],`${label}: one rotation wins`);
    const next=model.generation+1;
    outcome(results.find(r=>r.status===200),200,token(activeKey,next),label);
    outcome(results.find(r=>r.status===401),401,{error:'unauthorized'},label);
    model.generation=next;model.revoked=false;model.tokens[step.save]=mac(activeKey,next);continue;
   }
   const actual=await send(server.port,step,model);http++;
   if(step.status>=400){outcome(actual,step.status,expectedError(step),label);continue;}
   if(step.action==='issue'||step.action==='rotate'){
    model.generation++;model.revoked=false;
    outcome(actual,step.status,token(activeKey,model.generation),label);
    model.tokens[step.save]=mac(activeKey,model.generation);
   }else if(step.action==='revoke'){
    outcome(actual,204,null,label);model.revoked=true;
   }else outcome(actual,200,claims(model.generation),label);
  }
  return {engine:kind,scenario:scenario.id,httpAssertions:http,restarts,forcedCrashes:crashes,concurrentRotations:races,keyChanges};
 }finally{await stop(server);}
}
async function rejectStartupFailures(temporary,built,source){
 const variants=[['missing',null],['short','k'.repeat(31)],['long','k'.repeat(1025)],
   ['invalid-utf8',Buffer.from([0xff])],['bom-short','\ufeff'+'k'.repeat(30)],['capability',fixture.publicFixtureKey]];
 const results=[];
 for(const engine of environments)for(const [id,key] of variants){
  const cwd=join(temporary,`startup-${engine}-${id}`),storage=join(cwd,'state');
  mkdirSync(join(cwd,'data'),{recursive:true});mkdirSync(storage);
  if(key!==null)writeFileSync(join(cwd,'data/signing-key.txt'),key,{mode:0o600});
  let server,error;
  try{server=await start(engine,cwd,storage,built,source,undefined,id==='capability'?{HCODE_ALLOW_FILE_READ:'0'}:{});}
  catch(failure){error=failure;}
  if(server){await stop(server);assert.fail(`${engine}/${id}: invalid startup accepted`);}
  assert.match(error?.message??'',/exited before readiness \([1-9]\d*\)/,`${engine}/${id}: actual startup rejection required`);
  const reason=id==='missing'?/ENOENT|no such file/i:id==='invalid-utf8'?/utf-?8/i:
    id==='capability'?/capability denied/i:/assertion failed|key.*length/i;
  assert.match(error.message,reason,`${engine}/${id}: expected key/capability diagnostic required`);
  results.push({engine,case:id,rejectedBeforeListen:true});
 }
 return results;
}
async function rejectFaults(temporary,binary,source){
 const directory=join(temporary,'mutants');mkdirSync(directory);
 const originalHC=readFileSync(source,'utf8'),originalTS=readFileSync(join(root,folder,'typescript/main.ts'),'utf8');
 const definitions=[
  ['signature-bypass','state·revoked∨¬✓(key,claims(state·generation),signatures⟦0⟧·value)','state·revoked',
   "if (!timingSafeEqual(Buffer.from(signature(state.generation), 'hex'), Buffer.from(tags[0].value, 'hex')))",'if (false)'],
  ['rotation-reuse','issued(state·generation+1,200)','issued(state·generation,200)',
   'issued(state.generation + 1, 200)','issued(state.generation, 200)'],
  ['revocation-bypass','state·revoked∨¬✓','⊥∨¬✓','tags.length !== 1 || state.revoked ||','tags.length !== 1 ||'],
 ];
 const results=[];
 for(const engine of environments)for(const [id,hcBefore,hcAfter,tsBefore,tsAfter] of definitions){
  const isTS=engine==='typescript',original=isTS?originalTS:originalHC,before=isTS?tsBefore:hcBefore,after=isTS?tsAfter:hcAfter;
  assert.equal(original.split(before).length,2,'counterfactual must change exactly one application expression');
  const changed=join(directory,`${engine}-${id}.${isTS?'ts':'hc'}`);
  writeFileSync(changed,original.replace(before,after));
  const built=join(directory,`${engine}-${id}.mjs`);
  if(engine==='native')success(invoke(binary,['build',changed,'--out',built]),'counterfactual compilation');
  let rejected=null;
  try{await flow(engine,{...fixture.flows[0],id:`fault-${id}`},temporary,built,changed,fixture.publicFixtureKey,isTS?changed:undefined);}
  catch(error){if(error.code!=='ERR_ASSERTION')throw error;rejected=error;}
  assert.ok(rejected,`${engine}/${id}: application fault was not rejected`);
  results.push({engine,id,rejectedByHttpAssertions:true});
 }
 return results;
}
export async function runAuthProof(){
 const binary=compiler(),temporary=mkdtempSync(join(tmpdir(),'jfh-auth16-'));
 const source=join(root,folder,'hcode/main.hc'),built=join(temporary,'session.mjs');
 try{
  success(invoke(binary,['build',source,'--out',built]),'actual session compiler');
  const fixed=[],generated=[],generationBoundaryRuns=[],extra=generatedFlows();
  for(const engine of environments){
   for(const scenario of fixture.flows)fixed.push(await flow(engine,scenario,temporary,built,source,fixture.publicFixtureKey));
   for(const scenario of extra){
    const key=scenario.id==='generated-1'?'\ufeff'+'k'.repeat(31):scenario.id==='generated-2'?'🙂'.repeat(1024):
      (scenario.id==='generated-0'?'\ufeff':'')+createHash('sha256').update(`public generated fixture ${scenario.id}`).digest('hex');
    generated.push(await flow(engine,scenario,temporary,built,source,key));
   }
   generationBoundaryRuns.push(await flow(engine,{id:'maximum-generation',initialGeneration:Number.MAX_SAFE_INTEGER,steps:[
    {action:'issue',status:409,error:'generation_exhausted'},
    {action:'rotate',token:'maximum',status:409,error:'generation_exhausted'},
    {action:'verify',token:'maximum',status:200},
    {action:'revoke',token:'maximum',status:204},{action:'crash'},
    {action:'verify',token:'maximum',status:401},
    {action:'issue',status:409,error:'generation_exhausted'}
   ]},temporary,built,source,fixture.publicFixtureKey));
  }
  const startupRejections=await rejectStartupFailures(temporary,built,source);
  const seededFaultsRejected=await rejectFaults(temporary,binary,source);
  const bytes=readFileSync(built),runs=[...fixed,...generated,...generationBoundaryRuns];
  return {kind:'full-compiler-evidence',engines:environments,fixedScenarios:fixture.flows.length,
    generatedScenarios:extra.length,fixedRuns:fixed,generatedRuns:generated,generationBoundaryRuns,
    httpAssertions:runs.reduce((n,r)=>n+r.httpAssertions,0),
    forcedCrashes:runs.reduce((n,r)=>n+r.forcedCrashes,0),restarts:runs.reduce((n,r)=>n+r.restarts,0),
    concurrentRotations:runs.reduce((n,r)=>n+r.concurrentRotations,0),
    keyChanges:runs.reduce((n,r)=>n+r.keyChanges,0),startupRejections,seededFaultsRejected,
    bomKeyBytesVerified:true,minimumScalarBomKeyVerified:true,maximumUtf8KeyVerified:true,
    sharedReferenceHttpAndCasHost:true,independentTypeScriptSQLite:true,
    compiledJavaScript:{utf8Bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')},
    globallyVerified70Percent:false};
 }finally{rmSync(temporary,{recursive:true,force:true});}
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))console.log(JSON.stringify(await runAuthProof(),null,2));
