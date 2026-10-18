use hcode_compiler::{
 ast::ExprKind,
 checker::{check,Type,TypedStmtKind},
 codegen::emit,
 lexer::{lex,TokenKind},
 packages::PackageRegistry,
 parser::parse
};
use std::process::Command;

fn compile(source:&str)->Result<String,String>{
 let tree=parse(source).map_err(|e|e.to_string())?;
 let registry=PackageRegistry::default();
 let typed=check(&tree,&registry,true).map_err(|e|e.to_string())?;
 emit(&typed,&registry)
}
fn run(source:&str)->Result<String,String>{
 let js=compile(source)?;
 let child=Command::new("node").args(["--input-type=module","--eval",&js])
     .output().map_err(|e|e.to_string())?;
 if !child.status.success(){return Err(String::from_utf8_lossy(&child.stderr).into());}
 Ok(String::from_utf8_lossy(&child.stdout).replace("\r\n","\n"))
}
#[test]
fn symbols_are_actual_core_ast_ops_and_ascii_forms_are_semantically_identical(){
 let pairs=[
   ("⫶\"Hi🙂\"","text_scalars\"Hi🙂\""),
   ("⟟\"CAFÉ café\"","text_words\"CAFÉ café\""),
   ("⧉⟦1,2,1⟧","text_hist⟦1,2,1⟧"),
 ];
 for (glyph,alias) in pairs {
   let g=format!("print(⤒({glyph}));");
   let a=format!("print(json_out({alias}));");
   assert_eq!(compile(&g).unwrap(),compile(&a).unwrap());
   assert_eq!(run(&g).unwrap(),run(&a).unwrap());
 }
 assert_eq!(lex("⫶").unwrap()[0].kind,TokenKind::TextScalars);
 assert_eq!(lex("⟟").unwrap()[0].kind,TokenKind::TextWords);
 assert_eq!(lex("⧉").unwrap()[0].kind,TokenKind::Histogram);
 assert_eq!(lex("text_words").unwrap()[0].kind,TokenKind::TextWords);
 assert_eq!(run("print(⤒(⫶\"a🙂字\"));").unwrap(),"[\"a\",\"🙂\",\"字\"]\n");
}

#[test]
fn histogram_is_structurally_typed_as_sorted_sequence_of_count_value_records(){
 let tree=parse("≔items←⧉⟦\"b\",\"a\",\"b\"⟧;").unwrap();
 let typed=check(&tree,&PackageRegistry::default(),true).unwrap();
 let expected=Type::Sequence(Box::new(Type::Record(vec![
    ("count".into(),Type::Number),("value".into(),Type::String)
 ])));
 let TypedStmtKind::Let{value,..}=&typed.statements[0].kind else{panic!("Expected binding")};
 assert_eq!(value.ty,expected);
 assert!(matches!(value.kind,hcode_compiler::checker::TypedExprKind::Histogram(..)));
 assert_eq!(run("print(⤒(⧉⟦3,-2,3,0⟧));").unwrap(),
    "[{\"count\":1,\"value\":-2},{\"count\":1,\"value\":0},{\"count\":2,\"value\":3}]\n");
 assert_eq!(run("print(⤒(⧉⟦⊤,⊥,⊤⟧));").unwrap(),
    "[{\"count\":1,\"value\":false},{\"count\":2,\"value\":true}]\n");
 assert_eq!(run("≔xs:⟦String⟧←⟦⟧;print(⤒(⧉xs));").unwrap(),"[]\n");
}
#[test]
fn lexer_parser_and_typechecker_reject_invalid_histogram_and_tokenizer_inputs(){
 let invalid=[
    ("print(⟟42);","Unicode text operation requires String"),
    ("print(⫶⊤);","Unicode text operation requires String"),
    ("print(⧉42);","⧉ requires a typed sequence"),
    ("print(⧉⟦⦃value:1⦄⟧);","⧉ requires a concrete"),
    ("print(⧉⟦1,\"a\"⟧);","Sequence elements must have matching types"),
    ("print(⧉⟦⟧);","⧉ requires a concrete"),
    ("print(⧉⟦⟦1⟧⟧);","⧉ requires a concrete")
 ];
 for(source,needle) in invalid{
    let err=compile(source).unwrap_err();
    assert!(err.contains(needle),"Source {source}: {err}");
 }
}
#[test]
fn unicode_runtime_is_only_emitted_for_programs_that_actually_use_text_glyphs(){
 let no=compile("print(42);").unwrap();
 assert!(!no.contains("const __hc_text_words"));
 assert!(!no.contains("const __hc_hist"));
 let yes=compile("print(⤒(⧉(⟟\"Hello hello\")));").unwrap();
 assert!(yes.contains("const __hc_text_words"));
 assert!(yes.contains("const __hc_hist"));
 assert_eq!(run("print(⤒(⧉(⟟\"Hello hello\")));").unwrap(),
   "[{\"count\":2,\"value\":\"hello\"}]\n");
}
#[test]
fn actual_unicode_limits_and_proto_values_are_checked_at_runtime(){
 let giant="a ".repeat(16385);
 let source=format!("print(⤒(⧉(⟟{})));",serde_json::to_string(&giant).unwrap());
 let err=run(&source).unwrap_err();
 assert!(err.contains("Sequence allocation limit exceeded"),"{err}");
 assert_eq!(run("print(⤒(⧉⟦\"__proto__\",\"constructor\",\"__proto__\"⟧));").unwrap(),
  "[{\"count\":2,\"value\":\"__proto__\"},{\"count\":1,\"value\":\"constructor\"}]\n");
}
