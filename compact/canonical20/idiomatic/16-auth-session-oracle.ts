// Independent *test oracle* for preregistered Canonical16.
// NEVER use deterministic fixture IDs or keys from this file in production.
// This is TypeScript comparison/reference code, NOT H-Code language syntax.
import {createHash,createHmac,timingSafeEqual} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';

export type SessionRecord={identity:string;issuedAt:number;expiresAt:number};
const SID=/^[A-Za-z0-9_-]{24,64}$/;
const PERSON=/^[A-Za-z0-9_.:-]{1,128}$/;
const HEX_KEY=/^[0-9a-fA-F]{64}$/;
const SIGN_PREFIX='hcode-session/v1/';
const MAX_TTL=86400;

const checkTime=(n:number):void=>{
 if(!Number.isSafeInteger(n)||n<0)throw new RangeError('Invalid session timestamp');
};
const sessionHash=(id:string):string=>createHash('sha256').update(id,'utf8').digest('hex');

export class SessionOracle{
 private db:DatabaseSync;
 private key:Buffer;

 constructor(file:string,keyHex:string){
  if(typeof file!=='string'||!file)throw new TypeError('Database path required');
  if(typeof keyHex!=='string'||!HEX_KEY.test(keyHex))
    throw new TypeError('Test signing key must be 32 bytes');
  this.key=Buffer.from(keyHex,'hex');
  this.db=new DatabaseSync(file);
  this.db.exec(`CREATE TABLE IF NOT EXISTS sessions(
    id_hash TEXT PRIMARY KEY,
    identity TEXT NOT NULL,
    issued_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL,
    revoked_at INTEGER
  ) STRICT`);
 }
 close():void{this.db.close();}
 private sign(id:string):Buffer{
  return createHmac('sha256',this.key).update(SIGN_PREFIX+id,'utf8').digest();
 }
 private signed(id:string):string{
  return 'v1.'+id+'.'+this.sign(id).toString('base64url');
 }
 private decode(token:string):string|null{
  if(typeof token!=='string'||token.length>180)return null;
  const parts=/^v1.([A-Za-z0-9_-]{24,64}).([A-Za-z0-9_-]{43})$/.exec(token);
  if(!parts||!SID.test(parts[1]))return null;
  const signature=Buffer.from(parts[2],'base64url');
  if(signature.length!==32||signature.toString('base64url')!==parts[2])return null;
  if(!timingSafeEqual(signature,this.sign(parts[1])))return null;
  return parts[1];
 }
 private transaction<T>(action:()=>T):T{
  this.db.exec('BEGIN IMMEDIATE');
  try{const result=action();this.db.exec('COMMIT');return result;}
  catch(e){this.db.exec('ROLLBACK');throw e;}
 }
 private current(id:string,now:number):SessionRecord|null{
  const row=this.db.prepare(
   'SELECT identity,issued_at AS issuedAt,expires_at AS expiresAt,revoked_at AS revokedAt FROM sessions WHERE id_hash=?'
  ).get(sessionHash(id)) as
    (SessionRecord & {revokedAt:number|null})|undefined;
  if(!row||row.revokedAt!==null||now>=row.expiresAt)return null;
  return {identity:row.identity,issuedAt:row.issuedAt,expiresAt:row.expiresAt};
 }
 issue(identity:string,id:string,now:number,ttl:number):string{
  checkTime(now);
  if(typeof identity!=='string'||!PERSON.test(identity))throw new TypeError('Invalid identity');
  if(typeof id!=='string'||!SID.test(id))throw new TypeError('Invalid deterministic fixture id');
  if(!Number.isSafeInteger(ttl)||ttl<1||ttl>MAX_TTL)
   throw new RangeError('Invalid session TTL');
  if(!Number.isSafeInteger(now+ttl))throw new RangeError('Session expiry overflow');
  this.transaction(()=>{
   this.db.prepare('INSERT INTO sessions (id_hash,identity,issued_at,expires_at,revoked_at) VALUES (?,?,?,?,NULL)')
    .run(sessionHash(id),identity,now,now+ttl);
  });
  return this.signed(id);
 }
 inspect(token:string,now:number):SessionRecord|null{
  checkTime(now);
  const id=this.decode(token);
  return id===null?null:this.current(id,now);
 }
 rotate(token:string,newId:string,now:number):string|null{
  checkTime(now);
  if(typeof newId!=='string'||!SID.test(newId))throw new TypeError('Invalid rotated id');
  const id=this.decode(token);
  if(id===null)return null;
  return this.transaction(()=>{
   const row=this.current(id,now);
   if(!row||id===newId)return null;
   const revoked=this.db.prepare(
    'UPDATE sessions SET revoked_at=? WHERE id_hash=? AND revoked_at IS NULL AND expires_at>?'
   ).run(now,sessionHash(id),now);
   if(revoked.changes!==1)return null;
   this.db.prepare(
    'INSERT INTO sessions (id_hash,identity,issued_at,expires_at,revoked_at) VALUES (?,?,?,?,NULL)'
   ).run(sessionHash(newId),row.identity,now,row.expiresAt);
   return this.signed(newId);
  });
 }
 revoke(token:string,now:number):boolean{
  checkTime(now);
  const id=this.decode(token);
  if(id===null)return false;
  return this.transaction(()=>this.db.prepare(
   'UPDATE sessions SET revoked_at=? WHERE id_hash=? AND revoked_at IS NULL AND expires_at>?'
  ).run(now,sessionHash(id),now).changes===1);
 }
 cookie(token:string,ttl:number):string{
  if(this.decode(token)===null)throw new TypeError('Invalid signed cookie value');
  if(!Number.isSafeInteger(ttl)||ttl<1||ttl>MAX_TTL)throw new RangeError('Invalid cookie TTL');
  return '__Host-hcode_session='+token+'; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age='+ttl;
 }
}
