use hcode_compiler::{parser::parse,checker::check,codegen::emit,packages::PackageRegistry};
use std::process::Command;
fn compile(src:&str)->Result<String,String>{
    let ast=parse(src).map_err(|e|e.to_string())?;
    let p=PackageRegistry::default();
    emit(&check(&ast,&p,true).map_err(|e|e.to_string())?,&p)
}
#[test]
fn intrinsic_signs_and_aliases_lower_to_identical_checked_code(){
    let glyph=compile("⎙(42);⏳0;⎙(6);").unwrap();
    let ascii=compile("print(42);sleep_ms 0;print(6);").unwrap();
    assert_eq!(glyph,ascii);
    assert!(glyph.contains("await __hc_sleep"));
    assert!(!compile("⎙(42);").unwrap().contains("const __hc_sleep="));
    assert!(!compile("⎙(42);").unwrap().contains("const __hc_http_get="));
}
#[test]
fn dynamic_and_literal_duration_types_rejected_and_no_pure_io(){
    for code in ["⏳\"100\";","⏳-1;","⏳120001;","ƒ f()→Unit ↩ ⏳0;","≔f←λ x:⏳x;"] {
        assert!(compile(code).is_err(),"Expected compile rejection for: {code}");
    }
    let ast=parse("⏳100;").unwrap();
    let error=check(&ast,&PackageRegistry::default(),false).unwrap_err().to_string();
    assert!(error.contains("EFFECT"),"{error}");
}
#[test]
fn compiled_delay_runs_as_async_effect_with_injectable_virtual_scheduler(){
    let js=compile("⎙(1);⏳100;⎙(2);").unwrap();
    let result=Command::new("node").args(["--input-type=module","--eval",&js])
        .env("HCODE_TEST_VIRTUAL_SLEEP","1").output().unwrap();
    assert!(result.status.success(),"{}",String::from_utf8_lossy(&result.stderr));
    assert_eq!(String::from_utf8_lossy(&result.stdout).replace("\r\n","\n"),"1\n2\n");
    let bad=compile("≔v←-1;⏳v;").unwrap();
    let result=Command::new("node").args(["--input-type=module","--eval",&bad])
        .env("HCODE_TEST_VIRTUAL_SLEEP","1").output().unwrap();
    assert!(!result.status.success());
    assert!(String::from_utf8_lossy(&result.stderr).contains("integer milliseconds"));
}
