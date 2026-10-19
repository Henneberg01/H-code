use hcode_compiler::{
 lexer::{lex,TokenKind},parser::parse,checker::check,codegen::emit,packages::PackageRegistry
};
fn compile(source:&str,effects:bool)->Result<String,String>{
 let ast=parse(source).map_err(|e|e.to_string())?;
 let registry=PackageRegistry::default();
 let typed=check(&ast,&registry,effects).map_err(|e|e.to_string())?;
 emit(&typed,&registry)
}
#[test]
fn ascending_unicode_sort_is_native_glyph_and_ascii_alias(){
 let glyph=r#"≔xs←⟦⦃region:"West",v:3⦄,⦃region:"East",v:2⦄⟧;⎙(⤒(xs↥λr:r·region));"#;
 let alias=glyph.replace('↥',"@^");
 let a=lex(glyph).unwrap(),b=lex(&alias).unwrap();
 assert!(a.iter().any(|token|token.kind==TokenKind::SortTextAsc));
 assert_eq!(a.into_iter().map(|t|t.kind).collect::<Vec<_>>(),
            b.into_iter().map(|t|t.kind).collect::<Vec<_>>());
 let js=compile(glyph,true).unwrap();
 assert_eq!(js,compile(&alias,true).unwrap());
 assert!(js.contains("const __hc_sort_text="));
 assert!(js.contains("const __hc_compare="));
 assert!(!js.contains("__hc_sort_region"));
 assert!(!js.contains("node:sqlite"));
}
#[test]
fn sort_key_type_and_security_are_checked_by_rust(){
 for invalid in [
  r#"⟦1,2⟧↥λx:x;"#,
  r#"⟦1,2⟧↥λx:x≡1;"#,
  r#"1↥λx:"constant";"#,
  r#"⟦1,2⟧↥42;"#,
  r#"⟦1,2⟧↥λx:⎙(x);"#,
  r#"ƒ noisy(n:Number)→String {⎙(n);↩"bad"}; ⟦1,2⟧↥noisy;"#
 ]{assert!(compile(invalid,true).is_err(),"bad ↥ key accepted: {invalid}");}
}
#[test]
fn runtime_remains_conditional_for_old_hcode_programs(){
 let js=compile("⎙(⤒(⟦3,1,2⟧↧λn:n));",true).unwrap();
 assert!(!js.contains("const __hc_sort_text="));
 assert!(!js.contains("const __hc_compare="));
 let minimal=compile("⎙(42);",true).unwrap();
 assert!(!minimal.contains("__hc_sort_text"));
}
