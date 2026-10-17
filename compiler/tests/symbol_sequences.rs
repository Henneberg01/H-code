use hcode_compiler::{
    ast::{ExprKind,StmtKind},
    checker::{check,Type,TypedStmtKind},
    codegen::emit,
    lexer::{lex,TokenKind},
    packages::PackageRegistry,
    parser::parse
};
use std::process::Command;

fn compile(src:&str)->Result<String,String>{
    let ast=parse(src).map_err(|e|e.to_string())?;
    let reg=PackageRegistry::default();
    let typed=check(&ast,&reg,true).map_err(|e|e.to_string())?;
    emit(&typed,&reg)
}
fn run(src:&str)->Result<String,String>{
    let code=compile(src)?;
    let child=Command::new("node").args(["--input-type=module","--eval",&code]).output().map_err(|e|e.to_string())?;
    if !child.status.success(){return Err(String::from_utf8_lossy(&child.stderr).to_string());}
    Ok(String::from_utf8_lossy(&child.stdout).replace("\r\n","\n"))
}

#[test]
fn typed_sequences_have_real_lexer_tokens_and_canonical_ascii_ast(){
    let glyph="ƒ first(xs:⟦Number⟧) → Number ↩ xs⟦0⟧;print(first(⟦42⟧));";
    let ascii="fn first(xs:[[Number]]) -> Number return xs[[0]];print(first([[42]]));";
    assert_eq!(lex(glyph).unwrap().iter().map(|t|&t.kind).collect::<Vec<_>>(),
               lex(ascii).unwrap().iter().map(|t|&t.kind).collect::<Vec<_>>());
    assert_eq!(parse(glyph).unwrap(),parse(ascii).unwrap());
    assert_eq!(compile(glyph).unwrap(),compile(ascii).unwrap());
    assert_eq!(run(glyph).unwrap(),"42\n");
    let parsed=parse("≔ xs←⟦1,2⟧;").unwrap();
    assert!(matches!(&parsed.statements[0].kind,StmtKind::Let{value,..}
                     if matches!(&value.kind,ExprKind::Sequence(items) if items.len()==2)));
}
#[test]
fn rust_infers_recursive_type_safe_sequences_and_contextual_empty_lists(){
    let code="≔ xs←⟦1,2,3⟧;≔ ys←⟦⟦1⟧,⟦2⟧⟧;print(xs⟦0⟧);print(⌗ys);";
    let typed=check(&parse(code).unwrap(),&PackageRegistry::default(),true).unwrap();
    if let TypedStmtKind::Let{value,..}=&typed.statements[0].kind{
        assert_eq!(value.ty,Type::Sequence(Box::new(Type::Number)));
    }else{panic!("Expected sequence binding");}
    if let TypedStmtKind::Let{value,..}=&typed.statements[1].kind{
        assert_eq!(value.ty,Type::Sequence(Box::new(Type::Sequence(Box::new(Type::Number)))));
    }else{panic!("Expected nested sequence");}
    for src in [
        "≔ x:⟦Number⟧←⟦⟧;print(⌗x);",
        "ƒ empty() → ⟦Number⟧ ↩ ⟦⟧;print(⌗empty());",
        "fn empty() -> [[Number]] return [[]];print(#empty());"
    ]{assert_eq!(run(src).unwrap(),"0\n","{src}");}
}
#[test]
fn sequence_operations_work_in_compiled_node_js_and_do_not_mutate_inputs(){
    let examples=[
        ("≔ xs←⟦1,2,3⟧;print(xs⟦0⟧);print(⌗xs);","1\n3\n"),
        ("≔ xs←[[1,2,3]];print(xs[[0]]);print(#xs);","1\n3\n"),
        ("≔ xs←⟦1,2⟧;≔ ys←xs ⧺ ⟦3,4⟧;print(⌗xs);print(⌗ys);print(ys⟦3⟧);","2\n4\n4\n"),
        ("≔ xs←[[1,2]];≔ ys←xs ++ [[3,4]];print(#xs);print(ys[[3]]);","2\n4\n"),
        ("≔ xs←⟦⟦1,2⟧,⟦3,4⟧⟧;print(xs⟦1⟧⟦0⟧);","3\n"),
        ("ƒ twice(n) ↩ n*2;print(⟦20,21⟧⟦1⟧ ▷ twice);","42\n"),
        ("print(⊤ ◇ ⌗⟦1,2,3⟧ : 1/0);","3\n")
    ];
    for (src,expected) in examples {assert_eq!(run(src).unwrap(),expected,"{src}");}
}
#[test]
fn hcode_users_can_write_sum_map_and_filter_using_plain_symbolic_sequences(){
    let sum="ƒ sum(xs:⟦Number⟧) → Number {≔ i←0;≔ total←0;while(i<⌗xs){total←total+xs⟦i⟧;i←i+1;}↩ total;}print(sum(⟦2,3,5⟧));";
    assert_eq!(run(sum).unwrap(),"10\n");
    let map="ƒ twiceEach(xs:⟦Number⟧) → ⟦Number⟧ {≔ out:⟦Number⟧←⟦⟧;≔ i←0;while(i<⌗xs){out←out ⧺ ⟦xs⟦i⟧*2⟧;i←i+1;}↩ out;}≔ ys←twiceEach(⟦10,11⟧);print(ys⟦0⟧);print(ys⟦1⟧);";
    assert_eq!(run(map).unwrap(),"20\n22\n");
    let filter="ƒ positives(xs:⟦Number⟧) → ⟦Number⟧ {≔ out:⟦Number⟧←⟦⟧;≔ i←0;while(i<⌗xs){if(xs⟦i⟧>0){out←out ⧺ ⟦xs⟦i⟧⟧;}i←i+1;}↩ out;}≔ ys←positives(⟦-1,2,3,-2⟧);print(⌗ys);print(ys⟦0⟧);print(ys⟦1⟧);";
    assert_eq!(run(filter).unwrap(),"2\n2\n3\n");
}
#[test]
fn typechecker_rejects_mixed_elements_invalid_annotations_and_bad_indices(){
    let bad=[
        ("≔ xs←⟦1,\"bad\"⟧;","Sequence elements must have matching types"),
        ("≔ xs←⟦⟧;","Cannot infer"),
        ("print(⌗⟦⟧);","Cannot infer"),
        ("≔ xs:⟦Number⟧←⟦\"bad\"⟧;","Declaration type mismatch"),
        ("print(1⟦0⟧);","Sequence index requires sequence"),
        ("print(⌗42);","⌗ requires sequence"),
        ("print(⟦1⟧⟦\"0\"⟧);","Sequence index must be Number"),
        ("print(⟦1⟧⟦0.5⟧);","Sequence index must be an integer"),
        ("≔ xs←⟦1⟧ ⧺ ⟦\"x\"⟧;","⧺ operands must share element type"),
        ("≔ xs←1 ⧺ ⟦2⟧;","⧺ left operand must be sequence")
    ];
    for (src,needle) in bad {
        let err=compile(src).unwrap_err();
        assert!(err.contains(needle)&&err.contains("TYPE"),"{src}: {err}");
    }
}
#[test]
fn runtime_rejects_out_of_range_or_negative_dynamic_indices(){
    let bad=[
        "ƒ bad() → Number ↩ -1;print(⟦1⟧⟦bad()⟧);",
        "ƒ bad() → Number ↩ 1.5;print(⟦1⟧⟦bad()⟧);",
        "ƒ bad() → Number ↩ 100;print(⟦1⟧⟦bad()⟧);"
    ];
    for src in bad {
        let err=run(src).unwrap_err();
        assert!(err.contains("Sequence index out of bounds or not an integer"),"{src}: {err}");
    }
}
#[test]
fn lexer_and_parser_reject_malformed_or_unsafe_sequences(){
    assert!(parse("≔ xs←⟦1,2;").is_err());
    assert!(parse("print(⟦1,2⟧⟦⟧);").is_err());
    assert!(parse("≔ xs←⟦1,2,⟧;").is_err());
    assert!(lex("print(⟦1,\u{200b}2⟧);").is_err());
}
