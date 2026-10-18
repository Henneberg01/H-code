// Independent browser-safe pure reference for typed CSV records. No implicit I/O.
const LIMIT=1048576,COLS=64,ROWS=8192,FIELD=16384;
export function parseCSV(text){
  if(typeof text!=='string'||new TextEncoder().encode(text).length>LIMIT)throw Error('CSV input too large/invalid');
  for(const ch of text){
    const p=ch.codePointAt(0);
    if(p>=0xD800&&p<=0xDFFF)throw Error('CSV invalid surrogate');
  }
  const csv=text.charCodeAt(0)===0xFEFF?text.slice(1):text;
  if(!csv.length)throw Error('CSV missing header');
  let lines=[],row=[],part='',i=0,mode='start',begun=false;
  const field=()=>{row.push(part);part='';if(row.length>COLS)throw Error('CSV too many columns')};
  const record=()=>{field();if(row.length===1&&!row[0]&&!begun)throw Error('CSV empty row');
    lines.push(row);row=[];begun=false;mode='start';if(lines.length>ROWS+1)throw Error('CSV too many rows')};
  const append=ch=>{part+=ch;begun=true;if(part.length>FIELD)throw Error('CSV too long field')};
  for(;i<csv.length;i++){
    const c=csv[i];
    if(mode==='quoted'){
      if(c==='"'){
        if(csv[i+1]==='"'){append('"');i++;continue;}
        mode='after';continue;
      }
      append(c);continue;
    }
    if(c==='\r'||c==='\n'){
      if(c==='\r'&&csv[i+1]!=='\n')throw Error('CSV lone CR');
      record();if(c==='\r')i++;continue;
    }
    if(c===','){field();begun=true;mode='start';continue}
    if(mode==='after')throw Error('CSV trailing after quote');
    if(c==='"'){
      if(mode!=='start')throw Error('CSV quote in plain field');
      mode='quoted';begun=true;continue;
    }
    append(c);mode='plain';
  }
  if(mode==='quoted')throw Error('CSV unclosed quote');
  if(begun||part||row.length)record();
  if(!lines.length)throw Error('CSV header missing');
  if(lines.slice(1).some(r=>r.length!==lines[0].length))throw Error('CSV row width mismatch');
  return lines;
}
export function decodeTypedCSV(text,schema){
  if(!Array.isArray(schema)||!schema.length||schema.length>COLS)throw Error('CSV invalid schema');
  const known=new Set();
  for(const [name,ty] of schema){
    if(!/^[_A-Za-z][_A-Za-z0-9]*$/.test(name)||known.has(name)||!['String','Number','Bool'].includes(ty))
      throw Error('CSV duplicate field or unsupported type');
    known.add(name);
  }
  const rows=parseCSV(text),head=rows[0];
  if(head.length!==schema.length||new Set(head).size!==head.length||
     head.some(h=>!known.has(h)))throw Error('CSV typed headers mismatch');
  const positions=new Map(head.map((h,i)=>[h,i]));
  const sorted=[...schema].sort((a,b)=>a[0]<b[0]?-1:a[0]>b[0]?1:0);
  const out=[];
  for(const cells of rows.slice(1)){
    const result=Object.create(null);
    for(const [name,ty] of sorted){
      const value=cells[positions.get(name)];
      if(ty==='String')result[name]=value;
      else if(ty==='Bool'){
        if(value!=='true'&&value!=='false')throw Error('CSV Bool expected in '+name);
        result[name]=value==='true';
      }else{
        if(!/^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?$/.test(value))
          throw Error('CSV Number syntax mismatch in '+name);
        result[name]=Number(value);
        if(!Number.isFinite(result[name]))throw Error('CSV Number nonfinite in '+name);
      }
    }
    out.push(Object.freeze(result));
  }
  return Object.freeze(out);
}
