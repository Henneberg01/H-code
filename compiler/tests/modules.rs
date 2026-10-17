use hcode_compiler::{ast::StmtKind,checker::check,codegen::emit,modules::resolve,packages::{load_lockfile,PackageRegistry},parser::parse};
use std::{fs,path::Path,process::Command};

#[test]
fn local_modules_and_locked_package_interoperate(){
 let root=Path::new(env!("CARGO_MANIFEST_DIR")).parent().unwrap();
 let path=root.join("m4/main.hc");
 let mut ast=parse(&fs::read_to_string(&path).unwrap()).unwrap();
 let mut registry=load_lockfile(&root.join("hcode.lock.json")).unwrap();
 resolve(&mut ast,&path,&mut registry).unwrap();
 assert!(ast.statements.iter().any(|s|matches!(s.kind,StmtKind::Use{..})));
 let typed=check(&ast,&registry,true).unwrap();
 let js=emit(&typed,&registry).unwrap();
 let output=Command::new("node").args(["--input-type=module","--eval",&js]).output().unwrap();
 assert!(output.status.success(),"{}",String::from_utf8_lossy(&output.stderr));
 assert_eq!(String::from_utf8_lossy(&output.stdout).replace("\r\n","\n"),"49\n12\nHello world\nhaha\n9\n");
}
#[test]
fn local_module_import_cannot_traverse_or_leak_undefined_exports(){
 let root=Path::new(env!("CARGO_MANIFEST_DIR")).parent().unwrap();
 let entry=root.join("m4/main.hc");
 for spec in ["../m4/std/math.hc","/outside.hc","./std/missing.hc"]{
  let source=format!("import \"{spec}\" as math; print(math::square(3));");
  let mut ast=parse(&source).unwrap();
  let error=resolve(&mut ast,&entry,&mut PackageRegistry::default()).unwrap_err();
  assert!(error.to_string().contains("MODULE") || error.to_string().contains("Unknown"));
 }
 let mut ast=parse("import \"./std/math.hc\" as math; print(math::hidden(3));").unwrap();
 let mut registry=PackageRegistry::default();
 resolve(&mut ast,&entry,&mut registry).unwrap();
 let err=check(&ast,&registry,true).unwrap_err();
 assert!(err.to_string().contains("Unknown operation"));
}
#[test]
fn imports_and_exports_are_top_level_and_parse_correctly(){
 assert!(parse("fn f(){ import \"./std/math.hc\" as math; }").is_err());
 assert!(parse("if (true) { export fn f() { return 1; } }").is_err());
 assert!(parse("export print(1);").is_err());
}


#[test]
fn nested_modules_compile_with_transitive_dependencies(){
 let root=Path::new(env!("CARGO_MANIFEST_DIR")).parent().unwrap();
 let entry=root.join("m4/main.hc");
 let mut ast=parse("import \"./advanced.hc\" as advanced; print(advanced::fourth_power(3));").unwrap();
 let mut registry=PackageRegistry::default();
 resolve(&mut ast,&entry,&mut registry).unwrap();
 let typed=check(&ast,&registry,true).unwrap();
 let js=emit(&typed,&registry).unwrap();
 let output=Command::new("node").args(["--input-type=module","--eval",&js]).output().unwrap();
 assert!(output.status.success(),"{}",String::from_utf8_lossy(&output.stderr));
 assert_eq!(String::from_utf8_lossy(&output.stdout).replace("\r\n","\n"),"81\n");
}
#[test]
fn circular_imports_are_rejected(){
 let root=Path::new(env!("CARGO_MANIFEST_DIR")).parent().unwrap();
 let entry=root.join("m4/main.hc");
 let mut ast=parse("import \"./tests/cycle_a.hc\" as a; print(a::a(1));").unwrap();
 let error=resolve(&mut ast,&entry,&mut PackageRegistry::default()).unwrap_err();
 assert!(error.to_string().contains("Circular module import"));
}


#[test]
fn m4_cli_build_and_run_end_to_end(){
 let root=Path::new(env!("CARGO_MANIFEST_DIR")).parent().unwrap();
 let binary=env!("CARGO_BIN_EXE_hcodec");
 let out=Command::new(binary).current_dir(root).args(["run","m4/main.hc","--lock","hcode.lock.json"]).output().unwrap();
 assert!(out.status.success(),"{}",String::from_utf8_lossy(&out.stderr));
 assert_eq!(String::from_utf8_lossy(&out.stdout).replace("\r\n","\n"),"49\n12\nHello world\nhaha\n9\n");
 let dest=std::env::temp_dir().join(format!("hcode-m4-{}.mjs",std::process::id()));
 let built=Command::new(binary).current_dir(root).args(["build","m4/main.hc","--lock","hcode.lock.json","--out",dest.to_str().unwrap()]).output().unwrap();
 assert!(built.status.success(),"{}",String::from_utf8_lossy(&built.stderr));
 let node=Command::new("node").arg(&dest).output().unwrap();
 assert!(node.status.success(),"{}",String::from_utf8_lossy(&node.stderr));
 assert_eq!(String::from_utf8_lossy(&node.stdout).replace("\r\n","\n"),"49\n12\nHello world\nhaha\n9\n");
 fs::remove_file(dest).unwrap();
}
