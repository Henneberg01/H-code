// Generic synchronous state capability. It contains no session/application policy.
import {DatabaseSync as __hc_tx_Database} from 'node:sqlite';
import {lstatSync as __hc_tx_lstat,realpathSync as __hc_tx_real,openSync as __hc_tx_open,closeSync as __hc_tx_close,constants as __hc_tx_flags} from 'node:fs';
import {resolve as __hc_tx_resolve,isAbsolute as __hc_tx_absolute,join as __hc_tx_join} from 'node:path';

const __hc_tx_string=(s,limit)=>typeof s==='string'&&s.isWellFormed()&&Buffer.byteLength(s,'utf8')<=limit;
export function createStringTransactionStore({root}={}){
  if(typeof root!=='string'||!root)throw Error('transaction capability denied: HCODE_TX_STATE_ROOT required');
  try{
    const info=__hc_tx_lstat(root);
    if(!__hc_tx_absolute(root)||info.isSymbolicLink()||!info.isDirectory()||
       (process.platform!=='win32'&&((info.mode&0o077)!==0||info.uid!==process.getuid()))||
       __hc_tx_real(root)!==__hc_tx_resolve(root))throw Error();
  }catch{throw Error('Invalid transaction root');}
  const file=__hc_tx_join(root,'state.sqlite');
  try{
    let info;
    try{info=__hc_tx_lstat(file);}catch(e){if(e.code!=='ENOENT')throw e;}
    if(!info){
      try{
        const fd=__hc_tx_open(file,__hc_tx_flags.O_CREAT|__hc_tx_flags.O_EXCL|__hc_tx_flags.O_WRONLY|(__hc_tx_flags.O_NOFOLLOW||0),0o600);
        __hc_tx_close(fd);
      }catch(error){if(error.code!=='EEXIST')throw error;}
      info=__hc_tx_lstat(file);
    }
    if(info.isSymbolicLink()||!info.isFile()||info.nlink!==1||
      (process.platform!=='win32'&&((info.mode&0o077)!==0||info.uid!==process.getuid())))throw Error();
  }catch{throw Error('Invalid transaction database');}
  let database;
  try{
    database=new __hc_tx_Database(file);
    database.exec('PRAGMA busy_timeout=5000; PRAGMA journal_mode=DELETE; PRAGMA synchronous=FULL; CREATE TABLE IF NOT EXISTS hc_state (id INTEGER PRIMARY KEY CHECK(id=1), value TEXT NOT NULL) STRICT;');
  }catch{try{database?.close();}catch{}throw Error('Cannot open transaction database');}
  let active=false,closed=false;
  const transact=(handler,initial)=>{
    if(closed)throw Error('transaction store is closed');
    if(active)throw Error('nested transaction denied');
    if(typeof handler!=='function'||!__hc_tx_string(initial,1048576))throw TypeError('Invalid transaction arguments');
    active=true;let begun=false;
    try{
      database.exec('BEGIN IMMEDIATE');begun=true;
      const row=database.prepare('SELECT value FROM hc_state WHERE id=1').get();
      const previous=row?row.value:initial;
      if(!__hc_tx_string(previous,1048576))throw TypeError('Invalid stored transaction state');
      const result=handler(previous);
      if(!result||typeof result!=='object'||Array.isArray(result)||Object.getPrototypeOf(result)!==null||
        Object.keys(result).sort().join(',')!=='state,value'||
        !Object.hasOwn(Object.getOwnPropertyDescriptor(result,'state')??{},'value')||
        !Object.hasOwn(Object.getOwnPropertyDescriptor(result,'value')??{},'value')||
        !__hc_tx_string(result.state,1048576)||!__hc_tx_string(result.value,65536))
        throw TypeError('Invalid transaction result');
      // Persist only the state. The response value is deliberately ephemeral.
      if(!row||result.state!==previous)
        database.prepare('INSERT INTO hc_state(id,value) VALUES(1,?) ON CONFLICT(id) DO UPDATE SET value=excluded.value').run(result.state);
      database.exec('COMMIT');begun=false;
      return result.value;
    }catch(error){if(begun)try{database.exec('ROLLBACK');}catch{}throw error;}
    finally{active=false;}
  };
  return Object.freeze({transact,close(){if(active)throw Error('nested transaction close denied');if(!closed){database.close();closed=true;}}});
}
