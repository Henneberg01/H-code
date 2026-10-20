use hcode_compiler::{parser::parse,checker::check,codegen::emit,packages::PackageRegistry};
fn compiled(source:&str)->Result<String,String>{
 let registry=PackageRegistry::default();
 let ast=parse(source).map_err(|e|e.to_string())?;
 let typed=check(&ast,&registry,true).map_err(|e|e.to_string())?;
 emit(&typed,&registry)
}
const SOURCE:&str=r#"
ƒ reply(r:⦃body:String,contentType:String,headers:⟦⦃name:String,value:String⦄⟧,method:String,path:String⦄,state:String)→⦃body:String,contentType:String,state:String,status:Number⦄ {
 ↩⦃body:⤒r·headers,contentType:"application/json; charset=utf-8",state:state,status:200⦄
}
⤊(reply,"0")
"#;
#[test]
fn raw_header_sequence_is_a_real_optional_typed_http_request(){
 let js=compiled(SOURCE).expect("raw-header HTTP envelope compiles");
 assert!(js.contains("true, true)"));
 assert!(js.contains("rawHeaders"));
}
#[test]
fn malformed_header_types_and_incomplete_extended_shapes_are_rejected(){
 for source in [SOURCE.replace("headers:⟦⦃name:String,value:String⦄⟧","headers:String"),SOURCE.replace("name:String","name:Number"),SOURCE.replace("contentType:String,headers:","headers:")]{
  assert!(compiled(&source).is_err());
 }
}

#[test]
fn file_read_and_persistent_http_emit_without_import_binding_collisions(){
 use std::io::Write;
 use std::process::{Command,Stdio};
 let source=r#"
≔key←⧄"key.txt"
ƒ reply(r:⦃body:String,method:String,path:String⦄,state:String)→⦃body:String,state:String,status:Number⦄↩⦃body:✍(key,r·body),state:state,status:200⦄
⤊(reply,"0")
"#;
 let js=compiled(source).unwrap();
 let mut child=Command::new("node").args(["--input-type=module","--check"]).stdin(Stdio::piped()).stdout(Stdio::piped()).stderr(Stdio::piped()).spawn().unwrap();
 child.stdin.take().unwrap().write_all(js.as_bytes()).unwrap();
 let result=child.wait_with_output().unwrap();
 assert!(result.status.success(),"{}",String::from_utf8_lossy(&result.stderr));
}
