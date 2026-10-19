// Independent reference for Canonical16 B0. No H-Code auth syntax/coverage is claimed.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash,createHmac} from 'node:crypto';
import {readFileSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {DatabaseSync} from 'node:sqlite';
import {SessionOracle} from '../compact/canonical20/idiomatic/16-auth-session-oracle.ts';

const root=fileURLToPath(new URL('../',import.meta.url));
const blobs=Object.freeze({
 registry:['compact/canonical20/workloads.json','46653ef90ffb3e420fba4ddfbfac3c4cfd57f3b3'],
 fixture:['compact/canonical20/cases/16-auth-sessions.json','1861703aed80bcf4c324ad6519d8810a12bde765'],
 oracle:['compact/canonical20/idiomatic/16-auth-session-oracle.ts','02dc03af5ea422afd5adc970f18d07f3411da142']
});
function locked(name){
 const [path,expected]=blobs[name],data=readFileSync(join(root,path),'utf8');
 const normalized=data.replaceAll('\r\n','\n');
 assert.equal(normalized.includes('\r'),false,'Unexpected CR in '+path);
 const bytes=Buffer.from(normalized);
 const sha=createHash('sha1').update('blob '+bytes.length+'\0').update(bytes).digest('hex');
 assert.equal(sha,expected,'Canonical16 source lock changed: '+path);
 return normalized;
}
const fixture=JSON.parse(locked('fixture'));
const SID=i=>fixture.sessionIds[i],KEY=fixture.signingKeyHex;
function withDb(run){
 const dir=mkdtempSync(join(tmpdir(),'hcode-c16-auth-b0-')),file=join(dir,'sessions.sqlite');
 const oracle=new SessionOracle(file,KEY);
 try{return run(oracle,file);}
 finally{oracle.close();rmSync(dir,{recursive:true,force:true});}
}
test('unchanged 20-task registry and original Canonical16 preregistration',()=>{
 const original=JSON.parse(locked('registry'));
 locked('oracle');
 assert.equal(original.workloads.length,20);
 const task=original.workloads[15];
 assert.equal(task.id,fixture.workload);
 assert.equal(task.acceptance,fixture.originalAcceptance);
 assert.deepEqual(task.requiredCapabilities,fixture.capabilities);
 assert.equal(task.status,'unsupported');
 assert.equal(task.evidence,null);
 assert.equal(fixture.status,'b0-independent-correctness-fixture-only');
 assert.equal(fixture.cases.length,5);
});
test('RFC4231 HMAC-SHA256 known answer, distinct from session oracle',()=>{
 const hmac=createHmac('sha256',Buffer.alloc(20,0x0b)).update('Hi There').digest('hex');
 assert.equal(hmac,'b0344c61d8db38535ca8afceaf0bf12b881dc200c9833da726e9376c2e32cff7');
});
test('signed issue, expiry and strict cookie security attributes',()=>withDb((s,file)=>{
 const c=fixture.cases[0],sid=SID(c.sid);
 const token=s.issue(c.identity,sid,c.issuedAt,c.ttlSeconds);
 assert.match(token,/^v1\.[A-Za-z0-9_-]{24,64}\.[A-Za-z0-9_-]{43}$/);
 assert.equal(token,s.cookie(token,120).split(';')[0].split('=').slice(1).join('='));
 assert.equal(s.cookie(token,120),'__Host-hcode_session='+token+'; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=120');
 assert.deepEqual(s.inspect(token,c.inspectAt),{identity:c.expect.identity,issuedAt:c.issuedAt,expiresAt:c.expect.expiresAt});
 assert.equal(s.inspect(token,c.expect.expiresAt),null,'Expiry is exclusive');
 assert.equal(readFileSync(file).subarray(0,16).toString('ascii'),'SQLite format 3\0');
 assert.equal(readFileSync(file).includes(Buffer.from(sid)),false,'Never store raw session identifiers');
}));
test('rotation atomically revokes old token, preserves expiry and cannot be replayed',()=>withDb((s,file)=>{
 const issue=fixture.cases[0],rotation=fixture.cases[1];
 const before=s.issue(issue.identity,SID(issue.sid),issue.issuedAt,issue.ttlSeconds);
 const after=s.rotate(before,SID(rotation.newSid),rotation.rotatedAt);
 assert.match(after,/^v1\./);
 assert.equal(s.inspect(before,rotation.checkAt),null);
 assert.equal(s.rotate(before,SID(3),rotation.checkAt),null);
 assert.equal(s.inspect(after,rotation.checkAt).identity,rotation.expectNewIdentity);
 assert.equal(s.inspect(after,rotation.checkAt).expiresAt,rotation.expectExpiry);
 assert.equal(s.inspect(after,rotation.expectExpiry),null);
 assert.notEqual(after,before);
}));
test('revoke is persistent, idempotent and cannot resurrect a rotated session',()=>withDb((s,file)=>{
 const original=s.issue(fixture.identities[0],SID(0),1700000000,120);
 const rotated=s.rotate(original,SID(1),1700000040);
 assert.ok(rotated);
 assert.equal(s.revoke(rotated,1700000080),true);
 assert.equal(s.revoke(rotated,1700000081),false);
 assert.equal(s.inspect(rotated,1700000081),null);
 assert.equal(s.inspect(original,1700000081),null);
 const next=new SessionOracle(file,KEY);
 try{assert.equal(next.inspect(rotated,1700000082),null);}
 finally{next.close();}
}));
test('wrong signing key and malformed or mutated cookies always fail closed',()=>withDb((s,file)=>{
 const token=s.issue(fixture.identities[1],SID(2),1700000200,120);
 const other=new SessionOracle(file,'55'.repeat(32));
 try{assert.equal(other.inspect(token,1700000201),null);}
 finally{other.close();}
 const [version,sid,mac]=token.split('.');
 for(const forged of [
   token.replace(/.$/,token.endsWith('A')?'B':'A'),
   version+'.'+sid+'.'+('A'.repeat(mac.length)),
   'v1X'+sid+'X'+mac,'v1/'+sid+'/'+mac,'v1 '+sid+' '+mac,
   'v2.'+sid+'.'+mac,'v1.'+sid+'.garbage','x'.repeat(8192),'',
   '__Host-hcode_session='+token
 ]) assert.equal(s.inspect(forged,1700000201),null,'Forged token accepted: '+forged.slice(0,30));
}));
test('short TTL and deterministic boundary events do not extend expired sessions',()=>withDb(s=>{
 const c=fixture.cases[3];
 const token=s.issue(c.identity,SID(c.sid),c.issuedAt,c.ttlSeconds);
 assert.notEqual(s.inspect(token,c.checkAt-1),null);
 assert.equal(s.inspect(token,c.checkAt),null);
 assert.equal(s.rotate(token,SID(3),c.checkAt),null);
 assert.equal(s.revoke(token,c.checkAt),false);
}));
test('a signed session survives independent SQLite reopen and uses original identity',()=>{
 const c=fixture.cases[4],dir=mkdtempSync(join(tmpdir(),'hcode-auth-restart-'));
 const file=join(dir,'session.sqlite');
 try{
  const first=new SessionOracle(file,KEY);
  let token;
  try{token=first.issue(c.identity,SID(c.sid),c.issuedAt,c.ttlSeconds);}
  finally{first.close();}
  const second=new SessionOracle(file,KEY);
  try{assert.equal(second.inspect(token,c.checkAt).identity,c.expectIdentity);}
  finally{second.close();}
 }finally{rmSync(dir,{recursive:true,force:true});}
});
test('invalid identity, invalid IDs, unsafe TTL and duplicate IDs fail without writing a new session',()=>withDb(s=>{
 for(const identity of ['','bad id','<script>alert(1)</script>']){
  assert.throws(()=>s.issue(identity,SID(0),1700000000,120),/Invalid identity/);
 }
 for(const id of ['','../escape','too-short']){
  assert.throws(()=>s.issue('fixture-user-a',id,1700000000,120),/Invalid deterministic fixture id/);
 }
 for(const ttl of [0,-1,86401,NaN]){
  assert.throws(()=>s.issue('fixture-user-a',SID(0),1700000000,ttl),/Invalid session TTL/);
 }
 const token=s.issue('fixture-user-a',SID(0),1700000000,120);
 assert.throws(()=>s.issue('fixture-user-b',SID(0),1700000001,100),/UNIQUE constraint|SQLITE_CONSTRAINT/);
 assert.equal(s.inspect(token,1700000020).identity,'fixture-user-a');
 assert.throws(()=>s.inspect(token,-1),/Invalid session timestamp/);
}));
test('two independent SQLite connections cannot rotate the same signed token twice',()=>withDb((first,file)=>{
 const token=first.issue('fixture-user-a',SID(0),1700000000,120);
 const second=new SessionOracle(file,KEY);
 try{
  const rotated=first.rotate(token,SID(1),1700000010);
  assert.ok(rotated);
  assert.equal(second.rotate(token,SID(2),1700000011),null);
  assert.equal(second.inspect(rotated,1700000012).identity,'fixture-user-a');
 }finally{second.close();}
}));
