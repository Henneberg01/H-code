use std::{fs,path::Path,process::Command};
use hcode_compiler::{checker::check,codegen::emit,packages::{PackageRegistry,load_lockfile},parser::parse};
fn root()->std::path::PathBuf{Path::new(env!("CARGO_MANIFEST_DIR")).parent().unwrap().to_path_buf()}
fn compile(source:&str,packages:&PackageRegistry)->Result<String,String>{
 let p=parse(source).map_err(|e|e.to_string())?;
 let t=check(&p,packages,true).map_err(|e|e.to_string())?;
 emit(&t,packages)
}
fn run(source:&str,packages:&PackageRegistry)->Result<String,String>{
 let js=compile(source,packages)?;
 let output=Command::new("node").args(["--input-type=module","--eval",&js]).output().map_err(|e|e.to_string())?;
 if !output.status.success(){return Err(String::from_utf8_lossy(&output.stderr).into());}
 Ok(String::from_utf8_lossy(&output.stdout).replace("\r\n","\n"))
}
#[test]
fn all_reference_examples_execute_as_compiled_js(){
 let base=root();
 let registry=load_lockfile(&base.join("hcode.lock.json")).unwrap();
 let vec_registry=load_lockfile(&base.join("hcode.m16.lock.json")).unwrap();
 let empty=PackageRegistry::default();
  let mut count=0;
  let mut saw_sign_first_ranking=false;
  for entry in fs::read_dir(base.join("examples")).unwrap() {
    let path=entry.unwrap().path();
    if path.extension().and_then(|s|s.to_str())!=Some("hc"){continue;}
    let file=path.file_name().unwrap().to_str().unwrap();
    if file=="symbol-first-ranking.hc" {saw_sign_first_ranking=true;}
    let source=fs::read_to_string(&path).unwrap();
    let selected=match file {
        "user_symbols.hc"=>&registry,
        "m16_vec_operations.hc"=>&vec_registry,
        _=>&empty
    };
    let got=run(&source,selected).unwrap();
    let mut cmd=Command::new("node");
    cmd.current_dir(&base).arg("prototype/bin/hcode.mjs").arg("run").arg(&path);
    if file=="user_symbols.hc"{cmd.args(["--lock","hcode.lock.json"]);}
    if file=="m16_vec_operations.hc"{cmd.args(["--lock","hcode.m16.lock.json"]);}
    let output=cmd.output().unwrap();
    assert!(output.status.success(),"M1 failed {file}: {}",String::from_utf8_lossy(&output.stderr));
    assert_eq!(got,String::from_utf8_lossy(&output.stdout).replace("\r\n","\n"),"{file}");
    count+=1;
  }
  assert!(saw_sign_first_ranking,"Native symbolic ranking example must execute in both engines");
  assert!(count>=13,"All 12 original and new H-Code examples must run in Rust/JS parity");
}
#[test]
fn glyph_and_ascii_compilation_agree(){
 let a=run("ƒ f(n: Number) → Number { ↩ n * 2; } print(f(21));",&PackageRegistry::default()).unwrap();
 let b=run("fn f(n: Number) -> Number { return n * 2; } print(f(21));",&PackageRegistry::default()).unwrap();
 assert_eq!(a,b);assert_eq!(a,"42\n");
}
#[test]
fn print_and_shadowing_are_lexical(){
 let s="let x = 7; if (true) { let x = 9; print(x); } print(x);";
 assert_eq!(run(s,&PackageRegistry::default()).unwrap(),"9\n7\n");
}
#[test]
fn reject_invalid_code_before_generation(){
 assert!(compile("print(7 + true);",&PackageRegistry::default()).is_err());
 assert!(compile("while (1) {}",&PackageRegistry::default()).is_err());
}
#[test]
fn emit_escapes_strings_and_avoids_js_reserved_words(){
 assert_eq!(run("let await = \"a\\\"b\"; print(await);",&PackageRegistry::default()).unwrap(),"a\"b\n");
}
#[test]
fn compiled_division_by_zero_is_error(){
 assert!(run("print(1 / 0);",&PackageRegistry::default()).unwrap_err().contains("Division by zero"));
}
#[test]
fn compiled_short_circuit_does_not_evaluate_rhs(){
 let s="print(false and (1 / 0 > 0)); print(true or (1 / 0 > 0));";
 assert_eq!(run(s,&PackageRegistry::default()).unwrap(),"false\ntrue\n");
}
#[test]
fn cli_build_and_run(){
 let binary=env!("CARGO_BIN_EXE_hcodec");let base=root();
 let tmp=std::env::temp_dir().join(format!("hcode-m3-{}-test.mjs",std::process::id()));
 let out=Command::new(binary).current_dir(&base).args(["build","examples/user_symbols.hc","--lock","hcode.lock.json","--out",tmp.to_str().unwrap()]).output().unwrap();
 assert!(out.status.success(),"{}",String::from_utf8_lossy(&out.stderr));
 let js=fs::read_to_string(&tmp).unwrap();
 assert!(js.contains("__hc_operations"));
 let exec=Command::new("node").arg(&tmp).output().unwrap();
 assert!(exec.status.success(),"{}",String::from_utf8_lossy(&exec.stderr));
 assert_eq!(String::from_utf8_lossy(&exec.stdout).replace("\r\n","\n"),"42\n42\n11\nhihi\ntrue\n120\n");
 fs::remove_file(&tmp).unwrap();
 let direct=Command::new(binary).current_dir(&base).args(["run","examples/user_symbols.hc","--lock","hcode.lock.json"]).output().unwrap();
 assert!(direct.status.success(),"{}",String::from_utf8_lossy(&direct.stderr));
 assert_eq!(String::from_utf8_lossy(&direct.stdout).replace("\r\n","\n"),"42\n42\n11\nhihi\ntrue\n120\n");
}
