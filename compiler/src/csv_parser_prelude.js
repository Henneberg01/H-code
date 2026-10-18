// Pure, bounded schema-driven CSV reader shared by any H-Code program using ⧇.
// No host I/O, no eval or generated benchmark-specific tables.
const __hc_csv_max_bytes=1048576, __hc_csv_max_rows=8192, __hc_csv_max_cols=64, __hc_csv_max_field=16384;
const __hc_csv_utf8=s=>new TextEncoder().encode(s).length;
function __hc_csv_parse(text){
  __hc_tick();
  if(typeof text!=='string'||__hc_csv_utf8(text)>__hc_csv_max_bytes)
    throw Error('CSV input must be String <=1 MiB UTF-8');
  for(const ch of text){
    const n=ch.codePointAt(0);
    if(n>=0xD800&&n<=0xDFFF)throw Error('CSV contains invalid Unicode scalar');
  }
  const csv=text.charCodeAt(0)===0xFEFF?text.slice(1):text;
  if(csv.length===0)throw Error('CSV has no header row');
  const rows=[];
  let row=[],field='',i=0,state='start',line=1,recordStarted=false;
  const fail=why=>{throw Error('CSV '+why+' at row '+line);};
  const append=c=>{
    field+=c;recordStarted=true;
    if(field.length>__hc_csv_max_field)fail('field too long');
  };
  const fieldEnd=()=>{
    row.push(field);field='';
    if(row.length>__hc_csv_max_cols)fail('too many columns');
  };
  const rowEnd=()=>{
    fieldEnd();
    if(row.length===1&&row[0]===''&&!recordStarted)fail('blank record');
    rows.push(row);row=[];state='start';recordStarted=false;line++;
    if(rows.length>__hc_csv_max_rows+1)fail('too many records');
  };
  while(i<csv.length){
    if((i&255)===0)__hc_tick();
    const c=csv[i];
    if(state==='quoted'){
      if(c==='"'){
        if(csv[i+1]==='"'){append('"');i+=2;continue;}
        state='after-quote';i++;continue;
      }
      append(c);i++;continue;
    }
    if(c==='\r'||c==='\n'){
      if(c==='\r'&&csv[i+1]!=='\n')fail('lone CR outside quotes');
      rowEnd();i+=c==='\r'?2:1;continue;
    }
    if(c===','){
      fieldEnd();recordStarted=true;state='start';i++;continue;
    }
    if(state==='after-quote')fail('characters after closing quote');
    if(c==='"'){
      if(state!=='start')fail('quote inside plain field');
      state='quoted';recordStarted=true;i++;continue;
    }
    append(c);state='plain';i++;
  }
  if(state==='quoted')fail('unterminated quoted field');
  if(recordStarted||field!==''||row.length)rowEnd();
  if(!rows.length)throw Error('CSV has no header row');
  for(const [j,r] of rows.entries()){
    if(j&&r.length!==rows[0].length)throw Error('CSV row '+(j+1)+' has wrong column count');
  }
  return rows;
}
function __hc_csv_schema_fields(schema){
  if(!Array.isArray(schema)||schema.length<1||schema.length>__hc_csv_max_cols)
    throw Error('CSV record type needs 1..64 columns');
  const known=new Set();
  for(const item of schema){
    if(!Array.isArray(item)||item.length!==2)throw Error('CSV invalid schema');
    const [key,type]=item;
    if(typeof key!=='string'||!/^[_A-Za-z][_A-Za-z0-9]*$/.test(key)||known.has(key))
      throw Error('CSV duplicate/invalid type field');
    if(!['String','Number','Bool'].includes(type))throw Error('CSV unsupported field type');
    known.add(key);
  }
  return [...schema].sort((a,b)=>a[0]<b[0]?-1:a[0]>b[0]?1:0);
}
function __hc_csv_value(text,ty,name,row){
  if(ty==='String')return text;
  if(ty==='Bool'){
    if(text==='true')return true;if(text==='false')return false;
    throw Error('CSV invalid Bool in '+name+' row '+row);
  }
  if(!/^-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?$/.test(text))
    throw Error('CSV invalid Number in '+name+' row '+row);
  const n=Number(text);
  if(!Number.isFinite(n))throw Error('CSV nonfinite Number in '+name+' row '+row);
  return n;
}
function __hc_csv_typed(text,schema){
  const fields=__hc_csv_schema_fields(schema),rows=__hc_csv_parse(text);
  const headers=rows[0];
  if(headers.length!==fields.length||new Set(headers).size!==headers.length||
    headers.some(key=>!fields.some(([name])=>name===key)))
    throw Error('CSV header mismatches typed record fields');
  const indices=new Map(headers.map((h,i)=>[h,i])),result=[];
  for(let i=1;i<rows.length;i++){
    __hc_tick();
    const r=Object.create(null);
    for(const [key,ty] of fields)r[key]=__hc_csv_value(rows[i][indices.get(key)],ty,key,i+1);
    result.push(Object.freeze(r));
  }
  return __hc_seq(result);
}
