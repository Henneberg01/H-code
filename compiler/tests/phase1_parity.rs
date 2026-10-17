use hcode_compiler::{
    ast::Program,
    checker::check,
    codegen::emit,
    packages::{load_lockfile,PackageRegistry},
    parser::parse,
};
use serde_json::Value;
use std::{fs,path::Path,process::Command};

fn compile(source:&str,registry:&PackageRegistry)->(Program,String){
    let ast=parse(source).unwrap_or_else(|e|panic!("Failed to parse fixture: {e}"));
    let typed=check(&ast,registry,true).unwrap_or_else(|e|panic!("Failed to typecheck fixture: {e}"));
    let javascript=emit(&typed,registry).expect("Emit must succeed");
    (ast,javascript)
}

fn output(javascript:&str)->String{
    let command=Command::new("node").args(["--input-type=module","--eval",javascript]).output().expect("Node unavailable");
    assert!(command.status.success(),"Node compilation error: {}",String::from_utf8_lossy(&command.stderr));
    String::from_utf8_lossy(&command.stdout).replace("\r\n","\n")
}

#[test]
fn four_symbol_first_programs_have_identical_checked_output_and_generated_javascript(){
    let root=Path::new(env!("CARGO_MANIFEST_DIR")).parent().unwrap();
    let fixtures=root.join("phase1/fixtures");
    let manifest:Value=serde_json::from_slice(&fs::read(fixtures.join("manifest.json")).unwrap()).unwrap();
    assert_eq!(manifest["format"],1);
    let pairs=manifest["pairs"].as_array().expect("Fixture manifest pairs array");
    assert_eq!(pairs.len(),4);
    let expected_ids=["functions","booleans","recursion","package"];
    for (i,pair) in pairs.iter().enumerate(){
        let id=pair["id"].as_str().expect("id");
        assert_eq!(id,expected_ids[i]);
        let glyph=fs::read_to_string(fixtures.join(format!("{id}.glyph.hc"))).unwrap();
        let ascii=fs::read_to_string(fixtures.join(format!("{id}.ascii.hc"))).unwrap();
        let locked=pair["lock"].as_bool().expect("lock");
        let registry=if locked { load_lockfile(&root.join("hcode.lock.json")).unwrap() } else { PackageRegistry::default() };
        let (_,sign_js)=compile(&glyph,&registry);
        let (_,alias_js)=compile(&ascii,&registry);
        assert_eq!(sign_js,alias_js,"Compiler meaning diverges for {id}");
        let sign_out=output(&sign_js);
        let alias_out=output(&alias_js);
        assert_eq!(sign_out,alias_out,"Runtime output diverges for {id}");
        assert_eq!(sign_out,pair["output"].as_str().unwrap(),"{id} output mismatch");
    }
}
