use hcode_compiler::{parser::parse,checker::check,codegen::emit,packages::PackageRegistry};
fn compile(source:&str,effects:bool)->Result<String,String>{
 let ast=parse(source).map_err(|e|e.to_string())?;let registry=PackageRegistry::default();
 let typed=check(&ast,&registry,effects).map_err(|e|e.to_string())?;emit(&typed,&registry)
}
#[test]
fn transaction_sign_is_typed_native_and_alias_equivalent(){
 let source="ƒ step(s:String)→⦃state:String,value:String⦄ ↩⦃state:s,value:s⦄;⎙(⥁(step,\"0\"))";
 let js=compile(source,true).unwrap();
 assert_eq!(js,compile(&source.replace('⥁',"state_transaction"),true).unwrap());
 assert!(js.contains("node:sqlite"));assert!(js.contains("HCODE_TX_STATE_ROOT"));
 assert!(!compile("⎙(42)",true).unwrap().contains("node:sqlite"));
}
#[test]
fn transaction_types_pure_contexts_and_async_mix_fail_closed(){
 for source in ["⥁(7,\"0\")","⥁(λs:s,\"0\")","⥁(λs:⦃state:s,value:1⦄,\"0\")",
  "⟦\"x\"⟧↥λx:⥁(λs:⦃state:s,value:s⦄,\"0\")"]{
  assert!(compile(source,true).is_err(),"accepted {source}");
 }
 let valid="ƒ step(s:String)→⦃state:String,value:String⦄ ↩⦃state:s,value:s⦄;⥁(step,\"0\")";
 assert!(compile(valid,false).is_err());
 for suffix in ["⌛1","⤋\"http://test.invalid\"","⧅(\"x\",\"y\")"]{
  let source=format!("{valid};{suffix}");
  let ast=parse(&source).unwrap();
  assert!(check(&ast,&PackageRegistry::default(),true).is_err(),"check accepted mixed effects");
  assert!(compile(&source,true).is_err());
 }
}
