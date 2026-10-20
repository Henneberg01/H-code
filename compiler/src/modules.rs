//! M4 deterministic module resolver: recursive, project-local, no implicit host capabilities.
use std::{collections::HashSet,fs,path::{Path,PathBuf}};
use crate::{ast::{Program,StmtKind},checker::{check,TypedStmtKind},packages::{PackageRegistry,PackageDef,OperationSig},Diagnostic,lexer::Span,parser::parse};
fn fail(message:impl Into<String>)->Diagnostic{Diagnostic::new("MODULE",message.into(),Span::new(1,1))}
fn module_file(root:&Path,spec:&str)->Result<PathBuf,Diagnostic>{
 if !spec.starts_with("./") || !spec.ends_with(".hc") || spec.contains('\\') || spec.contains(':') ||
    spec.split('/').any(|part|part==".." || part.is_empty()) {
   return Err(fail(format!("Unsafe local import {spec}; expected ./path/file.hc")));
 }
 let base=fs::canonicalize(root).map_err(|e|fail(format!("Module root: {e}")))?;
 let path=fs::canonicalize(base.join(spec)).map_err(|e|fail(format!("Unknown module {spec}: {e}")))?;
 if !path.starts_with(&base)||path==base {return Err(fail("Module escapes project root"));}
 let meta=fs::metadata(&path).map_err(|e|fail(e.to_string()))?;
 if !meta.is_file()||meta.len()>1_048_576{return Err(fail("Module must be a regular file not exceeding 1 MiB"));}
 Ok(path)
}
pub fn resolve(program:&mut Program,entry:&Path,registry:&mut PackageRegistry)->Result<(),Diagnostic>{
 let mut visiting=HashSet::new();
 resolve_inner(program,entry,registry,&mut visiting,0)
}
fn resolve_inner(program:&mut Program,entry:&Path,registry:&mut PackageRegistry,visiting:&mut HashSet<PathBuf>,depth:usize)->Result<(),Diagnostic>{
 if depth>=32{return Err(fail("Maximum module import depth exceeded"));}
 let root=entry.parent().filter(|path|!path.as_os_str().is_empty()).unwrap_or_else(||Path::new("."));
 let mut seen=HashSet::new();
 for stmt in &mut program.statements {
  let StmtKind::Import{source,alias}=&stmt.kind else {continue};
  if !seen.insert(alias.clone()){return Err(fail(format!("Duplicate module alias {alias}")));}
  let path=module_file(root,source)?;
  let id=format!("local:{}",path.display());
  if !registry.packages.contains_key(&id) {
   if !visiting.insert(path.clone()){return Err(fail(format!("Circular module import: {}",path.display())));}
   let loaded=(|| {
    let code=fs::read_to_string(&path).map_err(|e|fail(format!("Cannot read local module: {e}")))?;
    let source_ast=parse(&code)?;
    let mut exports=HashSet::new();let mut body=Vec::new();
    for item in source_ast.statements {
     match item.kind {
      StmtKind::Export{declaration}=>{
       let StmtKind::Function{name,..}=&declaration.kind else{return Err(fail("M4 exports must be named functions"));};
       if !exports.insert(name.clone()){return Err(fail(format!("Duplicate export {name}")));}
       body.push(*declaration);
      }
      StmtKind::Function{..}|StmtKind::Import{..}|StmtKind::Use{..}=>body.push(item),
      _=>return Err(fail("M4 module top level permits only imports and functions")),
     }
    }
    if exports.is_empty(){return Err(fail("Local module has no exported functions"));}
    let mut module_ast=Program{statements:body};
    resolve_inner(&mut module_ast,&path,registry,visiting,depth+1)?;
    let typed=check(&module_ast,registry,false)?;
    let mut operations=Vec::new();
    for item in &typed.statements {
     if let TypedStmtKind::Function{name,parameters,returns,..}=&item.kind {
      if exports.contains(name) {
       operations.push(OperationSig{id:format!("{id}::{name}"),name:name.clone(),glyph:String::new(),parameters:parameters.iter().map(|(_,t)|t.clone()).collect(),returns:returns.clone(),implementation:name.clone(),type_parameters:Vec::new()});
      }
     }
    }
    registry.packages.insert(id.clone(),PackageDef{operations,typed_source:typed});
    Ok::<(),Diagnostic>(())
   })();
   visiting.remove(&path);
   loaded?;
  }
  stmt.kind=StmtKind::Use{package:id,alias:alias.clone()};
 }
 Ok(())
}
