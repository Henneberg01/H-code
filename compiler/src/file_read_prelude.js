// Optional Node-only filesystem effect. No filesystem APIs are linked when ⧄ is absent.
import {openSync as __hc_read_openSync,readFileSync as __hc_read_readFileSync,closeSync as __hc_read_closeSync,lstatSync as __hc_read_lstatSync,realpathSync as __hc_read_realpathSync,constants as __hc_read_constants} from 'node:fs';
import {resolve as __hc_read_resolve,sep as __hc_read_sep,isAbsolute as __hc_read_isAbsolute} from 'node:path';
const __hc_file_limit=1048576;
function __hc_csv_read_file(name){
  __hc_tick();
  if(__hc_cas_reducer_active)throw Error('↧ key effect denied: file read');
  if(process.env.HCODE_ALLOW_FILE_READ!=='1')throw Error('H-Code file-read capability denied');
  if(typeof name!=='string'||name.length===0||name.length>1024||
     __hc_read_isAbsolute(name)||name.includes('\\')||name.includes(':')||name.includes('\0'))
    throw Error('Invalid project-data file path');
  const parts=name.split('/');
  if(parts.some(p=>!p||p==='.'||p==='..'||!/^[\p{L}\p{M}\p{N}._-]+$/u.test(p)||
      /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(p)))
    throw Error('Unsafe project-data file path');
  const basePath=__hc_read_resolve(process.cwd(),'data');
  if(__hc_read_lstatSync(basePath).isSymbolicLink())throw Error('Symlinked data root denied');
  const base=__hc_read_realpathSync(basePath);
  if(!__hc_read_lstatSync(base).isDirectory())throw Error('Data root must be a directory');
  const file=__hc_read_resolve(base,...parts);
  if(!file.startsWith(base+__hc_read_sep))throw Error('CSV path escapes data root');
  let current=base;
  for(const part of parts){
    current=__hc_read_resolve(current,part);
    if(__hc_read_lstatSync(current).isSymbolicLink())throw Error('Symlinks not allowed');
  }
  if(__hc_read_realpathSync(file)!==file)throw Error('Non-canonical CSV path');
  const st=__hc_read_lstatSync(file);
  if(!st.isFile()||st.size>__hc_file_limit)throw Error('CSV file is not a regular <=1MiB file');
  const fd=__hc_read_openSync(file,__hc_read_constants.O_RDONLY|(__hc_read_constants.O_NOFOLLOW||0));
  let bytes;
  try{bytes=__hc_read_readFileSync(fd)}finally{__hc_read_closeSync(fd)}
  if(bytes.byteLength>__hc_file_limit)throw Error('CSV file too large');
  const text=new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(bytes);
  for(const ch of text){
    const n=ch.codePointAt(0);
    if(n>=0xD800&&n<=0xDFFF)throw Error('Invalid Unicode scalar in file');
  }
  return text;
}
