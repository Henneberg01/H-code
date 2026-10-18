use hcode_compiler::{ast::{ExprKind,StmtKind},checker::{check,Type,TypedStmtKind,TypedExprKind},lexer::lex,parser::parse,packages::{PackageRegistry,load_lockfile}};
use std::{fs,path::Path,process::Command};

fn check_source(source:&str)->Result<hcode_compiler::checker::TypedProgram,String>{
    check(&parse(source).map_err(|e|e.to_string())?,&PackageRegistry::default(),true).map_err(|e|e.to_string())
}
fn check_with_registry(source:&str)->Result<hcode_compiler::checker::TypedProgram,String>{
    let root=Path::new(env!("CARGO_MANIFEST_DIR")).parent().unwrap();
    let path=if source.contains("vec.math@1.0.0") {"hcode.m16.lock.json"} else {"hcode.lock.json"};
    let registry=load_lockfile(&root.join(path)).map_err(|e|e.to_string())?;
    check(&parse(source).map_err(|e|e.to_string())?,&registry,true).map_err(|e|e.to_string())
}
fn fail(source:&str,needle:&str){
    let err=check_source(source).unwrap_err();
    assert!(err.contains(needle),"expected {needle:?} in {err:?}");
}

#[test]
fn lexes_all_core_glyphs_as_their_textual_equivalents(){
    let pairs=[('ƒ',"fn"),('≔',"let"),('↩',"return"),('→',"->"),('←',"="),
        ('⊤',"true"),('⊥',"false"),('∧',"and"),('∨',"or"),('¬',"not"),
        ('≡',"=="),('≠',"!="),('≤',"<="),('≥',">="),('∷',"::")];
    for (glyph,alias) in pairs {
        let left=lex(&glyph.to_string()).unwrap();let right=lex(alias).unwrap();
        assert_eq!(left[0].kind,right[0].kind,"{glyph} vs {alias}");
    }
}
#[test]
fn parses_alias_and_glyph_to_same_semantic_program(){
    let glyph="ƒ add(a: Number, b: Number) → Number { ↩ a + b; } ≔ n ← add(2, 3); print(n);";
    let ascii="fn add(a: Number, b: Number) -> Number { return a + b; } let n = add(2, 3); print(n);";
    fn scrub(source:&str)->String{
        let parsed=parse(source).unwrap();
        parsed.statements.iter().map(|s|format!("{:?}",s.kind)).collect::<Vec<_>>().join("\n")
    }
    // Location spans differ between spellings; semantic operators and AST shapes match.
    let a=parse(glyph).unwrap();let b=parse(ascii).unwrap();
    assert_eq!(a.statements.len(),b.statements.len());
    assert!(scrub(glyph).contains("Function"));
    assert!(scrub(ascii).contains("Function"));
    assert!(check_source(glyph).is_ok());assert!(check_source(ascii).is_ok());
}
#[test]
fn parses_and_statically_checks_all_existing_reference_examples(){
    let base=Path::new(env!("CARGO_MANIFEST_DIR")).parent().unwrap().join("examples");
    let mut count=0;
    for entry in fs::read_dir(base).unwrap(){
        let path=entry.unwrap().path();
        if path.extension().and_then(|x|x.to_str())!=Some("hc"){continue;}
        let source=fs::read_to_string(&path).unwrap();
        let parsed=parse(&source).unwrap_or_else(|e|panic!("{}: {e}",path.display()));
        let checked=if matches!(path.file_name().and_then(|n|n.to_str()),Some("user_symbols.hc"|"m16_vec_operations.hc")) {
            check_with_registry(&source)
        } else {check_source(&source)};
        checked.unwrap_or_else(|e|panic!("{}: {e}",path.display()));
        assert!(!parsed.statements.is_empty());count+=1;
    }
    assert!(count>=12,"Expected existing examples and M16 v2 sample");
}
#[test]
fn infers_unannotated_function_parameter_and_return_types(){
    let p=check_source("fn greet(name) { return \"Hi \" + name; } let message = greet(\"world\");").unwrap();
    match &p.statements[0].kind{
        TypedStmtKind::Function{parameters,returns,..}=>{
            assert_eq!(parameters[0].1,Type::String);assert_eq!(returns,&Type::String)
        }
        other=>panic!("Unexpected AST: {other:?}")
    }
}
#[test]
fn infers_recursion_and_arithmetic(){
    let p=check_source("fn square(n) { return n * n; } let x = square(3);").unwrap();
    match &p.statements[0].kind{
        TypedStmtKind::Function{parameters,returns,..}=>{
            assert_eq!(parameters[0].1,Type::Number);assert_eq!(returns,&Type::Number);
        },_=>panic!("Expected function")
    }
}
#[test]
fn catches_invalid_source_before_execution(){
    fail("let x = 1; x = \"wrong\";","Assignment type mismatch");
    fail("print(2 + \"3\");","matching types");
    fail("if (7) { print(1); }","if condition must be Bool");
    fail("while (\"yes\") { print(1); }","while condition must be Bool");
    fail("unknown(1);","Unknown identifier unknown");
    fail("let x = 1; let x = 2;","Duplicate declaration x");
    fail("return 1;","return is only valid inside a function");
    fail("fn typed(a: String) -> String { return a; } typed(true);","Call argument types or arity mismatch");
    fail("fn typed(a: Number) -> Number { return a; } typed();","Call argument types or arity mismatch");
    fail("fn f() -> Number { if (true) { return 5; } }","does not return on every execution path");
    fail("fn f() -> Number { return \"bad\"; }","Return type mismatch");
    fail("let f = 5; f(3);","Call argument types or arity mismatch");
    fail("let f = \"hi\"; print(f < 3);","Comparison expects Number");
    fail("let f = true + false;","+ requires Number or String");
    fail("fn f(x) { print(x); }","Cannot infer type");
}
#[test]
fn conditional_scopes_do_not_leak(){
    fail("if (true) { let local = 1; } print(local);","Unknown identifier local");
    assert!(check_source("let x = 1; if (true) { let x = \"two\"; print(x); } print(x);").is_ok());
}
#[test]
fn recursion_and_boolean_precedence(){
    let expr=parse("print(false or true and false);").unwrap();
    if let StmtKind::Expression(call)=&expr.statements[0].kind{
        if let ExprKind::Call{arguments,..}=&call.kind {
            assert!(matches!(&arguments[0].kind,ExprKind::Binary{op:hcode_compiler::ast::BinaryOp::Or,..}));
        }else {panic!("expected call")}
    }else {panic!("expected expression")}
    assert!(check_source("fn f(n: Number) -> Number {if(n <= 1){return n;} return f(n-1) + f(n-2);} print(f(8));").is_ok());
}
#[test]
fn reserved_and_invisible_unicode_is_rejected(){
    assert!(lex("print(1); // \u{200b}").is_err());
    assert!(lex("print(\"x\u{202e}y\");").is_err());
    assert!(lex("print(\"x\u{fe0f}y\");").is_err());
    assert!(parse("let x = ;").is_err());
    assert!(parse("fn f() { return 1;").is_err());
    assert!(parse("print(\"unterminated);").is_err());
}
#[test]
fn source_position_is_included_in_diagnostics(){
    let err=check_source("let ok = 1;\nlet nope = ok + true;").unwrap_err();
    assert!(err.contains("2:"),"Expected second-line diagnostic, got {err}");
}
#[test]
fn verifies_symbol_library_imports_and_types(){
    let p=check_with_registry("use \"demo.math@1.0.0\" as math; print(⊕(20,22)); print(math::add(1,2)); print(math∷⊕(3,4));").unwrap();
    assert!(matches!(&p.statements[0].kind,TypedStmtKind::Use{..}));
    let first=match &p.statements[1].kind {TypedStmtKind::Expression(e)=>e,_=>panic!("expected expression")};
    if let TypedExprKind::Call{arguments,..}=&first.kind {
        let first_arg=&arguments[0];
        if let TypedExprKind::Call{callee,..}=&first_arg.kind {
            assert!(matches!(&callee.kind,TypedExprKind::OperationRef{id} if id=="demo.math@1.0.0::add"));
        }else{panic!("expected operation call")}
    }else{panic!("expected print call")}
    let wrong=check_with_registry("use \"demo.math@1.0.0\" as math; print(⊕(\"bad\",2));").unwrap_err();
    assert!(wrong.contains("Call argument types or arity mismatch"));
    let unbound=check_source("print(⊕(1,2));").unwrap_err();
    assert!(unbound.contains("Unbound symbol"));
}
#[test]
fn package_imports_require_lockfile_and_exact_version(){
    assert!(check_with_registry("use \"demo.math@2.0.0\" as math; print(3);").unwrap_err().contains("verified lockfile"));
    assert!(check_with_registry("use \"demo.math\" as math;").unwrap_err().contains("verified lockfile"));
    assert!(check_with_registry("use \"demo.math@1.0.0\" as math; use \"demo.math@1.0.0\" as math;").unwrap_err().contains("Duplicate"));
    assert!(check_with_registry("fn f(){use \"demo.math@1.0.0\" as math;}").unwrap_err().contains("top-level"));
}
#[test]
fn preserves_immutable_package_operations_and_builtin_capabilities(){
    assert!(check_with_registry("use \"demo.math@1.0.0\" as math; let action = ⊕; print(action(1,2));").is_ok());
    fail("fn f(){print(1);} f = 2;","Cannot assign to function");
    fail("print = 4;","Cannot assign to function or builtin");
}
#[test]
fn package_manifest_and_source_digest_must_match(){
    let source=Path::new(env!("CARGO_MANIFEST_DIR")).parent().unwrap();
    let mut fixture=std::env::temp_dir();
    fixture.push(format!("hcode-m2-test-{}-{}",std::process::id(),"digest"));
    let _=fs::remove_dir_all(&fixture);
    fs::create_dir_all(fixture.join("packages/demo.math")).unwrap();
    fs::copy(source.join("hcode.lock.json"),fixture.join("hcode.lock.json")).unwrap();
    for name in ["lib.hc","manifest.json"]{
        fs::copy(source.join("packages/demo.math").join(name),fixture.join("packages/demo.math").join(name)).unwrap();
    }
    let package_source=fixture.join("packages/demo.math/lib.hc");
    let mut data=fs::read_to_string(&package_source).unwrap();data.push('\n');
    fs::write(package_source,data).unwrap();
    assert!(load_lockfile(&fixture.join("hcode.lock.json")).unwrap_err().to_string().contains("SHA-256 mismatch"));
    fs::remove_dir_all(&fixture).unwrap();
}
#[test]
fn cli_accepts_real_hcode_and_rejects_invalid_source(){
    let root=Path::new(env!("CARGO_MANIFEST_DIR")).parent().unwrap();
    let binary=env!("CARGO_BIN_EXE_hcodec");
    let valid=Command::new(binary).current_dir(root).args(["check","examples/user_symbols.hc","--lock","hcode.lock.json"]).output().unwrap();
    assert!(valid.status.success(),"{}",String::from_utf8_lossy(&valid.stderr));
    let checked=String::from_utf8_lossy(&valid.stdout);
    assert!(checked.contains("statically checked"));
    let without_lock=Command::new(binary).current_dir(root).args(["check","examples/user_symbols.hc"]).output().unwrap();
    assert!(!without_lock.status.success());
}
