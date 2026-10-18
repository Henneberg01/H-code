use hcode_compiler::{ast::{BinaryOp,ExprKind,StmtKind},checker::check,codegen::emit,lexer::{lex,TokenKind},packages::PackageRegistry,parser::parse};
use std::process::Command;

fn compile(source:&str)->Result<String,String>{
 let ast=parse(source).map_err(|e|e.to_string())?;
 let typed=check(&ast,&PackageRegistry::default(),true).map_err(|e|e.to_string())?;
 emit(&typed,&PackageRegistry::default())
}
fn run(source:&str)->Result<String,String>{
 let code=compile(source)?;
 let result=Command::new("node").args(["--input-type=module","--eval",&code]).output().map_err(|e|e.to_string())?;
 if !result.status.success(){return Err(String::from_utf8_lossy(&result.stderr).to_string());}
 Ok(String::from_utf8_lossy(&result.stdout).replace("\r\n","\n"))
}

#[test]
fn glyph_and_accessible_alias_are_the_same_canonical_binary_operator(){
 let tokens=lex("twice ∘ inc;").unwrap();
 let ascii=lex("twice << inc;").unwrap();
 assert_eq!(tokens.iter().map(|t|&t.kind).collect::<Vec<_>>(),ascii.iter().map(|t|&t.kind).collect::<Vec<_>>());
 assert_eq!(tokens[1].kind,TokenKind::Compose);
 let source="ƒ twice(x) ↩ x*2; ƒ inc(x) ↩ x+1; print((twice ∘ inc)(20));";
 let ast=parse(source).unwrap();
 if let StmtKind::Expression(call)=&ast.statements[2].kind {
  if let ExprKind::Call{arguments,..}=&call.kind {
   assert!(matches!(&arguments[0].kind,ExprKind::Call{callee,..}
     if matches!(&callee.kind,ExprKind::Binary{op:BinaryOp::Compose,..})));
  } else {panic!("expected print call");}
 } else {panic!("expected expression");}
 let alternate="fn twice(x) return x*2; fn inc(x) return x+1; print((twice << inc)(20));";
 assert_eq!(compile(source).unwrap(),compile(alternate).unwrap());
}

#[test]
fn higher_order_composition_is_statically_checked_and_executable(){
 let sources=[
  ("ƒ twice(x) ↩ x*2; ƒ inc(x) ↩ x+1; print((twice ∘ inc)(20));","42\n"),
  ("ƒ twice(x) ↩ x*2; ƒ inc(x) ↩ x+1; print(20 ▷ (twice ∘ inc));","42\n"),
  ("fn twice(x) return x*2; fn inc(x) return x+1; print(20 |> (twice << inc));","42\n"),
  ("ƒ positive(x) ↩ x>0; ƒ invert(b) ↩ ¬b; print((invert ∘ positive)(-1));","true\n"),
  ("ƒ inc(x) ↩ x+1; ƒ twice(x) ↩ x*2; ≔ f ← twice ∘ inc; print(f(20));","42\n"),
  ("ƒ inc(x) ↩ x+1; ƒ double(x) ↩ x*2; ƒ minus(x) ↩ x-2; print((minus ∘ double ∘ inc)(20));","40\n")
 ];
 for (source,expected) in sources {assert_eq!(run(source).unwrap(),expected,"{source}");}
}

#[test]
fn composition_rejects_nonfunctions_multiarity_and_incompatible_types(){
 let errors=[
  ("≔ f ← 2 ∘ 3;","Composition"),
  ("ƒ add(a: Number,b: Number) ↩ a+b; ƒ inc(x) ↩ x+1; ≔ f ← inc ∘ add;","Composition"),
  ("ƒ twice(n: Number) → Number ↩ n*2; ƒ greet(x: String) → String ↩ x; ≔ f ← greet ∘ twice;","Composition"),
  ("ƒ twice(n: Number) → Number ↩ n*2; ƒ inc(x) ↩ x+1; print((twice ∘ inc)(\"wrong\"));","Call argument")
 ];
 for (source,expected) in errors {
  let result=compile(source);
  assert!(result.is_err(),"invalid composition must fail: {source}");
  let message=result.unwrap_err();
  assert!(message.contains(expected)&&message.contains("TYPE"),"{source}: {message}");
 }
}

#[test]
fn composition_rejects_invisible_unicode_and_missing_pipeline_target(){
 assert!(lex("print(3 ∘ \u{200b} inc);").is_err());
 assert!(parse("print(20 ▷ ());").is_err());
 assert!(parse("print((inc ∘)(20));").is_err());
}
