use hcode_compiler::{checker::check, codegen::emit, packages::PackageRegistry, parser::parse};
use std::process::Command;

fn compile(source: &str) -> Result<String, String> {
    let ast = parse(source).map_err(|e| e.to_string())?;
    let registry = PackageRegistry::default();
    let typed = check(&ast, &registry, true).map_err(|e| e.to_string())?;
    emit(&typed, &registry)
}

#[test]
fn glyph_and_alias_execute_boolean_assertions_and_return_unit() {
    for source in ["⎙(⊨(⊤));", "print(assert(true));"] {
        let generated = compile(source).unwrap();
        let output = Command::new("node").args(["--input-type=module", "--eval", &generated]).output().unwrap();
        assert!(output.status.success(), "{}", String::from_utf8_lossy(&output.stderr));
        assert_eq!(String::from_utf8_lossy(&output.stdout).trim(), "none");
    }
    assert!(!compile("⎙(42);").unwrap().contains("__hc_assert"));
    assert!(!compile("⎙(\"__hc_assert(\");").unwrap().contains("let __hc_assertions"));
}

#[test]
fn false_assertion_fails_at_the_original_source_location() {
    for (source,location) in [("≔n←1\n⊨(n≡2)","2:1"),("≔verify←⊨\nverify(⊥)","1:9")] {
        let generated = compile(source).unwrap();
        let output = Command::new("node").args(["--input-type=module", "--eval", &generated]).output().unwrap();
        assert!(!output.status.success());
        assert!(String::from_utf8_lossy(&output.stderr).contains(&format!("JFH-CODE assertion failed at {location}")));
    }
}

#[test]
fn assertion_rejects_non_boolean_values_and_wrong_arity_before_codegen() {
    for source in ["⊨(1)", "assert(\"true\")", "⊨()", "⊨(⊤,⊤)", "⊨(⟦⊤⟧)"] {
        assert!(compile(source).unwrap_err().contains("TYPE"), "{source}");
    }
}

#[test]
fn assertion_aliases_preserve_lexical_shadowing_and_first_class_calls() {
    let generated = compile("≔verify←⊨;verify(⊤);ƒ apply(f){↩f(⊤);}apply(⊨);ƒ wrapped()→Number{ƒ assert(x:Number)→Number↩x+1;↩assert(41);}⎙(wrapped());").unwrap();
    let output = Command::new("node").args(["--input-type=module", "--eval", &generated]).output().unwrap();
    assert!(output.status.success(), "{}", String::from_utf8_lossy(&output.stderr));
    assert_eq!(String::from_utf8_lossy(&output.stdout).trim(), "42");
}

#[test]
fn assertion_cannot_be_used_as_an_effect_in_a_pure_sort_callback() {
    for source in [
        "≔xs←⟦1,2⟧;⎙(xs↧λx:⊨(x>0));",
        "ƒ key(x:Number)→Number{⊨(x>0);↩x;}⎙(⟦1,2⟧↧key);",
        "≔verify←⊨;ƒ key(x:Number)→Number{verify(x>0);↩x;}⎙(⟦1,2⟧↧key);",
    ] {
        assert!(compile(source).unwrap_err().contains("EFFECT"), "{source}");
    }
}

#[test]
fn factory_returning_an_assertion_must_execute_before_its_result_is_called() {
    let generated = compile("ƒ factory(){⊨(⊥);↩⊨;}factory()(⊤);").unwrap();
    let output = Command::new("node").args(["--input-type=module", "--eval", &generated]).output().unwrap();
    assert!(!output.status.success(), "A false assertion inside factory must not be skipped");
    assert!(String::from_utf8_lossy(&output.stderr).contains("JFH-CODE assertion failed"));
}

#[test]
fn reassigned_assertion_aliases_call_the_current_value() {
    for source in [
        "ƒ noop(x:Bool)→Unit{}≔verify←⊨;verify←noop;verify(⊥);",
        "ƒ noop(x:Bool)→Unit{}ƒ wrapped(){≔assert←⊨;assert←noop;assert(⊥);}wrapped();",
    ] {
        let generated = compile(source).unwrap();
        let output = Command::new("node").args(["--input-type=module", "--eval", &generated]).output().unwrap();
        assert!(output.status.success(), "{}", String::from_utf8_lossy(&output.stderr));
    }
}
