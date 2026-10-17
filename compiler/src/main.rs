//! `hcodec check file.hc [--lock path]` - M2 static checker (does not execute code).
use std::{env,fs,path::Path};
use hcode_compiler::{checker::check,packages::{load_lockfile,PackageRegistry},parser::parse};
fn main(){ if let Err(message)=run() {eprintln!("{message}");std::process::exit(1);} }
fn run()->Result<(),String>{
    let args:Vec<String>=env::args().skip(1).collect();
    if args.len()<2 || !matches!(args[0].as_str(),"check"|"ast") {
        return Err("Usage: hcodec check|ast FILE.hc [--lock hcode.lock.json]".into());
    }
    let (mut lock,mut i)=(None,2);
    while i<args.len(){
        if args[i]!="--lock"||i+1>=args.len()||lock.is_some() {return Err("Usage: hcodec check|ast FILE.hc [--lock hcode.lock.json]".into());}
        lock=Some(args[i+1].clone());i+=2;
    }
    let path=&args[1];
    let source=fs::read_to_string(path).map_err(|e|format!("Cannot read {path}: {e}"))?;
    let parsed=parse(&source).map_err(|e|format!("{path}:{e}"))?;
    let registry=match lock {
        Some(file)=>load_lockfile(Path::new(&file)).map_err(|e|format!("{file}:{e}"))?,
        None=>PackageRegistry::default()
    };
    let checked=check(&parsed,&registry,true).map_err(|e|format!("{path}:{e}"))?;
    if args[0]=="ast" {println!("{checked:#?}");}
    else {println!("OK {path}: {} statically checked statement(s)",checked.statements.len());}
    Ok(())
}
