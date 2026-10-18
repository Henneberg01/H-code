//! M16.2: real rigid ∀T source validation + per-operation-call specialization.
use hcode_compiler::{ast::StmtKind,checker::check,codegen::emit,lexer::{lex,TokenKind},
    packages::{load_lockfile,PackageRegistry},parser::parse};
use serde_json::{Value,json};
use sha2::{Sha256,Digest};
use std::{path::{Path,PathBuf},fs,process::Command,time::{SystemTime,UNIX_EPOCH}};

fn root()->PathBuf{Path::new(env!("CARGO_MANIFEST_DIR")).parent().unwrap().to_path_buf()}
fn shab(bytes:&[u8])->String{format!("{:x}",Sha256::digest(bytes))}
fn compile(code:&str,reg:&PackageRegistry)->Result<String,String>{
    let ast=parse(code).map_err(|e|e.to_string())?;
    let checked=check(&ast,reg,true).map_err(|e|e.to_string())?;
    emit(&checked,reg)
}
fn run(code:&str,reg:&PackageRegistry)->Result<String,String>{
    let js=compile(code,reg)?;
    let out=Command::new("node").args(["--input-type=module","--eval",&js])
        .output().map_err(|e|e.to_string())?;
    if !out.status.success(){return Err(String::from_utf8_lossy(&out.stderr).to_string());}
    Ok(String::from_utf8_lossy(&out.stdout).replace("\r\n","\n"))
}
struct Temp{path:PathBuf,lock:Value}
impl Drop for Temp {fn drop(&mut self){let _=fs::remove_dir_all(&self.path);}}
impl Temp {
    fn new()->Self{
        let n=SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_nanos();
        let path=std::env::temp_dir().join(format!("hcode-m16-2-{}-{n}",std::process::id()));
        fs::create_dir_all(path.join("packages/poly.signs")).unwrap();
        for name in ["manifest.json","lib.hc"]{
            fs::copy(root().join("packages/poly.signs").join(name),path.join("packages/poly.signs").join(name)).unwrap();
        }
        let lock=serde_json::from_slice(&fs::read(root().join("hcode.m16.2.lock.json")).unwrap()).unwrap();
        Self{path,lock}
    }
    fn manifest(&self)->PathBuf{self.path.join("packages/poly.signs/manifest.json")}
    fn source(&self)->PathBuf{self.path.join("packages/poly.signs/lib.hc")}
    fn lockfile(&self)->PathBuf{self.path.join("hcode.lock.json")}
    fn save(&mut self){
        self.lock["packages"][0]["manifestSha256"]=json!(shab(&fs::read(self.manifest()).unwrap()));
        self.lock["packages"][0]["sourceSha256"]=json!(shab(&fs::read(self.source()).unwrap()));
        fs::write(self.lockfile(),serde_json::to_vec(&self.lock).unwrap()).unwrap();
    }
    fn manifest_edit(&mut self,f:impl FnOnce(&mut Value)){
        let mut m:Value=serde_json::from_slice(&fs::read(self.manifest()).unwrap()).unwrap();
        f(&mut m);
        fs::write(self.manifest(),serde_json::to_vec(&m).unwrap()).unwrap();
        self.save();
    }
    fn source_edit(&mut self,s:&str){fs::write(self.source(),s).unwrap();self.save();}
    fn load(&self)->Result<PackageRegistry,String>{load_lockfile(&self.lockfile()).map_err(|e|e.to_string())}
}
const USE:&str="use \"poly.signs@1.0.0\" as p;\n";

