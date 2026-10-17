use hcode_compiler::lexer::{lex,TokenKind};
use hcode_compiler::packages::load_lockfile;
use serde_json::{json,Value};
use sha2::{Digest,Sha256};
use std::{fs,path::Path,time::{SystemTime,UNIX_EPOCH}};

#[test]
fn pipeline_glyph_and_ascii_alias_lex_to_the_same_rust_kind(){
    let glyph=lex("1 ▷ double;").unwrap();
    let ascii=lex("1 |> double;").unwrap();
    assert_eq!(glyph,ascii);
    assert_eq!(glyph[1].kind,TokenKind::Pipe);
    assert!(lex("1 | > f;").is_err());
    assert!(lex("1 | f;").is_err());
    assert!(lex("1 ▷ \u{200b} f;").is_err());
}

#[test]
fn sha_locked_package_cannot_shadow_pipeline_operator(){
    let tick=SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_nanos();
    let dir=std::env::temp_dir().join(format!("hcode-cse1-{}-{tick}",std::process::id()));
    let packages=dir.join("packages/demo.math");
    fs::create_dir_all(&packages).unwrap();
    let root=Path::new(env!("CARGO_MANIFEST_DIR")).parent().unwrap();
    let result=(|| -> Result<(),String> {
        fs::copy(root.join("packages/demo.math/lib.hc"),packages.join("lib.hc")).map_err(|e|e.to_string())?;
        let mut manifest:Value=serde_json::from_slice(&fs::read(root.join("packages/demo.math/manifest.json")).unwrap()).unwrap();
        manifest["operations"][0]["glyph"]=json!("▷");
        let bytes=serde_json::to_vec(&manifest).unwrap();
        fs::write(packages.join("manifest.json"),&bytes).unwrap();
        let mut lock:Value=serde_json::from_slice(&fs::read(root.join("hcode.lock.json")).unwrap()).unwrap();
        lock["packages"][0]["manifestSha256"]=json!(format!("{:x}",Sha256::digest(&bytes)));
        lock["packages"][0]["sourceSha256"]=json!(format!("{:x}",Sha256::digest(&fs::read(packages.join("lib.hc")).unwrap())));
        let lockpath=dir.join("hcode.lock.json");
        fs::write(&lockpath,serde_json::to_vec(&lock).unwrap()).unwrap();
        let msg=load_lockfile(&lockpath).unwrap_err().to_string();
        if !msg.contains("Invalid, reserved or duplicate glyph"){return Err(msg);}
        Ok(())
    })();
    let _=fs::remove_dir_all(&dir);
    result.unwrap();
}
