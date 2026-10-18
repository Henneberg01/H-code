//! M3 JavaScript backend. Emits only checked H-Code AST, never raw source interpolation.
use std::collections::BTreeMap;
use crate::{ast::{BinaryOp,UnaryOp},checker::{TypedProgram,TypedStmt,TypedStmtKind,TypedExpr,TypedExprKind,Type},packages::PackageRegistry};

fn q(s:&str)->String {serde_json::to_string(s).expect("serializable string")}
fn name(s:&str)->String {format!("h_{}",s.bytes().map(|b|format!("{b:02x}")).collect::<String>())}
fn pkg_name(s:&str)->String {name(&format!("package_{s}"))}

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
   TypedExprKind::RecordUpdate{record,name:field,value}=>format!("__hc_update({}, {}, {})",self.expr(record),q(field),self.expr(value)),
    TypedExprKind::Index{sequence,index}=>format!("__hc_index({}, {})",self.expr(sequence),self.expr(index)),
    TypedExprKind::Length(value)=>format!("__hc_len({})",self.expr(value)),
    TypedExprKind::Sum(value)=>format!("__hc_sum({})",self.expr(value)),
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
pub fn emit(program:&TypedProgram,registry:&PackageRegistry)->Result<String,String>{
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
  output.push_str("const __hc_operations = Object.create(null);\n");
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