#[test]
fn universal_sign_and_ascii_keyword_are_the_same_real_lexer_token(){
    assert_eq!(lex("∀T ƒ f(xs:⟦T⟧)→T ↩ xs⟦0⟧;").unwrap()[0].kind,TokenKind::Forall);
    assert_eq!(lex("forall T fn f(xs:[[T]]) -> T return xs[[0]];").unwrap()[0].kind,TokenKind::Forall);
    let sign=parse("∀T ƒ head(xs:⟦T⟧)→T ↩ xs⟦0⟧;").unwrap();
    let alias=parse("forall T fn head(xs:[[T]]) -> T return xs[[0]];").unwrap();
    // Unicode glyphs and ASCII aliases carry different source columns:
    // compare normalized semantic structure, not raw spans.
    let StmtKind::Function{name:a,type_parameters:ta,parameters:pa,returns:ra,body:ba}=&sign.statements[0].kind else {panic!("Expected glyph function");};
    let StmtKind::Function{name:b,type_parameters:tb,parameters:pb,returns:rb,body:bb}=&alias.statements[0].kind else {panic!("Expected ASCII function");};
    assert_eq!((a,ta,ra), (b,tb,rb));
    assert_eq!(pa[0].annotation,pb[0].annotation);
    assert_eq!(pa[0].name,pb[0].name);
    assert_eq!(ba.len(),bb.len());
    assert_eq!(ta,&vec!["T".to_string()]);
    for src in ["∀T,T ƒ f(xs:⟦T⟧)→T ↩ xs⟦0⟧;","∀Number ƒ f(x:Number)→Number ↩ x;",
        "∀T,U,V,W,X,Y,Z,P,Q ƒ f(x:T)→T ↩ x;","∀T ≔x←1;"]{
        assert!(parse(src).is_err(),"{src}");
    }
}

#[test]
fn signed_v3_package_runs_real_rust_compiled_hcode_with_multiple_types(){
    let registry=load_lockfile(&root().join("hcode.m16.2.lock.json")).unwrap();
    let demo=fs::read_to_string(root().join("packages/poly.signs/demo.hc")).unwrap();
    assert_eq!(run(&demo,&registry).unwrap(),"2\na\ntrue\n4\n4\n");
    let tests=[
        (format!("{USE}print(p∷⥇(⟦-3.5,2⟧));"),"-3.5\n"),
        (format!("{USE}print(p∷⥇(⟦\"hello\",\"world\"⟧));"),"hello\n"),
        (format!("{USE}print(p∷⥇(⟦⊥,⊤⟧));"),"false\n"),
        (format!("{USE}print(⌗p∷⥇(⟦⟦1,2⟧,⟦3⟧⟧));"),"2\n"),
        (format!("{USE}print(⌗p∷⥈(⟦\"x\",\"y\"⟧));"),"4\n"),
        (format!("{USE}print(⌗p∷⥈(⟦⟦1⟧,⟦2⟧⟧));"),"4\n")
    ];
    for (src,expected) in tests{assert_eq!(run(&src,&registry).unwrap(),expected,"{src}");}
    let same_scope=format!("{USE}print(p∷⥇(⟦1⟧));print(p∷⥇(⟦\"q\"⟧));print(p∷⥇(⟦⊤⟧));");
    assert_eq!(run(&same_scope,&registry).unwrap(),"1\nq\ntrue\n");
}

#[test]
fn generic_arguments_are_not_any_and_never_leak_between_calls(){
    let r=load_lockfile(&root().join("hcode.m16.2.lock.json")).unwrap();
    for source in [
        format!("{USE}print(p∷⥇(⟦⟧));"),
        format!("{USE}print(p∷⥈(⟦⟧));"),
        format!("{USE}print(p∷⥇(⟦1,\"x\"⟧));"),
        format!("{USE}print(p∷⥇(42));"),
        format!("{USE}print(p∷⥇());"),
        format!("{USE}print(p∷⥇(⟦1⟧,⟦2⟧));"),
        format!("{USE}print(p∷⥈(⟦⊤,7⟧));")
    ]{
        let error=compile(&source,&r).unwrap_err();
        assert!(error.contains("TYPE"),"{source}: {error}");
    }
}

