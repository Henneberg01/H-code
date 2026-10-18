import {parse} from "csv-parse/sync";
import {z} from "zod";
import {readFileSync,realpathSync,lstatSync,openSync,closeSync,constants} from "node:fs";
import {isAbsolute,resolve,sep} from "node:path";

const schema=z.strictObject({
  active:z.boolean(),age:z.number().finite(),name:z.string(),note:z.string()
});
export type User=z.infer<typeof schema>;
const limit=1048576;
const numberPattern=/^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?$/;

export function parseUsers(text:string):User[]{
  if(new TextEncoder().encode(text).length>limit)throw Error("CSV exceeds 1 MiB");
  for(const c of text){
    const cp=c.codePointAt(0)!;
    if(cp>=0xd800&&cp<=0xdfff)throw Error("Unpaired surrogate");
  }
  const rows=parse(text,{
    bom:true,columns:false,record_delimiter:["\r\n","\n"],
    skip_empty_lines:false,relax_column_count:false,relax_quotes:false,
    max_record_size:limit
  }) as string[][];
  if(rows.length<1||rows.length>8193)throw Error("Wrong CSV row count");
  const head=rows.shift()!;
  const fields=["active","age","name","note"];
  if(head.length!==4||new Set(head).size!==4||fields.some(f=>!head.includes(f)))
    throw Error("CSV columns differ from schema");
  const index=new Map(head.map((key,i)=>[key,i]));
  return rows.map(cells=>{
    if(cells.length!==4||cells.some(c=>c.length>16384))throw Error("CSV field invalid");
    const field=(name:string)=>cells[index.get(name)!];
    const bool=field("active"),number=field("age");
    if(bool!=="true"&&bool!=="false")throw Error("Invalid Bool");
    if(!numberPattern.test(number))throw Error("Invalid Number");
    const age=Number(number);
    if(!Number.isFinite(age))throw Error("Nonfinite Number");
    return schema.parse({active:bool==="true",age,name:field("name"),note:field("note")});
  });
}

export function readUsers(name:string):User[]{
  if(process.env.HCODE_ALLOW_FILE_READ!=="1")throw Error("File read denied");
  if(!name||name.length>1024||isAbsolute(name)||name.includes("\\")||
     name.includes(":")||name.includes("\0"))throw Error("Invalid data path");
  const parts=name.split("/");
  if(parts.some(p=>!p||p==="."||p===".."||
    !/^[\p{L}\p{M}\p{N}._-]+$/u.test(p)||
    /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(p)))
    throw Error("Unsafe data path");
  const root=resolve(process.cwd(),"data");
  if(lstatSync(root).isSymbolicLink())throw Error("Symlinked data root");
  const base=realpathSync(root);
  let file=base;
  for(const part of parts){
    file=resolve(file,part);
    if(lstatSync(file).isSymbolicLink())throw Error("Symlinked file");
  }
  if(!file.startsWith(base+sep)||file!==realpathSync(file)||
     !lstatSync(file).isFile()||lstatSync(file).size>limit)
    throw Error("CSV must be a regular local file <=1 MiB");
  const fd=openSync(file,constants.O_RDONLY|(constants.O_NOFOLLOW||0));
  let bytes:Buffer;
  try{bytes=readFileSync(fd);}finally{closeSync(fd);}
  if(bytes.length>limit)throw Error("File exceeds 1 MiB");
  return parseUsers(new TextDecoder("utf-8",{fatal:true,ignoreBOM:true}).decode(bytes));
}
