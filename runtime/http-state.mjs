// M19.12 B2a: generic, bounded, single-process durable HTTP state capability.
// THIS IS NOT a CRUD application and does not imply cross-process transactions.
import {
  closeSync as __hc_state_close_fd,existsSync as __hc_state_exists,
  fsyncSync as __hc_state_fsync,lstatSync as __hc_state_lstat,
  openSync as __hc_state_open,readFileSync as __hc_state_read,
  realpathSync as __hc_state_realpath,renameSync as __hc_state_rename,
  unlinkSync as __hc_state_unlink,writeFileSync as __hc_state_write
} from 'node:fs';
import {isAbsolute as __hc_state_absolute,join as __hc_state_join,resolve as __hc_state_resolve} from 'node:path';
import {randomUUID as __hc_state_uuid,createHash as __hc_state_hash} from 'node:crypto';

const __hc_state_max=1024*1024;
const __hc_state_receipt_max=128;
const __hc_state_receipt_id=/^[A-Za-z0-9_-]{1,64}$/;
const __hc_state_receipt_digest=/^[a-f0-9]{64}$/;
// Digest all externally observed request input before state mutation.
const __hc_state_request_digest=(method,path,body,contentType,headers=undefined)=>
  __hc_state_hash('sha256').update(JSON.stringify(headers===undefined?
    [method,path,body,contentType]:[method,path,body,contentType,headers]),'utf8').digest('hex');
const __hc_state_plain=value=>value!==null && typeof value==='object' &&
  !Array.isArray(value) && Object.getPrototypeOf(value)===Object.prototype;
const __hc_state_text=value=>typeof value==='string' && value.isWellFormed() &&
  new TextEncoder().encode(value).length<=__hc_state_max;
const __hc_state_strict_root=root=>{
  if(typeof root!=='string' || !__hc_state_absolute(root) || __hc_state_resolve(root)!==root)
    throw Error('H-Code state root must be an explicit canonical absolute path');
  const stat=__hc_state_lstat(root);
  if(!stat.isDirectory() || stat.isSymbolicLink() || __hc_state_realpath(root)!==root)
    throw Error('H-Code state root must be a real canonical directory');
  return root;
};

