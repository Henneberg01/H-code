//! H-Code CLI: check, ast, build, run (M3 JavaScript backend).
use std::{env,fs,path::{Path,PathBuf},process::{Command,Stdio}};
use hcode_compiler::{checker::check,codegen::emit,modules::resolve,packages::{load_lockfile,PackageRegistry},parser::parse};
fn usage()->String{"Usage: hcodec check|ast|build|run FILE.hc [--lock hcode.lock.json] [--out result.mjs]".into()}
fn main(){if let Err(msg)=run(){eprintln!("{msg}");std::process::exit(1)}}
fn run()->Result<(),String>{
 let args:Vec<String>=env::args().skip(1).collect();
 if args.len()<2||!matches!(args[0].as_str(),"check"|"ast"|"build"|"run"){return Err(usage());}
 let command=&args[0];let path=&args[1];
 let (mut lock,mut out)=(None::<String>,None::<String>);
 let mut i=2;while i<args.len(){
  if i+1>=args.len(){return Err(usage());}
  match args[i].as_str(){
   "--lock" if lock.is_none()=>lock=Some(args[i+1].clone()),
   "--out" if out.is_none() && command=="build"=>out=Some(args[i+1].clone()),
   _=>return Err(usage())
  }
  i+=2;
 }
 let source=fs::read_to_string(path).map_err(|e|format!("Cannot read {path}: {e}"))?;
 let mut ast=parse(&source).map_err(|e|format!("{path}:{e}"))?;
 let mut registry=match lock {
  Some(file)=>load_lockfile(Path::new(&file)).map_err(|e|format!("{file}:{e}"))?,
  None=>PackageRegistry::default()
 };
 resolve(&mut ast,Path::new(path),&mut registry).map_err(|e|format!("{path}:{e}"))?;
 let typed=check(&ast,&registry,true).map_err(|e|format!("{path}:{e}"))?;
 match command.as_str(){
  "check"=>println!("OK {path}: {} statically checked statement(s)",typed.statements.len()),
  "ast"=>println!("{typed:#?}"),
  "build"|"run"=>{
   let javascript=emit(&typed,&registry).map_err(|e|format!("{path}: {e}"))?;
   if command=="build" {
    let destination=out.map(PathBuf::from).unwrap_or_else(||Path::new(path).with_extension("mjs"));
    if destination==Path::new(path){return Err("Output must not overwrite input".into());}
    fs::write(&destination,javascript).map_err(|e|format!("Cannot write {}: {e}",destination.display()))?;
    println!("Built {}",destination.display());
   }else{
    // Stdin is disabled; the compiled JS is delivered to Node via argument, not shell.
    let result=Command::new("node").arg("--input-type=module").arg("--eval").arg(javascript)
      .stdin(Stdio::null()).status().map_err(|e|format!("Cannot execute Node.js: {e}"))?;
    if !result.success(){return Err(format!("Compiled H-Code program exited with {result}"));}
   }
  }
  _=>unreachable!()
 }
 Ok(())
}
