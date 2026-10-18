// M19 canonical01: real lexer/AST/typechecker/runtime capabilities, no hardcoded
// calculator app parser. The full stdin/out/stderr matrix is in benchmark20:verify01.
use hcode_compiler::{
 checker::{check,Type,TypedStmtKind,TypedExprKind},
 codegen::emit,lexer::{lex,TokenKind},parser::parse,packages::PackageRegistry
};
fn typed(source:&str,allow_effects:bool)->Result<hcode_compiler::checker::TypedProgram,String>{
 let p=parse(source).map_err(|e|e.to_string())?;
 check(&p,&PackageRegistry::default(),allow_effects).map_err(|e|e.to_string())
}
fn js(source:&str)->Result<String,String>{
 emit(&typed(source,true)?,&PackageRegistry::default())
}
#[test]
fn symbols_are_real_tokens_and_not_long_source_aliases(){
 assert_eq!(lex("⌨").unwrap()[0].kind,TokenKind::StdinText);
 assert_eq!(lex("⩚").unwrap()[0].kind,TokenKind::ArithEval);
 assert_eq!(lex("stdin_text").unwrap()[0].kind,TokenKind::StdinText);
 assert_eq!(lex("arith_eval").unwrap()[0].kind,TokenKind::ArithEval);
 assert_eq!(js("print(⩚⌨);").unwrap(),js("print(arith_eval stdin_text);").unwrap());
}
#[test]
fn typechecker_enforces_string_to_finite_number_contract(){
 let program=typed("≔amount:Number←⩚⌨;",true).unwrap();
 let TypedStmtKind::Let{value,..}=&program.statements[0].kind else {panic!("binding missing")};
 assert_eq!(value.ty,Type::Number);
 assert!(matches!(value.kind,TypedExprKind::ArithEval(..)));
 for source in ["print(⩚42);","print(⩚⊤);","print(⌨+2);","print(⩚⟦1⟧);"]{
  assert!(typed(source,true).is_err(),"Ill-typed source accepted: {source}");
 }
}
#[test]
fn pure_signed_packages_cannot_access_ambient_stdin(){
 let result=typed("ƒ leak()→String ↩ ⌨;",false);
 let error=format!("{:?}",result.err().expect("Pure package was allowed STDIN"));
 assert!(error.contains("stdin")||error.contains("⌨"),"{error}");
 // A pure arithmetic expression is still legal: ⩚ is pure over a String.
 assert!(typed("ƒ add()→Number ↩ ⩚\"1+2\";",false).is_ok());
}
#[test]
fn generated_io_module_is_not_linked_when_not_used(){
 let no=js("print(5);").unwrap();
 assert!(!no.contains("import {readSync as __hc_read_fd0}"));
 assert!(!no.contains("const __hc_arith ="));
 let pure=js("print(⩚\"2+3*4\");").unwrap();
 assert!(pure.contains("const __hc_arith ="));
 assert!(!pure.contains("import {readSync as __hc_read_fd0}"));
 let io=js("print(⩚⌨);").unwrap();
 assert!(io.contains("import {readSync as __hc_read_fd0}"));
 assert!(io.contains("const __hc_arith ="));
 assert!(io.contains("HCODE_ERROR: "));
}
