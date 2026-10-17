use hcode_compiler::{ast::{ExprKind,StmtKind},checker::check,codegen::emit,lexer::lex,packages::{load_lockfile,PackageRegistry},parser::parse};
use std::{path::Path,process::Command};

fn root()->std::path::PathBuf{Path::new(env!("CARGO_MANIFEST_DIR")).parent().unwrap().to_path_buf()}
fn compile(source:&str,registry:&PackageRegistry)->Result<String,String>{
    let ast=parse(source).map_err(|e|e.to_string())?;
    let typed=check(&ast,registry,true).map_err(|e|e.to_string())?;
    emit(&typed,registry)
}
fn output(source:&str,registry:&PackageRegistry)->Result<String,String>{
    let js=compile(source,registry)?;
    let run=Command::new("node").args(["--input-type=module","--eval",&js]).output().map_err(|e|e.to_string())?;
    if !run.status.success(){return Err(String::from_utf8_lossy(&run.stderr).into());}
    Ok(String::from_utf8_lossy(&run.stdout).replace("\r\n","\n"))
}
fn bare()->PackageRegistry{PackageRegistry::default()}

#[test]
fn rust_pipeline_lexer_and_parser_lower_to_existing_checked_calls(){
    let glyph=parse("ƒ double(x) ↩ x*2; print(21 ▷ double);").unwrap();
    let ascii=parse("fn double(x) return x*2; print(21 |> double);").unwrap();
    assert_eq!(glyph.statements.len(),ascii.statements.len());
    assert_eq!(lex("1 ▷ f;").unwrap()[1].kind,lex("1 |> f;").unwrap()[1].kind);
    if let StmtKind::Expression(print)=&glyph.statements[1].kind {
        if let ExprKind::Call{arguments,..}=&print.kind{
            assert!(matches!(&arguments[0].kind,ExprKind::Call{..}));
        } else {panic!("Expected print call")}
    } else {panic!("Expected expression")}
    assert_eq!(compile("ƒ double(x) ↩ x*2; print(21 ▷ double);",&bare()).unwrap(),
               compile("fn double(x) {return x*2;} print(double(21));",&bare()).unwrap());
}

#[test]
fn rust_typed_pipelines_produce_equivalent_executable_js(){
    let samples=[
        "ƒ double(x) ↩ x*2; print(21 ▷ double);",
        "fn double(x) return x*2; print(21 |> double);",
        "ƒ double(x) ↩ x*2; print(1+20 ▷ double);",
        "ƒ inc(x) ↩ x+1; ƒ double(x) ↩ x*2; print(20 |> inc |> double);",
        "ƒ double(x) ↩ x*2; print((1 ▷ double)+40);"
    ];
    for source in samples {assert_eq!(output(source,&bare()).unwrap(),"42\n","{source}");}
    assert_eq!(output("ƒ add(a: Number,b: Number) → Number ↩ a+b; print(20 ▷ add(22));",&bare()).unwrap(),"42\n");
    let reg=load_lockfile(&root().join("hcode.lock.json")).unwrap();
    let glyph="use \"demo.math@1.0.0\" as math; print(20 ▷ math∷⊕(22));";
    let ascii="use \"demo.math@1.0.0\" as math; print(20 |> math::add(22));";
    assert_eq!(output(glyph,&reg).unwrap(),"42\n");
    assert_eq!(compile(glyph,&reg).unwrap(),compile(ascii,&reg).unwrap());
}

#[test]
fn pipeline_left_expression_executes_once_even_when_chained(){
    let source="ƒ next() → Number {print(1);↩ 21;} ƒ twice(x) ↩ x*2; print(next() ▷ twice);";
    assert_eq!(output(source,&bare()).unwrap(),"1\n42\n");
    let chain="ƒ next() → Number {print(1);↩ 20;} ƒ inc(x) ↩ x+1; ƒ twice(x) ↩ x*2; print(next() ▷ inc ▷ twice);";
    assert_eq!(output(chain,&bare()).unwrap(),"1\n42\n");
}

#[test]
fn malformed_pipelines_fail_with_source_locations(){
    for source in ["print(1 ▷ 2);","print(1 ▷ (f));","print(1 ▷ f + 2);","print(1 ▷ f and true);","print(1 |>);"] {
        let err=parse(source).unwrap_err().to_string();
        assert!(err.contains("PARSE") && err.contains("1:"),"{source}: {err}");
    }
    assert!(parse("print(1 | > f);").is_err());
    assert!(parse("ƒ f(n) ↩ n*2; print((1 ▷ f)+2);").is_ok());
}

#[test]
fn statically_rejects_non_callable_target_and_type_or_arity_mismatch(){
    for source in [
        "≔ f ← 2; print(1 ▷ f);",
        "ƒ add(a: Number,b: Number) → Number ↩ a+b; print(1 ▷ add(2,3));",
        "ƒ f(x: String) → String ↩ x; print(1 ▷ f);"
    ]{
        let err=compile(source,&bare()).unwrap_err();
        assert!(err.contains("TYPE") && err.contains("Call argument types or arity mismatch"),"{source}: {err}");
        assert!(err.contains("1:"),"{err}");
    }
}
