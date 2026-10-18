use hcode_compiler::{parser::parse,checker::check,codegen::emit,packages::PackageRegistry};
fn compiled(src:&str)->Result<String,String>{
 let ast=parse(src).map_err(|e|e.to_string())?;
 let reg=PackageRegistry::default();
 let typed=check(&ast,&reg,true).map_err(|e|e.to_string())?;
 emit(&typed,&reg)
}
#[test]
fn expanded_http_request_and_response_are_compiler_checked(){
 let src=r#"
ƒ reply(r:⦃body:String,contentType:String,method:String,path:String⦄,state:String)→⦃body:String,contentType:String,state:String,status:Number⦄ {
  ↩⦃body:r.body,contentType:"application/json; charset=utf-8",state:state,status:200⦄
}
⤊(reply,"0")
"#;
 let js=compiled(src).expect("extended HTTP envelope must compile");
 assert!(js.contains("createHttpCasStateStore"));
 assert!(js.contains("true)"),"typed extended variant must reach host prelude");
 assert!(js.contains("contentType"));
}
#[test]
fn earlier_http_source_still_compiles_without_extended_envelope(){
 let src=r#"
ƒ reply(r:⦃body:String,method:String,path:String⦄,state:String)→⦃body:String,state:String,status:Number⦄ {
  ↩⦃body:state,state:state,status:200⦄
}
⤊(reply,"0")
"#;
 let js=compiled(src).expect("legacy H-Code source must continue compiling");
 assert!(js.contains("false)"));
}
#[test]
fn wrong_extended_response_shape_fails_without_runtime_cast(){
 let src=r#"
ƒ reply(r:⦃body:String,contentType:String,method:String,path:String⦄,state:String)→⦃body:String,state:String,status:Number⦄ {
  ↩⦃body:state,state:state,status:200⦄
}
⤊(reply,"0")
"#;
 assert!(compiled(src).is_err(),"typed request must demand MIME response");
}