#[test]
fn rigid_type_t_does_not_silently_become_number_or_arbitrary_constant(){
    for body in [
        "∀T ƒ head(xs:⟦T⟧)→T ↩ 42;",
        "∀T ƒ head(xs:⟦T⟧)→T ↩ xs⟦0⟧+xs⟦0⟧;",
        "∀T ƒ head(xs:⟦T⟧)→T ↩ \"x\";",
        "∀T ƒ head(xs:⟦T⟧)→T ↩ xs⟦0⟧*2;"
    ]{
        let mut f=Temp::new();
        f.source_edit(&(body.to_string()+"\n∀T ƒ repeat(xs:⟦T⟧)→⟦T⟧ ↩ xs⧺xs;\n"));
        let e=f.load().unwrap_err();
        assert!(e.contains("TYPE"),"{body}: {e}");
    }
}

#[test]
fn generic_manifest_and_source_binders_must_match_and_remain_bound(){
    let mut f=Temp::new();
    f.manifest_edit(|m|{
        m["operations"][0]["typeParameters"]=json!(["U"]);
        m["operations"][0]["parameters"][0]["type"]=json!("⟦U⟧");
        m["operations"][0]["returns"]=json!("U");
    });
    assert!(f.load().unwrap_err().contains("binder mismatch"));
    let mut f=Temp::new();f.manifest_edit(|m|m["operations"][0]["returns"]=json!("Any"));
    assert!(f.load().unwrap_err().contains("Unsupported package contract type"));
    let mut f=Temp::new();f.manifest_edit(|m|m["operations"][0]["parameters"][0]["type"]=json!("⟦U⟧"));
    assert!(f.load().unwrap_err().contains("Unsupported package contract type"));
    let mut f=Temp::new();f.manifest_edit(|m|m["operations"][0]["typeParameters"]=json!(["T","T"]));
    assert!(f.load().unwrap_err().contains("duplicate"));
    let mut f=Temp::new();f.manifest_edit(|m|m["operations"][0]["typeParameters"]=json!(["Number"]));
    assert!(f.load().unwrap_err().contains("Invalid"));
    let mut f=Temp::new();f.manifest_edit(|m|m["operations"][0]["typeParameters"]=json!([]));
    assert!(f.load().unwrap_err().contains("Unsupported package contract type"));
    let mut f=Temp::new();f.manifest_edit(|m|m["operations"][0]["glyph"]=json!("∑"));
    assert!(f.load().unwrap_err().contains("reserved"));
}

#[test]
fn old_manifest_formats_cannot_smuggle_quantifiers(){
    for format in [1,2]{
        let mut f=Temp::new();f.manifest_edit(|m|m["format"]=json!(format));
        assert!(f.load().is_err());
    }
    let old=load_lockfile(&root().join("hcode.m16.lock.json")).unwrap();
    assert!(run("use \"vec.math@1.0.0\" as vec;print(vec∷⊚(⟦2,3,5⟧));",&old).unwrap()=="10\n");
}

#[test]
fn hash_modification_is_rejected_even_for_statistically_typed_generic_functions(){
    let mut f=Temp::new();f.save();assert!(f.load().is_ok());
    fs::write(f.source(),"∀T ƒ head(xs:⟦T⟧)→T ↩ 777;\n").unwrap();
    assert!(f.load().unwrap_err().contains("source SHA-256 mismatch"));
    let mut f=Temp::new();f.save();fs::write(f.manifest(),"{}\n").unwrap();
    assert!(f.load().unwrap_err().contains("manifest SHA-256 mismatch"));
}

#[test]
fn user_signs_use_real_import_scope_and_reject_ambiguous_unqualified_use(){
    let r=load_lockfile(&root().join("hcode.m16.2.lock.json")).unwrap();
    assert_eq!(run(&(USE.to_string()+"print(⥇(⟦8,9⟧));"),&r).unwrap(),"8\n");
    assert!(compile("print(⥇(⟦8,9⟧));",&r).unwrap_err().contains("IMPORT"));
}
