use hcode_compiler::{
    checker::check,
    codegen::emit,
    parser::parse,
    packages::PackageRegistry
};
use std::process::Command;

fn compile(source:&str)->Result<String,String>{
    let ast=parse(source).map_err(|e|e.to_string())?;
    let registry=PackageRegistry::default();
    let checked=check(&ast,&registry,true).map_err(|e|e.to_string())?;
    emit(&checked,&registry)
}
fn run(source:&str)->Result<String,String>{
    let js=compile(source)?;
    let result=Command::new("node").args(["--input-type=module","--eval",&js]).output().map_err(|e|e.to_string())?;
    if !result.status.success(){return Err(String::from_utf8_lossy(&result.stderr).into());}
    Ok(String::from_utf8_lossy(&result.stdout).replace("\r\n","\n"))
}

#[test]
fn typed_sections_compile_to_real_unary_functions_and_compose_with_collection_signs(){
    for (source,expected) in [
        ("print((+2)(40));","42\n"),
        ("print((*2)(21));","42\n"),
        ("print((/2)(84));","42\n"),
        ("print((%3)(11));","2\n"),
        ("print((>0)(1));","true\n"),
        ("print((<=3)(4));","false\n"),
        ("print((>=1)(1));","true\n"),
        ("print((≡42)(42));","true\n"),
        ("print((≠42)(41));","true\n"),
        ("print((+\"b\")(\"a\"));","ab\n"),
        ("print(((*2)∘(+1))(20));","42\n"),
        ("print((-2)+3);","1\n")
    ]{
        assert_eq!(run(source).unwrap(),expected,"{source}");
    }
}
#[test]
fn identical_task_map_filter_sections_match_reference_stdout_in_real_compiled_node(){
    for (source,expected) in [
        ("≔y←⟦10,11⟧⇢(*2);print(y⟦0⟧);print(y⟦1⟧);","20\n22\n"),
        ("≔y←⟦-1,2,3,-2⟧⌕(>0);print(⌗y);print(y⟦0⟧);print(y⟦1⟧);","2\n2\n3\n"),
        ("print(∑(⟦-1,2,3,-2⟧⌕(>0)⇢(*2)));","10\n")
    ]{
        assert_eq!(run(source).unwrap(),expected,"{source}");
    }
}
#[test]
fn numeric_section_captures_operand_exactly_once(){
    let code="≔n←0;ƒ next(){n←n+1;↩n;}≔f←(*next());print(f(3));print(f(4));print(n);";
    assert_eq!(run(code).unwrap(),"3\n4\n1\n");
}
#[test]
fn static_section_validation_rejects_invalid_operand_types_and_bad_callbacks(){
    for (source,reason) in [
        ("print((>\"bad\")(1));","Operator section requires Number"),
        ("print((+⊤)(1));","+ requires Number or String"),
        ("print(⟦1⟧⌕(*2));","⌕ predicate must be unary and return Bool"),
        ("print((≡⟦1⟧)(⟦1⟧));","Equality requires a primitive comparable type"),
        ("print((*2)(1,2));","Call argument types or arity mismatch")
    ]{
        let err=compile(source).unwrap_err();
        assert!(err.contains(reason),"{source}: {err}");
    }
}

#[test]
fn exact_m14_three_task_sources_compile_and_run_in_real_rust_backend(){
    let root=std::path::Path::new(env!("CARGO_MANIFEST_DIR")).parent().unwrap();
    for (id,expected) in [
        ("sum-typed-sequence","10\n"),
        ("map-typed-sequence","20\n22\n"),
        ("filter-typed-sequence","2\n2\n3\n")
    ]{
        let file=root.join(format!("compact/benchmarks/m14/{id}.hc"));
        let text=std::fs::read_to_string(&file).unwrap();
        assert_eq!(run(&text).unwrap(),expected,"{id}");
    }
}
