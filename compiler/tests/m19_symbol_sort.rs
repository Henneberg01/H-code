use hcode_compiler::{lexer::{lex,TokenKind},parser::parse,checker::check,codegen::emit,packages::PackageRegistry};
fn compile(source:&str, effects:bool)->Result<String,String>{
 let ast=parse(source).map_err(|e|e.to_string())?;
 let registry=PackageRegistry::default();
 let typed=check(&ast,&registry,effects).map_err(|e|e.to_string())?;
 emit(&typed,&registry)
}
#[test]
fn actual_unicode_sort_and_print_glyphs_are_same_typed_language_as_accessible_aliases(){
 let src=r#"≔xs←⟦3,1,2,2⟧↧λx:x;⎙(⤒xs)"#;
 let ascii=src.replace('↧',"@v").replace('⎙',"print");
 let a=lex(src).unwrap(),b=lex(&ascii).unwrap();
 assert_eq!(a.into_iter().map(|t|t.kind).collect::<Vec<_>>(),
            b.into_iter().map(|t|t.kind).collect::<Vec<_>>());
 let js=compile(src,true).expect("sort sign must be native typed Rust source");
 assert_eq!(js,compile(&ascii,true).unwrap());
 assert!(js.contains("__hc_sort_desc("),"Stable descending sort must be real runtime operation");
 assert!(js.contains("__hc_print"),"⎙ must be an actual H-Code output effect");
 assert!(!js.contains("__hc_revenue_sort"),"No sales-specific macro");
}
#[test]
fn general_typechecker_rejects_non_numeric_keys_and_non_sequences(){
 for src in [
  r#"⟦1,2⟧↧λn:"wrong";"#,
  r#"⟦1,2⟧↧λn:n≡1;"#,
  r#"1↧λn:n;"#,
  r#"⟦1,2⟧↧42;"#,
  r#"⟦"a","b"⟧↧λn:n;"#,
 ]{assert!(compile(src,true).is_err(),"invalid ↧ source compiled: {src}");}
}
#[test]
fn runtime_for_unchanged_programs_has_no_new_sort_prelude(){
 let js=compile("⎙(42);",true).unwrap();
 assert!(!js.contains("const __hc_sort_desc"),"Unrelated programs must not absorb sorting runtime");
 assert!(!js.contains("node:sqlite"),"Sort-only change must never link database");
}
#[test]
fn typed_general_sort_can_rank_strings_and_records_by_numbers(){
 let source=r#"≔xs←⟦⦃name:"a",score:2⦄,⦃name:"b",score:3⦄⟧↧λx:x·score;⎙(⤒xs);"#;
 let js=compile(source,true).unwrap();
 assert!(js.contains("↧ key must return a finite Number"));
 assert!(js.contains("__hc_sort_desc"));
}