export const createHttpStateStore = ({root,initial})=>{
  if(!__hc_state_text(initial))throw TypeError('H-Code initial state must be a bounded valid UTF-8 String');
  const dir=__hc_state_strict_root(root);
  const path=__hc_state_join(dir,'hcode-http-state.json');
  const lock=__hc_state_join(dir,'.hcode-http-state.lock');
  // Separate processes must never silently load independent copies of state.
  // A stale lock after an unclean crash requires explicit host intervention;
  // automatic stale lock recovery is intentionally NOT claimed by B2a.
  let fd=__hc_state_open(lock,'wx',0o600),closed=false,sequence=0,state=initial,receipts=[];
  const release=()=>{
    if(closed)return;
    closed=true;
    try{__hc_state_close_fd(fd);}finally{
      try{__hc_state_unlink(lock);}catch(e){
        if(e?.code!=='ENOENT')throw e;
      }
    }
  };
  process.once('exit',release);
  const verifyTarget=()=>{
    if(!__hc_state_exists(path))return false;
    const stat=__hc_state_lstat(path);
    if(!stat.isFile() || stat.isSymbolicLink() || stat.size>__hc_state_max*3)
      throw Error('Unsafe H-Code state file target');
    return true;
  };
  try{
    if(verifyTarget()){
      const bytes=__hc_state_read(path);
      let parsed;
      try{parsed=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));}
      catch{throw Error('Corrupt H-Code persisted state');}
      const v1=__hc_state_plain(parsed)&&parsed.version===1&&
        Object.keys(parsed).sort().join(',')==='seq,state,version';
      const v2=__hc_state_plain(parsed)&&parsed.version===2&&
        Object.keys(parsed).sort().join(',')==='receipts,seq,state,version';
      if((!v1&&!v2)||!Number.isSafeInteger(parsed.seq)||parsed.seq<0||
         !__hc_state_text(parsed.state))
        throw Error('Invalid H-Code persisted state schema');
      if(v2){
        if(!Array.isArray(parsed.receipts)||parsed.receipts.length>__hc_state_receipt_max)
          throw Error('Invalid H-Code durable receipt journal');
        const ids=new Set();
        for(const receipt of parsed.receipts){
          if(!__hc_state_plain(receipt)||
            Object.keys(receipt).sort().join(',')!=='body,digest,id,status'||
            typeof receipt.id!=='string'||!__hc_state_receipt_id.test(receipt.id)||
            typeof receipt.digest!=='string'||!__hc_state_receipt_digest.test(receipt.digest)||
            !Number.isInteger(receipt.status)||receipt.status<200||receipt.status>599||
            typeof receipt.body!=='string'||!receipt.body.isWellFormed()||
            new TextEncoder().encode(receipt.body).byteLength>65536||
            ids.has(receipt.id))
            throw Error('Invalid H-Code durable receipt journal');
          ids.add(receipt.id);
        }
        receipts=parsed.receipts;
      }
      state=parsed.state;sequence=parsed.seq;
    }
  }catch(error){process.off('exit',release);release();throw error;}
  // Receipt and state are one atomic revision; no eviction of older IDs.
  const receiptFor=id=>receipts.find(x=>x.id===id)??null;
  const commit=(next,receipt=null)=>{
    if(closed)throw Error('H-Code state store is closed');
    if(!__hc_state_text(next))throw TypeError('H-Code state exceeds 1 MiB or is invalid Unicode');
    if(receipt!==null){
      if(!__hc_state_plain(receipt)||
         Object.keys(receipt).sort().join(',')!=='body,digest,id,status'||
         typeof receipt.id!=='string'||!__hc_state_receipt_id.test(receipt.id)||
         typeof receipt.digest!=='string'||!__hc_state_receipt_digest.test(receipt.digest)||
         !Number.isInteger(receipt.status)||receipt.status<200||receipt.status>599||
         typeof receipt.body!=='string'||!receipt.body.isWellFormed()||
         new TextEncoder().encode(receipt.body).byteLength>65536)
        throw TypeError('Invalid H-Code idempotency receipt');
      if(receipts.some(r=>r.id===receipt.id))throw Error('Duplicate H-Code idempotency receipt');
      if(receipts.length>=__hc_state_receipt_max)throw Error('H-Code durable receipt journal full');
    }
    if(next===state&&receipt===null)return sequence;
    if(sequence>=Number.MAX_SAFE_INTEGER)throw RangeError('H-Code state sequence exhausted');
    const nextReceipts=receipt===null?receipts:[...receipts,receipt];
    const envelope=nextReceipts.length?
      {version:2,seq:sequence+1,state:next,receipts:nextReceipts}:
      {version:1,seq:sequence+1,state:next};
    const encoded=Buffer.from(JSON.stringify(envelope)+'\n','utf8');
    if(encoded.length>__hc_state_max*3)throw RangeError('H-Code state file exceeds budget');
    const temporary=__hc_state_join(dir,'.hcode-state-'+process.pid+'-'+__hc_state_uuid()+'.tmp');
    let temporaryFd;
    try{
      temporaryFd=__hc_state_open(temporary,'wx',0o600);
      __hc_state_write(temporaryFd,encoded);
      __hc_state_fsync(temporaryFd);
      __hc_state_close_fd(temporaryFd);temporaryFd=undefined;
      verifyTarget();
      __hc_state_rename(temporary,path); // atomic publish within same directory
      state=next;receipts=nextReceipts;sequence++;
      if(process.platform!=='win32'){
        const directoryFd=__hc_state_open(dir,'r');
        try{__hc_state_fsync(directoryFd);}finally{__hc_state_close_fd(directoryFd);}
      }
      return sequence;
    }finally{
      if(temporaryFd!==undefined)__hc_state_close_fd(temporaryFd);
      try{__hc_state_unlink(temporary);}catch(e){
        if(e?.code!=='ENOENT')throw e;
      }
    }
  };
  return Object.freeze({read:()=>state,commit,sequence:()=>sequence,
    receiptFor,receiptSlots:()=>__hc_state_receipt_max-receipts.length,
    close:()=>{
    process.off('exit',release);
    release();
  }});
};
