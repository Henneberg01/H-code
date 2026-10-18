//! M16.3: deterministic, offline, glyph-first package authoring.
//! Author a .hcs file; generated .hc/manifest/lock are build artifacts.
use std::{collections::HashSet,fs,path::{Path,PathBuf},time::{SystemTime,UNIX_EPOCH}};
use sha2::{Digest,Sha256};
use serde_json::json;
use unicode_normalization::UnicodeNormalization;
use crate::{ast::StmtKind,checker::check,lexer::{lex,is_symbol,TokenKind},packages::{load_lockfile,PackageRegistry},parser::parse};

fn sha(data:&[u8])->String{format!("{:x}",Sha256::digest(data))}
fn fail(s:impl Into<String>)->String{format!("M16.3: {}",s.into())}
fn legal_name(s:&str)->bool{
    // Identical grammar to the existing JS loader's PACKAGE contract.
    let components:Vec<_>=s.split(['.','-']).collect();
    s.starts_with(|c:char|c.is_ascii_lowercase()) &&
        components.iter().all(|part|!part.is_empty()&&
            part.bytes().all(|c|c.is_ascii_lowercase()||c.is_ascii_digit()))
}
fn legal_version(s:&str)->bool{
    let p:Vec<_>=s.split('.').collect();
    p.len()==3 && p.iter().all(|v| !v.is_empty()&&v.bytes().all(|c|c.is_ascii_digit())&&(v.len()==1||!v.starts_with('0')))
}
fn source_text(path:&Path)->Result<String,String>{
    let m=fs::symlink_metadata(path).map_err(|e|fail(format!("Source: {e}")))?;
    if !m.file_type().is_file()||m.len()>1_048_576{return Err(fail("Source must be a regular file <= 1 MiB"))}
    String::from_utf8(fs::read(path).map_err(|e|fail(e.to_string()))?).map_err(|_|fail("Invalid UTF-8"))
}
fn canonical_dir(path:&Path)->Result<PathBuf,String>{
    let p=fs::canonicalize(path).map_err(|e|fail(e.to_string()))?;
    if !fs::metadata(&p).map_err(|e|fail(e.to_string()))?.is_dir(){return Err(fail("Expected directory"))}
    Ok(p)
}
fn write_or_check(path:&Path,content:&[u8],check_only:bool)->Result<(),String>{
    if check_only{
        let old=fs::read(path).map_err(|e|fail(format!("Missing generated {}: {e}",path.display())))?;
        if old!=content{return Err(fail(format!("Out of date: {}",path.display())))}
    } else {
        if path.exists(){
            let m=fs::symlink_metadata(path).map_err(|e|fail(e.to_string()))?;
            if !m.file_type().is_file(){return Err(fail(format!("Non-regular output: {}",path.display())))}
        }
        fs::write(path,content).map_err(|e|fail(format!("Write {}: {e}",path.display())))?;
    }
    Ok(())
}
// Verify the final format-3 package with the real loader BEFORE touching
// existing output files. A source contract failure must not leave a bad lock.
struct PreviewDir(PathBuf);
impl Drop for PreviewDir{fn drop(&mut self){let _=fs::remove_dir_all(&self.0);}}
fn verify_generated(name:&str,source:&[u8],manifest:&[u8],lock:&[u8])->Result<(),String>{
    let now=SystemTime::now().duration_since(UNIX_EPOCH).map_err(|e|fail(e.to_string()))?.as_nanos();
    let temp=std::env::temp_dir().join(format!("hcode-m163-preview-{}-{now}",std::process::id()));
    fs::create_dir(&temp).map_err(|e|fail(format!("Create preview: {e}")))?;
    let cleanup=PreviewDir(temp);
    let pkg=cleanup.0.join("packages").join(name);
    fs::create_dir_all(&pkg).map_err(|e|fail(format!("Preview package: {e}")))?;
    fs::write(pkg.join("lib.hc"),source).map_err(|e|fail(format!("Preview source: {e}")))?;
    fs::write(pkg.join("manifest.json"),manifest).map_err(|e|fail(format!("Preview manifest: {e}")))?;
    let path=cleanup.0.join("hcode.lock.json");
    fs::write(&path,lock).map_err(|e|fail(format!("Preview lock: {e}")))?;
    load_lockfile(&path).map_err(|e|fail(format!("Generated package rejected: {e}")))?;
    Ok(())
}
/// Usage: hcodec pack --name NAME --version X.Y.Z --source packages/NAME/signs.hcs
///                   --lock hcode.NAME.lock.json [--check]
/// Paths must be within a canonical project root; no network access.
pub fn generate(name:&str,version:&str,source:&Path,lock:&Path,check_only:bool)->Result<(),String>{
    if !legal_name(name)||!legal_version(version){return Err(fail("Invalid package name/version"))}
    if source.extension().and_then(|x|x.to_str())!=Some("hcs"){return Err(fail("Source must be .hcs"))}
    let project=canonical_dir(Path::new("."))?;
    let authored=source_text(source)?; // Inspect the requested leaf path, before symlink resolution.
    let input=fs::canonicalize(source).map_err(|e|fail(format!("Source: {e}")))?;
    if !input.starts_with(&project){return Err(fail("Source escapes project directory"))}
    let package=canonical_dir(input.parent().ok_or_else(||fail("Missing source directory"))?)?;
    let expected=project.join("packages").join(name);
    if package!=expected{return Err(fail(format!("Source must be in packages/{name}/")))}
    let lock_parent=canonical_dir(lock.parent().filter(|p|!p.as_os_str().is_empty()).unwrap_or_else(||Path::new(".")))?;
    if lock_parent!=project || lock.file_name().and_then(|x|x.to_str()).is_none_or(|s|!s.starts_with("hcode.")||!s.ends_with(".lock.json")){
        return Err(fail("Lock must be a hcode.*.lock.json file in project root"));
    }
    let tokens=lex(&authored).map_err(|e|fail(e.to_string()))?;
    let mut positions=Vec::new();
    let mut glyphs=HashSet::new();
    for i in 0..tokens.len().saturating_sub(1){
        if let (TokenKind::Glyph(c),TokenKind::LeftParen)=(&tokens[i].kind,&tokens[i+1].kind){
            // The user-owned glyph IS the function constructor/name.
            // Example: ∀T ⥇(xs:⟦T⟧)→T ↩ xs⟦0⟧;
            // Generate the private identifier only for the existing M16.2 checker.
            if !is_symbol(*c){return Err(fail("Invalid glyph"))}
            if !glyphs.insert(*c){return Err(fail(format!("Duplicate glyph {c}")))}
            if !matches!(tokens.get(i.wrapping_sub(1)).map(|t|&t.kind),Some(TokenKind::Identifier(_))|Some(TokenKind::Semicolon)|Some(TokenKind::RightBrace)) && i!=0 {
                return Err(fail("Glyph must declare a top-level function"));
            }
            positions.push((tokens[i].span.line,tokens[i].span.column,*c));
        }
    }
    if positions.is_empty()||positions.len()>100{return Err(fail("Expected 1..100 glyph-marked functions"))}
    // A private compiler identifier is generated from source order, not
    // authored by the developer. The sign itself declares the function.
    let mut lines:Vec<String>=authored.split_inclusive('\n').map(str::to_string).collect();
    // Apply right-to-left so earlier byte/column offsets on the same line
    // remain unchanged, even with multiple declarations on one line.
    for (index,(line,column,c)) in positions.iter().enumerate().rev(){
        let original=lines.get_mut(line-1).ok_or_else(||fail("Invalid glyph source position"))?;
        let begin=original.char_indices().nth(column-1).map(|(x,_)|x).ok_or_else(||fail("Invalid glyph column"))?;
        if !original[begin..].starts_with(*c){return Err(fail("Glyph source position mismatch"))}
        original.replace_range(begin..begin+c.len_utf8(),&format!("ƒ g{}",index+1));
    }
    let output=lines.concat();
    let ast=parse(&output).map_err(|e|fail(e.to_string()))?;
    if ast.statements.len()!=positions.len(){return Err(fail("Every top-level function requires one glyph marker"))}
    let _checked=check(&ast,&PackageRegistry::default(),false).map_err(|e|fail(e.to_string()))?;
    let mut names=HashSet::new();
    let mut operations=Vec::new();
    for (index,(s,(_,_,glyph))) in ast.statements.iter().zip(&positions).enumerate(){
        let StmtKind::Function{name:fn_name,type_parameters,parameters,returns,..}=&s.kind else {return Err(fail("Package can only contain functions"))};
        if *fn_name!=format!("g{}",index+1){return Err(fail("Generated glyph/function order mismatch"))}
        if !names.insert(fn_name.clone()){return Err(fail("Duplicate exported function"))}
        let result=returns.as_deref().ok_or_else(||fail(format!("{fn_name}: return type required")))?;
        let params:Result<Vec<_>,String>=parameters.iter().map(|p|{
            let ty=p.annotation.as_ref().ok_or_else(||fail(format!("{}: missing parameter type",p.name)))?;
            Ok(json!({"name":p.name,"type":ty}))
        }).collect();
        operations.push(json!({"name":fn_name,"glyph":glyph.to_string(),"typeParameters":type_parameters,
            "parameters":params?,"returns":result,"effects":[],"implementation":fn_name}));
    }
    // M16.2's verified loader remains authoritative for contracts and Unicode rules.
    // Refuse unsafe or reserved glyphs before writing.
    for (_,_,c) in &positions {
        let s=c.to_string();
        if s.nfc().collect::<String>()!=s||s.nfkc().collect::<String>()!=s || crate::packages::reserved_glyph(*c){
            return Err(fail(format!("Reserved or normalization-unstable glyph {c}")));
        }
    }
    let manifest=json!({"format":3,"name":name,"version":version,"source":"lib.hc","operations":operations});
    let manifest_bytes=serde_json::to_vec_pretty(&manifest).map_err(|e|fail(e.to_string()))?;
    let mut manifest_bytes=manifest_bytes;manifest_bytes.push(b'\n');
    let relative=format!("packages/{name}/manifest.json");
    let lock_object=json!({"lockVersion":1,"packages":[{
        "name":name,"version":version,"manifest":relative,
        "manifestSha256":sha(&manifest_bytes),"sourceSha256":sha(output.as_bytes())
    }]});
    let mut lock_bytes=serde_json::to_vec_pretty(&lock_object).map_err(|e|fail(e.to_string()))?;
    lock_bytes.push(b'\n');
    verify_generated(name,output.as_bytes(),&manifest_bytes,&lock_bytes)?;
    let manifest_path=package.join("manifest.json");
    let source_path=package.join("lib.hc");
    // In check mode reject any drift; in write mode use deterministic bytes.
    // Disallow symlink targets (including dangling links).
    for p in [&manifest_path,&source_path,lock]{
        if let Ok(m)=fs::symlink_metadata(p){
            if !m.file_type().is_file(){return Err(fail(format!("Unsafe output target: {}",p.display())))}
        }
    }
    if check_only {
        write_or_check(&source_path,output.as_bytes(),true)?;
        write_or_check(&manifest_path,&manifest_bytes,true)?;
        write_or_check(lock,&lock_bytes,true)?;
        load_lockfile(lock).map_err(|e|fail(format!("Generated package verification: {e}")))?;
    } else {
        write_or_check(&source_path,output.as_bytes(),false)?;
        write_or_check(&manifest_path,&manifest_bytes,false)?;
        write_or_check(lock,&lock_bytes,false)?;
        load_lockfile(lock).map_err(|e|fail(format!("Generated package verification: {e}")))?;
    }
    Ok(())
}
