use std::{fs,path::{Path,PathBuf},process::Command,time::{SystemTime,UNIX_EPOCH}};
use hcode_compiler::packages::load_lockfile;
use serde_json::Value;
fn root()->PathBuf{Path::new(env!("CARGO_MANIFEST_DIR")).parent().unwrap().to_path_buf()}
struct Workspace(PathBuf);
impl Workspace{
 fn new()->Self{
  let n=SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_nanos();
  let root=std::env::temp_dir().join(format!("hcode-m163-{}-{n}",std::process::id()));
  fs::create_dir_all(root.join("packages/poly.auto")).unwrap();
  fs::copy(root_source(),root.join("packages/poly.auto/signs.hcs")).unwrap();
  fs::copy(root().join("packages/poly.auto/demo.hc"),root.join("packages/poly.auto/demo.hc")).unwrap();
  Self(root)
 }
 fn run(&self,extra:&[&str])->std::process::Output{
  let mut c=Command::new(env!("CARGO_BIN_EXE_hcodec"));
  c.current_dir(&self.0).args(["pack","--name","poly.auto","--version","1.0.0",
   "--source","packages/poly.auto/signs.hcs","--lock","hcode.m16.3.lock.json"]).args(extra).output().unwrap()
 }
 fn source(&self)->PathBuf{self.0.join("packages/poly.auto/signs.hcs")}
 fn lock(&self)->PathBuf{self.0.join("hcode.m16.3.lock.json")}
}
fn root_source()->PathBuf{root().join("packages/poly.auto/signs.hcs")}
impl Drop for Workspace{fn drop(&mut self){let _=fs::remove_dir_all(&self.0);}}
fn output(out:&std::process::Output)->String{
 String::from_utf8_lossy(&out.stderr).to_string()
}
#[test]
fn build_is_deterministic_sha_locked_and_idempotent(){
 let w=Workspace::new();
 let out=w.run(&[]);assert!(out.status.success(),"{}",output(&out));
 let lib=w.0.join("packages/poly.auto/lib.hc");
 let manifest=w.0.join("packages/poly.auto/manifest.json");
 let original=[fs::read(&lib).unwrap(),fs::read(&manifest).unwrap(),fs::read(w.lock()).unwrap()];
 assert!(w.run(&["--check"]).status.success());
 assert!(w.run(&[]).status.success());
 let repeated=[fs::read(&lib).unwrap(),fs::read(&manifest).unwrap(),fs::read(w.lock()).unwrap()];
 assert_eq!(original,repeated);
 let parsed:Value=serde_json::from_slice(&original[1]).unwrap();
 assert_eq!(parsed["format"],3);
 assert_eq!(parsed["operations"][0]["glyph"],"⥇");
 assert_eq!(parsed["operations"][1]["glyph"],"⥈");
 assert!(load_lockfile(&w.lock()).is_ok());
 let generated=Command::new(env!("CARGO_BIN_EXE_hcodec"))
   .current_dir(&w.0).args(["run","packages/poly.auto/demo.hc","--lock","hcode.m16.3.lock.json"]).output().unwrap();
 assert!(generated.status.success(),"Compiled Rust backend: {}",output(&generated));
 let reference=Command::new("node").current_dir(&w.0)
   .arg(root().join("prototype/bin/hcode.mjs"))
   .args(["run","packages/poly.auto/demo.hc","--lock","hcode.m16.3.lock.json"])
   .output().unwrap();
 assert!(reference.status.success(),"JS reference: {}",output(&reference));
 let text=|b:&[u8]|String::from_utf8_lossy(b).replace("\r\n","\n");
 assert_eq!(text(&generated.stdout),"2\na\ntrue\n4\n");
 assert_eq!(text(&reference.stdout),text(&generated.stdout));
 fs::write(&lib,"TAMPER").unwrap();
 assert!(!w.run(&["--check"]).status.success());
 assert!(load_lockfile(&w.lock()).is_err());
}
#[test]
fn invalid_glyph_or_type_does_not_write_outputs(){
 let bad=[
   "∀T ∑ ƒ head(xs:⟦T⟧)→T ↩ xs⟦0⟧;\n",
   "∀T ⥇ ƒ head(xs:⟦T⟧)→T ↩ 42;\n",
   "∀T ⥇ ƒ head(xs:⟦T⟧)→T ↩ xs⟦0⟧;\n∀T ⥇ ƒ other(xs:⟦T⟧)→T ↩ xs⟦0⟧;\n",
   "∀T ⥇ ƒ head(xs:⟦U⟧)→U ↩ xs⟦0⟧;\n",
   "∀T ⥇ ƒ unused(xs:⟦Number⟧)→Number ↩ xs⟦0⟧;\n",
   "∀T ⥇ ƒ head(xs:⟦T⟧)→T ↩ print(xs⟦0⟧);\n"
 ];
 for code in bad{
  let w=Workspace::new();
  fs::write(w.source(),code).unwrap();
  let result=w.run(&[]);
  assert!(!result.status.success(),"unexpected success: {code}");
  assert!(!w.lock().exists(),"invalid source must not produce lockfile: {code}");
 }
}
#[test]
fn source_and_generated_output_reject_symlinks(){
 let w=Workspace::new();
 let out=w.run(&[]);assert!(out.status.success(),"{}",output(&out));
 fs::remove_file(w.0.join("packages/poly.auto/manifest.json")).unwrap();
 #[cfg(unix)]
 {
  std::os::unix::fs::symlink(w.source(),w.0.join("packages/poly.auto/manifest.json")).unwrap();
  assert!(!w.run(&[]).status.success());
 }
}

#[test]
fn invalid_update_does_not_damage_previously_valid_lock(){
 let w=Workspace::new();
 let good=w.run(&[]);assert!(good.status.success(),"{}",output(&good));
 let paths=[w.0.join("packages/poly.auto/lib.hc"),
     w.0.join("packages/poly.auto/manifest.json"),w.lock()];
 let old=paths.iter().map(|p|fs::read(p).unwrap()).collect::<Vec<_>>();
 fs::write(w.source(),"∀T ⥇ ƒ unused(xs:⟦Number⟧)→Number ↩ xs⟦0⟧;\n").unwrap();
 let bad=w.run(&[]);
 assert!(!bad.status.success(),"invalid package should not regenerate files");
 let unchanged=paths.iter().map(|p|fs::read(p).unwrap()).collect::<Vec<_>>();
 assert_eq!(old,unchanged);
 assert!(load_lockfile(&w.lock()).is_ok());
}
