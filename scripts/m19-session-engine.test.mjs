import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync,spawn} from 'node:child_process';
import {mkdtempSync,readFileSync,writeFileSync,rmSync,mkdirSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';
import {createHmac} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {execute} from '../prototype/src/hcode.mjs';
import {createCryptoReferenceHost} from '../prototype/src/crypto-reference.mjs';
import {createStringTransactionStore} from '../runtime/string-transaction.mjs';
import {SessionOracle} from '../compact/canonical20/idiomatic/16-auth-session-oracle.ts';
const root=fileURLToPath(new URL('../',import.meta.url));
const fixture=JSON.parse(readFileSync(join(root,'compact/canonical20/cases/16-auth-sessions.json'),'utf8'));
const source=readFileSync(join(root,'compact/canonical20/candidates/16-session-engine-b2a.hc'),'utf8');
const grants={version:1,keys:{session:{hex:fixture.signingKeyHex,sign:true,verify:true}},random:true};
const ids=fixture.sessionIds,epoch=fixture.baseEpoch;
const token=id=>'v1.'+id+'.'+createHmac('sha256',Buffer.from(fixture.signingKeyHex,'hex')).update('hcode-session/v1/'+id).digest('base64url');
const command=(op,extra={})=>({op,identity:fixture.identities[0],token:'',now:epoch,ttl:120,...extra});
let compiled;
function context(run){
 const dir=mkdtempSync(join(tmpdir(),'jfh-session-'));
 try{
  if(!compiled){
   const output=join(dir,'session.mjs');
   const build=spawnSync(join(root,'compiler/target/debug/hcodec'+(process.platform==='win32'?'.exe':'')),['build',join(root,'compact/canonical20/candidates/16-session-engine-b2a.hc'),'--out',output],{encoding:'utf8',timeout:30000});
   assert.equal(build.status,0,build.stderr||String(build.error));compiled=readFileSync(output,'utf8');
  }
  const output=join(dir,'session.mjs');writeFileSync(output,compiled);
  const referenceRoot=join(dir,'reference'),nativeRoot=join(dir,'native');mkdirSync(referenceRoot,{mode:0o700});mkdirSync(nativeRoot,{mode:0o700});
  const store=createStringTransactionStore({root:referenceRoot});
  const oracle=new SessionOracle(join(dir,'oracle.sqlite'),fixture.signingKeyHex);
  const env=(id=ids[0],key=grants)=>({...process.env,HCODE_TX_STATE_ROOT:nativeRoot,HCODE_CRYPTO_GRANTS:JSON.stringify(key),JFH_TEST_SESSION_ID:id});
  const args=['--import',join(root,'scripts/fixtures/session-entropy-preload.mjs'),output];
  const native=(q,id=ids[0],key=grants)=>{
   const result=spawnSync(process.execPath,args,{encoding:'utf8',env:env(id,key),input:JSON.stringify(q),timeout:10000});
   assert.equal(result.status,0,result.stderr||String(result.error));
   assert.doesNotMatch(result.stderr,/v1\.[A-Za-z0-9_-]+\.|424242424242/);
   return JSON.parse(result.stdout);
  };
  const reference=(q,id=ids[0],key=grants)=>{
   const lines=[],host=createCryptoReferenceHost(key);
   execute(source,{readStdin:()=>JSON.stringify(q),stateTransaction:store.transact,cryptoHost:{...host,random:()=>id},stdout:s=>lines.push(s)});
   assert.equal(lines.length,1);return JSON.parse(lines[0]);
  };
  const both=(q,id=ids[0],key=grants)=>{const a=reference(q,id,key),b=native(q,id,key);assert.deepEqual(b,a);return a;};
  const c={dir,nativeRoot,referenceRoot,oracle,both,native,reference,env,args};
  try{return run(c);}finally{store.close();oracle.close();}
 }finally{rmSync(dir,{recursive:true,force:true});}
}
test('actual sign-only session source passes all five frozen B0 scenarios against the independent SQLite oracle',()=>context(c=>{
 const {both,oracle}=c;
 const issued=both(command('issue'));
 assert.equal(issued.ok,true);assert.equal(issued.token,oracle.issue(fixture.identities[0],ids[0],epoch,120));
 assert.equal(issued.cookie,oracle.cookie(issued.token,120));
 const inspect=both(command('inspect',{token:issued.token,now:epoch+10}));
 const row=oracle.inspect(issued.token,epoch+10);
 assert.deepEqual({identity:inspect.identity,issuedAt:inspect.issuedAt,expiresAt:inspect.expiresAt},row);
 const rotated=both(command('rotate',{token:issued.token,now:epoch+50}),ids[1]);
 assert.equal(rotated.token,oracle.rotate(issued.token,ids[1],epoch+50));assert.equal(rotated.expiresAt,epoch+120);
 assert.equal(rotated.cookie,oracle.cookie(rotated.token,70));
 assert.equal(both(command('inspect',{token:issued.token,now:epoch+51})).ok,false);assert.equal(oracle.inspect(issued.token,epoch+51),null);
 assert.equal(both(command('inspect',{token:rotated.token,now:epoch+51})).identity,oracle.inspect(rotated.token,epoch+51).identity);
 assert.equal(both(command('revoke',{token:rotated.token,now:epoch+80})).ok,oracle.revoke(rotated.token,epoch+80));
 assert.equal(both(command('inspect',{token:rotated.token,now:epoch+81})).ok,false);
 const expiry=both(command('issue',{identity:fixture.identities[1],now:epoch+200,ttl:5}),ids[2]);
 assert.equal(expiry.token,oracle.issue(fixture.identities[1],ids[2],epoch+200,5));
 assert.equal(both(command('inspect',{token:expiry.token,now:epoch+204})).ok,true);
 assert.equal(both(command('inspect',{token:expiry.token,now:epoch+205})).ok,false);assert.equal(oracle.inspect(expiry.token,epoch+205),null);
 const persisted=both(command('issue',{now:epoch+300,ttl:300}),ids[3]);oracle.issue(fixture.identities[0],ids[3],epoch+300,300);
 assert.equal(both(command('inspect',{token:persisted.token,now:epoch+301})).identity,oracle.inspect(persisted.token,epoch+301).identity);
 // Every native command above ran in a fresh process and reopened the same DB.
}));
test('forged, malformed, wrong-key and nonexistent tokens fail; expiry and revoke are exact',()=>context(c=>{
 const issued=c.both(command('issue'));
 for(const bad of ['', 'x'.repeat(8192),issued.token+'=',issued.token+'.extra',issued.token.replace('v1.','v2.'),token(ids[1]),issued.token.slice(0,-1)+'!','v1..x'])
  for(const op of ['inspect','rotate','revoke'])assert.equal(c.both(command(op,{token:bad})).ok,false);
 const wrong={...grants,keys:{session:{...grants.keys.session,hex:'43'.repeat(32)}}};
 assert.equal(c.both(command('inspect',{token:issued.token}),ids[1],wrong).ok,false);
 assert.equal(c.both(command('revoke',{token:issued.token,now:epoch+119})).ok,true);
 assert.equal(c.both(command('revoke',{token:issued.token,now:epoch+119})).ok,false);
 assert.equal(c.both(command('rotate',{token:issued.token,now:epoch+119}),ids[1]).ok,false);
}));
test('invalid inputs and ID collisions preserve committed sessions; rotation retains absolute expiry',()=>context(c=>{
 for(const changes of [{identity:''},{identity:'bad identity'},{identity:'x'.repeat(129)},{identity:'ø'},{ttl:0},{ttl:86401},{ttl:1.5},{now:-1},{now:0.5},{now:9007199254740991}])
  assert.equal(c.both(command('issue',changes)).ok,false);
 const issued=c.both(command('issue'));c.oracle.issue(fixture.identities[0],ids[0],epoch,120);
 assert.equal(c.both(command('issue')).error,'conflict');assert.throws(()=>c.oracle.issue(fixture.identities[0],ids[0],epoch,120));
 const other=c.both(command('issue'),ids[1]);c.oracle.issue(fixture.identities[0],ids[1],epoch,120);
 assert.equal(c.both(command('rotate',{token:issued.token,now:epoch+10}),ids[1]).error,'conflict');
 assert.throws(()=>c.oracle.rotate(issued.token,ids[1],epoch+10));
 assert.equal(c.both(command('inspect',{token:issued.token,now:epoch+11})).ok,true);assert.ok(c.oracle.inspect(issued.token,epoch+11));
 assert.equal(c.both(command('inspect',{token:other.token})).ok,true);
 const rotated=c.both(command('rotate',{token:issued.token,now:epoch+119}),ids[2]);
 assert.equal(rotated.token,c.oracle.rotate(issued.token,ids[2],epoch+119));
 assert.equal(c.both(command('inspect',{token:rotated.token,now:epoch+120})).ok,false);
 assert.equal(c.both(command('bogus')).ok,false);
}));
test('actual SQLite contains only hashed IDs and metadata after issue, rotate and revoke',()=>context(c=>{
 const issued=c.both(command('issue'));const rotated=c.both(command('rotate',{token:issued.token,now:epoch+1}),ids[1]);
 c.both(command('revoke',{token:rotated.token,now:epoch+2}));
 for(const path of [c.nativeRoot,c.referenceRoot]){
  const bytes=readFileSync(join(path,'state.sqlite'));
  for(const secret of [...ids,issued.token,rotated.token,fixture.signingKeyHex,'hcode-session/v1/'])assert.equal(bytes.includes(Buffer.from(secret)),false,secret);
  assert.equal(bytes.includes(Buffer.from(fixture.identities[0])),true);
 }
}));
test('missing signing and entropy permissions cannot commit a session',()=>context(c=>{
 for(const denied of [{...grants,random:false},{...grants,keys:{session:{...grants.keys.session,sign:false}}}]){
  // Use the real reference permission check for randomness in this negative test.
  const host=createCryptoReferenceHost(denied),store=createStringTransactionStore({root:c.referenceRoot});
  try{assert.throws(()=>execute(source,{readStdin:()=>JSON.stringify(command('issue')),stateTransaction:store.transact,cryptoHost:host}),/crypto/);}
  finally{store.close();}
  const r=spawnSync(process.execPath,c.args,{env:c.env(ids[0],denied),encoding:'utf8',input:JSON.stringify(command('issue')),timeout:10000});
  assert.notEqual(r.status,0);assert.equal(r.stdout,'');assert.doesNotMatch(r.stderr,/v1\.[A-Za-z0-9_-]+\.|424242424242/);
 }
 // A failed first transaction leaves no committed state row.
 for(const path of [c.nativeRoot,c.referenceRoot]){
  const db=new DatabaseSync(join(path,'state.sqlite'));
  try{assert.equal(db.prepare('SELECT count(*) AS n FROM hc_state').get().n,0);}finally{db.close();}
 }
 assert.equal(c.both(command('issue')).ok,true);
}));
test('the 1024-row bound retains old tombstones and refuses new sessions without entropy',()=>context(c=>{
 const rows=Array.from({length:1024},(_,i)=>({h:String(i),u:'old-user',a:epoch,e:epoch+120,r:-1}));
 const state=JSON.stringify(rows);
 for(const path of [c.nativeRoot,c.referenceRoot]){
  const store=createStringTransactionStore({root:path});
  try{store.transact(()=>Object.assign(Object.create(null),{state,value:''}),'[]');}finally{store.close();}
 }
 const denied={...grants,random:false};
 assert.equal(c.both(command('issue'),ids[0],denied).error,'capacity');
}));
test('two separate Rust-generated processes cannot both rotate the same session',async()=>{
 // Keep fixtures alive through asynchronous children: the sync context helper cannot own this case.
 let saved;
 context(c=>{const issued=c.native(command('issue'));saved={compiled,token:issued.token,db:readFileSync(join(c.nativeRoot,'state.sqlite'))};});
 const dir=mkdtempSync(join(tmpdir(),'jfh-session-race-'));
 try{
  const output=join(dir,'session.mjs');writeFileSync(output,saved.compiled);writeFileSync(join(dir,'state.sqlite'),saved.db,{mode:0o600});
  const run=id=>new Promise((resolve,reject)=>{
   const child=spawn(process.execPath,['--import',join(root,'scripts/fixtures/session-entropy-preload.mjs'),output],{timeout:10000,env:{...process.env,HCODE_TX_STATE_ROOT:dir,HCODE_CRYPTO_GRANTS:JSON.stringify(grants),JFH_TEST_SESSION_ID:id}});
   let out='',err='';child.stdout.on('data',x=>out+=x);child.stderr.on('data',x=>err+=x);child.on('error',reject);
   child.on('close',code=>{try{assert.equal(code,0,err);resolve(JSON.parse(out));}catch(e){reject(e);}});
   child.stdin.end(JSON.stringify(command('rotate',{token:saved.token,now:epoch+10})));
  });
  const results=await Promise.all([run(ids[1]),run(ids[2])]);assert.equal(results.filter(x=>x.ok).length,1);
 }finally{rmSync(dir,{recursive:true,force:true});}
});
