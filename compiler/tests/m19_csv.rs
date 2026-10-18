// Native CSV and file effect conformance on both Windows and Linux.
use hcode_compiler::{checker::{check,Type,TypedExprKind,TypedStmtKind},
 parser::parse,packages::PackageRegistry,codegen::emit,lexer::{lex,TokenKind}};
use std::{path::Path,process::Command};
fn compile(src:&str)->Result<String,String>{
 let parsed=parse(src).map_err(|e|e.to_string())?;
 let checked=check(&parsed,&PackageRegistry::default(),true).map_err(|e|e.to_string())?;
 emit(&checked,&PackageRegistry::default())
}
fn run(src:&str,allowed:bool)->Result<String,String>{
 let js=compile(src)?;
 let unique=std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_nanos();
 let file=std::env::temp_dir().join(format!("hcode_csv_{}_{}.mjs",std::process::id(),unique));
 std::fs::write(&file,js).map_err(|e|e.to_string())?;
 let project=Path::new(env!("CARGO_MANIFEST_DIR")).parent().unwrap();
 let result=Command::new("node").current_dir(project).arg(&file)
   .env("HCODE_ALLOW_FILE_READ",if allowed{"1"}else{"0"}).output();
 let _=std::fs::remove_file(&file);
 let child=result.map_err(|e|e.to_string())?;
 if !child.status.success(){return Err(String::from_utf8_lossy(&child.stderr).into());}
 Ok(String::from_utf8_lossy(&child.stdout).replace("\r\n","\n"))
}
#[test]
fn csv_symbols_and_aliases_share_exact_ast_and_output(){
 assert_eq!(lex("⧄").unwrap()[0].kind,TokenKind::FileRead);
 assert_eq!(lex("⧇").unwrap()[0].kind,TokenKind::CsvTyped);
 let schema="⦃active:Bool,age:Number,name:String,note:String⦄";
 let g=format!("print(⤒(⧇{schema}(⧄\"canonical04/users.csv\")));" );
 let a=format!("print(json_out(csv_typed{schema}(file_read\"canonical04/users.csv\")));" );
 assert_eq!(compile(&g).unwrap(),compile(&a).unwrap());
 assert_eq!(run(&g,true).unwrap(),run(&a,true).unwrap());
}
#[test]
fn csv_results_have_real_structural_record_types(){
 let src="≔xs←⧇⦃active:Bool,age:Number,name:String,note:String⦄(⧄\"canonical04/users.csv\");";
 let ast=parse(src).unwrap();
 let checked=check(&ast,&PackageRegistry::default(),true).unwrap();
 let TypedStmtKind::Let{value,..}=&checked.statements[0].kind else {panic!("Expected binding")};
 let expected=Type::Sequence(Box::new(Type::Record(vec![
  ("active".into(),Type::Bool),("age".into(),Type::Number),
  ("name".into(),Type::String),("note".into(),Type::String)
 ])));
 assert_eq!(value.ty,expected);
 assert!(matches!(value.kind,TypedExprKind::CsvTyped{..}));
 let output=run("print(⤒(⧇⦃active:Bool,age:Number,name:String,note:String⦄(⧄\"canonical04/users.csv\")));",true).unwrap();
 assert!(output.contains("Ada, Lovelace"));
 assert!(output.contains("東京"));
 assert!(output.contains("Turing \\\"Alan\\\""));
}
#[test]
fn malformed_csv_files_fail_before_producing_success(){
 let pre="ƒ users(path:String)→String ↩ ⤒(⧇⦃active:Bool,age:Number,name:String,note:String⦄(⧄path));\n";
 for name in ["bad-quote.csv","bad-number.csv","bad-bool.csv",
   "bad-header.csv","bad-row.csv","bad-empty.csv"]{
  let source=format!("{pre}print(users(\"canonical04/{name}\"));");
  let err=run(&source,true).unwrap_err();
  assert!(err.contains("CSV"),"{name}: {err}");
 }
}
#[test]
fn checker_rejects_illegal_file_or_csv_types(){
 for src in [
  "print(⧄42);",
  "print(⧇⦃age:Number⦄42);",
  "print(⧇⟦Number⟧\"x\");",
  "print(⧇⦃x:Unit⦄\"x\");",
  "print(⧇⦃x:Bool,x:String⦄\"x\");"
 ]{assert!(compile(src).is_err(),"Compiled invalid CSV: {src}");}
}
#[test]
fn host_file_effect_is_disabled_by_default_and_blocks_unsafe_paths(){
 let script="print(⧄\"canonical04/users.csv\");";
 assert!(run(script,false).unwrap_err().contains("capability denied"));
 for name in ["../secret.csv","/etc/passwd","CON.txt"]{
   let source=format!("print(⧄{});",serde_json::to_string(name).unwrap());
   assert!(run(&source,true).is_err(),"Unsafe path allowed: {name}");
 }
}
#[test]
fn unrelated_code_never_links_csv_or_node_file_runtime(){
 let no=compile("print(42);").unwrap();
 assert!(!no.contains("node:fs"));
 assert!(!no.contains("function __hc_csv_typed"));
 let pure=compile("print(⤒(⧇⦃age:Number⦄\"age\\n10\"));").unwrap();
 assert!(!pure.contains("node:fs"));
 assert!(pure.contains("function __hc_csv_typed"));
 let effect=compile("print(⧄\"canonical04/users.csv\");").unwrap();
 assert!(effect.contains("node:fs"));
}
