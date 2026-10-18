use hcode_compiler::{
    lexer::{lex,TokenKind},
    parser::parse,
    packages::PackageRegistry,
    checker::check,
    codegen::emit
};
use std::process::Command;

fn compile(source:&str)->Result<String,String>{
    let ast=parse(source).map_err(|e|e.to_string())?;
    let registry=PackageRegistry::default();
    let checked=check(&ast,&registry,true).map_err(|e|e.to_string())?;
    emit(&checked,&registry)
}
fn run(source:&str)->Result<String,String>{
    let js=compile(source)?;
    let child=Command::new("node").args(["--input-type=module","--eval",&js]).output().map_err(|e|e.to_string())?;
    if !child.status.success(){return Err(String::from_utf8_lossy(&child.stderr).into());}
    Ok(String::from_utf8_lossy(&child.stdout).replace("\r\n","\n"))
}
#[test]
fn sign_and_ascii_lambda_have_equivalent_static_type_inference_and_generated_js(){
    let sign="print((λx:x+1)(41));";
    let ascii="print((lambda x:x+1)(41));";
    assert_eq!(lex("λ").unwrap()[0].kind,TokenKind::Lambda);
    assert_eq!(lex("lambda").unwrap()[0].kind,TokenKind::Lambda);
    assert_eq!(compile(sign).unwrap(),compile(ascii).unwrap());
    assert_eq!(run(sign).unwrap(),"42\n");
}
#[test]
fn compiled_lambda_map_filter_are_real_general_purpose_functions(){
    for (source,expected) in [
        ("≔y←⟦10,11⟧⇢λx:x*2;print(y⟦0⟧);print(y⟦1⟧);","20\n22\n"),
        ("≔y←⟦-1,2,3,-2⟧⌕λx:x>0;print(⌗y);print(y⟦0⟧);print(y⟦1⟧);","2\n2\n3\n"),
        ("print(∑(⟦-1,2,3,-2⟧⌕(λx:x>0)⇢(λx:x*2)));","10\n"),
        ("≔f←λx:x*2;print(f(21));","42\n"),
        ("≔n←4;≔f←λx:x+n;print(f(5));n←10;print(f(5));","9\n15\n"),
        ("≔add←λx:λy:x+y;print(add(2)(3));","5\n")
    ]{
        assert_eq!(run(source).unwrap(),expected,"{source}");
    }
}
#[test]
fn actual_static_checker_rejects_ill_typed_lambda_callbacks(){
    for (src,reason) in [
        ("≔y←⟦1,2⟧⌕λx:x*2;","⌕ predicate must be unary and return Bool"),
        ("≔y←⟦1,2⟧⇢λx:x+\"bad\";","⇢ transformer must be unary"),
        ("print((λx:x*2)(\"bad\"));","Call argument types or arity mismatch"),
        ("≔f←λx:x;","Cannot infer type"),
        ("print((λx:x+1)(1,2));","Call argument types or arity mismatch")
    ]{
        let error=compile(src).unwrap_err();
        assert!(error.contains(reason),"{src}: {error}");
    }
}
#[test]
fn lambda_recognizes_invisible_unicode_as_invalid_input(){
    assert!(lex("print((λx:x+\u{200b}1)(2));").is_err());
}
