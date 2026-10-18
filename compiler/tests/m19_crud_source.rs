use std::fs;
use std::path::PathBuf;
use hcode_compiler::{parser::parse,checker::check,codegen::emit,packages::PackageRegistry};
#[test]
fn canonical12_user_authored_crud_compiles_without_crud_macros(){
 let source=fs::read_to_string(PathBuf::from(env!("CARGO_MANIFEST_DIR"))
  .join("../compact/canonical20/programs/12-crud-api.hc")).unwrap();
 let parsed=parse(&source).expect("user-authored CRUD source must parse");
 let registry=PackageRegistry::default();
 let checked=check(&parsed,&registry,true).expect("user-authored CRUD source must typecheck");
 let emitted=emit(&checked,&registry).expect("real Rust-generated JS must compile");
 assert!(emitted.contains("createHttpCasStateStore"));
 assert!(emitted.contains("__hc_http_serve_state"));
 assert!(emitted.contains("__hc_json_valid"));
 assert!(!emitted.contains("__hc_crud"),"No hidden application macro");
}
