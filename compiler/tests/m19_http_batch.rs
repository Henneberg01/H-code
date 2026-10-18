use hcode_compiler::{parser::parse,checker::check,codegen::emit,packages::PackageRegistry};
fn compile(source:&str)->Result<String,String>{
 let ast=parse(source).map_err(|e|e.to_string())?;
 let registry=PackageRegistry::default();
 let typed=check(&ast,&registry,true).map_err(|e|e.to_string())?;
 emit(&typed,&registry)
}
#[test]
fn vectorized_http_has_exact_typed_sequence_and_true_concurrent_codegen(){
 let source="≔r←⤋⟦\"https://example.invalid/a\",\"https://example.invalid/b\"⟧;print(⤒(r⇢λv:v·body));";
 let js=compile(source).unwrap();
 assert!(js.contains("await __hc_http_batch("));
 assert!(js.contains("Promise.all(urls.map(__hc_http_get))"));
 assert!(js.contains("__hc_http_request_count+urls.length>64"));
 // The same intrinsic must retain backward-compatible scalar semantics.
 let scalar=compile("≔r←⤋\"https://example.invalid/x\";print(r·status);").unwrap();
 assert!(scalar.contains("await __hc_http_get("));
 assert!(!scalar.contains("await __hc_http_batch("));
}
#[test]
fn mismatched_types_and_unapproved_async_effects_are_rejected(){
 for (source,needle) in [
   ("⤋⟦1,2⟧;","⤋ batch expects"),
   ("⤋⊤;","⤋ expects a String URL"),
   ("ƒ invalid(u:⟦String⟧)→Number ↩ ⌗(⤋u);","only available in effectful top-level"),
 ]{
  let e=compile(source).unwrap_err();
  assert!(e.contains(needle),"{source}: {e}");
 }
 let ast=parse("≔xs:⟦String⟧←⟦⟧;print(⌗(⤋xs));").unwrap();
 assert!(check(&ast,&PackageRegistry::default(),true).is_ok());
 assert!(check(&parse("⤋⟦\"https://example.invalid\"⟧;").unwrap(),
   &PackageRegistry::default(),false).is_err());
}
