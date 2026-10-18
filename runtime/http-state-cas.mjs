// H-Code M19.12 B2c-1: opt-in, lock-free, immutable CAS state store.
// B2c-2 will wire bounded retries and request-id replay into the HTTP adapter.
import {
  closeSync,constants,existsSync,fstatSync,fsyncSync,linkSync,lstatSync,
  openSync,readFileSync,readdirSync,realpathSync,unlinkSync,writeFileSync
} from 'node:fs';
import {createHash,randomUUID} from 'node:crypto';
import {isAbsolute,join,resolve} from 'node:path';

const STATE_MAX=1048576;
const FILE_MAX=STATE_MAX*3;
const REV_MAX=256;
const RECEIPT_MAX=128;
const ID=/^[A-Za-z0-9_-]{1,64}$/;
const DIGEST=/^[a-f0-9]{64}$/;
const REV_NAME=/^rev-([0-9]{12})\.json$/;
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const plain=value=>value!==null&&typeof value==='object'&&!Array.isArray(value)&&
  Object.getPrototypeOf(value)===Object.prototype;
const text=(value,max)=>typeof value==='string'&&value.isWellFormed()&&
  Buffer.byteLength(value,'utf8')<=max;
const keys=(value,list)=>Object.keys(value).sort().join(',')===list;
const receiptValid=value=>plain(value)&&
  (keys(value,'body,digest,id,status')||
   (keys(value,'body,contentType,digest,id,status')&&
     text(value.contentType,128)&&
     /^[a-z][a-z0-9._+-]*\/[a-z0-9._+-]+(?:; charset=utf-8)?$/.test(value.contentType)))&&
  ID.test(value.id)&&DIGEST.test(value.digest)&&
  Number.isInteger(value.status)&&value.status>=200&&value.status<=599&&
  text(value.body,65536);
const filename=revision=>'rev-'+String(revision).padStart(12,'0')+'.json';

function strictRoot(root){
  if(typeof root!=='string'||!isAbsolute(root)||resolve(root)!==root)
    throw Error('H-Code CAS root must be a canonical absolute path');
  const stat=lstatSync(root);
  if(!stat.isDirectory()||stat.isSymbolicLink()||realpathSync(root)!==root)
    throw Error('H-Code CAS root must be a real canonical directory');
  return root;
}
function readRevision(path){
  const stat=lstatSync(path);
  if(!stat.isFile()||stat.isSymbolicLink()||stat.size>FILE_MAX)
    throw Error('Unsafe H-Code CAS revision target');
  // O_NOFOLLOW is enforced where the host supports it; lstat/fstat additionally
  // detect replacements of the directory entry between inspection and open.
  const fd=openSync(path,constants.O_RDONLY|(constants.O_NOFOLLOW||0));
  try{
    const opened=fstatSync(fd);
    if(!opened.isFile()||opened.dev!==stat.dev||opened.ino!==stat.ino||
       opened.size!==stat.size||opened.size>FILE_MAX)
      throw Error('Unsafe H-Code CAS revision changed during read');
    const bytes=readFileSync(fd);
    if(bytes.length!==opened.size||bytes.length>FILE_MAX)
      throw Error('Unsafe H-Code CAS revision size changed');
    let data;
    try{data=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));}
    catch{throw Error('Corrupt H-Code CAS revision JSON/UTF-8');}
    return {data,bytes};
  }finally{closeSync(fd);}
}
function validEnvelope(data,revision,initialHash,previousHash){
  if(!plain(data)||!keys(data,'initialHash,previousHash,receipts,revision,schema,state')||
     data.schema!=='hcode-cas-v1'||data.revision!==revision||
     data.initialHash!==initialHash||data.previousHash!==previousHash||
     !text(data.state,STATE_MAX)||!Array.isArray(data.receipts)||
     data.receipts.length>RECEIPT_MAX)
    throw Error('Invalid H-Code CAS revision schema or hash chain');
  const ids=new Set();
  for(const receipt of data.receipts){
    if(!receiptValid(receipt)||ids.has(receipt.id))
      throw Error('Invalid H-Code CAS durable receipt journal');
    ids.add(receipt.id);
  }
}

