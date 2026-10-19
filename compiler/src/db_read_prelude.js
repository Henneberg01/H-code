// M19.15 B1: real read-only SQLite capability for source-typed H-Code records.
// Included only when the Rust compiler has a checked \u29c8 DB expression.
// Requires HCODE_SQLITE_READ_ROOT to be set to a trusted, real directory.
// No fallback, network access, database creation or unsafe query interpolation.
const __hc_db_rows=(name,sql,params,schema)=>{
  __hc_tick();
  if(__hc_cas_reducer_active)throw Error('Database read denied in CAS reducer');
  if(typeof process==='undefined'||!process.env?.HCODE_SQLITE_READ_ROOT)
    throw Error('Database read capability denied: set HCODE_SQLITE_READ_ROOT');
  const root=process.env.HCODE_SQLITE_READ_ROOT;
  if(typeof root!=='string'||!__hc_isAbsolute(root))
    throw TypeError('Database read root must be absolute');
  const info=__hc_lstatSync(root);
  if(info.isSymbolicLink()||!info.isDirectory())
    throw TypeError('Database read root must be a real directory');
  const canonicalRoot=__hc_realpathSync(root);
  if(typeof name!=='string'||!/^[A-Za-z0-9][A-Za-z0-9._-]{0,100}\.sqlite$/.test(name)||
     name.includes('..'))
    throw TypeError('Database file must be a simple .sqlite basename');
  const file=__hc_join(canonicalRoot,name);
  const fileInfo=__hc_lstatSync(file);
  if(fileInfo.isSymbolicLink()||!fileInfo.isFile()||
     __hc_dirname(__hc_realpathSync(file))!==canonicalRoot)
    throw TypeError('Database file is not an approved regular file');
  if(typeof sql!=='string'||!sql.isWellFormed()||
     new TextEncoder().encode(sql).length>8192||
     !/^\s*SELECT\s/i.test(sql)||/[;]|--|\/\*/.test(sql))
    throw TypeError('Database query must be one bounded SELECT statement');
  if(!Array.isArray(params)||params.length>16||
     !params.every(p=>typeof p==='string'&&p.isWellFormed()&&
       new TextEncoder().encode(p).length<=4096))
    throw TypeError('Database parameters must be a bounded sequence of Strings');
  if(!Array.isArray(schema)||schema[0]!=='o'||!Array.isArray(schema[1])||
     schema[1].length<1||schema[1].length>64||
     !schema[1].every(([key,type])=>typeof key==='string'&&['s','n','b'].includes(type)))
    throw TypeError('Database row schema must contain 1..64 scalar columns');
  // Enforce actual SQLite file access with an OS/host read-only handle.
  // All bind variables use prepared statements, never string interpolation.
  const db=new __hc_DatabaseSync(file,{readOnly:true,allowExtension:false});
  try{
    const statement=db.prepare(sql);
    const rows=[],columns=schema[1];
    for(const raw of statement.iterate(...params)){
      __hc_tick();
      if(rows.length>=1000)throw RangeError('Database result exceeds 1000 records');
      if(raw===null||typeof raw!=='object'||Array.isArray(raw)||
         Object.keys(raw).length!==columns.length)
        throw TypeError('Database record shape mismatch');
      const row=Object.create(null);
      for(const [key,type] of columns){
        if(!Object.hasOwn(raw,key))throw TypeError('Database column missing '+key);
        const value=raw[key];
        if(type==='b'&&(value===0||value===1))row[key]=value===1;
        else if(type==='n'){
          if(!Number.isSafeInteger(value))throw TypeError('Database Number exceeds safe integer range');
          row[key]=value;
        }else if(type==='s'){
          if(typeof value!=='string'||!value.isWellFormed()||
             new TextEncoder().encode(value).length>65536)
            throw TypeError('Database String column exceeds validation budget');
          row[key]=value;
        }else row[key]=value;
      }
      rows.push(row);
    }
    if(new TextEncoder().encode(JSON.stringify(rows)).length>1048576)
      throw RangeError('Database result exceeds 1 MiB');
    // Reuse H-Code's strict independent schema guard for exact typed records.
    return __hc_json_guard(rows,['a',schema]);
  }finally{db.close();}
};
