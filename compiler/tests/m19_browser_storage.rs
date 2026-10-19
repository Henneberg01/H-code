use std::{fs,path::PathBuf};
use hcode_compiler::{parser::parse,checker::check,codegen::emit,packages::PackageRegistry};
fn compile(s:&str,allow_effects:bool)->Result<String,String>{
 let program=parse(s).map_err(|e|e.to_string())?;
 let registry=PackageRegistry::default();
 let typed=check(&program,&registry,allow_effects).map_err(|e|e.to_string())?;
 emit(&typed,&registry)
}
#[test]
fn persistence_symbols_are_real_native_typed_browser_intrinsics(){
 let source="⟖(\"hcode:probe\",\"hello\");⟑(\"#after\",⟕(\"hcode:probe\"));⟗(\"hcode:probe\");";
 let js=compile(source,true).unwrap();
 for target in ["__hc_store_get","__hc_store_put","__hc_store_del","globalThis.localStorage","__hc_dom_text"]{
  assert!(js.contains(target),"Missing native generated browser function {target}");
 }
 assert!(!js.contains("node:fs"),"Browser persistence must never use Node filesystem");
 assert!(!js.contains("__hc_todo_app"),"No hardcoded task14 todo macro");
}
#[test]
fn browser_storage_demo_is_real_developer_written_hcode(){
 let path=PathBuf::from(env!("CARGO_MANIFEST_DIR"))
     .join("../compact/canonical20/programs/14-browser-storage-demo.hc");
 let s=fs::read_to_string(path).unwrap();
 let generated=compile(&s,true).unwrap();
 assert!(generated.contains("__hc_store_get")&&generated.contains("__hc_store_put"));
}
#[test]
fn symbol_first_storage_and_ascii_fallback_compile_identically(){
 let symbolic=compile("⟖(\"hcode:a\",\"b\"); ⟕(\"hcode:a\"); ⟗(\"hcode:a\");",true).unwrap();
 let ascii=compile("store_put(\"hcode:a\",\"b\"); store_get(\"hcode:a\"); store_del(\"hcode:a\");",true).unwrap();
 assert_eq!(symbolic,ascii);
}
#[test]
fn browser_storage_is_rejected_in_signed_pure_package_context(){
 for s in ["⟕(\"hcode:probe\");","⟖(\"hcode:probe\",\"v\");","⟗(\"hcode:probe\");",
           "store_get(\"hcode:probe\");","store_put(\"hcode:probe\",\"v\");"]{
  assert!(compile(s,false).is_err(),"Storage operation admitted into pure package: {s}");
 }
}
#[test]
fn storage_operations_are_statically_typed_and_unshadowable(){
 for s in ["⟕(1);","⟖(\"hcode:key\",false);","⟗(true);",
           "⟖(false,\"yes\");","⟕();","⟖(\"hcode:key\");","⟗(\"hcode:a\",1);"]{
  assert!(compile(s,true).is_err(),"Invalid storage invocation typechecked: {s}");
 }
 let invalid="fn shadow(store_get:String)->String { return store_get; }";
 let err=compile(invalid,true).unwrap_err();
 assert!(err.contains("Reserved core browser DOM capability"),"{err}");
}
#[test]
fn ordinary_program_without_browser_effects_retains_unmodified_emission(){
 let program=compile("print(\"hello\");",true).unwrap();
 assert!(!program.contains("globalThis.localStorage"));
 assert!(!program.contains("const __hc_store_get="));
 assert!(!program.contains("const __hc_dom_value="));
}
