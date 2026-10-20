use hcode_compiler::{parser::parse,checker::check,codegen::emit,packages::PackageRegistry};
use std::process::Command;
fn compile(source:&str)->Result<String,String>{
 let ast=parse(source).map_err(|e|e.to_string())?;
 let registry=PackageRegistry::default();
 let typed=check(&ast,&registry,true).map_err(|e|e.to_string())?;
 emit(&typed,&registry)
}
fn run(source:&str)->String{
 let js=compile(source).expect("real typed existential operator compiles");
 let output=Command::new("node").args(["--input-type=module","--eval",&js]).output().unwrap();
 assert!(output.status.success(),"{}",String::from_utf8_lossy(&output.stderr));
 String::from_utf8(output.stdout).unwrap().replace("\r\n","\n")
}
#[test]
fn exists_is_typed_generic_computation_with_an_equivalent_ascii_spelling(){
 let source="≔empty:⟦Number⟧←⟦⟧;⎙(empty∃λn:n>0);⎙(⟦1,2,3⟧∃(>2));⎙(⟦\"a\",\"b\"⟧∃λs:s≡\"b\");⎙(⟦⦃done:⊥⦄,⦃done:⊤⦄⟧∃λr:r·done);";
 assert_eq!(compile(source).unwrap(),compile(&source.replace('∃',"@!")).unwrap());
 assert_eq!(run(source),"false\ntrue\ntrue\ntrue\n");
}
#[test]
fn exists_evaluates_input_once_and_stops_at_first_matching_element(){
 let source="≔calls←0;≔visits←0;ƒ values()→⟦Number⟧{calls←calls+1;↩⟦1,2,3⟧}ƒ found(n:Number)→Bool{visits←visits+1;↩n≡2}⎙(values()∃found);⎙(calls);⎙(visits);⎙(⟦0,1⟧∃λn:n≡0∨1/n>0);";
 assert_eq!(run(source),"true\n1\n2\ntrue\n");
}
#[test]
fn exists_rejects_incompatible_inputs_predicates_and_unknown_empty_types(){
 for source in ["1∃λx:⊤;","⟦1⟧∃λx:x+1;","⟦1⟧∃42;","⟦⟧∃λx:⊤;","⟦⟧∃(>0);","ƒ positive(n:Number)→Bool↩n>0;⟦⟧∃positive;","ƒ wrong(s:String)→Bool↩⊤;⟦1⟧∃wrong;","ƒ wrong(a:Number,b:Number)→Bool↩⊤;⟦1⟧∃wrong;"]{
  assert!(compile(source).is_err(),"invalid program accepted: {source}");
 }
}
#[test]
fn legacy_programs_do_not_gain_an_unused_runtime(){
 assert!(!compile("⎙(42);").unwrap().contains("__hc_exists"));
 assert!(compile("⎙(⟦1⟧∃(>0));").unwrap().contains("const __hc_exists"));
}
#[test]
fn predicate_factory_is_evaluated_once_and_composition_is_typed(){
 let source="≔factories←0;ƒ found(n:Number)→Bool↩n>1;ƒ choose(){factories←factories+1;↩found}⎙(⟦1,2,3⟧∃choose());⎙(factories);ƒ twice(n:Number)→Number↩n*2;⎙(⟦1,2⟧∃(found∘twice));";
 assert_eq!(run(source),"true\n1\ntrue\n");
}
#[test]
fn existential_callbacks_cannot_hide_effects_inside_websocket_reducers(){
 let helper="ƒ noisy(s:String)→Bool{⎙(s);↩⊤}";
 let handler="ƒ handle(e:⦃client:String,data:String,kind:String⦄,s:String)→⦃messages:⟦⦃client:String,data:String⦄⟧,state:String⦄{≔found←⟦e·data⟧∃noisy;↩⦃messages:⟦⟧,state:s⦄}";
 assert!(compile(&format!("{helper}{handler}⇄(handle,\"\");")).unwrap_err().contains("EFFECT"));
}
