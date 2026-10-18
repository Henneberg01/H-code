use hcode_compiler::{parser::parse,checker::check,codegen::emit,packages::PackageRegistry};
fn compile(s:&str)->Result<String,String>{
 let ast=parse(s).map_err(|e|e.to_string())?;
 let registry=PackageRegistry::default();
 let program=check(&ast,&registry,true).map_err(|e|e.to_string())?;
 emit(&program,&registry)
}
#[test]
fn json_validation_is_a_bool_intrinsic_in_rust_not_an_application_macro(){
 let glyph=r#"print(⤔⦃id:String,name:String,qty:Number⦄ "{\"id\":\"a\",\"name\":\"A\",\"qty\":1}");"#;
 let ascii=r#"print(json_valid⦃id:String,name:String,qty:Number⦄ "{\"id\":\"a\",\"name\":\"A\",\"qty\":1}");"#;
 let js=compile(glyph).expect("symbolic JSON validator compiles");
 assert_eq!(js,compile(ascii).expect("ASCII parity"));
 assert!(js.contains("__hc_json_valid"));
 assert!(!js.contains("crud"),"no application-specific CRUD intrinsic");
}
#[test]
fn json_validation_rejects_nonstring_input_and_invalid_schema(){
 for source in ["print(⤔⦃id:String⦄ 42);","print(⤔Unknown \"{}\");"]{
  assert!(compile(source).is_err(),"{source}");
 }
}
