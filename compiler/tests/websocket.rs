use hcode_compiler::{parser::parse,checker::check,codegen::emit,packages::PackageRegistry};
use std::process::Command;
fn compile(source:&str)->Result<String,String>{
 let registry=PackageRegistry::default();
 let ast=parse(source).map_err(|e|e.to_string())?;
 let typed=check(&ast,&registry,true).map_err(|e|e.to_string())?;
 emit(&typed,&registry)
}
const HANDLER:&str="ƒ handle(e:⦃client:String,data:String,kind:String⦄,s:String)→⦃messages:⟦⦃client:String,data:String⦄⟧,state:String⦄↩⦃messages:⟦⦃client:e·client,data:e·data⦄⟧,state:s⦄;";
#[test]
fn websocket_typed_handler_and_alias_emit_the_same_general_operation(){
 let source=format!("{HANDLER}⇄(handle,\"initial\");");
 let js=compile(&source).unwrap();
 assert_eq!(js,compile(&source.replace('⇄',"websocket_serve")).unwrap());
 assert!(js.contains("HCODE_WS_LISTEN"));
 assert!(js.contains("WebSocketServer"));
 assert!(!compile("⎙(\"⇄\");").unwrap().contains("WebSocketServer"));
}
#[test]
fn websocket_callback_types_and_arity_are_exact(){
 for source in ["⇄(1,\"\");".to_string(),format!("{HANDLER}⇄(handle,1);"),format!("{HANDLER}⇄(handle);"),format!("{HANDLER}⇄(handle,\"\",0);")]{assert!(compile(&source).is_err());}
 for (from,to) in [("client:String","client:Number"),("data:String","data:Bool"),("messages:⟦⦃client:String,data:String⦄⟧","messages:String"),("state:String","state:Number")]{
  assert!(compile(&format!("{}⇄(handle,\"\");",HANDLER.replace(from,to))).is_err());
 }
}
#[test]
fn websocket_requires_explicit_runtime_capability(){
 let js=compile(&format!("{HANDLER}⇄(handle,\"\");")).unwrap();
 let r=Command::new("node").args(["--input-type=module","--eval",&js]).env_remove("HCODE_WS_LISTEN").output().unwrap();
 assert!(!r.status.success());assert!(String::from_utf8_lossy(&r.stderr).contains("WebSocket listen capability denied"));
}
#[test]
fn websocket_callbacks_reject_transitive_effects_and_capture_mutation(){
 for body in ["≔x←⧄\"key\";","⎙(e·data);","s←\"changed\";","≔x←✍(\"key\",⧄\"key\");","≔x←helper();"]{
  let source=format!("ƒ helper()→String↩⧄\"key\";ƒ handle(e:⦃client:String,data:String,kind:String⦄,s:String)→⦃messages:⟦⦃client:String,data:String⦄⟧,state:String⦄{{{body}↩⦃messages:⟦⟧,state:s⦄}}⇄(handle,\"\");");
  assert!(compile(&source).unwrap_err().contains("EFFECT"),"{body}");
 }
 let nested=format!("{HANDLER}ƒ start()→Unit↩⇄(handle,\"\");");
 assert!(compile(&nested).unwrap_err().contains("EFFECT"));
}
#[test]
fn websocket_initial_operands_retain_json_file_and_mac_discovery(){
 let js=compile(&format!("{HANDLER}⇄(handle,✍(⧄\"key\",⤒1));")).unwrap();
 assert!(js.contains("HCODE_ALLOW_FILE_READ"));assert!(js.contains("timingSafeEqual"));assert!(js.contains("const __hc_json_write"));
}
#[test]
fn nested_top_level_websocket_registration_still_checks_callback_effects(){
 let bad=HANDLER.replace("↩⦃messages:","{⎙(e·data);↩⦃messages:").replace("state:s⦄;","state:s⦄}");
 for register in ["⊢(⊤){⇄(handle,\"\");}","≔x←⊤◇⇄(handle,\"\"):⇄(handle,\"\");"]{
  assert!(compile(&format!("{bad}{register}")).unwrap_err().contains("EFFECT"));
 }
}
