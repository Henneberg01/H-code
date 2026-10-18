// Standalone TypeScript oracle for M19 #04. Intentionally does NOT import
// H-Code CSV parser. This is a self-contained reference used for parity;
// another idiomatic library-based baseline will be used for fair code length.
import {readFileSync, realpathSync, lstatSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve, sep} from 'node:path';

type User = {active:boolean; age:number; name:string; note:string};
function csvFields(text:string):string[][] {
  const rows:string[][]=[];
  let part='',line:string[]=[],quoted=false,closed=false,started=false;
  if(text.startsWith('\ufeff'))text=text.slice(1);
  if(text==='')throw Error('no CSV header');
  for(let i=0;i<text.length;i++){
    const c=text[i];
    if(quoted){
      if(c==='"'){
        if(text[i+1]==='"'){part+='"';i++;}
        else {quoted=false;closed=true;}
      }else part+=c;
      continue;
    }
    if(c==='"'){
      if(closed||part!=='')throw Error('unexpected CSV quote');
      quoted=true;started=true;continue;
    }
    if(c===','){
      line.push(part);part='';closed=false;started=true;continue;
    }
    if(c==='\r'||c==='\n'){
      if(c==='\r'&&text[i+1]!=='\n')throw Error('lone carriage return');
      if(c==='\r')i++;
      line.push(part);
      if(line.length===1&&line[0]===''&&!started)throw Error('blank CSV row');
      rows.push(line);line=[];part='';closed=false;started=false;continue;
    }
    if(closed)throw Error('garbage after CSV quote');
    part+=c;started=true;
  }
  if(quoted)throw Error('unterminated CSV quote');
  if(started||part||line.length){line.push(part);rows.push(line);}
  if(!rows.length||rows.length>8193)throw Error('CSV rows limit');
  const width=rows[0].length;
  if(width!==4||rows.some(r=>r.length!==width))throw Error('wrong column count');
  return rows;
}
function strictNumber(text:string):number{
  if(!/^-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?(?:[Ee][+-]?[0-9]+)?$/.test(text))throw Error('bad age');
  const x=Number(text);
  if(!Number.isFinite(x))throw Error('age is not finite');
  return x;
}
export function typedUsersCSV(text:string):User[]{
  const rows=csvFields(text),keys=rows.shift()!;
  const expected=['active','age','name','note'];
  if(new Set(keys).size!==4||expected.some(k=>!keys.includes(k)))throw Error('bad headers');
  const at=new Map(keys.map((k,i)=>[k,i] as const));
  return rows.map(row=>{
    const val=(key:string)=>row[at.get(key)!];
    const a=val('active');if(a!=='true'&&a!=='false')throw Error('invalid active Bool');
    return {active:a==='true',age:strictNumber(val('age')),name:val('name'),note:val('note')};
  });
}
export function typedUsersFromFile(file:string,root=process.cwd()):User[]{
  if(typeof file!=="string"||file.length>1024||file.length===0||file.includes("\\")||file.includes(":"))throw Error('unsafe file');
  const parts=file.split('/');
  if(parts.some(p=>!p||p==='.'||p==='..'||!/^[\p{L}\p{M}\p{N}._-]+$/u.test(p)||
    /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(p)))throw Error('unsafe file');
  if(lstatSync(resolve(root,'data')).isSymbolicLink())throw Error('symlink root');
  const base=realpathSync(resolve(root,'data'));
  let next=base;
  for(const part of parts){next=resolve(next,part);if(lstatSync(next).isSymbolicLink())throw Error('symlink file');}
  const path=realpathSync(next);
  if(!path.startsWith(base+sep)||!lstatSync(path).isFile()||lstatSync(path).size>1048576)throw Error('bad data path');
  const bytes=readFileSync(path);
  if(bytes.byteLength>1048576)throw Error('too large');
  return typedUsersCSV(new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(bytes));
}
console.log(JSON.stringify(typedUsersFromFile("canonical04/users.csv")));
console.log(JSON.stringify(typedUsersFromFile("canonical04/bom-crlf.csv")));
console.log(JSON.stringify(typedUsersFromFile("canonical04/header-only.csv")));
console.log(JSON.stringify(typedUsersFromFile("canonical04/unicode.csv")));
