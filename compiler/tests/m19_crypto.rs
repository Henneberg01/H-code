use hcode_compiler::{parser::parse,checker::check,codegen::emit,packages::PackageRegistry};
fn compile(source:&str,effects:bool)->Result<String,String>{
 let ast=parse(source).map_err(|e|e.to_string())?;
 let registry=PackageRegistry::default();
 let typed=check(&ast,&registry,effects).map_err(|e|e.to_string())?;
 emit(&typed,&registry)
}
#[test]
fn native_crypto_signs_have_identical_accessibility_aliases(){
 for (glyph,alias) in [
  ("⌁\"abc\"","sha256_text \"abc\""),
  ("⊩(\"test\",\"abc\")","hmac_sign(\"test\",\"abc\")"),
  ("⊨(\"test\",\"abc\",\"mac\")","hmac_verify(\"test\",\"abc\",\"mac\")"),
  ("⚄24","random_id 24")
 ]{
  let generated=compile(glyph,true).unwrap();
  assert_eq!(generated,compile(alias,true).unwrap());
  assert!(generated.contains("node:crypto"));
 }
}
#[test]
fn crypto_arity_types_and_purity_are_checked(){
 for source in ["⌁1","⊩(1,\"x\")","⊩(\"key\",2)","⊨(\"key\",\"x\",2)","⚄\"24\"",
  "⊩(\"key\")","⊩(\"key\",\"x\",\"extra\")","⊨(\"key\",\"x\")",
  "⟦\"x\"⟧↥λx:⊩(\"key\",x)",
  "ƒ sign(s:String)→String ↩ ⊩(\"key\",s); ⟦\"x\"⟧↥sign"
 ]{assert!(compile(source,true).is_err(),"accepted {source}");}
 for source in ["⊩(\"key\",\"x\")","⊨(\"key\",\"x\",\"mac\")","⚄24"]{
  assert!(compile(source,false).is_err(),"pure package accepted {source}");
 }
 assert!(compile("⌁\"abc\"",false).is_ok());
 assert!(compile("⟦\"x\"⟧↥λx:⌁x",true).is_ok());
}
#[test]
fn crypto_linkage_is_conditional_and_traverses_effectful_operands(){
 let pure=compile("⎙(42)",true).unwrap();
 assert!(!pure.contains("node:crypto"));
 let hash=compile("⎙(⌁\"abc\")",true).unwrap();
 assert!(!hash.contains("HCODE_CRYPTO_GRANTS"),"pure hash has no key-grant runtime");
 assert!(!hash.contains("randomBytes"),"pure hash has no entropy runtime");
 let nested=compile("⎙(⌁(⤒⦃x:1⦄))",true).unwrap();
 assert!(nested.contains("__hc_json_write("));
 assert!(nested.contains("const __hc_json_write"));
 let stdin=compile("⎙(⌁⌨)",true).unwrap();
 assert!(stdin.contains("__hc_read_fd0"));
 let http=compile("⎙(⌁(⤒(⤋\"http://127.0.0.1:1234\")))",true).unwrap();
 assert!(http.contains("const __hc_http_get"));
}
