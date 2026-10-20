use hcode_compiler::{parser::parse,checker::check,codegen::emit,packages::PackageRegistry};
use std::process::Command;
fn compile(source:&str)->Result<String,String>{
 let registry=PackageRegistry::default();
 let ast=parse(source).map_err(|e|e.to_string())?;
 let typed=check(&ast,&registry,true).map_err(|e|e.to_string())?;
 emit(&typed,&registry)
}
fn run(source:&str)->std::process::Output{
 let js=compile(source).expect("HMAC source compiles");
 Command::new("node").args(["--input-type=module","--eval",&js]).output().unwrap()
}
const TAG:&str="5bdcc146bf60754e6a042426089575c75a003f089d2739839dec58b964ec3843";
#[test]
fn generic_hmac_signs_and_aliases_have_identical_typed_output(){
 let source="⎙(✍(\"Jefe\",\"what do ya want for nothing?\"));";
 assert_eq!(compile(source).unwrap(),compile(&source.replace('✍',"hmac_sign")).unwrap());
 let out=run(source);assert!(out.status.success(),"{}",String::from_utf8_lossy(&out.stderr));
 assert_eq!(String::from_utf8_lossy(&out.stdout),format!("{TAG}\n"));
 let verify=format!("⎙(✓(\"Jefe\",\"what do ya want for nothing?\",\"{TAG}\"));");
 assert_eq!(compile(&verify).unwrap(),compile(&verify.replace('✓',"hmac_verify")).unwrap());
 assert_eq!(String::from_utf8_lossy(&run(&verify).stdout),"true\n");
}
#[test]
fn full_mac_verification_rejects_tampering_and_noncanonical_tags(){
 for tag in [TAG.to_uppercase(),"".into(),TAG[..62].into(),format!("{}00",TAG),format!("0{}",&TAG[1..]),format!("{}0",&TAG[..63]),"x".repeat(64)]{
  let source=format!("⎙(✓(\"Jefe\",\"what do ya want for nothing?\",\"{tag}\"));");
  let out=run(&source);assert!(out.status.success());assert_eq!(String::from_utf8_lossy(&out.stdout),"false\n");
 }
 for source in [format!("⎙(✓(\"wrong\",\"what do ya want for nothing?\",\"{TAG}\"));"),format!("⎙(✓(\"Jefe\",\"tampered\",\"{TAG}\"));")]{
  assert_eq!(String::from_utf8_lossy(&run(&source).stdout),"false\n");
 }
}
#[test]
fn hmac_requires_string_arguments_and_exact_arity(){
 for source in ["✍(1,\"data\");","✍(\"key\",⊤);","✓(\"key\",\"data\",1);","✍(\"key\");","✓(\"key\",\"data\");","✍(\"k\",\"d\",\"extra\");"]{
  assert!(compile(source).is_err(),"{source}");
 }
}
#[test]
fn only_used_hmac_operations_embed_the_crypto_runtime(){
 let plain=compile("⎙(42);").unwrap();assert!(!plain.contains("node:crypto"));
 let used=compile("⎙(✍(\"key\",\"data\"));").unwrap();assert!(used.contains("node:crypto"));assert!(used.contains("timingSafeEqual"));
}
#[test]
fn hmac_operands_keep_io_discovery_and_purity_checks(){
 let js=compile("⎙(✓(✍(\"key\",⤒1),⌨,⧄\"tag.txt\"));").unwrap();
 assert!(js.contains("HCODE_ALLOW_FILE_READ"));assert!(js.contains("let __hc_stdin_used=false"));assert!(js.contains("const __hc_json_write"));
 let cas="ƒ serve(r:⦃body:String,method:String,path:String⦄,s:String)→⦃body:String,state:String,status:Number⦄↩⦃body:✍(⧄\"key\",r·body),state:s,status:200⦄;⤊(serve,\"\");";
 assert!(compile(cas).unwrap_err().contains("EFFECT"));
 let sort="⎙(⟦\"a\"⟧↥λx:✍(⧄\"key\",x));";
 assert!(compile(sort).unwrap_err().contains("EFFECT"));
}
#[test]
fn utf8_byte_limits_are_enforced_without_echoing_inputs(){
 for (key,data) in [("k".repeat(4097),"data".into()),("key".into(),"ø".repeat(32769))]{
  let source=format!("⎙(✍(\"{key}\",\"{data}\"));");
  let out=run(&source);assert!(!out.status.success());
  let stderr=String::from_utf8_lossy(&out.stderr);assert!(stderr.contains("HMAC"));
 }
 let source=format!("⎙(⌗(⫶✍(\"{}\",\"{}\")));","k".repeat(4096),"ø".repeat(32768));
 assert_eq!(String::from_utf8_lossy(&run(&source).stdout),"64\n");
}

#[test]
fn pure_library_functions_and_imported_modules_link_the_actual_crypto_runtime(){
 let registry=PackageRegistry::default();
 let ast=parse("ƒ sign(k:String,m:String)→String↩✍(k,m);").unwrap();
 assert!(check(&ast,&registry,false).is_ok());
 let directory=std::env::temp_dir().join(format!("hcode-hmac-import-{}",std::process::id()));
 std::fs::create_dir_all(&directory).unwrap();
 std::fs::write(directory.join("mac.hc"),"export ƒ sign(k:String,m:String)→String↩✍(k,m);").unwrap();
 let mut ast=parse("import \"./mac.hc\" as m;⎙(m∷sign(\"Jefe\",\"what do ya want for nothing?\"));").unwrap();
 let mut registry=PackageRegistry::default();
 hcode_compiler::modules::resolve(&mut ast,&directory.join("main.hc"),&mut registry).unwrap();
 let typed=check(&ast,&registry,true).unwrap();
 let js=emit(&typed,&registry).unwrap();
 let out=Command::new("node").args(["--input-type=module","--eval",&js]).output().unwrap();
 std::fs::remove_dir_all(directory).unwrap();
 assert!(out.status.success(),"{}",String::from_utf8_lossy(&out.stderr));
 assert_eq!(String::from_utf8_lossy(&out.stdout),format!("{TAG}\n"));
}
