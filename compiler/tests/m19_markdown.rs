use hcode_compiler::{lexer::lex,parser::parse,checker::check,codegen::emit,packages::PackageRegistry};
use std::process::Command;
fn compile(source:&str)->Result<String,String>{
 let ast=parse(source).map_err(|e|e.to_string())?;
 let packages=PackageRegistry::default();
 let program=check(&ast,&packages,true).map_err(|e|e.to_string())?;
 emit(&program,&packages)
}
#[test]
fn markdown_sign_and_ascii_alias_are_real_identical_pure_typed_operations(){
 assert_eq!(lex("≋").unwrap()[0].kind,lex("markdown_tokens").unwrap()[0].kind);
 let a=compile("print(⤒(≋\"# Hello\"));").unwrap();
 let b=compile("print(⤒(markdown_tokens(\"# Hello\")));").unwrap();
 assert_eq!(a,b);
 assert!(a.contains("__hc_md_tokens"));
 assert!(a.contains("Markdown token limit exceeded"));
 assert!(!compile("print(1);").unwrap().contains("__hc_md_tokens"));
 let run=Command::new("node").arg("--input-type=module").arg("--eval").arg(a).output().unwrap();
 assert!(run.status.success(),"{}",String::from_utf8_lossy(&run.stderr));
 assert_eq!(String::from_utf8_lossy(&run.stdout),"[{\"href\":\"\",\"kind\":\"heading\",\"level\":1,\"text\":\"Hello\"}]\n");
}
#[test]
fn markdown_has_strict_string_input_and_statically_known_token_fields(){
 for (source,message) in [
   ("≋3;","≋ expects Markdown String input"),
   ("≋⊤;","≋ expects Markdown String input"),
   ("≋⟦\"a\"⟧;","≋ expects Markdown String input"),
   ("≋⦃a:1⦄;","≋ expects Markdown String input"),
   ("≔p←≋\"# T\";print(p⟦0⟧·invalid);","Unknown record field invalid")
 ]{
  let error=compile(source).unwrap_err();
  assert!(error.contains(message),"{source}: {error}");
 }
 assert!(compile("≔p←≋\"# T\";print(p⟦0⟧·kind);").is_ok());
}
