//! M2 verified local package loader. Contracts are resolved statically: no package code is executed.
use std::{collections::{HashMap,HashSet},fs,path::{Path,PathBuf}};
use serde::Deserialize;
use sha2::{Digest,Sha256};
use unicode_normalization::UnicodeNormalization;
use crate::{ast::StmtKind,checker::{check,Type,TypedProgram},lexer::{is_symbol,Span},parser::parse,Diagnostic};

#[derive(Clone,Debug,Default)]
pub struct PackageRegistry { pub packages:HashMap<String,PackageDef> }
#[derive(Clone,Debug)]
pub struct PackageDef { pub operations:Vec<OperationSig>, pub typed_source:TypedProgram }
#[derive(Clone,Debug)]
pub struct OperationSig {
    pub id:String,pub name:String,pub glyph:String,
    pub parameters:Vec<Type>,pub returns:Type,pub implementation:String,
    pub type_parameters:Vec<String>,
}

#[derive(Deserialize)]
struct Lockfile { #[serde(rename="lockVersion")] lock_version:u32, packages:Vec<LockEntry> }
#[derive(Deserialize)]
struct LockEntry {
    name:String,version:String,manifest:String,
    #[serde(rename="manifestSha256")] manifest_hash:String,
    #[serde(rename="sourceSha256")] source_hash:String,
}
#[derive(Deserialize)]
struct Manifest { format:u32,name:String,version:String,source:String,operations:Vec<Operation> }
#[derive(Deserialize)]
struct Operation { name:String,glyph:String,parameters:Vec<Parameter>,returns:String,effects:Vec<String>,implementation:String,
    #[serde(default,rename="typeParameters")] type_parameters:Vec<String> }
#[derive(Deserialize)]
struct Parameter { name:String,#[serde(rename="type")] ty:String }

fn failure(msg:impl Into<String>)->Diagnostic { Diagnostic::new("IMPORT",msg.into(),Span::new(1,1)) }
fn bounded_read(path:&Path)->Result<Vec<u8>,Diagnostic>{
    let meta=fs::metadata(path).map_err(|e|failure(format!("Cannot access {}: {e}",path.display())))?;
    if !meta.is_file() || meta.len()>1_048_576 {return Err(failure(format!("Package file is not a regular file or exceeds 1 MiB: {}",path.display())));}
    fs::read(path).map_err(|e|failure(format!("Cannot read {}: {e}",path.display())))
}
fn safe_read(root:&Path,relative:&str)->Result<(PathBuf,Vec<u8>),Diagnostic>{
    if relative.is_empty() || relative.starts_with('/') || relative.contains('\\') || relative.contains(':') ||
        relative.split('/').any(|p|p.is_empty()||p=="."||p==".."){
        return Err(failure(format!("Unsafe package path {relative}")));
    }
    let root=fs::canonicalize(root).map_err(|e|failure(format!("Cannot resolve package root: {e}")))?;
    let full=fs::canonicalize(root.join(relative)).map_err(|e|failure(format!("Cannot resolve package file {relative}: {e}")))?;
    if !full.starts_with(&root) || full==root {return Err(failure("Package path escapes its directory"));}
    let data=bounded_read(&full)?;
    Ok((full,data))
}
fn utf8(bytes:Vec<u8>,label:&str)->Result<String,Diagnostic>{
    String::from_utf8(bytes).map_err(|_|failure(format!("{label} is not valid UTF-8")))
}
fn verify_sha(bytes:&[u8],expected:&str,label:&str)->Result<(),Diagnostic>{
    if expected.len()!=64 || !expected.bytes().all(|b|b.is_ascii_digit()||('a'..='f').contains(&(b as char))){
        return Err(failure(format!("{label} has invalid SHA-256 digest")));
    }
    let actual=format!("{:x}",Sha256::digest(bytes));
    if actual!=expected {return Err(failure(format!("{label} SHA-256 mismatch")));}
    Ok(())
}
fn ident(v:&str)->bool {
    let mut cs=v.chars();
    matches!(cs.next(),Some(c) if c.is_ascii_alphabetic()||c=='_') && cs.all(|c|c.is_ascii_alphanumeric()||c=='_')
}
fn keyword(v:&str)->bool {
    matches!(v,"fn"|"let"|"return"|"true"|"false"|"if"|"else"|"while"|"and"|"or"|"not"|"use"|"import"|"export"|"as"|"lambda"|"json_in"|"json_out"|"text_scalars"|"text_words"|"text_hist"|"file_read"|"csv_typed"|"stdin_text"|"arith_eval")
}
fn package_name(v:&str)->bool{
    !v.is_empty() && v.as_bytes()[0].is_ascii_lowercase() &&
    v.bytes().all(|c|c.is_ascii_lowercase()||c.is_ascii_digit()||c==b'.'||c==b'-') &&
    !v.contains("..") && !v.ends_with('.') && !v.ends_with('-')
}
fn version(v:&str)->bool {
    let xs:Vec<_>=v.split('.').collect();
    xs.len()==3 && xs.iter().all(|x|!x.is_empty()&& x.bytes().all(|n|n.is_ascii_digit())&&(x.len()==1||!x.starts_with('0')))
}
fn parse_contract_type(ty:&str,format:u32,bound:&[String])->Result<Type,Diagnostic>{
    // V1 contracts remain scalar-only. V2 reuses the compiler's own *concrete*
    // recursive Type::Sequence; no unchecked Any, T, generic erasure or JS types.
    if format==1 && (ty.contains('⟦') || ty.contains('⟧')){
        return Err(failure("Sequence types require package manifest v2; v1 scalar contracts only"));
    }
    if ty.len()>256 || ty.matches('⟦').count()>16 {
        return Err(failure("Package contract type exceeds nesting or length limit"));
    }
    Type::from_bound_name(ty,bound,Span::new(1,1))
        .map_err(|_|failure(format!("Unsupported package contract type {ty}")))
}
pub(crate) fn reserved_glyph(c:char)->bool {
    matches!(c,'ƒ'|'≔'|'↩'|'→'|'←'|'⊤'|'⊥'|'∧'|'∨'|'¬'|'≡'|'≠'|'≤'|'≥'|'∷'|'▷'|'∘'|'◇'|'⌗'|'⧺'|'∑'|'⌕'|'⇢'|'λ'|'⊢'|'⊣'|'⟳'|'⇒'|'⟦'|'⟧'|'⦃'|'⦄'|'·'|'⊞'|'⤓'|'⤒'|'⫶'|'⟟'|'⧉'|'⧄'|'⧇'|'⌨'|'⩚'|'∅'|'∀'|'∈')
}

pub fn load_lockfile(path:&Path)->Result<PackageRegistry,Diagnostic>{
    let lockpath=fs::canonicalize(path).map_err(|e|failure(format!("Cannot resolve lockfile {}: {e}",path.display())))?;
    let lock:Lockfile=serde_json::from_slice(&bounded_read(&lockpath)?)
        .map_err(|e|failure(format!("Invalid H-Code lockfile: {e}")))?;
    if lock.lock_version!=1 {return Err(failure("Unsupported H-Code lockfile version"));}
    if lock.packages.len()>128 {return Err(failure("Package limit exceeded (128)"));}
    let root=lockpath.parent().expect("file always has parent");
    let mut registry=PackageRegistry::default();
    for entry in lock.packages {
        if !package_name(&entry.name)||!version(&entry.version){return Err(failure("Invalid package lock entry name/version"));}
        let key=format!("{}@{}",entry.name,entry.version);
        if registry.packages.contains_key(&key){return Err(failure(format!("Duplicate locked package {key}")));}
        let (manifest_path,manifest_bytes)=safe_read(root,&entry.manifest)?;
        verify_sha(&manifest_bytes,&entry.manifest_hash,&format!("{key} manifest"))?;
        let manifest:Manifest=serde_json::from_slice(&manifest_bytes).map_err(|e|failure(format!("Invalid package manifest: {e}")))?;
        if !matches!(manifest.format,1|2|3) {
            return Err(failure(format!("Unsupported package manifest format {}: {key}",manifest.format)));
        }
        if manifest.name!=entry.name||manifest.version!=entry.version{
            return Err(failure(format!("Package manifest identity mismatch: {key}")));
        }
        if !manifest.source.ends_with(".hc") || !manifest.source.as_bytes().iter().all(|c|c.is_ascii_alphanumeric()||matches!(*c,b'_'|b'-'|b'.')) || manifest.source.contains("..") {
            return Err(failure("Package source must be a local .hc filename"));
        }
        let (_,source_bytes)=safe_read(manifest_path.parent().expect("manifest has parent"),&manifest.source)?;
        verify_sha(&source_bytes,&entry.source_hash,&format!("{key} source"))?;
        let source=utf8(source_bytes,"Package source")?;
        let ast=parse(&source)?;
        if ast.statements.iter().any(|s|!matches!(s.kind,StmtKind::Function{..})) {
            return Err(failure(format!("{key}: only top-level functions permitted in a pure package")));
        }
        if manifest.format!=3 && ast.statements.iter().any(|s|matches!(&s.kind,StmtKind::Function{type_parameters,..} if !type_parameters.is_empty())){
            return Err(failure("∀ source functions require format 3"));
        }
        // Entire library body is statically checked with no ambient I/O functions.
        let typed_source=check(&ast,&PackageRegistry::default(),false)?;
        let mut operations=Vec::new();let mut names=HashSet::new();let mut glyphs=HashSet::new();
        if manifest.operations.is_empty()||manifest.operations.len()>100 {return Err(failure("Package must export 1..100 operations"));}
        for op in manifest.operations {
            if manifest.format!=3 && !op.type_parameters.is_empty(){
                return Err(failure("∀ type parameters require manifest format 3"));
            }
            if op.type_parameters.len()>8{return Err(failure("Maximum 8 ∀ type parameters"));}
            let mut vars=HashSet::new();
            for name in &op.type_parameters{
                if !ident(name) || !name.starts_with(|c:char|c.is_ascii_uppercase()) ||
                    name.len()>32 || matches!(name.as_str(),"Number"|"String"|"Bool"|"Unit") ||
                    !vars.insert(name.clone()){
                    return Err(failure(format!("Invalid or duplicate ∀ binder {name}")));
                }
            }
            if !ident(&op.name)||keyword(&op.name)||!names.insert(op.name.clone()){
                return Err(failure(format!("Invalid or duplicate operation name {}",op.name)));
            }
            let chars:Vec<char>=op.glyph.chars().collect();
            if chars.len()!=1||!is_symbol(chars[0])||reserved_glyph(chars[0])||
                op.glyph.nfc().collect::<String>()!=op.glyph||op.glyph.nfkc().collect::<String>()!=op.glyph||
                !glyphs.insert(op.glyph.clone()){
                return Err(failure(format!("Invalid, reserved or duplicate glyph {}",op.glyph)));
            }
            if !op.effects.is_empty() {return Err(failure("M2 package operations must be pure (effects: [])"));}
            if op.parameters.len()>32 {return Err(failure("Package operation has more than 32 parameters"));}
            let mut parameters=Vec::new();let mut param_names=HashSet::new();
            for param in &op.parameters {
                if !ident(&param.name)||keyword(&param.name)||!param_names.insert(param.name.clone()){
                    return Err(failure(format!("Invalid or duplicate parameter name {}",param.name)));
                }
                parameters.push(parse_contract_type(&param.ty,manifest.format,&op.type_parameters)?);
            }
            let returns=parse_contract_type(&op.returns,manifest.format,&op.type_parameters)?;
            let implementation=ast.statements.iter().find_map(|s|match &s.kind {
                StmtKind::Function{name,type_parameters,parameters,returns,body:_} if name==&op.implementation=>Some((type_parameters,parameters,returns)),
                _=>None
            }).ok_or_else(||failure(format!("{}: implementation {} not found",op.name,op.implementation)))?;
            if implementation.0!=&op.type_parameters{
                return Err(failure(format!("{}: ∀ binder mismatch between manifest and source",op.name)));
            }
            if implementation.1.len()!=parameters.len(){return Err(failure(format!("{}: contract argument count mismatch",op.name)));}
            for (i,(param,sig)) in implementation.1.iter().zip(&op.parameters).enumerate() {
                if param.name!=sig.name || param.annotation.as_deref()!=Some(sig.ty.as_str()) {
                    return Err(failure(format!("{}: parameter {} contract mismatch",op.name,i+1)));
                }
            }
            if implementation.2.as_deref()!=Some(op.returns.as_str()){
                return Err(failure(format!("{}: return contract mismatch",op.name)));
            }
            if manifest.format==3 && !op.type_parameters.is_empty(){
                fn mentions(ty:&Type,name:&str)->bool{
                    match ty {
                        Type::Generic(v)=>v==name,
                        Type::Sequence(inner)=>mentions(inner,name),
                        Type::Record(fields)=>fields.iter().any(|(_,ty)|mentions(ty,name)),
                        Type::Function(xs,ret)=>xs.iter().any(|a|mentions(a,name))||mentions(ret,name),
                        _=>false
                    }
                }
                for name in &op.type_parameters{
                    if !parameters.iter().any(|p|mentions(p,name)) && !mentions(&returns,name){
                        return Err(failure(format!("Unused ∀ binder {name}")));
                    }
                }
            }
            operations.push(OperationSig{id:format!("{key}::{}",op.name),name:op.name,glyph:op.glyph,parameters,returns,implementation:op.implementation,type_parameters:op.type_parameters});
        }
        registry.packages.insert(key,PackageDef{operations,typed_source});
    }
    Ok(registry)
}
