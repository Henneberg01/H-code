// Optional Node-only filesystem effect. No filesystem APIs are linked when ⧄ is absent.
import {openSync,readFileSync,closeSync,lstatSync,realpathSync,constants} from 'node:fs';
import {resolve,sep,isAbsolute} from 'node:path';
const __hc_file_limit=1048576;
function __hc_csv_read_file(name){
  __hc_tick();
  if(process.env.HCODE_ALLOW_FILE_READ!=='1')throw Error('H-Code file-read capability denied');
  if(typeof name!=='string'||name.length===0||name.length>1024||
     isAbsolute(name)||name.includes('\\')||name.includes(':')||name.includes('\0'))
    throw Error('Invalid project-data file path');
  const parts=name.split('/');
  if(parts.some(p=>!p||p==='.'||p==='..'||!/^[\p{L}\p{M}\p{N}._-]+$/u.test(p)||
      /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(p)))
    throw Error('Unsafe project-data file path');
  const basePath=resolve(process.cwd(),'data');
  if(lstatSync(basePath).isSymbolicLink())throw Error('Symlinked data root denied');
  const base=realpathSync(basePath);
  if(!lstatSync(base).isDirectory())throw Error('Data root must be a directory');
  const file=resolve(base,...parts);
  if(!file.startsWith(base+sep))throw Error('CSV path escapes data root');
  let current=base;
  for(const part of parts){
    current=resolve(current,part);
    if(lstatSync(current).isSymbolicLink())throw Error('Symlinks not allowed');
  }
  if(realpathSync(file)!==file)throw Error('Non-canonical CSV path');
  const st=lstatSync(file);
  if(!st.isFile()||st.size>__hc_file_limit)throw Error('CSV file is not a regular <=1MiB file');
  const fd=openSync(file,constants.O_RDONLY|(constants.O_NOFOLLOW||0));
  let bytes;
  try{bytes=readFileSync(fd)}finally{closeSync(fd)}
  if(bytes.byteLength>__hc_file_limit)throw Error('CSV file too large');
  const text=new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(bytes);
  for(const ch of text){
    const n=ch.codePointAt(0);
    if(n>=0xD800&&n<=0xDFFF)throw Error('Invalid Unicode scalar in file');
  }
  return text;
}
