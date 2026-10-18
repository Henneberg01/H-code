use hcode_compiler::{parser::parse,checker::check,codegen::emit,packages::PackageRegistry};
use std::{fs,env,process::Command,time::{SystemTime,UNIX_EPOCH}};
fn compile(s:&str)->Result<String,String>{
 let ast=parse(s).map_err(|e|e.to_string())?;
 let registry=PackageRegistry::default();
 let typed=check(&ast,&registry,true).map_err(|e|e.to_string())?;
 emit(&typed,&registry)
}
fn root()->std::path::PathBuf{
 let stamp=SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_nanos();
 let path=env::temp_dir().join(format!("hcode-m19-07-{}-{}",std::process::id(),stamp));
 fs::create_dir(&path).unwrap(); path.canonicalize().unwrap()
}
#[test]
fn glyph_ascii_alias_and_type_effect_restrictions(){
 let symbol=compile("print(⧅(\"out.txt\",\"hi\"));").unwrap();
 let ascii=compile("print(file_write(\"out.txt\",\"hi\"));").unwrap();
 assert_eq!(symbol,ascii);
 assert!(symbol.contains("const __hc_file_write="));
 assert!(symbol.contains("linkSync(tmp, dest)"));
 assert!(!compile("print(1);").unwrap().contains("createFileWriteCapability"));
 for (source,msg) in [
   ("⧅(12,\"x\");","⧅ filename must be String"),
   ("⧅(\"x\",42);","⧅ content must be String"),
   ("ƒ forbidden()→Number ↩ ⧅(\"x\",\"v\");","only available in effectful top-level"),
   ("≔f←λu:⧅(\"x\",u);","only available in effectful top-level")
 ]{
   let err=compile(source).unwrap_err();
   assert!(err.contains(msg),"{source}: {err}");
 }
 assert!(parse("⧅(\"x\");").is_err());
 assert!(parse("⧅(\"x\",\"y\",\"z\");").is_err());
 let ast=parse("⧅(\"x\",\"y\");").unwrap();
 assert!(check(&ast,&PackageRegistry::default(),false).unwrap_err().to_string().contains("EFFECT"));
}
#[test]
fn generated_js_writes_exact_utf8_and_denies_overwrite_and_ambient_access(){
 let dir=root();
 let js=compile("print(⧅(\"sample.json\",\"{\\\"text\\\":\\\"Møbel 🧩\\\"}\"));").unwrap();
 let no=Command::new("node").arg("--input-type=module").arg("--eval").arg(&js)
   .env_remove("HCODE_FILE_WRITE_ROOT").output().unwrap();
 assert!(!no.status.success());
 assert!(String::from_utf8_lossy(&no.stderr).contains("explicitly approved absolute output directory"));
 assert!(!dir.join("sample.json").exists());
 let ok=Command::new("node").arg("--input-type=module").arg("--eval").arg(&js)
   .env("HCODE_FILE_WRITE_ROOT",&dir).output().unwrap();
 assert!(ok.status.success(),"{}",String::from_utf8_lossy(&ok.stderr));
 let data=fs::read(dir.join("sample.json")).unwrap();
 assert_eq!(data,"{\"text\":\"Møbel 🧩\"}".as_bytes());
 assert_eq!(String::from_utf8_lossy(&ok.stdout).trim(),data.len().to_string());
 let conflict=Command::new("node").arg("--input-type=module").arg("--eval").arg(&js)
   .env("HCODE_FILE_WRITE_ROOT",&dir).output().unwrap();
 assert!(!conflict.status.success());
 assert!(String::from_utf8_lossy(&conflict.stderr).contains("EEXIST"));
 assert_eq!(fs::read(dir.join("sample.json")).unwrap(),data);
 assert_eq!(fs::read_dir(&dir).unwrap().count(),1);
 fs::remove_dir_all(dir).unwrap();
}
#[test]
fn generated_js_refuses_unsafe_names_and_oversized_content_before_publish(){
 let dir=root();
 for (src,part) in [
   ("⧅(\"../escaped\",\"x\");","portable single-component filename"),
   ("⧅(\"CON.txt\",\"x\");","portable single-component filename"),
   ("⧅(\"x\",\"ok\");⧅(\"x\",\"again\");","EEXIST")
 ]{
  let js=compile(src).unwrap();
  let out=Command::new("node").arg("--input-type=module").arg("--eval").arg(js)
    .env("HCODE_FILE_WRITE_ROOT",&dir).output().unwrap();
  assert!(!out.status.success(),"{src}");
  assert!(String::from_utf8_lossy(&out.stderr).contains(part),"{src}: {}",String::from_utf8_lossy(&out.stderr));
 }
 assert!(!dir.join("escaped").exists());
 assert_eq!(fs::read(dir.join("x")).unwrap(),"ok".as_bytes());
 fs::remove_dir_all(dir).unwrap();
}
