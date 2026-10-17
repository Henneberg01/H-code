use hcode_compiler::{ast::{StmtKind},checker::check,codegen::emit,packages::PackageRegistry,parser::parse};
use std::process::Command;

fn generated(src:&str)->Result<String,String>{
    let p=parse(src).map_err(|e|e.to_string())?;
    let typed=check(&p,&PackageRegistry::default(),true).map_err(|e|e.to_string())?;
    emit(&typed,&PackageRegistry::default())
}
fn output(src:&str)->String{
    let js=generated(src).unwrap();
    let run=Command::new("node").args(["--input-type=module","--eval",&js]).output().unwrap();
    assert!(run.status.success(),"{}",String::from_utf8_lossy(&run.stderr));
    String::from_utf8_lossy(&run.stdout).replace("\r\n","\n")
}

#[test]
fn expression_functions_preserve_the_existing_one_return_ast_and_output(){
    let glyph="ƒ square(n: Number) → Number ↩ n*n; print(square(5));";
    let ascii="fn square(n: Number) -> Number return n*n; print(square(5));";
    let block="fn square(n: Number) -> Number { return n*n; } print(square(5));";
    for src in [glyph,ascii,block] {
        let p=parse(src).unwrap();
        match &p.statements[0].kind {
            StmtKind::Function{body,returns,parameters,..}=>{
                assert_eq!(body.len(),1);
                assert!(matches!(&body[0].kind,StmtKind::Return(_)));
                assert_eq!(returns.as_deref(),Some("Number"));
                assert_eq!(parameters.len(),1);
            },
            x=>panic!("Unexpected AST: {x:?}")
        }
        assert_eq!(output(src),"25\n");
    }
    assert_eq!(generated(glyph).unwrap(),generated(ascii).unwrap());
    assert_eq!(generated(glyph).unwrap(),generated(block).unwrap());
}

#[test]
fn short_form_infers_types_and_supports_export_and_recursion(){
    let code="ƒ double(n) ↩ n*2; print(double(21));";
    assert_eq!(output(code),"42\n");
    let export="export ƒ inc(n: Number) → Number ↩ n+1;";
    assert!(generated(export).is_ok());
    let recursion="ƒ fact(n: Number) → Number {if(n<=1){↩ 1;}↩ n*fact(n-1);} print(fact(5));";
    assert_eq!(output(recursion),"120\n");
}

#[test]
fn short_form_reports_parse_and_static_type_errors(){
    let bad_parse=[
        "ƒ f() ↩ 1", "ƒ f() → ↩ 1;", "ƒ f() 1;", "fn f(x) return ;"
    ];
    for code in bad_parse {assert!(parse(code).is_err(),"{code}");}
    let p=parse("ƒ f() → Number ↩ \"wrong\";").unwrap();
    let err=check(&p,&PackageRegistry::default(),true).unwrap_err().to_string();
    assert!(err.contains("Return type mismatch"),"{err}");
    assert!(parse("fn legacy(){return 1;}").is_ok());
}
