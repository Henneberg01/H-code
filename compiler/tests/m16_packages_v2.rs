//! M16: actual Rust-compiled executable, typed SHA-locked user signs.
use hcode_compiler::{checker::check,codegen::emit,packages::{load_lockfile,PackageRegistry},parser::parse};
use serde_json::{json,Value};
use sha2::{Digest,Sha256};
use std::{fs,path::{Path,PathBuf},process::Command,time::{SystemTime,UNIX_EPOCH}};

fn root()->PathBuf{Path::new(env!("CARGO_MANIFEST_DIR")).parent().unwrap().to_path_buf()}
fn sha(bytes:&[u8])->String{format!("{:x}",Sha256::digest(bytes))}
fn compile(source:&str,reg:&PackageRegistry)->Result<String,String>{
    let ast=parse(source).map_err(|e|e.to_string())?;
    let typed=check(&ast,reg,true).map_err(|e|e.to_string())?;
    emit(&typed,reg)
}
fn run(source:&str,reg:&PackageRegistry)->Result<String,String>{
    let js=compile(source,reg)?;
    let child=Command::new("node").args(["--input-type=module","--eval",&js]).output().map_err(|e|e.to_string())?;
    if !child.status.success(){return Err(String::from_utf8_lossy(&child.stderr).to_string());}
    Ok(String::from_utf8_lossy(&child.stdout).replace("\r\n","\n"))
}
struct Fixture{path:PathBuf,lock:Value}
impl Drop for Fixture{fn drop(&mut self){let _=fs::remove_dir_all(&self.path);}}
impl Fixture{
    fn new()->Self{
        let nanos=SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_nanos();
        let path=std::env::temp_dir().join(format!("hcode-m16-{}-{nanos}",std::process::id()));
        fs::create_dir_all(path.join("packages/vec.math")).unwrap();
        for name in ["manifest.json","lib.hc"] {
            fs::copy(root().join("packages/vec.math").join(name),path.join("packages/vec.math").join(name)).unwrap();
        }
        let lock:Value=serde_json::from_slice(&fs::read(root().join("hcode.m16.lock.json")).unwrap()).unwrap();
        Self{path,lock}
    }
    fn source_path(&self)->PathBuf{self.path.join("packages/vec.math/lib.hc")}
    fn manifest_path(&self)->PathBuf{self.path.join("packages/vec.math/manifest.json")}
    fn lock_path(&self)->PathBuf{self.path.join("hcode.lock.json")}
    fn write_lock(&mut self){
        self.lock["packages"][0]["manifestSha256"]=json!(sha(&fs::read(self.manifest_path()).unwrap()));
        self.lock["packages"][0]["sourceSha256"]=json!(sha(&fs::read(self.source_path()).unwrap()));
        fs::write(self.lock_path(),serde_json::to_vec(&self.lock).unwrap()).unwrap();
    }
    fn update_manifest(&mut self,callback:impl FnOnce(&mut Value)){
        let mut man:Value=serde_json::from_slice(&fs::read(self.manifest_path()).unwrap()).unwrap();
        callback(&mut man);fs::write(self.manifest_path(),serde_json::to_vec(&man).unwrap()).unwrap();
        self.write_lock();
    }
    fn update_source(&mut self,new_source:&str){
        fs::write(self.source_path(),new_source).unwrap();self.write_lock();
    }
    fn load(&self)->Result<PackageRegistry,String>{
        load_lockfile(&self.lock_path()).map_err(|e|e.to_string())
    }
}
const USE:&str="use \"vec.math@1.0.0\" as vec;\n";

