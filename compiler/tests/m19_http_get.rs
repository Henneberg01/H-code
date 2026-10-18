use hcode_compiler::{parser::parse,checker::check,codegen::emit,packages::PackageRegistry};
use std::{io::{Read,Write},net::TcpListener,process::Command,thread,time::{Duration,Instant}};

fn compile(source:&str)->Result<String,String>{
    let parsed=parse(source).map_err(|e|e.to_string())?;
    let registry=PackageRegistry::default();
    let typed=check(&parsed,&registry,true).map_err(|e|e.to_string())?;
    emit(&typed,&registry)
}
#[test]
fn symbol_and_ascii_alias_produce_identical_typed_js(){
    let glyph=compile("≔r←⤋\"https://example.invalid\";print(r·status);").unwrap();
    let ascii=compile("let r=http_get \"https://example.invalid\";print(r.status);").unwrap();
    assert_eq!(glyph,ascii);
    assert!(glyph.contains("await __hc_http_get"));
    assert!(glyph.contains("const __hc_http_get=async raw=>"));
    assert!(!compile("print(1);").unwrap().contains("const __hc_http_get"));
}
#[test]
fn network_is_a_checked_effect_and_is_not_allowed_in_pure_sources_or_sync_closures(){
    for (source,needle) in [
      ("print((⤋ 12)·body);","⤋ expects a String URL"),
      ("ƒ danger()→String ↩ (⤋\"https://example.invalid\")·body;","only available in effectful top-level"),
      ("≔f←λ u:⤋u;","only available in effectful top-level")
    ] {
       let error=compile(source).unwrap_err();
       assert!(error.contains(needle),"{source}: {error}");
    }
    let program=parse("≔r←⤋\"https://example.invalid\";").unwrap();
    let error=check(&program,&PackageRegistry::default(),false).unwrap_err().to_string();
    assert!(error.contains("EFFECT"),"{error}");
}
#[test]
fn generated_network_effect_denies_ambient_access(){
    let js=compile("print((⤋\"http://127.0.0.1:41231/nope\")·status);").unwrap();
    let output=Command::new("node").arg("--input-type=module").arg("--eval").arg(js)
      .env_remove("HCODE_HTTP_ALLOWED_ORIGINS").output().unwrap();
    assert!(!output.status.success(),"HTTP must deny absent origin grant");
    assert!(String::from_utf8_lossy(&output.stderr).contains("H-Code HTTP capability denied"));
}
#[test]
fn generated_network_effect_issues_real_get_and_exposes_typed_response(){
    let listener=TcpListener::bind("127.0.0.1:0").unwrap();
    listener.set_nonblocking(true).unwrap();
    let origin=format!("http://{}",listener.local_addr().unwrap());
    let server=thread::spawn(move||{
        let start=Instant::now();
        while start.elapsed()<Duration::from_secs(8) {
            match listener.accept(){
                Ok((mut socket,_))=>{
                    socket.set_read_timeout(Some(Duration::from_secs(2))).unwrap();
                    let mut data=[0u8;1024];
                    let count=socket.read(&mut data).unwrap();
                    assert!(String::from_utf8_lossy(&data[..count]).starts_with("GET /case HTTP/1.1"));
                    socket.write_all(b"HTTP/1.1 429 Too Many Requests\r\nRetry-After: 1\r\nContent-Length: 4\r\nConnection: close\r\n\r\nbusy").unwrap();
                    return true;
                }
                Err(e) if e.kind()==std::io::ErrorKind::WouldBlock=>thread::sleep(Duration::from_millis(10)),
                Err(e)=>panic!("HTTP accept: {e}")
            }
        }
        false
    });
    let code=format!("≔r←⤋\"{origin}/case\";print(r·status);print(r·body);print(r·retryAfter);print(r·ok);");
    let js=compile(&code).unwrap();
    let result=Command::new("node").arg("--input-type=module").arg("--eval").arg(js)
       .env("HCODE_HTTP_ALLOWED_ORIGINS",&origin).output().unwrap();
    assert!(result.status.success(),"{}",String::from_utf8_lossy(&result.stderr));
    assert!(server.join().unwrap(),"GET never arrived");
    assert_eq!(String::from_utf8_lossy(&result.stdout),"429\nbusy\n1000\nfalse\n");
}
