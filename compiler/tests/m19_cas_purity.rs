use hcode_compiler::{parser::parse,checker::check,codegen::emit,packages::PackageRegistry};
fn compile(source:&str)->Result<String,String>{
 let ast=parse(source).map_err(|e|e.to_string())?;
 let registry=PackageRegistry::default();
 let checked=check(&ast,&registry,true).map_err(|e|e.to_string())?;
 emit(&checked,&registry)
}
const HEAD:&str="(r:⦃body:String,method:String,path:String⦄,s:String)→⦃body:String,state:String,status:Number⦄";
#[test]
fn pure_state_reducer_compiles_and_embeds_cas_runtime(){
 let source=format!("ƒ reply{} ↩ ⦃body:s,state:s,status:200⦄\n⤊(reply,\"0\")",HEAD);
 let js=compile(&source).expect("pure H-Code reducer must compile");
 assert!(js.contains("createHttpCasStateStore"));
 assert!(js.contains("executeHttpCasTransaction"));
 assert!(js.contains("HCODE_HTTP_STATE_MODE"));
}
#[test]
fn compiler_denies_direct_transitive_print_and_mutating_state_reducers(){
 for body in [
  "print(1);↩ ⦃body:s,state:s,status:200⦄",
  "helper();↩ ⦃body:s,state:s,status:200⦄",
  "s←\"unsafe\";↩ ⦃body:s,state:s,status:200⦄",
 ]{
  let extra=if body.starts_with("helper"){"ƒ helper()→Unit {print(1);}\n"}else{""};
  let source=format!("{extra}ƒ reply{HEAD} {{{body}}}\n⤊(reply,\"0\")");
  let error=compile(&source).expect_err("impure reducer should not compile");
  assert!(error.contains("EFFECT"),"{error}");
 }
}
