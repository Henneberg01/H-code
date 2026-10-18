use hcode_compiler::{
    ast::ExprKind,
    checker::check,
    codegen::emit,
    lexer::{lex,TokenKind},
    packages::PackageRegistry,
    parser::parse,
};
use std::process::Command;

fn compile(src:&str)->Result<String,String>{
    let tree=parse(src).map_err(|e|e.to_string())?;
    let registry=PackageRegistry::default();
    let typed=check(&tree,&registry,true).map_err(|e|e.to_string())?;
    emit(&typed,&registry)
}
fn run(src:&str)->Result<String,String>{
    let code=compile(src)?;
    let output=Command::new("node").args(["--input-type=module","--eval",&code])
       .output().map_err(|e|e.to_string())?;
    if !output.status.success(){return Err(String::from_utf8_lossy(&output.stderr).into());}
    Ok(String::from_utf8_lossy(&output.stdout).replace("\r\n","\n"))
}

#[test]
fn json_arrows_are_native_canonical_syntax_with_accessible_ascii_aliases(){
    assert_eq!(lex("⤓").unwrap()[0].kind,TokenKind::JsonRead);
    assert_eq!(lex("json_in").unwrap()[0].kind,TokenKind::JsonRead);
    assert_eq!(lex("⤒").unwrap()[0].kind,TokenKind::JsonWrite);
    assert_eq!(lex("json_out").unwrap()[0].kind,TokenKind::JsonWrite);
    let unicode=r#"≔raw←"{\"name\":\"Ada\",\"age\":42}";≔p←⤓⦃name:String,age:Number⦄raw;print(p·name);print(⤒p);"#;
    let ascii=r#"let raw="{\"name\":\"Ada\",\"age\":42}";let p=json_in{name:String,age:Number}raw;print(p.name);print(json_out p);"#;
    assert_eq!(compile(unicode).unwrap(),compile(ascii).unwrap());
    assert_eq!(run(unicode).unwrap(),"Ada\n{\"age\":42,\"name\":\"Ada\"}\n");
    assert_eq!(run(ascii).unwrap(),"Ada\n{\"age\":42,\"name\":\"Ada\"}\n");
    let ast=parse(r#"≔p←⤓Number "42";"#).unwrap();
    assert!(matches!(&ast.statements[0].kind,hcode_compiler::ast::StmtKind::Let{value,..}
        if matches!(&value.kind,ExprKind::JsonRead{..})));
}

#[test]
fn json_records_arrays_and_nested_types_are_executable_in_compiled_js(){
    let cases=[
        (r#"≔s←"[{\"v\":2},{\"v\":3}]";≔xs←⤓⟦⦃v:Number⦄⟧s;print(xs⟦1⟧·v);print(⤒xs);"#,
         "3\n[{\"v\":2},{\"v\":3}]\n"),
        (r#"≔s←"{\"ok\":true,\"parts\":[{\"x\":\"a\"}]}";≔p←⤓⦃parts:⟦⦃x:String⦄⟧,ok:Bool⦄s;print(p·ok);print(p·parts⟦0⟧·x);print(⤒p);"#,
         "true\na\n{\"ok\":true,\"parts\":[{\"x\":\"a\"}]}\n"),
        (r#"≔p←⦃name:"Ada",age:42⦄;print(⤒p);"#,
         "{\"age\":42,\"name\":\"Ada\"}\n"),
        (r#"print(⤓Number "42");print(⤓Bool "true");print(⤓String "\"hello\"");"#,
         "42\ntrue\nhello\n"),
        (r#"≔p←⤓⦃age:Number⦄"{\"age\":42}";≔q←p⊞age:p·age+1;print(⤒q);print(⤒p);"#,
         "{\"age\":43}\n{\"age\":42}\n"),
        (r#"≔p←⤓⦃__proto__:Number,constructor:String⦄"{\"__proto__\":2,\"constructor\":\"good\"}";print(p·__proto__);print(p·constructor);"#,
         "2\ngood\n"),
        (r#"≔p←⤓⦃⦄"{}";print(⤒p);≔xs:⟦Number⟧←⟦⟧;print(⤒xs);"#,
         "{}\n[]\n"),
    ];
    for(const (src,expected) of cases {
        assert_eq!(run(src).unwrap(),expected,"{src}");
    }
}

#[test]
fn compiler_rejects_invalid_json_schemas_non_string_input_and_unsafe_serialization(){
    let cases=[
        (r#"print(⤓Number 42);"#,"⤓ expects JSON text of type String"),
        (r#"print(⤓Unit "null");"#,"⤓ schema must be a concrete"),
        (r#"print(⤓T "42");"#,"Unknown type T"),
        (r#"print(⤒print(1));"#,"⤒ expects statically typed JSON-compatible"),
        (r#"≔f←λx:x+1;print(⤒f);"#,"⤒ expects statically typed JSON-compatible"),
        (r#"ƒ f()→String ↩ ⤓⦃a:Number⦄"{\"a\":42}";"#,"Return type mismatch"),
    ];
    for(const (src,expected) of cases {
        let err=compile(src).unwrap_err();
        assert!(err.contains(expected),"{src}: {err}");
    }
}

#[test]
fn runtime_json_validation_is_recursive_exact_and_fails_closed(){
    let cases=[
        (r#"print(⤓⦃age:Number⦄"{\"age\":\"wrong\"}");"#,"JSON Number type mismatch"),
        (r#"print(⤓⦃age:Number⦄"{\"age\":42,\"extra\":1}");"#,"JSON Record shape mismatch"),
        (r#"print(⤓⦃age:Number⦄"{\"name\":\"Ada\"}");"#,"JSON Record missing field"),
        (r#"print(⤓⟦Number⟧"[1,\"bad\"]");"#,"JSON Number type mismatch"),
        (r#"print(⤓Number "null");"#,"JSON Number type mismatch"),
        (r#"print(⤓Number "1e309");"#,"JSON Number type mismatch"),
        (r#"print(⤓Number "{bad}");"#,"Invalid JSON text"),
        (r#"print(⤓⦃data:⟦Number⟧⦄"{\"data\":[1,\"bad\"]}");"#,"JSON Number type mismatch"),
    ];
    for(const (src,expected) of cases {
        let err=run(src).unwrap_err();
        assert!(err.contains(expected),"{src}: {err}");
    }
    // A concrete schema deeper than the allowed JSON recursion budget is rejected
    // by the Rust typechecker before data parsing or JavaScript code generation.
    let mut schema="Number".to_string();
    for _ in 0..34 {schema=format!("⟦{schema}⟧");}
    let src=format!("print(⤓{schema} \"1\");");
    let err=compile(&src).unwrap_err();
    assert!(err.contains("⤓ schema must be a concrete"),"{err}");
}
