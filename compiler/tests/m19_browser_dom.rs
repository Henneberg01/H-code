use std::{fs,path::PathBuf};
use hcode_compiler::{parser::parse,checker::check,codegen::emit,packages::PackageRegistry};
fn compile(s:&str,allow_effects:bool)->Result<String,String>{
 let program=parse(s).map_err(|e|e.to_string())?;
 let registry=PackageRegistry::default();
 let typed=check(&program,&registry,allow_effects).map_err(|e|e.to_string())?;
 emit(&typed,&registry)
}
#[test]
fn browser_form_is_real_typed_hcode_source_not_a_form_macro(){
 let file=PathBuf::from(env!("CARGO_MANIFEST_DIR"))
   .join("../compact/canonical20/programs/13-form-validation-ui.hc");
 let program=fs::read_to_string(file).unwrap();
 let js=compile(&program,true).expect("M19.13 browser source should compile");
 for function in ["__hc_dom_value","__hc_dom_text","__hc_dom_valid","__hc_dom_on","__hc_dom_attr"]{
   assert!(js.contains(function),"missing native browser operation {function}");
 }
 assert!(!js.contains("node:fs"),"browser UI code must not import Node APIs");
 assert!(!js.contains("__hc_form_validation"),"no app-specific form macro");
}
#[test]
fn browser_effects_are_denied_to_pure_signed_packages_and_wrong_types(){
 for source in ["dom_value(\"#email\");","⟐(\"#email\");","⟑(\"#out\",\"hello\");"]{
  assert!(compile(source,false).is_err(),"browser effect escaped purity: {source}");
 }
 for source in [
  "⟐(1);",
  "⟑(\"#out\",7);",
  "⟒(true);",
  "⟓(\"#email\",\"input\",true);",
  "⟔(\"#email\",\"aria-invalid\",1);"
 ]{
  assert!(compile(source,true).is_err(),"ill-typed DOM op compiled: {source}");
 }
}
#[test]
fn ascii_and_symbol_browser_operations_are_same_compiler_semantics(){
 let a=compile("⟑(\"#out\",⟐(\"#email\"));",true).unwrap();
 let b=compile("dom_text(\"#out\",dom_value(\"#email\"));",true).unwrap();
 assert_eq!(a,b);
}
