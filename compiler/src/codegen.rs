//! M3 JavaScript backend. Emits only checked H-Code AST, never raw source interpolation.
use std::collections::BTreeMap;
use crate::{ast::{BinaryOp,UnaryOp},checker::{TypedProgram,TypedStmt,TypedStmtKind,TypedExpr,TypedExprKind,Type},packages::PackageRegistry};

fn q(s:&str)->String {serde_json::to_string(s).expect("serializable string")}
fn name(s:&str)->String {format!("h_{}",s.bytes().map(|b|format!("{b:02x}")).collect::<String>())}
fn pkg_name(s:&str)->String {name(&format!("package_{s}"))}

// Emit structural runtime schemas only from Rust-checked H-Code types.
// The output is a JS array/string *literal*, never interpolated source text.
fn json_schema(ty:&Type)->String {
 match ty {
  Type::Number=>"\"n\"".to_string(),
  Type::String=>"\"s\"".to_string(),
  Type::Bool=>"\"b\"".to_string(),
  Type::Sequence(item)=>format!("[\"a\",{}]",json_schema(item)),
  Type::Record(fields)=>{
   let items=fields.iter().map(|(key,value)|format!("[{},{}]",q(key),json_schema(value)))
    .collect::<Vec<_>>().join(",");
   format!("[\"o\",[{items}]]")
  },
  _=>unreachable!("JSON schemas must have passed structural typechecking")
 }
}
struct Emitter { depth:usize }
impl Emitter {
 fn ind(&self)->String {"  ".repeat(self.depth)}
 fn expr(&self,e:&TypedExpr)->String {
  match &e.kind {
   TypedExprKind::Number(s)=>s.clone(),TypedExprKind::String(s)=>q(s),
   TypedExprKind::Sequence(items)=>{
     let values=items.iter().map(|x|self.expr(x)).collect::<Vec<_>>().join(", ");
     format!("__hc_seq([{values}])")
    }
   TypedExprKind::Record(fields)=>{
     let pairs=fields.iter().map(|(key,value)|format!("[{},{}]",q(key),self.expr(value)))
         .collect::<Vec<_>>().join(",");
     format!("__hc_record([{pairs}])")
   }
   TypedExprKind::Field{record,name:field}=>format!("__hc_field({}, {})",self.expr(record),q(field)),
   TypedExprKind::JsonRead{schema,value}=>format!("__hc_json_read({}, {})",self.expr(value),json_schema(schema)),
   TypedExprKind::JsonWrite{schema,value}=>format!("__hc_json_write({}, {})",self.expr(value),json_schema(schema)),
   TypedExprKind::RecordUpdate{record,name:field,value}=>format!("__hc_update({}, {}, {})",self.expr(record),q(field),self.expr(value)),
    TypedExprKind::Index{sequence,index}=>format!("__hc_index({}, {})",self.expr(sequence),self.expr(index)),
    TypedExprKind::Length(value)=>format!("__hc_len({})",self.expr(value)),
    TypedExprKind::Sum(value)=>format!("__hc_sum({})",self.expr(value)),
    TypedExprKind::TextScalars(value)=>format!("__hc_text_scalars({})",self.expr(value)),
    TypedExprKind::TextWords(value)=>format!("__hc_text_words({})",self.expr(value)),
    TypedExprKind::Histogram(value)=>format!("__hc_hist({})",self.expr(value)),
    TypedExprKind::Lambda{parameter,body}=>format!("(({}) => ({}))",name(parameter),self.expr(body)),
    TypedExprKind::Section{op,right}=>{
     // Exactly one evaluation of the captured right operand at section creation.
     let action=match op{
       BinaryOp::Add=>"(__hc_section_x + __hc_section_rhs)",
       BinaryOp::Multiply=>"(__hc_section_x * __hc_section_rhs)",
       BinaryOp::Divide=>"__hc_div(__hc_section_x,__hc_section_rhs)",
       BinaryOp::Modulo=>"__hc_mod(__hc_section_x,__hc_section_rhs)",
       BinaryOp::Less=>"(__hc_section_x < __hc_section_rhs)",
       BinaryOp::Greater=>"(__hc_section_x > __hc_section_rhs)",
       BinaryOp::LessEqual=>"(__hc_section_x <= __hc_section_rhs)",
       BinaryOp::GreaterEqual=>"(__hc_section_x >= __hc_section_rhs)",
       BinaryOp::Equal=>"(__hc_section_x === __hc_section_rhs)",
       BinaryOp::NotEqual=>"(__hc_section_x !== __hc_section_rhs)",
       _=>unreachable!("only typed supported sections are emitted")
     };
     format!("((__hc_section_rhs) => ((__hc_section_x) => {{ __hc_tick(); return {action}; }}))({})",self.expr(right))
    },
    TypedExprKind::Bool(b)=>b.to_string(),TypedExprKind::Identifier(s)=>if matches!(e.ty,Type::BuiltinPrint) {"__hc_print".into()}else{name(s)},
   TypedExprKind::OperationRef{id}=>format!("__hc_operations[{}]",q(id)),
   TypedExprKind::Unary{op,operand}=>format!("({}{})",match op{UnaryOp::Not=>"!",UnaryOp::Negate=>"-"},self.expr(operand)),
   TypedExprKind::Binary{op,left,right}=>{
    let a=self.expr(left);let b=self.expr(right);
    match op {
     BinaryOp::Filter=>format!("__hc_filter({a},{b})"),
     BinaryOp::Map=>format!("__hc_map({a},{b})"),
     BinaryOp::Concat=>format!("__hc_concat({a},{b})"),
     BinaryOp::Compose=>format!("__hc_compose({a},{b})"),
     BinaryOp::Divide=>format!("__hc_div({a},{b})"),
     BinaryOp::Modulo=>format!("__hc_mod({a},{b})"),
     _=>{
      let token=match op {BinaryOp::Add=>"+",BinaryOp::Subtract=>"-",BinaryOp::Multiply=>"*",BinaryOp::Equal=>"===",BinaryOp::NotEqual=>"!==",BinaryOp::Less=>"<",BinaryOp::Greater=>">",BinaryOp::LessEqual=>"<=",BinaryOp::GreaterEqual=>">=",BinaryOp::And=>"&&",BinaryOp::Or=>"||",_=>unreachable!()};
      format!("({a} {token} {b})")
     }
    }
   }
   TypedExprKind::Choice{condition,when_true,when_false}=>{
    // Native conditional expression: unused branch is never evaluated.
    format!("({} ? {} : {})",self.expr(condition),self.expr(when_true),self.expr(when_false))
   }
   TypedExprKind::Call{callee,arguments}=>{
    let args=arguments.iter().map(|x|self.expr(x)).collect::<Vec<_>>().join(", ");
    if matches!(callee.ty,Type::BuiltinPrint){format!("__hc_print({args})")}else{format!("(__hc_tick(),{})({args})",self.expr(callee))}
   }
  }
 }
 fn statement(&mut self,s:&TypedStmt)->String {
  let pad=self.ind();
  match &s.kind {
   TypedStmtKind::Use{..}|TypedStmtKind::Import{..}=>String::new(),
   TypedStmtKind::Export{declaration}=>self.statement(declaration),
   TypedStmtKind::Let{name:n,value}=>format!("{pad}let {} = {};\n",name(n),self.expr(value)),
   TypedStmtKind::Assign{name:n,value}=>format!("{pad}{} = {};\n",name(n),self.expr(value)),
   TypedStmtKind::Return(e)=>format!("{pad}return {};\n",self.expr(e)),
   TypedStmtKind::Expression(e)=>format!("{pad}{};\n",self.expr(e)),
   TypedStmtKind::Function{name:n,parameters,body,..}=>{
     let ps=parameters.iter().map(|(p,_)|name(p)).collect::<Vec<_>>().join(", ");
     let mut out=format!("{pad}function {}({ps}) {{\n{pad}  __hc_tick();\n{pad}  if (++__hc_depth > 1000) throw Error('H-Code call depth exceeded');\n{pad}  try {{\n",name(n));
     self.depth+=1;out.push_str(&self.statements(body));self.depth-=1;
     out.push_str(&format!("{pad}  }} finally {{ __hc_depth--; }}\n{pad}}}\n"));out
   }
   TypedStmtKind::If{condition,then_body,else_body}=>{
     let mut out=format!("{pad}if ({}) {{\n",self.expr(condition));
     self.depth+=1;out.push_str(&self.statements(then_body));self.depth-=1;
     out.push_str(&format!("{pad}}}"));
     if let Some(else_body)=else_body {
      out.push_str(" else {\n");self.depth+=1;out.push_str(&self.statements(else_body));self.depth-=1;
      out.push_str(&format!("{pad}}}"));
     }
     out.push('\n');out
   }
   TypedStmtKind::While{condition,body}=>{
    let mut out=format!("{pad}while ({}) {{\n{pad}  __hc_tick();\n",self.expr(condition));
    self.depth+=1;out.push_str(&self.statements(body));self.depth-=1;
    out.push_str(&format!("{pad}}}\n"));out
   }
  }
 }
 fn statements(&mut self,s:&[TypedStmt])->String {s.iter().map(|x|self.statement(x)).collect()}
}
// Only ship the JSON validator with programs (or actually imported packages)
// that require it. A new glyph must not inflate the runtime of unrelated code.
fn expr_uses_json(e:&TypedExpr)->bool {
 match &e.kind {
  TypedExprKind::JsonRead{..}|TypedExprKind::JsonWrite{..}=>true,
  TypedExprKind::Record(fields)=>fields.iter().any(|(_,v)|expr_uses_json(v)),
  TypedExprKind::Field{record,..}=>expr_uses_json(record),
  TypedExprKind::RecordUpdate{record,value,..}=>expr_uses_json(record)||expr_uses_json(value),
  TypedExprKind::Sequence(items)=>items.iter().any(expr_uses_json),
  TypedExprKind::Index{sequence,index}=>expr_uses_json(sequence)||expr_uses_json(index),
  TypedExprKind::Length(x)|TypedExprKind::Sum(x)|
  TypedExprKind::TextScalars(x)|TypedExprKind::TextWords(x)|TypedExprKind::Histogram(x)=>expr_uses_json(x),
  TypedExprKind::Lambda{body,..}|TypedExprKind::Section{right:body,..}|TypedExprKind::Unary{operand:body,..}=>expr_uses_json(body),
  TypedExprKind::Binary{left,right,..}=>expr_uses_json(left)||expr_uses_json(right),
  TypedExprKind::Choice{condition,when_true,when_false}=>
   expr_uses_json(condition)||expr_uses_json(when_true)||expr_uses_json(when_false),
  TypedExprKind::Call{callee,arguments}=>expr_uses_json(callee)||arguments.iter().any(expr_uses_json),
  TypedExprKind::Number(_)|TypedExprKind::String(_)|TypedExprKind::Bool(_)|
  TypedExprKind::Identifier(_)|TypedExprKind::OperationRef{..}=>false
 }
}
fn stmt_uses_json(s:&TypedStmt)->bool {
 match &s.kind {
  TypedStmtKind::Use{..}|TypedStmtKind::Import{..}=>false,
  TypedStmtKind::Export{declaration}=>stmt_uses_json(declaration),
  TypedStmtKind::Let{value,..}|TypedStmtKind::Assign{value,..}|
  TypedStmtKind::Return(value)|TypedStmtKind::Expression(value)=>expr_uses_json(value),
  TypedStmtKind::Function{body,..}|TypedStmtKind::While{body,..}=>body.iter().any(stmt_uses_json),
  TypedStmtKind::If{condition,then_body,else_body}=>expr_uses_json(condition)||
   then_body.iter().any(stmt_uses_json)||else_body.as_ref().is_some_and(|b|b.iter().any(stmt_uses_json))
 }
}
// Only include the Unicode module for programs that actually use any of
// the universal text/histogram primitives (including verified imported packages).
fn expr_uses_text(e:&TypedExpr)->bool {
 match &e.kind {
  TypedExprKind::TextScalars(..)|TypedExprKind::TextWords(..)|TypedExprKind::Histogram(..)=>true,
  TypedExprKind::JsonRead{value,..}|TypedExprKind::JsonWrite{value,..}=>expr_uses_text(value),
  TypedExprKind::Record(fields)=>fields.iter().any(|(_,v)|expr_uses_text(v)),
  TypedExprKind::Field{record,..}=>expr_uses_text(record),
  TypedExprKind::RecordUpdate{record,value,..}=>expr_uses_text(record)||expr_uses_text(value),
  TypedExprKind::Sequence(items)=>items.iter().any(expr_uses_text),
  TypedExprKind::Index{sequence,index}=>expr_uses_text(sequence)||expr_uses_text(index),
  TypedExprKind::Length(x)|TypedExprKind::Sum(x)=>expr_uses_text(x),
  TypedExprKind::Lambda{body,..}|TypedExprKind::Section{right:body,..}|
  TypedExprKind::Unary{operand:body,..}=>expr_uses_text(body),
  TypedExprKind::Binary{left,right,..}=>expr_uses_text(left)||expr_uses_text(right),
  TypedExprKind::Choice{condition,when_true,when_false}=>
    expr_uses_text(condition)||expr_uses_text(when_true)||expr_uses_text(when_false),
  TypedExprKind::Call{callee,arguments}=>expr_uses_text(callee)||arguments.iter().any(expr_uses_text),
  TypedExprKind::Number(_)|TypedExprKind::String(_)|TypedExprKind::Bool(_)|
  TypedExprKind::Identifier(_)|TypedExprKind::OperationRef{..}=>false
 }
}
fn stmt_uses_text(s:&TypedStmt)->bool {
 match &s.kind {
  TypedStmtKind::Use{..}|TypedStmtKind::Import{..}=>false,
  TypedStmtKind::Export{declaration}=>stmt_uses_text(declaration),
  TypedStmtKind::Let{value,..}|TypedStmtKind::Assign{value,..}|
  TypedStmtKind::Return(value)|TypedStmtKind::Expression(value)=>expr_uses_text(value),
  TypedStmtKind::Function{body,..}|TypedStmtKind::While{body,..}=>body.iter().any(stmt_uses_text),
  TypedStmtKind::If{condition,then_body,else_body}=>expr_uses_text(condition)||
    then_body.iter().any(stmt_uses_text)||else_body.as_ref().is_some_and(|b|b.iter().any(stmt_uses_text))
 }
}
pub fn emit(program:&TypedProgram,registry:&PackageRegistry)->Result<String,String>{
 let mut imported=BTreeMap::<String,()>::new();
 for stmt in &program.statements { if let TypedStmtKind::Use{package,..}=&stmt.kind {imported.insert(package.clone(),());}}
 // Recursively include imports used by module bodies (without executing imports at compile time).
 let mut work=imported.keys().cloned().collect::<Vec<_>>();
 while let Some(pkg)=work.pop() {
  let definition=registry.packages.get(&pkg).ok_or_else(||format!("Unverified package {pkg}"))?;
  for statement in &definition.typed_source.statements {
   if let TypedStmtKind::Use{package,..}=&statement.kind {
    if !imported.contains_key(package) {imported.insert(package.clone(),());work.push(package.clone());}
   }
  }
 }
 let requires_json=program.statements.iter().any(stmt_uses_json) ||
  imported.keys().any(|id|registry.packages.get(id)
    .is_some_and(|pkg|pkg.typed_source.statements.iter().any(stmt_uses_json)));
 let requires_text=program.statements.iter().any(stmt_uses_text) ||
  imported.keys().any(|id|registry.packages.get(id)
    .is_some_and(|pkg|pkg.typed_source.statements.iter().any(stmt_uses_text)));
 let mut output=String::from("// Generated by H-Code M3. ESM, no eval or source interpolation.\n'use strict';\n");
 output.push_str("let __hc_fuel = 100000; let __hc_depth=0; const __hc_tick = () => { if (--__hc_fuel < 0) throw Error('H-Code instruction budget exceeded'); };\n");
 output.push_str("const __hc_print = (...xs) => { console.log(xs.map(x => x === null ? 'none' : String(x)).join(' ')); return null; };\n");
 output.push_str("const __hc_div = (a,b) => { if (b === 0) throw Error('Division by zero'); return a/b; };\n");
 output.push_str("const __hc_mod = (a,b) => { if (b === 0) throw Error('Division by zero'); return a%b; };\n");
 output.push_str("const __hc_compose = (outer,inner) => { if (typeof outer !== 'function' || typeof inner !== 'function') throw Error('Composition expects unary functions'); return (x) => { __hc_tick(); return outer(inner(x)); }; };\n");
 output.push_str("const __hc_seq = (xs) => { __hc_tick(); if (!Array.isArray(xs)) throw Error('Expected sequence'); if (xs.length > 16384) throw Error('Sequence allocation limit exceeded'); return xs; };\n");
 output.push_str("const __hc_record = (pairs) => { __hc_tick(); if (pairs.length > 64) throw Error('Record field limit exceeded'); const record = Object.create(null); for (const [key,value] of pairs) { __hc_tick(); if (Object.hasOwn(record,key)) throw Error('Duplicate record field'); record[key] = value; } return Object.freeze(record); };\n");
 output.push_str("const __hc_field = (record,key) => { __hc_tick(); if (record === null || typeof record !== 'object' || Array.isArray(record) || Object.getPrototypeOf(record) !== null || !Object.hasOwn(record,key)) throw Error('Unknown record field '+key); return record[key]; };\n");
 output.push_str("const __hc_index = (xs,i) => { __hc_tick(); __hc_seq(xs); if (!Number.isInteger(i) || i<0 || i>=xs.length) throw Error('Sequence index out of bounds or not an integer'); return xs[i]; };\n");
 output.push_str("const __hc_update = (record,key,value) => { __hc_tick(); if (record === null || typeof record !== 'object' || Array.isArray(record) || Object.getPrototypeOf(record) !== null || !Object.hasOwn(record,key)) throw Error('Unknown record field '+key); const copy=Object.assign(Object.create(null),record); copy[key]=value; return Object.freeze(copy); };\n");
 output.push_str("const __hc_len = (xs) => { __hc_tick(); return __hc_seq(xs).length; };\n");
 output.push_str("const __hc_concat = (a,b) => { __hc_tick(); __hc_seq(a); __hc_seq(b); if (a.length+b.length>16384) throw Error('Sequence allocation limit exceeded'); return __hc_seq([...a,...b]); };\n");
 output.push_str("const __hc_sum = (xs) => { __hc_seq(xs); let total=0; for (const item of xs) { __hc_tick(); if (typeof item !== 'number') throw Error('∑ requires a numeric sequence'); total+=item; } return total; };\n");
  output.push_str("const __hc_filter = (xs,fn) => { __hc_seq(xs); if (typeof fn!=='function') throw Error('⌕ requires a unary predicate'); const output=[]; for (const item of xs) { __hc_tick(); const keep=fn(item); if (typeof keep!=='boolean') throw Error('⌕ predicate must return Bool'); if (keep) output.push(item); if (output.length>16384) throw Error('Sequence allocation limit exceeded'); } return __hc_seq(output); };\n");
  output.push_str("const __hc_map = (xs,fn) => { __hc_seq(xs); if (typeof fn!=='function') throw Error('⇢ requires a unary transform'); const output=[]; for (const item of xs) { __hc_tick(); output.push(fn(item)); if (output.length>16384) throw Error('Sequence allocation limit exceeded'); } return __hc_seq(output); };\n");
  if requires_json {
  // A deterministic, bounded JSON boundary shared in meaning with the JS reference.
  // It cannot be bypassed with "as T": every scalar, field and array element is checked.
  output.push_str(r#"
const __hc_json_limit = 1048576;
const __hc_json_bytes = text => new TextEncoder().encode(text).length;
const __hc_json_guard = (data,schema,depth=0) => {
  __hc_tick(); if(depth>32)throw Error('JSON nesting depth exceeded');
  if(schema==='n'){ if(typeof data!=='number'||!Number.isFinite(data))throw Error('JSON Number type mismatch'); return data; }
  if(schema==='s'){ if(typeof data!=='string')throw Error('JSON String type mismatch'); return data; }
  if(schema==='b'){ if(typeof data!=='boolean')throw Error('JSON Bool type mismatch'); return data; }
  if(Array.isArray(schema)&&schema[0]==='a'){
    if(!Array.isArray(data))throw Error('JSON Sequence type mismatch');
    if(data.length>16384)throw Error('JSON Sequence length exceeded');
    return Object.freeze(data.map(value=>__hc_json_guard(value,schema[1],depth+1)));
  }
  if(Array.isArray(schema)&&schema[0]==='o'){
    if(data===null||typeof data!=='object'||Array.isArray(data))throw Error('JSON Record type mismatch');
    const proto=Object.getPrototypeOf(data);
    if(proto!==null&&proto!==Object.prototype)throw Error('JSON Record prototype mismatch');
    const fields=schema[1];
    if(fields.length>64||Object.keys(data).length!==fields.length)throw Error('JSON Record shape mismatch');
    const out=Object.create(null);
    for(const [key,expected] of fields){
      if(!Object.hasOwn(data,key))throw Error('JSON Record missing field '+key);
      out[key]=__hc_json_guard(data[key],expected,depth+1);
    }
    return Object.freeze(out);
  }
  throw Error('Invalid internal JSON schema');
};
const __hc_json_read = (text,schema) => {
  __hc_tick(); if(typeof text!=='string')throw Error('⤓ expects JSON String');
  if(__hc_json_bytes(text)>__hc_json_limit)throw Error('JSON input size exceeded');
  let input;try{ input=JSON.parse(text); }catch{ throw Error('Invalid JSON text'); }
  return __hc_json_guard(input,schema);
};
const __hc_json_write = (data,schema) => {
  __hc_tick();const checked=__hc_json_guard(data,schema);
  const text=JSON.stringify(checked);
  if(__hc_json_bytes(text)>__hc_json_limit)throw Error('JSON output size exceeded');
  return text;
};
"#);
  }
  if requires_text {
  output.push_str(r#"
const __hc_text_limit = 1048576;
const __hc_text_bytes = value => new TextEncoder().encode(value).length;
const __hc_text_check = value => {
  __hc_tick();
  if(typeof value!=='string')throw Error('Unicode text operation requires String');
  let n=0;
  for(const char of value){
    if((++n & 255)===0)__hc_tick();
    const cp=char.codePointAt(0);
    if(cp>=0xD800 && cp<=0xDFFF)throw Error('Unpaired UTF-16 surrogate');
  }
  if(__hc_text_bytes(value)>__hc_text_limit)throw Error('Unicode text exceeds 1 MiB UTF-8');
  return value;
};
const __hc_unicode_compare = (a,b) => {
  const x=[...a],y=[...b];
  for(let i=0;i<Math.min(x.length,y.length);i++){
    const delta=x[i].codePointAt(0)-y[i].codePointAt(0);
    if(delta!==0)return delta;
  }
  return x.length-y.length;
};
const __hc_text_scalars = input => {
  const text=__hc_text_check(input),out=[];
  for(const char of text){
    __hc_tick();out.push(char);
    if(out.length>16384)throw Error('Sequence allocation limit exceeded');
  }
  return __hc_seq(out);
};
const __hc_text_words = input => {
  const text=__hc_text_check(input).normalize('NFC').toLowerCase().normalize('NFC');
  if(__hc_text_bytes(text)>__hc_text_limit)throw Error('Normalized text exceeds 1 MiB UTF-8');
  const out=[];
  for(const match of text.matchAll(/[\p{L}\p{N}][\p{L}\p{M}\p{N}\p{Pc}]*/gu)){
    __hc_tick();out.push(match[0]);
    if(out.length>16384)throw Error('Sequence allocation limit exceeded');
  }
  return __hc_seq(out);
};
const __hc_hist = input => {
  const values=__hc_seq(input),counts=new Map();
  let kind=null,totalKeyBytes=0;
  for(const v of values){
    __hc_tick();
    const ty=typeof v;
    if(ty!=='string'&&ty!=='number'&&ty!=='boolean')
      throw Error('⧉ requires String, Number, or Bool values');
    if(kind!==null && ty!==kind)throw Error('⧉ requires homogeneous sequence');
    kind=ty;
    if(ty==='number'&&!Number.isFinite(v))throw Error('⧉ requires finite Number keys');
    if(ty==='string'){
      __hc_text_check(v);
      totalKeyBytes+=__hc_text_bytes(v);
      if(totalKeyBytes>__hc_text_limit)throw Error('Histogram text exceeds 1 MiB UTF-8');
    }
    const key=v===0?0:v;
    counts.set(key,(counts.get(key)||0)+1);
  }
  const cmp=kind==='string'?
    (a,b)=>__hc_unicode_compare(a[0],b[0]):
    (a,b)=>a[0]<b[0]?-1:a[0]>b[0]?1:0;
  const result=[...counts.entries()].sort(cmp).map(([value,count])=>{
    __hc_tick();
    const row=Object.create(null);
    row.count=count;row.value=value;
    return Object.freeze(row);
  });
  return __hc_seq(result);
};
"#);
  }
  output.push_str("const __hc_operations = Object.create(null);\n");
 for (pkg,_) in imported {
  let def=registry.packages.get(&pkg).ok_or_else(||format!("Unverified package {pkg}"))?;
  let object=pkg_name(&pkg);
  output.push_str(&format!("const {object} = (() => {{\n"));
  let mut e=Emitter{depth:1};output.push_str(&e.statements(&def.typed_source.statements));
  output.push_str("  return Object.freeze({\n");
  for op in &def.operations {
   let named=name(&op.implementation);
   output.push_str(&format!("    {}: {},\n",q(&op.id),named));
  }
  output.push_str("  });\n})();\n");
  for op in &def.operations {
   output.push_str(&format!("__hc_operations[{}] = {}[{}];\n",q(&op.id),object,q(&op.id)));
  }
 }
 let mut e=Emitter{depth:0};output.push_str(&e.statements(&program.statements));Ok(output)
}
