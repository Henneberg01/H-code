use hcode_compiler::{
    lexer::{lex,TokenKind},parser::parse,checker::check,codegen::emit,
    packages::PackageRegistry
};
use std::process::Command;

fn compile(source:&str)->Result<String,String>{
    let ast=parse(source).map_err(|e|e.to_string())?;
    let registry=PackageRegistry::default();
    let checked=check(&ast,&registry,true).map_err(|e|e.to_string())?;
    emit(&checked,&registry)
}
fn output(source:&str)->Result<String,String>{
    let js=compile(source)?;
    let result=Command::new("node").args(["--input-type=module","--eval",&js])
        .output().map_err(|e|e.to_string())?;
    if !result.status.success(){return Err(String::from_utf8_lossy(&result.stderr).into());}
    Ok(String::from_utf8_lossy(&result.stdout).replace("\r\n","\n"))
}

#[test]
fn m15_symbols_lex_as_exact_same_tokens_as_accessibility_aliases(){
    for (glyph,alias,kind) in [
        ("⊢","if",TokenKind::If),
        ("⊣","else",TokenKind::Else),
        ("⟳","while",TokenKind::While),
        ("⇒","=>",TokenKind::Then)
    ]{
        assert_eq!(lex(glyph).unwrap()[0].kind,kind);
        assert_eq!(lex(alias).unwrap()[0].kind,kind);
    }
    for text in ["print(⊢\u{200b}(⊤)⇒print(1));","⊢(⊤)\u{202e}⇒print(1)"]{
        assert!(lex(text).is_err(),"Invisible/RTL spoofing must not be allowed");
    }
}
#[test]
fn sign_only_short_blocks_lower_to_the_existing_control_flow_ast_and_js(){
    let cases=[
        ("⊢(⊤)⇒print(1)⊣⇒print(2)","1\n"),
        ("⊢(⊥)⇒print(1)⊣⇒print(2)","2\n"),
        ("if(false)=>print(1)\nelse=>print(2)","2\n"),
        ("≔n←0⟳(n<3)⇒n←n+1\nprint(n)","3\n"),
        ("≔n←0\n⟳(n<3){n←n+1}\nprint(n)","3\n"),
        ("≔x←1\n⊢(⊤)⇒≔x←2\nprint(x)","1\n"),
        ("ƒabs(n){⊢(n<0)⇒↩-n\n↩n}\nprint(abs(-5))","5\n"),
        ("⊢(⊤)⇒⊢(⊥)⇒print(1)⊣⇒print(2)","2\n"),
        ("≔x←2+\n3\nprint(x)","5\n"),
        ("≔x←2\n+3\nprint(x)","5\n"),
        ("≔y←⟦10,11⟧⇢(*2)\nprint(y⟦0⟧)\nprint(y⟦1⟧)","20\n22\n")
    ];
    for (source,expected) in cases {
        assert_eq!(output(source).unwrap(),expected,"M15: {source}");
    }
}
#[test]
fn compressed_sign_program_emits_exactly_same_js_as_original_braced_program(){
    let glyph="≔n←0⟳(n<3)⇒n←n+1⊢(n≡3)⇒print(n)⊣⇒print(0)";
    let verbose="let n=0;while(n<3){n=n+1;}if(n==3){print(n);}else{print(0);}";
    assert_eq!(compile(glyph).unwrap(),compile(verbose).unwrap());
    assert_eq!(output(glyph).unwrap(),"3\n");
}
#[test]
fn semicolon_elision_is_not_arbitrary_and_parse_errors_remain_located(){
    for source in [
        "print(1)print(2)", "≔x←1 x←2", "⊢(⊤)⇒", "⟳(⊤)⇒",
        "⊣⇒print(1)", "⊢(⊤)⇒print(1)⊣print(2)", "⊢(⊤)print(1)",
        "⊢(⊤)⇒print(1) print(2)", "≔x←1\n*"
    ] {
        let e=parse(source).unwrap_err().to_string();
        let expected_line=if source.contains('\n'){ "2:" } else { "1:" };
        assert!(e.contains("PARSE")&&e.contains(expected_line),"{source}: {e}");
    }
}
#[test]
fn bad_condition_types_are_compile_time_errors_not_js_truthiness(){
    for source in ["⊢(1)⇒print(1)","⟳(1)⇒print(1)"]{
        let e=compile(source).unwrap_err();
        assert!(e.contains("TYPE"),"{source}: {e}");
    }
}

#[test]
fn all_eight_original_m10_tasks_compile_and_run_with_frozen_m15_sign_sources(){
    let root=std::path::Path::new(env!("CARGO_MANIFEST_DIR")).parent().unwrap();
    for (name,expected) in [
        ("typed-function","42\n"),("chained-functions","42\n"),
        ("recursive-fibonacci","13\n"),("counter-loop","0\n1\n2\n3\n"),
        ("string-greeting","Hi world\n"),("boolean-check","true\n"),
        ("recursive-factorial","120\n"),("conditional-branch","negative\n")
    ]{
        let path=root.join(format!("compact/benchmarks/m15/{name}.hc"));
        let source=std::fs::read_to_string(&path).unwrap();
        assert_eq!(output(&source).unwrap(),expected,"m15 {name}");
    }
}
