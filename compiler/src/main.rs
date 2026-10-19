//! H-Code CLI: check, ast, build, run (M3 JavaScript backend).
use std::{env,fs,path::{Path,PathBuf},process::{Command,Stdio}};
use hcode_compiler::{checker::check,codegen::emit,modules::resolve,packages::{load_lockfile,PackageRegistry},parser::parse};
fn usage()->String{"Usage: hcodec check|ast|build|run FILE.hc [--lock hcode.lock.json] [--out result.mjs]\n  hcodec test PATH [--lock FILE] [--timeout-ms N]\n  hcodec pack --name NAME --version X.Y.Z --source packages/NAME/signs.hcs --lock hcode.NAME.lock.json [--check]".into()}
fn main(){if let Err(msg)=run(){eprintln!("{msg}");std::process::exit(1)}}
fn run()->Result<(),String>{
 let args:Vec<String>=env::args().skip(1).collect();
 if args.first().is_some_and(|x|x=="test"){
  return hcode_compiler::test_runner::run(&args[1..]);
 }
 if args.first().is_some_and(|x|x=="pack"){
  let mut name=None::<String>;let mut version=None::<String>;let mut source=None::<String>;let mut lock=None::<String>;let mut check=false;
  let mut i=1;while i<args.len(){
   if args[i]=="--check" {if check{return Err("Duplicate --check".into())}check=true;i+=1;continue;}
   if i+1>=args.len(){return Err("pack: missing option value".into())}
   let target=match args[i].as_str(){"--name"=>&mut name,"--version"=>&mut version,"--source"=>&mut source,"--lock"=>&mut lock,_=>return Err("pack: unknown option".into())};
   if target.is_some(){return Err("pack: duplicate option".into())}
   *target=Some(args[i+1].clone());i+=2;
  }
  hcode_compiler::packgen::generate(&name.ok_or("Missing --name")?,&version.ok_or("Missing --version")?,
   Path::new(&source.ok_or("Missing --source")?),Path::new(&lock.ok_or("Missing --lock")?),check)?;
  println!("M16.3 package generation {}",if check{"verified"}else{"complete"});return Ok(());
 }
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
    // Stdin is inherited as a real explicit effect. Programs without ⌨ never read it.
    let result=Command::new("node").arg("--input-type=module").arg("--eval").arg(javascript)
      .stdin(Stdio::inherit()).status().map_err(|e|format!("Cannot execute Node.js: {e}"))?;
    if !result.success(){std::process::exit(result.code().unwrap_or(1));}
   }
  }
  _=>unreachable!()
 }
 Ok(())
}
