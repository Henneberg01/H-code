use hcode_compiler::{parser::parse,checker::check,codegen::emit,packages::PackageRegistry};
use std::process::Command;
fn compile(source:&str)->Result<String,String>{
 let parsed=parse(source).map_err(|e|e.to_string())?;
 let packages=PackageRegistry::default();
 let checked=check(&parsed,&packages,true).map_err(|e|e.to_string())?;
 emit(&checked,&packages)
}
#[test]
fn typed_record_filter_and_map_lambdas_infer_parameters_contextually(){
 let source="≔rs←⟦⦃name:\"A\",t:1⦄,⦃name:\"B\",t:0⦄⟧;print(⤒(rs⌕λe:e·t>0));print(⤒(rs⇢λe:e·name));";
 let js=compile(source).unwrap();
 let output=Command::new("node").arg("--input-type=module").arg("--eval").arg(js).output().unwrap();
 assert!(output.status.success(),"{}",String::from_utf8_lossy(&output.stderr));
 assert_eq!(String::from_utf8_lossy(&output.stdout),"[{\"name\":\"A\",\"t\":1}]\n[\"A\",\"B\"]\n");
}
#[test]
fn record_lambda_does_not_allow_unknown_fields_or_effect_escape(){
 for (program,expected) in [
   ("≔xs←⟦⦃key:\"x\",t:1⦄⟧;print(⌗(xs⌕λe:e·bad>0));","Unknown record field bad"),
   ("≔xs←⟦1,2⟧;print(⌗(xs⌕λe:e·t>0));","Field access requires an explicitly typed record"),
   ("≔xs←⟦⦃url:\"https://example.invalid\"⦄⟧;print(⌗(xs⌕λe:(⤋e·url)·ok));","only available in effectful top-level")
 ]{
  let error=compile(program).unwrap_err();
  assert!(error.contains(expected),"{program}: {error}");
 }
}
