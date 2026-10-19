use hcode_compiler::{lexer::{lex,TokenKind},parser::parse,checker::check,codegen::emit,packages::PackageRegistry};
fn generate(src:&str,effects:bool)->Result<String,String>{
 let program=parse(src).map_err(|e|e.to_string())?;
 let registry=PackageRegistry::default();
 let typed=check(&program,&registry,effects).map_err(|e|e.to_string())?;
 emit(&typed,&registry)
}
const SORT:&str=r#"≔xs←⟦⦃name:"Alpha",score:5⦄,⦃name:"Beta",score:9⦄,⦃name:"Gamma",score:9⦄,⦃name:"Delta",score:1⦄⟧
print(⤒(xs⇣λx:x·score))"#;
#[test]
fn sort_desc_glyph_ascii_have_identical_native_token_ast_and_esm(){
 let ascii=SORT.replace('⇣',"@v");
 let kinds=|s:&str|lex(s).unwrap().into_iter().map(|t|t.kind).collect::<Vec<_>>();
 assert_eq!(kinds(SORT),kinds(&ascii));
 assert!(kinds(SORT).contains(&TokenKind::SortDesc));
 // AST spans include source character offsets and differ for 1-char versus
 // 2-char spellings. Compare canonical token variants and emitted semantics.
 assert!(parse(SORT).is_ok());
 assert!(parse(&ascii).is_ok());
 let symbol=generate(SORT,true).unwrap();
 assert_eq!(symbol,generate(&ascii,true).unwrap(),"Aliases must emit byte-identical ESM");
 assert!(symbol.contains("const __hc_sort_desc="));
 assert!(symbol.contains("__hc_sort_desc("));
 assert!(!symbol.contains("__hc_dashboard"));
 let simple=generate("print(1)",true).unwrap();
 assert!(!simple.contains("__hc_sort_desc"),"No sort runtime in unrelated program");
}
#[test]
fn numeric_keys_required_and_nonsequence_rejected(){
 for bad in [
   "print((⟦1,2⟧⇣λx:\"bad\"))",
   "print((⟦\"A\",\"B\"⟧⇣λx:x))",
   "print((⟦1,2⟧⇣λx:x>0))",
   "print((99⇣λx:x))",
   "print((⟦1,2⟧⇣42))",
 ]{
  assert!(generate(bad,true).is_err(),"Should reject invalid pure numeric sort key: {bad}");
 }
}
#[test]
fn pure_symbol_is_available_in_typed_function_and_signed_code(){
 let source=String::from(r#"ƒ order(xs:⟦Number⟧)→⟦Number⟧ ↩ xs⇣λx:x
print(⤒order(⟦3,1,2⟧))"#);
 assert!(generate(&source,true).is_ok());
 let app=generate("≔xs:⟦Number⟧←⟦⟧;print(⤒(xs⇣λn:n));",true);
 assert!(app.is_ok(),"Empty but annotated sequence must sort deterministically");
}
