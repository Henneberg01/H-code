use std::{fs,path::Path,process::Command};
fn project()->std::path::PathBuf{Path::new(env!("CARGO_MANIFEST_DIR")).parent().unwrap().to_path_buf()}
fn cli(args:&[&str])->std::process::Output{Command::new(env!("CARGO_BIN_EXE_hcodec")).current_dir(project()).args(args).output().unwrap()}
#[test]
fn m5_real_apps_compile_run_and_build(){
 let cases=[
 ("m5/invoice/main.hc","INVOICE\nsubtotal_cents 6000\ndiscount_cents 600\nvat_cents 1350\ntotal_cents 6750\n"),
 ("m5/inventory/main.hc","INVENTORY\nreorder true\norder_units 22\npurchase_cents 6578\n"),
 ("m5/savings/main.hc","SAVINGS\nyears 3\nbalance 1331\ntarget_reached true\n")
 ];
 for (file,expected) in cases {
  let direct=cli(&["run",file]);
  assert!(direct.status.success(),"{file}: {}",String::from_utf8_lossy(&direct.stderr));
  assert_eq!(String::from_utf8_lossy(&direct.stdout).replace("\r\n","\n"),expected,"{file}");
  let target=std::env::temp_dir().join(format!("hcode-m5-{}-{}.mjs",std::process::id(),file.replace('/',"-")));
  let target=target.to_string_lossy().into_owned();
  let build=cli(&["build",file,"--out",&target]);
  assert!(build.status.success(),"{file}: {}",String::from_utf8_lossy(&build.stderr));
  let generated=fs::read_to_string(&target).unwrap();
  assert!(generated.contains("__hc_operations"),"{file}: missing linker");
  let node=Command::new("node").arg(&target).output().unwrap();
  assert!(node.status.success(),"{file}: {}",String::from_utf8_lossy(&node.stderr));
  assert_eq!(String::from_utf8_lossy(&node.stdout).replace("\r\n","\n"),expected);
  fs::remove_file(target).unwrap();
 }
}
#[test]
fn m5_modules_have_no_implicit_global_access(){
 let cases=["m5/invoice/main.hc","m5/inventory/main.hc","m5/savings/main.hc"];
 for file in cases {
  let out=cli(&["check",file]);
  assert!(out.status.success(),"{file}: {}",String::from_utf8_lossy(&out.stderr));
 }
}
