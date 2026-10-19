use hcode_compiler::{checker::check, packages::{load_lockfile,PackageRegistry},parser::parse};
use sha2::{Digest,Sha256};
use serde_json::{json,Value};
use std::{fs,path::{Path,PathBuf},time::{Duration,SystemTime,UNIX_EPOCH}};

fn root()->PathBuf{Path::new(env!("CARGO_MANIFEST_DIR")).parent().unwrap().to_path_buf()}

// Windows Defender/file indexers can transiently open fixture sources without
// FILE_SHARE_DELETE/WRITE, making fs::copy fail with ERROR_SHARING_VIOLATION (32).
// Retry only that *specific transient OS error*, never checksum mismatches or
// other filesystem failures. The production package loader is unchanged.
fn copy_fixture(source:&Path,destination:&Path){
    for attempt in 0..12_u64 {
        match fs::copy(source,destination) {
            Ok(_) => return,
            Err(e) if cfg!(windows) && e.raw_os_error()==Some(32) && attempt<11=>{
                std::thread::sleep(Duration::from_millis(25*(attempt+1)));
            },
            Err(e)=>panic!("Cannot copy fixture {} -> {}: {e}",
                           source.display(),destination.display())
        }
    }
    unreachable!("retry loop returns on both success and fatal failure")
}
struct TempPackage{dir:PathBuf,lock:Value}
impl Drop for TempPackage{fn drop(&mut self){let _=fs::remove_dir_all(&self.dir);}}
impl TempPackage {
 fn new()->Self {
  let tick=SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_nanos();
  let dir=std::env::temp_dir().join(format!("hcode-phase1-{}-{tick}",std::process::id()));
  fs::create_dir_all(dir.join("packages/demo.math")).unwrap();
  let r=root();
  copy_fixture(&r.join("packages/demo.math/manifest.json"),&dir.join("packages/demo.math/manifest.json"));
  copy_fixture(&r.join("packages/demo.math/lib.hc"),&dir.join("packages/demo.math/lib.hc"));
  let lock:Value=serde_json::from_slice(&fs::read(r.join("hcode.lock.json")).unwrap()).unwrap();
  let mut s=Self{dir,lock};s.refresh();s
 }
 fn path(&self)->PathBuf{self.dir.join("hcode.lock.json")}
 fn sha(data:&[u8])->String{format!("{:x}",Sha256::digest(data))}
 fn refresh(&mut self){
  let m=fs::read(self.dir.join("packages/demo.math/manifest.json")).unwrap();
  let s=fs::read(self.dir.join("packages/demo.math/lib.hc")).unwrap();
  self.lock["packages"][0]["manifestSha256"]=json!(Self::sha(&m));
  self.lock["packages"][0]["sourceSha256"]=json!(Self::sha(&s));
  fs::write(self.path(),serde_json::to_vec(&self.lock).unwrap()).unwrap();
 }
 fn reg(&self)->Result<PackageRegistry,String>{load_lockfile(&self.path()).map_err(|e|e.to_string())}
}

#[test]
fn unknown_or_unimported_glyphs_dont_typecheck(){
 for src in ["print(⚡(1));","print(∅);","print(⊕(1,2));"] {
  let ast=parse(src).expect("glyph should tokenize as an operation");
  let msg=check(&ast,&PackageRegistry::default(),true).unwrap_err().to_string();
  assert!(msg.contains("Unbound symbol"),"unexpected error: {msg}");
 }
}

#[test]
fn dangerous_unicode_is_rejected_at_lexing_even_inside_comments(){
 for src in ["//\u{202e} forged\nprint(1);","let x = 1; //\u{200b} concealed","print(\"a\u{200d}b\");"] {
  let msg=parse(src).unwrap_err().to_string();
  assert!(msg.contains("Forbidden control"),"unexpected error: {msg}");
 }
}

#[test]
fn package_digest_and_nfkc_unstable_symbol_cannot_enter_registry(){
 let mut f=TempPackage::new();
 let path=f.dir.join("packages/demo.math/manifest.json");
 let mut original=fs::read(&path).unwrap();
 original.push(b'\n');
 fs::write(&path,original).unwrap();
 assert!(f.reg().unwrap_err().contains("SHA-256 mismatch"));
 let mut m:Value=serde_json::from_slice(&fs::read(&path).unwrap()).unwrap();
 m["operations"][0]["glyph"]=json!("㎞");
 fs::write(&path,serde_json::to_vec(&m).unwrap()).unwrap();
 f.refresh();
 let msg=f.reg().unwrap_err();
 assert!(msg.contains("Invalid, reserved or duplicate glyph"),"{msg}");
}

#[test]
fn ambiguous_imports_need_a_qualified_symbol_even_in_rust_frontend(){
 let mut f=TempPackage::new();
 let other=f.dir.join("packages/demo.other");fs::create_dir(&other).unwrap();
 fs::copy(f.dir.join("packages/demo.math/lib.hc"),other.join("lib.hc")).unwrap();
 let mut m:Value=serde_json::from_slice(&fs::read(f.dir.join("packages/demo.math/manifest.json")).unwrap()).unwrap();
 m["name"]=json!("demo.other");
 let manifest=serde_json::to_vec(&m).unwrap();
 fs::write(other.join("manifest.json"),&manifest).unwrap();
 let source=fs::read(other.join("lib.hc")).unwrap();
 f.lock["packages"].as_array_mut().unwrap().push(json!({
   "name":"demo.other", "version":"1.0.0",
   "manifest":"packages/demo.other/manifest.json",
   "manifestSha256":TempPackage::sha(&manifest),
   "sourceSha256":TempPackage::sha(&source)
 }));
 fs::write(f.path(),serde_json::to_vec(&f.lock).unwrap()).unwrap();
 let reg=f.reg().expect("both packages validate");
 let imports="use \"demo.math@1.0.0\" as math; use \"demo.other@1.0.0\" as other;\n";
 let ambiguous=format!("{imports}print(⊕(1,2));");
 let msg=check(&parse(&ambiguous).unwrap(),&reg,true).unwrap_err().to_string();
 assert!(msg.contains("Ambiguous symbol"),"{msg}");
 let qualified=format!("{imports}print(math::add(1,2)); print(other∷⊕(3,4));");
 check(&parse(&qualified).unwrap(),&reg,true).expect("qualified symbol resolves");
}
