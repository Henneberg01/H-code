use std::{fs,path::PathBuf};
use hcode_compiler::{parser::parse,checker::check,codegen::emit,packages::PackageRegistry};
fn compile(s:&str,with_effects:bool)->Result<String,String>{
 let parsed=parse(s).map_err(|e|e.to_string())?;
 let r=PackageRegistry::default();
 let p=check(&parsed,&r,with_effects).map_err(|e|e.to_string())?;
 emit(&p,&r)
}
#[test]
fn developer_authored_todo_app_compiles_and_uses_generic_browser_language(){
 let path=PathBuf::from(env!("CARGO_MANIFEST_DIR"))
  .join("../compact/canonical20/programs/14-todo-app.hc");
 let source=fs::read_to_string(path).unwrap();
 let js=compile(&source,true).expect("H-Code todo source should compile with real Rust frontend");
 for builtin in ["__hc_store_get","__hc_store_put","__hc_dom_value",
  "__hc_dom_list","__hc_dom_text","__hc_dom_on","__hc_json"]{
  assert!(js.contains(builtin),"missing generic operation: {builtin}");
 }
 assert!(!js.contains("__hc_todo_app"),"A task-specific runtime macro would invalidate the benchmark");
 assert!(!js.contains("node:fs"),"Native browser todo must never access server file system");
}
#[test]
fn list_operation_is_generic_typed_and_symbol_identical_to_alias(){
 let a=compile("⟘(\"#tasks\",⟦\"a\",\"b\"⟧);",true).unwrap();
 let b=compile("dom_list(\"#tasks\",⟦\"a\",\"b\"⟧);",true).unwrap();
 assert_eq!(a,b);
 assert!(a.contains("replaceChildren"));
}
#[test]
fn list_renders_only_string_sequences_and_never_inside_pure_package(){
 for invalid in ["⟘(\"#tasks\",1);","⟘(\"#tasks\",⟦1,2⟧);",
   "⟘(false,⟦\"a\"⟧);","⟘(\"#tasks\");"]{
  assert!(compile(invalid,true).is_err(),"Wrongly compiled invalid list: {invalid}");
 }
 assert!(compile("⟘(\"#tasks\",⟦\"a\"⟧);",false).is_err());
}
