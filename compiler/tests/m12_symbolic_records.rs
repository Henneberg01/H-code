use hcode_compiler::{
    ast::{ExprKind,StmtKind},
    checker::{check,Type,TypedStmtKind},
    codegen::emit, lexer::{lex,TokenKind},
    packages::PackageRegistry, parser::parse
};
use std::process::Command;

fn compile(source:&str)->Result<String,String>{
    let ast=parse(source).map_err(|e|e.to_string())?;
    let registry=PackageRegistry::default();
    let typed=check(&ast,&registry,true).map_err(|e|e.to_string())?;
    emit(&typed,&registry)
}
fn run(source:&str)->Result<String,String>{
    let js=compile(source)?;
    let child=Command::new("node").args(["--input-type=module","--eval",&js])
        .output().map_err(|e|e.to_string())?;
    if !child.status.success(){return Err(String::from_utf8_lossy(&child.stderr).into());}
    Ok(String::from_utf8_lossy(&child.stdout).replace("\r\n","\n"))
}

#[test]
fn record_syntax_parses_to_the_same_typed_ast_as_ascii_aliases(){
    let unicode="≔x←⦃name:\"Ada\",age:42⦄;print(x·age);";
    let ascii="let x={name:\"Ada\",age:42};print(x.age);";
    assert_eq!(compile(unicode).unwrap(),compile(ascii).unwrap());
    assert_eq!(run(unicode).unwrap(),"42\n");
    assert_eq!(run(ascii).unwrap(),"42\n");
    assert_eq!(lex("⦃").unwrap()[0].kind,TokenKind::RecOpen);
    assert_eq!(lex("⦄").unwrap()[0].kind,TokenKind::RecClose);
    assert_eq!(lex("·").unwrap()[0].kind,TokenKind::Field);
    let ast=parse("≔x←⦃a:1⦄;").unwrap();
    assert!(matches!(&ast.statements[0].kind,StmtKind::Let{value,..}
        if matches!(&value.kind,ExprKind::Record(fields) if fields.len()==1)));
}

#[test]
fn inferred_structural_record_types_are_sorted_and_exact(){
    let ast=parse("≔x←⦃z:\"Ada\",a:42⦄;").unwrap();
    let ty=check(&ast,&PackageRegistry::default(),true).unwrap();
    if let TypedStmtKind::Let{value,..}=&ty.statements[0].kind{
        assert_eq!(value.ty,Type::Record(vec![
            ("a".into(),Type::Number),("z".into(),Type::String)
        ]));
    }else{panic!("Expected record binding")};
    let nested=check(&parse("≔u:⦃age:Number,inner:⦃n:String⦄⦄←⦃age:42,inner:⦃n:\"a\"⦄⦄;").unwrap(),
        &PackageRegistry::default(),true).unwrap();
    if let TypedStmtKind::Let{value,..}=&nested.statements[0].kind{
        assert_eq!(value.ty,Type::Record(vec![
          ("age".into(),Type::Number),
          ("inner".into(),Type::Record(vec![("n".into(),Type::String)]))
        ]));
    } else { panic!("Expected typed record"); }
}

#[test]
fn records_execute_as_real_frozen_null_prototype_values_with_nested_projections(){
    for (src,expected) in [
        ("≔x←⦃inner:⦃n:42⦄,list:⟦1,2⟧⦄;print(x·inner·n);print(x·list⟦1⟧);","42\n2\n"),
        ("≔x:⦃age:Number,name:String⦄←⦃name:\"Ada\",age:42⦄;print(x·name);print(x·age);","Ada\n42\n"),
        ("ƒ get(r:⦃age:Number,name:String⦄)→Number ↩ r·age;print(get(⦃age:42,name:\"Ada\"⦄));","42\n"),
        ("fn get(r:{age:Number}) -> Number return r.age;print(get({age:42}));","42\n"),
        ("≔x←⦃constructor:1,__proto__:2⦄;print(x·constructor);print(x·__proto__);","1\n2\n"),
        ("≔x:⦃⦄←⦃⦄;print(⊤);","true\n"),
        ("≔xs←⟦⦃v:1⦄,⦃v:2⦄⟧;print(xs⟦1⟧·v);","2\n"),
        ("≔x:⦃inner:⦃n:Number⦄,items:⟦String⟧⦄←⦃inner:⦃n:5⦄,items:⟦\"a\"⟧⦄;print(x·inner·n);","5\n")
    ] {
        assert_eq!(run(src).unwrap(),expected,"{src}");
    }
}

#[test]
fn static_typechecker_rejects_missing_fields_duplicates_and_mismatches(){
    let cases=[
        ("≔x←⦃a:1,a:2⦄;","Duplicate record field"),
        ("≔x:⦃a:Number,a:String⦄←⦃a:1⦄;","Duplicate record field"),
        ("≔x←⦃a:1⦄;print(x·missing);","Unknown record field"),
        ("≔x←⦃a:1⦄;print(x·toString);","Unknown record field"),
        ("print(42·age);","Field access requires"),
        ("≔x:⦃a:Number⦄←⦃a:\"wrong\"⦄;","Declaration type mismatch"),
        ("≔x:⦃a:Number⦄←⦃b:1⦄;","Declaration type mismatch"),
        ("≔x:⦃a:Number⦄←⦃a:1,b:2⦄;","Declaration type mismatch"),
        ("≔xs←⟦⦃a:1⦄,⦃a:\"wrong\"⦄⟧;","Sequence elements must have matching types"),
        ("ƒ get(x:⦃a:Number⦄)→Number ↩ x·a;print(get(⦃a:\"wrong\"⦄));","Call argument types or arity mismatch"),
        ("ƒ f(x:⦃n:Number⦄)→Number ↩ x·missing;","Unknown record field"),
        ("ƒ f(x:⦃n:Number⦄)→⦃n:Number⦄ ↩ x·n;","Return type mismatch")
    ];
    for (src,expected) in cases {
        let failure=compile(src).unwrap_err();
        assert!(failure.contains(expected),"{src}: {failure}");
    }
}
