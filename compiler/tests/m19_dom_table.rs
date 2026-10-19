use hcode_compiler::{lexer::{lex,TokenKind},parser::parse,checker::check,codegen::emit,packages::PackageRegistry};
fn compile(source:&str,effects:bool)->Result<String,String>{
 let ast=parse(source).map_err(|e|e.to_string())?;
 let registry=PackageRegistry::default();
 let typed=check(&ast,&registry,effects).map_err(|e|e.to_string())?;
 emit(&typed,&registry)
}
#[test]
fn generic_table_glyph_and_ascii_alias_have_identical_rust_typed_semantics(){
 let glyph=r##"⟙("#results","A caption",⟦"Name","Value"⟧,⟦⟦"north","5"⟧⟧);"##;
 let ascii=glyph.replace('⟙',"dom_table");
 assert_eq!(lex(glyph).unwrap().iter().map(|t|&t.kind).collect::<Vec<_>>(),
            lex(&ascii).unwrap().iter().map(|t|&t.kind).collect::<Vec<_>>());
 let a=compile(glyph,true).unwrap();let b=compile(&ascii,true).unwrap();
 assert_eq!(a,b,"ASCII alias and real glyph must produce identical ESM");
 assert!(a.contains("const __hc_dom_table"));
 assert!(a.contains("createElement('thead')"));
 assert!(a.contains("textNode('caption'"),"Generic table must create a semantic caption");
 assert!(!a.contains("__hc_dashboard"));
 assert!(!a.contains("node:sqlite"),"table alone must not link database runtime");
}
#[test]
fn generic_table_is_lexically_reserved_and_rejects_bad_static_shapes(){
 assert!(lex("⟙(\"#results\",\"Cap\",⟦\"A\"⟧,⟦⟦\"B\"⟧⟧);").unwrap().iter()
   .any(|t|t.kind==TokenKind::Identifier("dom_table".into())));
 for source in [
   r##"⟙("#results","Cap",⟦1⟧,⟦⟦"a"⟧⟧);"##,
   r##"⟙("#results","Cap",⟦"a"⟧,⟦⟦1⟧⟧);"##,
   r##"⟙("#results",1,⟦"a"⟧,⟦⟦"b"⟧⟧);"##,
   r##"⟙("#results","Cap",⟦"a"⟧);"##,
   r##"⟙("#results","Cap",⟦"a"⟧,false);"##,
 ] {
  assert!(compile(source,true).is_err(),"Invalid source unexpectedly compiled: {source}");
 }
 assert!(compile(r##"⟙("#results","Cap",⟦"a"⟧,⟦⟦"b"⟧⟧);"##,false).is_err(),
   "No browser effects permitted in signed packages");
}

#[test]
fn typed_records_render_without_manual_headers_cell_arrays_or_domain_macros(){
 let source=r###"≔r←⟦⦃region:"North",revenue:1200⦄,⦃region:"South",revenue:900⦄⟧
 ⟙("#results",r)"###;
 let compiled=compile(source,true).unwrap();
 assert!(compiled.contains("__hc_dom_records"),"Native typed record table must not lower to TypeScript authoring");
 assert!(compiled.contains("const __hc_dom_records"));
 assert!(!compiled.contains("node:sqlite"),"Pure UI operation must not link SQLite");
 let alias=source.replace('⟙',"dom_table");
 assert_eq!(compiled,compile(&alias,true).unwrap(),"Literal glyph and ASCII alias must be identical");
 assert!(compile(source,false).is_err(),"Pure packages must not use DOM effects");
 for bad in [
    r###"⟙("#results",⟦1,2⟧)"###,
    r###"⟙("#results",⟦⦃x:⟦1⟧⦄⟧)"###,
    r###"⟙(123,⟦⦃x:"v"⦄⟧)"###,
    r###"⟙("#results",false)"###
 ]{assert!(compile(bad,true).is_err(),"Bad row type not rejected: {bad}");}
 let previous=r###"⟙("#results","My title",⟦"A"⟧,⟦⟦"B"⟧⟧);"###;
 assert!(compile(previous,true).is_ok(),"Legacy four-argument typed table remains valid");
}
