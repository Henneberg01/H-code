use std::{process::{Command,Stdio},time::{Duration,Instant},thread};
use hcode_compiler::{checker::check,codegen::emit,packages::PackageRegistry,parser::parse};
fn compile(source:&str)->String {
 let ast=parse(source).unwrap();
 let checked=check(&ast,&PackageRegistry::default(),true).unwrap();
 emit(&checked,&PackageRegistry::default()).unwrap()
}
fn execute(js:&str)->(bool,String,String) {
 let mut child=Command::new("node").args(["--input-type=module","--eval",js]).stdout(Stdio::piped()).stderr(Stdio::piped()).spawn().unwrap();
 let started=Instant::now();
 loop {
  if child.try_wait().unwrap().is_some(){
   let output=child.wait_with_output().unwrap();
   return (output.status.success(),String::from_utf8_lossy(&output.stdout).to_string(),String::from_utf8_lossy(&output.stderr).to_string());
  }
  if started.elapsed()>Duration::from_secs(3){
   child.kill().ok();child.wait().ok();panic!("Execution budget failed to terminate generated program within 3 seconds");
  }
  thread::sleep(Duration::from_millis(10));
 }
}
#[test]
fn infinite_empty_while_has_runtime_step_budget(){
 let js=compile("while (true) {}");
 assert!(js.contains("__hc_tick"),"Generated output does not include a fuel guard");
 let (ok,_,err)=execute(&js);
 assert!(!ok,"Infinite loop must be stopped");
 assert!(err.contains("H-Code instruction budget exceeded"),"Unexpected error: {err}");
}
#[test]
fn recursion_is_stopped_before_javascript_stack_overflow(){
 let js=compile("fn forever(n: Number) -> Number { return forever(n + 1); } print(forever(0));");
 let (ok,_,err)=execute(&js);
 assert!(!ok,"Unbounded recursion must be stopped");
 assert!(err.contains("H-Code call depth exceeded"),"Unexpected error: {err}");
}
#[test]
fn finite_loops_and_functions_still_work(){
 let js=compile("fn bump(x: Number) -> Number { return x + 1; } let n=0; while (n < 2000) { n = bump(n); } print(n);");
 let (ok,out,err)=execute(&js);
 assert!(ok,"Finite code failed: {err}");assert_eq!(out.trim(),"2000");
}
