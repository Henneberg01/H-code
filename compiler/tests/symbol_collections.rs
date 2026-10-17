use hcode_compiler::{
    ast::{ExprKind,StmtKind},
    checker::check,
    codegen::emit,
    lexer::{lex,TokenKind},
    packages::PackageRegistry,
    parser::parse
};
use std::process::Command;

fn compile(src:&str)->Result<String,String>{
    let ast=parse(src).map_err(|e|e.to_string())?;
    let registry=PackageRegistry::default();
    let checked=check(&ast,&registry,true).map_err(|e|e.to_string())?;
    emit(&checked,&registry)
}
fn run(src:&str)->Result<String,String>{
    let js=compile(src)?;
    let result=Command::new("node").args(["--input-type=module","--eval",&js]).output().map_err(|e|e.to_string())?;
    if !result.status.success() {return Err(String::from_utf8_lossy(&result.stderr).into());}
    Ok(String::from_utf8_lossy(&result.stdout).replace("\r\n","\n"))
}

#[test]
fn canonical_sum_filter_map_are_real_ast_tokens_and_emit_identical_js(){
    for (sign,ascii) in [
        ("∑","@+"),("⌕","@?"),("⇢","@>")
    ]{
        let left=lex(sign).unwrap();
        let right=lex(ascii).unwrap();
        assert_eq!(left[0].kind,right[0].kind);
    }
    assert!(matches!(lex("∑")[0].kind,TokenKind::Sum));
    assert!(matches!(lex("⌕")[0].kind,TokenKind::Filter));
    assert!(matches!(lex("⇢")[0].kind,TokenKind::Map));
    let unicode="ƒ twice(n)↩n*2;print(∑(⟦2,3⟧⇢twice));";
    let fallback="fn twice(n) return n*2;print(@+([[2,3]] @> twice));";
    assert_eq!(compile(unicode).unwrap(),compile(fallback).unwrap());
    let program=parse("print(∑⟦2,3,5⟧);").unwrap();
    if let StmtKind::Expression(call)=&program.statements[0].kind{
        if let ExprKind::Call{arguments,..}=&call.kind{
            assert!(matches!(&arguments[0].kind,ExprKind::Sum(_)));
        }else{panic!("expected print Call");}
    }else{panic!("expected expression statement");}
}

#[test]
fn rust_typechecks_and_emits_executable_numeric_sum_and_generic_collections(){
    let cases=[
        ("print(∑⟦2,3,5⟧);","10\n"),
        ("print(@+[[2,3,5]]);","10\n"),
        ("print(∑⟦⟧);","0\n"),
        ("ƒ twice(n)↩n*2;≔y←⟦10,11⟧⇢twice;print(y⟦0⟧);print(y⟦1⟧);","20\n22\n"),
        ("ƒ positive(n)↩n>0;≔y←⟦-1,2,3,-2⟧⌕positive;print(⌗y);print(y⟦0⟧);print(y⟦1⟧);","2\n2\n3\n"),
        ("ƒ positive(n)↩n>0;ƒ twice(n)↩n*2;print(∑(⟦-1,2,3,-2⟧⌕positive⇢twice));","10\n"),
        ("ƒ tag(n: Number)→String ↩ \"x\";≔y←⟦1,2⟧⇢tag;print(y⟦0⟧);","x\n"),
        ("ƒ twice(n)↩n*2;print((⟦1,2⟧⇢twice)⟦1⟧);","4\n")
    ];
    for (source,expected) in cases{
        assert_eq!(run(source).unwrap(),expected,"{source}");
    }
}

#[test]
fn rejected_contracts_report_static_type_errors_with_locations(){
    for (source,reason) in [
        ("print(∑⟦\"bad\"⟧);","∑ requires a numeric sequence"),
        ("print(∑42);","∑ requires a numeric sequence"),
        ("print(42⌕p);","Unknown identifier p"),
        ("print(⟦1⟧⌕42);","⌕ predicate must be unary and return Bool"),
        ("ƒ twice(n: Number)→Number ↩ n*2;print(⟦1⟧⌕twice);","⌕ predicate must be unary and return Bool"),
        ("ƒ bad(a: Number,b: Number)→Bool ↩ ⊤;print(⟦1⟧⌕bad);","⌕ predicate must be unary and return Bool"),
        ("print(⟦1⟧⇢42);","⇢ transformer must be unary"),
        ("ƒ bad(a: Number,b: Number)→Number ↩ a+b;print(⟦1⟧⇢bad);","⇢ transformer must be unary"),
        ("ƒ bad(n: String)→String ↩ n;print(⟦1⟧⇢bad);","⇢ transformer must be unary")
    ]{
        let err=compile(source).unwrap_err();
        assert!(err.contains(reason),"{source}: {err}");
        assert!(err.contains("1:"),"{source}: {err}");
    }
}
#[test]
fn filters_are_stable_and_callbacks_execute_once_per_value(){
    let src="ƒ pred(n) {print(n);↩n>0;}≔out←⟦-1,2,3⟧⌕pred;print(⌗out);";
    assert_eq!(run(src).unwrap(),"-1\n2\n3\n2\n");
    let src="ƒ times(n) {print(n);↩n*2;}≔out←⟦1,2⟧⇢times;print(out⟦1⟧);";
    assert_eq!(run(src).unwrap(),"1\n2\n4\n");
}
#[test]
fn rejects_invisible_unicode_in_new_sign_expressions(){
    assert!(lex("print(∑⟦1,\u{200b}2⟧);").is_err());
}

#[test]
fn all_three_exact_sha_locked_m13_hcode_sources_compile_and_execute(){
    let root=std::path::Path::new(env!("CARGO_MANIFEST_DIR")).parent().unwrap();
    for (id,expected) in [
        ("sum-typed-sequence","10\n"),
        ("map-typed-sequence","20\n22\n"),
        ("filter-typed-sequence","2\n2\n3\n")
    ]{
        let file=root.join(format!("compact/benchmarks/m13/{id}.hc"));
        let source=std::fs::read_to_string(&file).unwrap();
        assert_eq!(run(&source).unwrap(),expected,"M13 corpus {id}");
    }
}
