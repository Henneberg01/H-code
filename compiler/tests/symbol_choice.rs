use hcode_compiler::{ast::{ExprKind,StmtKind},checker::check,codegen::emit,lexer::{lex,TokenKind},packages::PackageRegistry,parser::parse};
use std::process::Command;

fn compile(source:&str)->Result<String,String>{
    let ast=parse(source).map_err(|e|e.to_string())?;
    let typed=check(&ast,&PackageRegistry::default(),true).map_err(|e|e.to_string())?;
    emit(&typed,&PackageRegistry::default())
}
fn run(source:&str)->Result<String,String>{
    let code=compile(source)?;
    let process=Command::new("node").args(["--input-type=module","--eval",&code]).output().map_err(|e|e.to_string())?;
    if !process.status.success(){return Err(String::from_utf8_lossy(&process.stderr).into());}
    Ok(String::from_utf8_lossy(&process.stdout).replace("\r\n","\n"))
}
#[test]
fn glyph_and_ascii_conditional_spellings_have_same_rust_tokens_and_compiled_meaning(){
    let a=lex("⊤ ◇ 1 : 2;").unwrap();
    let b=lex("true ? 1 : 2;").unwrap();
    assert_eq!(a.iter().map(|t|&t.kind).collect::<Vec<_>>(),b.iter().map(|t|&t.kind).collect::<Vec<_>>());
    assert_eq!(a[1].kind,TokenKind::Choice);
    let glyph="ƒ fib(n: Number) → Number ↩ n≤1 ◇ n : fib(n-1)+fib(n-2); print(fib(7));";
    let ascii="fn fib(n: Number) -> Number return n<=1 ? n : fib(n-1)+fib(n-2); print(fib(7));";
    let parsed=parse(glyph).unwrap();
    if let StmtKind::Function{body,..}=&parsed.statements[0].kind{
        if let StmtKind::Return(value)=&body[0].kind{
            assert!(matches!(&value.kind,ExprKind::Choice{..}));
        }else{panic!("Expected function return");}
    }else{panic!("Expected a function");}
    assert_eq!(compile(glyph).unwrap(),compile(ascii).unwrap());
    assert_eq!(run(glyph).unwrap(),"13\n");
}
#[test]
fn choice_replaces_braced_conditions_without_changing_recursive_outputs(){
    for (source,expected) in [
        ("ƒ fib(n) ↩ n≤1 ◇ n : fib(n-1)+fib(n-2); print(fib(7));","13\n"),
        ("ƒ fact(n) ↩ n≤1 ◇ 1 : n*fact(n-1); print(fact(5));","120\n"),
        ("ƒ sign(n) ↩ n<0 ◇ \"negative\" : \"nonnegative\"; print(sign(-5));","negative\n"),
        ("print(⊤ ◇ 42 : 1/0); print(⊥ ◇ 1/0 : 42);","42\n42\n"),
        ("print(⊥ ◇ 1 : ⊤ ◇ 2 : 3);","2\n"),
        ("ƒ twice(n) ↩ n*2; print(⊤ ◇ 21 ▷ twice : 0);","42\n"),
        ("ƒ inc(n) ↩ n+1; ƒ twice(n) ↩ n*2; print(⊤ ◇ (twice ∘ inc)(20) : 0);","42\n")
    ]{
        assert_eq!(run(source).unwrap(),expected,"{source}");
    }
}
#[test]
fn never_runs_unselected_branch_or_repeats_the_condition(){
    let source="ƒ condition() {print(\"condition\");↩ ⊤;} ƒ unused() {print(\"never\");↩ 0;} print(condition() ◇ 42 : unused());";
    assert_eq!(run(source).unwrap(),"condition\n42\n");
}
#[test]
fn invalid_conditions_and_incompatible_branch_types_are_static_errors(){
    for (source,needle) in [
        ("print(2 ◇ 3 : 4);","Choice condition must be Bool"),
        ("print(⊤ ◇ 1 : \"bad\");","Choice branches must have matching types"),
        ("ƒ f(n: Number) → Number ↩ ⊤ ◇ n : \"bad\";","Choice branches must have matching types")
    ]{
        let err=compile(source).unwrap_err();
        assert!(err.contains("TYPE") && err.contains(needle),"{source}: {err}");
        assert!(err.contains("1:"),"{err}");
    }
}
#[test]
fn malformed_choice_and_control_characters_are_rejected(){
    for source in ["print(⊤ ◇ 1);","print(⊤ ◇ : 4);","print(⊤ ◇ 1 :);"]{
        assert!(parse(source).is_err(),"{source}");
    }
    assert!(lex("print(⊤ ◇ 1 : \u{200b} 2);").is_err());
}
