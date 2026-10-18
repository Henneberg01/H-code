use hcode_compiler::{checker::check,codegen::emit,packages::{load_lockfile,PackageRegistry},parser::parse};
use serde_json::Value;
use std::{fs,path::Path,process::Command};

#[test]
fn seven_paired_cse1_files_compile_to_identical_js_and_correct_outputs(){
    let root=Path::new(env!("CARGO_MANIFEST_DIR")).parent().unwrap();
    let fixture=root.join("compact/fixtures");
    let manifest:Value=serde_json::from_slice(&fs::read(fixture.join("manifest.json")).unwrap()).unwrap();
    let entries=manifest["pairs"].as_array().unwrap();
    assert_eq!(entries.len(),7);
    for entry in entries{
        let id=entry["id"].as_str().unwrap();
        let registry=if entry["locked"].as_bool().unwrap(){
            load_lockfile(&root.join("hcode.lock.json")).unwrap()
        } else {PackageRegistry::default()};
        let mut js=Vec::new();
        for variant in ["glyph","ascii"]{
            let src=fs::read_to_string(fixture.join(format!("{id}.{variant}.hc"))).unwrap();
            let ast=parse(&src).unwrap_or_else(|e|panic!("{id}/{variant}: {e}"));
            let typed=check(&ast,&registry,true).unwrap_or_else(|e|panic!("{id}/{variant}: {e}"));
            let code=emit(&typed,&registry).unwrap();
            let run=Command::new("node").args(["--input-type=module","--eval",&code]).output().unwrap();
            assert!(run.status.success(),"{id}/{variant}: {}",String::from_utf8_lossy(&run.stderr));
            assert_eq!(String::from_utf8_lossy(&run.stdout).replace("\r\n","\n"),entry["output"].as_str().unwrap(),"{id}/{variant} output");
            js.push(code);
        }
        assert_eq!(js[0],js[1],"{id} compiled output must be identical");
    }
}
