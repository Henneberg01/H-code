use hcode_compiler::{parser::parse,checker::check,codegen::emit,packages::PackageRegistry};
use std::process::Command;
fn compile(src:&str)->Result<String,String>{
  let parsed=parse(src).map_err(|e|e.to_string())?;
  let registry=PackageRegistry::default();
  let typed=check(&parsed,&registry,true).map_err(|e|e.to_string())?;
  emit(&typed,&registry)
}
#[test]
fn delay_is_an_intrinsic_and_typechecked_effect(){
  let glyph=compile("⌛10;").unwrap();
  assert_eq!(glyph,compile("sleep_ms 10;").unwrap());
  assert!(glyph.contains("await __hc_sleep(10)"));
  assert!(glyph.contains("const __hc_sleep=async ms=>"));
  assert!(!compile("print(1);").unwrap().contains("const __hc_sleep"));
  for (src,needle) in [
    ("⌛\"1\";","⌛ expects Number milliseconds"),
    ("ƒ delay()→Unit{⌛0;}delay();","only available in effectful top-level"),
    ("≔f←λv:⌛v;","only available in effectful top-level")
  ] {
    let error=compile(src).unwrap_err();
    assert!(error.contains(needle),"{src}: {error}");
  }
  let parsed=parse("⌛0;").unwrap();
  let error=check(&parsed,&PackageRegistry::default(),false).unwrap_err().to_string();
  assert!(error.contains("EFFECT"),"{error}");
}
#[test]
fn delay_runs_in_node_and_refuses_unbounded_input(){
  let js=compile("⌛0;print(7);").unwrap();
  let ok=Command::new("node").arg("--input-type=module").arg("--eval").arg(js).output().unwrap();
  assert!(ok.status.success(),"{}",String::from_utf8_lossy(&ok.stderr));
  assert_eq!(String::from_utf8_lossy(&ok.stdout).trim(),"7");
  let js=compile("⌛-1;").unwrap();
  let bad=Command::new("node").arg("--input-type=module").arg("--eval").arg(js).output().unwrap();
  assert!(!bad.status.success());
  assert!(String::from_utf8_lossy(&bad.stderr).contains("bounded nonnegative integer"));
}
