// File access for *explicitly authorized* reference execution only.
// This host adapter is not imported into browser-safe H-Code language semantics.
import {lstatSync,realpathSync,openSync,readFileSync,closeSync,constants} from 'node:fs';
import {resolve,sep,isAbsolute} from 'node:path';
const MAX=1048576;
export function readProjectText(name,{cwd=process.cwd(),allowFileRead=false}={}){
  if(allowFileRead!==true)throw Error('H-Code file-read capability denied');
  if(typeof name!=='string'||!name||name.length>1024||isAbsolute(name)||
    name.includes('\\')||name.includes(':')||name.includes('\0'))
    throw Error('Invalid project-data file path');
  const parts=name.split('/');
  if(parts.some(p=>!p||p==='.'||p==='..'||!/^[\p{L}\p{M}\p{N}._-]+$/u.test(p)||
      /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(p)))
    throw Error('Unsafe project-data file path');
  const raw=resolve(cwd,'data');
  if(lstatSync(raw).isSymbolicLink())throw Error('Data directory cannot be symlink');
  const base=realpathSync(raw);
  const file=resolve(base,...parts);
  if(!file.startsWith(base+sep))throw Error('CSV path escapes sandbox');
  let current=base;
  for(const part of parts){
    current=resolve(current,part);
    if(lstatSync(current).isSymbolicLink())throw Error('CSV symlink not permitted');
  }
  if(realpathSync(file)!==file||!lstatSync(file).isFile()||lstatSync(file).size>MAX)
    throw Error('CSV source is not a regular <=1MiB file');
  const fd=openSync(file,constants.O_RDONLY|(constants.O_NOFOLLOW||0));
  let bytes;
  try{bytes=readFileSync(fd)}finally{closeSync(fd)}
  if(bytes.length>MAX)throw Error('CSV file larger than 1 MiB');
  const text=new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(bytes);
  for(const ch of text){
    const cp=ch.codePointAt(0);
    if(cp>=0xD800&&cp<=0xDFFF)throw Error('File contains invalid UTF-8 scalar');
  }
  return text;
}
