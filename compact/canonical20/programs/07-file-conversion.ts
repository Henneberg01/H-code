// Standalone TypeScript correctness oracle for original canonical workload07.
// This is NOT a competitive idiomatic TS benchmark baseline.
import {readFileSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {createFileWriteCapability} from '../../../runtime/file-write.mjs';

function parseCSV(input:string):string[][]{
  const text=input.charCodeAt(0)===0xFEFF?input.slice(1):input;
  if(!text)throw Error('CSV has no header row');
  const rows:string[][]=[];
  let row:string[]=[],field='',quoted=false,closed=false,started=false;
  for(let i=0;i<text.length;i++){
    const c=text[i];
    if(quoted){
      if(c==='"'){
        if(text[i+1]==='"'){field+='"';i++;}
        else{quoted=false;closed=true;}
      } else{field+=c;}started=true;continue;
    }
    if(c==='"'){
      if(field||closed)throw Error('CSV unexpected quote');
      quoted=true;started=true;continue;
    }
    if(c===','){
      row.push(field);field='';closed=false;started=true;continue;
    }
    if(c==='\r'||c==='\n'){
      if(c==='\r'&&text[i+1]!=='\n')throw Error('CSV lone CR');
      if(c==='\r')i++;
      row.push(field);if(row.length===1&&!row[0]&&!started)throw Error('CSV blank record');
      rows.push(row);row=[];field='';closed=false;started=false;continue;
    }
    if(closed)throw Error('CSV characters after closing quote');
    field+=c;started=true;
  }
  if(quoted)throw Error('CSV unterminated quoted field');
  if(started||row.length||field){row.push(field);rows.push(row);}
  if(rows.length===0)throw Error('CSV has no header row');
  return rows;
}
function canonicalConvert(source:string):string{
  const rows=parseCSV(source),header=rows.shift()!;
  if(header.length!==3||new Set(header).size!==3||
      !['name','quantity','active'].every(x=>header.includes(x)))
    throw Error('CSV header/schema mismatch');
  const pick=(row:string[],key:string)=>row[header.indexOf(key)];
  const result=rows.map((row,i)=>{
    if(row.length!==3)throw Error('CSV row '+(i+2)+' column mismatch');
    const raw=pick(row,'quantity'),bool=pick(row,'active');
    if(!/^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?$/.test(raw))
      throw Error('CSV invalid Number');
    const n=Number(raw);
    if(!Number.isFinite(n))throw Error('CSV nonfinite Number');
    if(bool!=='true'&&bool!=='false')throw Error('CSV invalid Bool');
    return {active:bool==='true',name:pick(row,'name'),quantity:n};
  });
  return JSON.stringify(result);
}
export function convert(inputFile:string, outputRoot:string){
 const raw=readFileSync(inputFile);
 if(raw.byteLength>1048576)throw Error('CSV source exceeds 1MiB');
 const csv=new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(raw);
 const json=canonicalConvert(csv);
 return createFileWriteCapability({root:outputRoot}).write('converted.json',json);
}
if(process.argv[1]&&process.argv[1].endsWith('07-file-conversion.ts')){
 const name=readFileSync(0,'utf8').trim();
 if(!/^[a-z0-9-]+\.csv$/.test(name))throw Error('Unsafe file input');
 const input=join(resolve(process.cwd(),'data','canonical07'),name);
 console.log(convert(input,process.env.HCODE_FILE_WRITE_ROOT??''));
}
