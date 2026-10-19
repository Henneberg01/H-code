use hcode_compiler::{lexer::{lex,TokenKind},parser::parse,checker::{check,TypedStmtKind,TypedExprKind,Type},codegen::emit,packages::PackageRegistry};
fn typed(s:&str,pure:bool)->Result<hcode_compiler::checker::TypedProgram,String>{
 let ast=parse(s).map_err(|e|e.to_string())?;
 check(&ast,&PackageRegistry::default(),!pure).map_err(|e|e.to_string())
}
fn compile(s:&str,pure:bool)->Result<String,String>{
 emit(&typed(s,pure)?,&PackageRegistry::default())
}
const QUERY:&str=r#"⧈⦃region:String,amount:Number⦄("orders.sqlite","SELECT region,amount FROM sales WHERE region=? ORDER BY amount",⟦"North"⟧)"#;
#[test]
fn native_db_glyph_ascii_same_ast_types_and_emission(){
 let symbol=format!("≔ rows={QUERY};");
 let alias=symbol.replace('⧈',"db_rows");
 let a=compile(&symbol,false).unwrap();
 let b=compile(&alias,false).unwrap();
 assert_eq!(a,b,"Symbol and ASCII must generate byte-for-byte identical JS");
 assert!(a.contains("node:sqlite"));
 assert!(a.contains("__hc_db_rows"));
 assert!(a.contains("HCODE_SQLITE_READ_ROOT"));
 assert!(!a.contains("__hc_dashboard"));
 let a=lex(&symbol).unwrap();
 let b=lex(&alias).unwrap();
 assert!(a.iter().any(|t|t.kind==TokenKind::DbRows));
 assert_eq!(a.iter().map(|t|t.kind.clone()).collect::<Vec<_>>(),
            b.iter().map(|t|t.kind.clone()).collect::<Vec<_>>());
 let tree=typed(&symbol,false).unwrap();
 let TypedStmtKind::Let{value,..}=&tree.statements[0].kind else{panic!("expected typed let")};
 assert!(matches!(value.kind,TypedExprKind::DbRows{..}));
 assert!(matches!(value.ty,Type::Sequence(_)));
}
#[test]
fn compiler_rejects_wrong_schema_types_and_unauthorized_effect(){
 for bad in [
 r#"⧈Number("orders.sqlite","SELECT 1",⟦"a"⟧);"#,
 r#"⧈⦃x:⟦String⟧⦄("orders.sqlite","SELECT x",⟦"a"⟧);"#,
 r#"⧈⦃x:Unit⦄("orders.sqlite","SELECT x",⟦"a"⟧);"#,
 r#"⧈⦃⦄("orders.sqlite","SELECT x",⟦"a"⟧);"#,
 r#"⧈⦃x:String⦄(42,"SELECT x",⟦"a"⟧);"#,
 r#"⧈⦃x:String⦄("orders.sqlite",42,⟦"a"⟧);"#,
 r#"⧈⦃x:String⦄("orders.sqlite","SELECT x",⟦1⟧);"#,
 r#"⧈⦃x:String⦄("orders.sqlite","SELECT x",false);"#,
 r#"⧈⦃x:String⦄("orders.sqlite","SELECT x");"#
 ] {
  assert!(compile(bad,false).is_err(),"Should reject: {bad}");
 }
 assert!(compile(&format!("≔ rows={QUERY};"),true).is_err(),"DB is denied to pure signed packages");
 assert!(compile(&format!("ƒ f()→⟦⦃region:String,amount:Number⦄⟧ ↩ {QUERY};"),false).is_err(),
   "DB may not leak into synchronous functions");
 let simple=compile("print(1);",false).unwrap();
 assert!(!simple.contains("node:sqlite"),"Ordinary H-Code must not link DB runtime");
}


#[test]
fn symbol_first_table_projection_is_generic_typed_and_compatible_with_legacy_sql(){
 let glyph=r#"≔r←⧈⦃amount_cents:Number,day:String,region:String,status:String⦄("orders.sqlite","orders");"#;
 let alias=glyph.replace('⧈',"db_rows");
 let native=compile(glyph,false).unwrap();
 assert_eq!(native,compile(&alias,false).unwrap());
 assert!(native.contains("__hc_db_table"));
 assert!(native.contains("SELECT "));
 assert!(!glyph.contains("SELECT"),"Developer does not author SQL");
 assert!(!native.contains("__hc_dashboard"));
 let typed=typed(glyph,false).unwrap();
 let TypedStmtKind::Let{value,..}=&typed.statements[0].kind else {panic!("Expected typed record sequence")};
 assert!(matches!(value.kind,TypedExprKind::DbTable{..}));
 assert!(matches!(value.ty,Type::Sequence(_)));
 for bad in [
  r#"⧈Number("orders.sqlite","orders");"#,
  r#"⧈⦃x:⟦Number⟧⦄("orders.sqlite","orders");"#,
  r#"⧈⦃x:Number⦄(123,"orders");"#,
  r#"⧈⦃x:Number⦄("orders.sqlite",123);"#,
  r#"⧈⦃x:Number⦄("orders.sqlite");"#
 ]{assert!(compile(bad,false).is_err(),"Wrongly accepted {bad}");}
 assert!(compile(glyph,true).is_err(),"Pure packages may never read databases");
}