#[test]
fn v2_signed_sources_are_real_executable_rust_compiled_hcode(){
    let reg=load_lockfile(&root().join("hcode.m16.lock.json")).unwrap();
    let fixture=fs::read_to_string(root().join("examples/m16_vec_operations.hc")).unwrap();
    assert_eq!(run(&fixture,&reg).unwrap(),"10\n20\n");
    for (values,total,doubled) in [
        ("⟦-5,9.5⟧","4.5\n","9\n"),
        ("⟦0⟧","0\n","0\n"),
        ("⟦4,6⟧","10\n","20\n"),
        ("⟦⟧","0\n","0\n")
    ] {
        let application=format!("{USE}print(vec∷⊚({values}));");
        assert_eq!(run(&application,&reg).unwrap(),total);
        let app=format!("{USE}print(∑vec∷⊛({values}));");
        assert_eq!(run(&app,&reg).unwrap(),doubled);
    }
    // Source is a real H-Code function, not a synthetic JS or AI output.
    let def=reg.packages.get("vec.math@1.0.0").unwrap();
    assert_eq!(def.operations.len(),2);
    assert_eq!(def.typed_source.statements.len(),2);
}
#[test]
fn v1_packages_and_scalar_contracts_remain_compatible(){
    let old=load_lockfile(&root().join("hcode.lock.json")).unwrap();
    assert_eq!(run("use \"demo.math@1.0.0\" as m;print(m∷⊕(20,22));",&old).unwrap(),"42\n");
    let mut f=Fixture::new();f.update_manifest(|m|m["format"]=json!(1));
    assert!(f.load().unwrap_err().contains("v1 scalar contracts only"));
}
#[test]
fn wrong_array_element_types_and_arity_fail_before_execution(){
    let reg=load_lockfile(&root().join("hcode.m16.lock.json")).unwrap();
    for source in [
        format!("{USE}print(vec∷⊚(⟦\"bad\"⟧));"),
        format!("{USE}print(vec∷⊚(⟦1,⊤⟧));"),
        format!("{USE}print(vec∷⊚(42));"),
        format!("{USE}print(vec∷⊚());"),
        format!("{USE}print(vec∷⊛(⟦1⟧,⟦2⟧));")
    ]{
        let message=compile(&source,&reg).unwrap_err();
        assert!(message.contains("TYPE"),"{source}: {message}");
    }
    let bad=format!("{USE}print(∑vec∷⊛(⟦\"bad\"⟧));");
    assert!(compile(&bad,&reg).is_err());
}
#[test]
fn mismatching_manifest_implementation_annotations_and_return_types_are_rejected(){
    let mut f=Fixture::new();
    f.update_manifest(|m|m["operations"][0]["returns"]=json!("String"));
    assert!(f.load().unwrap_err().contains("return contract mismatch"));
    let mut f=Fixture::new();
    f.update_manifest(|m|m["operations"][0]["parameters"][0]["type"]=json!("⟦String⟧"));
    assert!(f.load().unwrap_err().contains("parameter 1 contract mismatch"));
    let mut f=Fixture::new();
    f.update_manifest(|m|m["operations"][0]["parameters"][0]["name"]=json!("other"));
    assert!(f.load().unwrap_err().contains("parameter 1 contract mismatch"));
    let mut f=Fixture::new();
    f.update_source("ƒ total(xs:⟦Number⟧)→Number ↩ \"bad\";\nƒ doubleAll(xs:⟦Number⟧)→⟦Number⟧ ↩ xs⇢(*2);\n");
    let err=f.load().unwrap_err();assert!(err.contains("TYPE")&&err.contains("Return type mismatch"),"{err}");
}
#[test]
fn pure_package_rejects_print_import_and_cross_scope_access(){
    for text in [
        "ƒ total(xs:⟦Number⟧)→Number ↩ print(xs);\nƒ doubleAll(xs:⟦Number⟧)→⟦Number⟧ ↩ xs⇢(*2);\n",
        "ƒ total(xs:⟦Number⟧)→Number ↩ missing(xs);\nƒ doubleAll(xs:⟦Number⟧)→⟦Number⟧ ↩ xs⇢(*2);\n",
        "use \"demo.math@1.0.0\" as m;\nƒ total(xs:⟦Number⟧)→Number ↩ ∑xs;\n",
        "import \"./other.hc\" as m;\nƒ total(xs:⟦Number⟧)→Number ↩ ∑xs;\n"
    ]{
        let mut f=Fixture::new();f.update_source(text);
        assert!(f.load().is_err(),"Pure package accepted: {text}");
    }
    let mut f=Fixture::new();f.update_manifest(|m|m["operations"][0]["effects"]=json!(["filesystem.read"]));
    assert!(f.load().unwrap_err().contains("pure"));
}
#[test]
fn lock_tampering_and_reserved_or_unstable_user_signs_are_blocked(){
    let mut f=Fixture::new();f.write_lock();
    assert!(f.load().is_ok());
    fs::write(f.source_path(),"ƒ total(xs:⟦Number⟧)→Number ↩ 999;\n").unwrap();
    assert!(f.load().unwrap_err().contains("source SHA-256 mismatch"));
    let mut f=Fixture::new();f.write_lock();
    fs::write(f.manifest_path(),"{}\n").unwrap();
    assert!(f.load().unwrap_err().contains("manifest SHA-256 mismatch"));
    for glyph in ["∑","λ","⇢","⊢","㎞"] {
        let mut f=Fixture::new();
        f.update_manifest(|m|m["operations"][0]["glyph"]=json!(glyph));
        assert!(f.load().unwrap_err().contains("Invalid, reserved or duplicate glyph"),"{glyph}");
    }
    let mut f=Fixture::new();f.update_manifest(|m|m["operations"][0]["parameters"][0]["type"]=json!("⟦T⟧"));
    assert!(f.load().unwrap_err().contains("Unsupported package contract type"));
    let mut f=Fixture::new();f.update_manifest(|m|m["operations"][0]["returns"]=json!("⟦⟦⟧⟧"));
    assert!(f.load().is_err());
}
#[test]
fn qualified_glyphs_disambiguate_two_imported_v2_packages(){
    let mut f=Fixture::new();
    let other=f.path.join("packages/vec.other");
    fs::create_dir_all(&other).unwrap();
    fs::copy(f.manifest_path(),other.join("manifest.json")).unwrap();
    fs::copy(f.source_path(),other.join("lib.hc")).unwrap();
    let mut manifest:Value=serde_json::from_slice(&fs::read(other.join("manifest.json")).unwrap()).unwrap();
    manifest["name"]=json!("vec.other");
    let bytes=serde_json::to_vec(&manifest).unwrap();
    fs::write(other.join("manifest.json"),&bytes).unwrap();
    f.lock["packages"].as_array_mut().unwrap().push(json!({
      "name":"vec.other","version":"1.0.0","manifest":"packages/vec.other/manifest.json",
      "manifestSha256":sha(&bytes),
      "sourceSha256":sha(&fs::read(other.join("lib.hc")).unwrap())
    }));
    f.write_lock();
    let reg=f.load().unwrap();
    let uses=format!("{USE}use \"vec.other@1.0.0\" as other;\n");
    assert!(compile(&(uses.clone()+"print(⊚(⟦2,3⟧));"),&reg).unwrap_err().contains("Ambiguous"));
    assert_eq!(run(&(uses.clone()+"print(vec∷⊚(⟦2,3⟧));print(other∷⊚(⟦4,5⟧));"),&reg).unwrap(),"5\n9\n");
}
#[test]
fn unknown_format_and_excessive_depth_fail_closed(){
    let mut f=Fixture::new();f.update_manifest(|m|m["format"]=json!(99));
    assert!(f.load().unwrap_err().contains("Unsupported package manifest format"));
    let mut f=Fixture::new();f.update_manifest(|m|m["operations"][0]["parameters"][0]["type"]=json!(format!("{}Number{}","⟦".repeat(17),"⟧".repeat(17))));
    assert!(f.load().unwrap_err().contains("limit"));
}