export function createHttpCasStateStore({root,initial,faultHook=null}){
  // Injection exists only for the standalone trusted-host fault tests. H-Code
  // compiled source and HTTP clients have no access to this callback.
  if(faultHook!==null &&
     (process.env.HCODE_CAS_TEST_FAULTS!=='1'||typeof faultHook!=='function'))
    throw Error('H-Code CAS fault injection is disabled');
  const inject=phase=>{if(faultHook)faultHook(phase);};
  if(!text(initial,STATE_MAX))
    throw TypeError('H-Code CAS initial state must be a bounded valid UTF-8 String');
  const dir=strictRoot(root);
  const initialHash=hash(Buffer.from(initial,'utf8'));
  let closed=false;
  const checkOpen=()=>{if(closed)throw Error('H-Code CAS store is closed');};
  const snapshot=()=>{
    checkOpen();
    // CAS and legacy modes are explicitly incompatible in the same directory.
    if(existsSync(join(dir,'hcode-http-state.json'))||
       existsSync(join(dir,'.hcode-http-state.lock')))
      throw Error('H-Code CAS refuses a mixed legacy state root');
    const revisions=[];
    for(const entry of readdirSync(dir)){
      if(entry.startsWith('rev-')){
        const match=REV_NAME.exec(entry);
        if(!match)throw Error('Invalid H-Code CAS revision filename');
        revisions.push(Number(match[1]));
      }
    }
    revisions.sort((a,b)=>a-b);
    if(revisions.length>REV_MAX)throw Error('H-Code CAS revision quota exceeded');
    let state=initial,receipts=[],previousHash=null;
    for(let i=0;i<revisions.length;i++){
      const revision=revisions[i];
      if(revision!==i+1)throw Error('Missing H-Code CAS committed revision');
      const file=readRevision(join(dir,filename(revision)));
      validEnvelope(file.data,revision,initialHash,previousHash);
      state=file.data.state;
      receipts=file.data.receipts;
      previousHash=hash(file.bytes);
    }
    return Object.freeze({revision:revisions.length,state,
      receipts:Object.freeze(receipts.map(x=>Object.freeze({...x}))),
      previousHash});
  };
  // Atomic publication is intentionally primitive: callers must re-read and
  // re-evaluate their *pure* state reducer after any conflict (B2c-2).
  const tryCommit=({expectedRevision,next,receipt=null})=>{
    checkOpen();
    if(!Number.isInteger(expectedRevision)||expectedRevision<0||expectedRevision>REV_MAX)
      throw TypeError('Invalid H-Code CAS expected revision');
    if(!text(next,STATE_MAX))throw TypeError('H-Code CAS state exceeds 1 MiB');
    if(receipt!==null&&!receiptValid(receipt))
      throw TypeError('Invalid H-Code CAS idempotency receipt');
    const current=snapshot();
    if(current.revision!==expectedRevision)return Object.freeze({committed:false,revision:current.revision});
    if(receipt!==null){
      if(current.receipts.some(item=>item.id===receipt.id))
        throw Error('Duplicate H-Code CAS idempotency receipt');
      if(current.receipts.length>=RECEIPT_MAX)
        throw RangeError('H-Code CAS durable receipt journal full');
    }
    if(next===current.state&&receipt===null)
      return Object.freeze({committed:true,revision:current.revision,changed:false});
    if(current.revision>=REV_MAX)throw RangeError('H-Code CAS revision quota exhausted');
    const revision=current.revision+1;
    const envelope={schema:'hcode-cas-v1',revision,initialHash,
      previousHash:current.previousHash,state:next,
      receipts:receipt===null?current.receipts:[...current.receipts,receipt]};
    const bytes=Buffer.from(JSON.stringify(envelope)+'\n','utf8');
    if(bytes.length>FILE_MAX)throw RangeError('H-Code CAS revision file exceeds budget');
    const temporary=join(dir,'.hcode-cas-tmp-'+process.pid+'-'+randomUUID()+'.tmp');
    const target=join(dir,filename(revision));
    let fd,linked=false;
    try{
      fd=openSync(temporary,'wx',0o600);
      writeFileSync(fd,bytes);
      inject('before-temp-fsync');
      fsyncSync(fd);
      inject('after-temp-fsync');
      closeSync(fd);fd=undefined;
      inject('before-link');
      try{linkSync(temporary,target);linked=true;}
      catch(error){
        if(error?.code==='EEXIST'){
          // EEXIST must represent a valid winning revision, not a symlink or
          // attacker-created target. Re-read and validate before retrying.
          const winner=snapshot();
          if(winner.revision<=expectedRevision)
            throw Error('Unsafe H-Code CAS publish target exists');
          return Object.freeze({committed:false,revision:winner.revision});
        }
        throw error; // EXDEV/EPERM/ENOTSUP/IO failure: fail closed
      }
      inject('after-link');
      // Directory fsync is required where supported; Windows/NTFS crash-power
      // durability is deliberately deferred to B2c-3 platform validation.
      if(process.platform!=='win32'){
        inject('before-directory-fsync');
        const directoryFd=openSync(dir,'r');
        try{fsyncSync(directoryFd);}finally{closeSync(directoryFd);}
        inject('after-directory-fsync');
      }
      return Object.freeze({committed:true,revision,changed:true});
    }finally{
      if(fd!==undefined)closeSync(fd);
      try{unlinkSync(temporary);}catch(error){if(error?.code!=='ENOENT')throw error;}
      // If the directory sync failed after link(), the revision may already
      // be committed. A client must retry with a stable request ID.
      void linked;
    }
  };
  // Fail immediately on unsafe existing roots, not only at first transaction.
  snapshot();
  return Object.freeze({snapshot,tryCommit,
    read:()=>snapshot().state,
    sequence:()=>snapshot().revision,
    receiptFor:id=>snapshot().receipts.find(x=>x.id===id)??null,
    receiptSlots:()=>RECEIPT_MAX-snapshot().receipts.length,
    close:()=>{closed=true;}});
}
