use std::{fs, path::{Path, PathBuf}, process::{Command, Output}, time::{Instant, SystemTime, UNIX_EPOCH}};

struct Workspace(PathBuf);
impl Workspace {
    fn new() -> Self {
        let stamp = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_nanos();
        let path = std::env::temp_dir().join(format!("jfh-native-tests-{}-{stamp}", std::process::id()));
        fs::create_dir(&path).unwrap();
        Self(path)
    }
    fn write(&self, name: &str, source: &str) {
        let file = self.0.join(name);
        fs::create_dir_all(file.parent().unwrap()).unwrap();
        fs::write(file, source).unwrap();
    }
    fn run(&self, target: &str, flags: &[&str]) -> Output {
        Command::new(env!("CARGO_BIN_EXE_hcodec"))
            .current_dir(&self.0).arg("test").arg(self.0.join(target)).args(flags).output().unwrap()
    }
}
impl Drop for Workspace { fn drop(&mut self) { let _ = fs::remove_dir_all(&self.0); } }
fn text(output: &Output) -> String {
    format!("{}\n{}", String::from_utf8_lossy(&output.stdout), String::from_utf8_lossy(&output.stderr)).replace("\r\n", "\n")
}

#[test]
fn discovers_test_files_in_order_and_runs_real_imported_modules() {
    let w = Workspace::new();
    w.write("math.hc", "export ƒ twice(x:Number)→Number↩x*2;");
    w.write("a.test.hc", "import \"./math.hc\" as math;⊨(math∷twice(21)≡42);");
    w.write("nested/ø.test.hc", "⊨(⌗(⫶\"a🙂字\")≡3);");
    for name in ["ignored.hc", "target/ignored.test.hc", "node_modules/ignored.test.hc", ".git/ignored.test.hc"] {
        w.write(name, "this must not execute");
    }
    let out = w.run(".", &[]);
    let log = text(&out);
    assert!(out.status.success(), "{log}");
    assert!(log.contains("1..2"), "{log}");
    assert!(log.contains("# assertions 2"), "{log}");
    assert!(log.find("a.test.hc").unwrap() < log.find("ø.test.hc").unwrap(), "{log}");
}

#[test]
fn empty_discovery_is_an_error_and_never_a_zero_test_success() {
    let w = Workspace::new();
    let out = w.run(".", &[]);
    assert!(!out.status.success());
    assert!(text(&out).contains("No test files"), "{}", text(&out));
}

#[test]
fn every_file_must_execute_a_real_assertion_even_if_it_prints_a_fake_result() {
    let w = Workspace::new();
    for source in ["⊢(⊥)⇒⊨(⊤);", "⎙(\"JFH_ASSERTIONS=99\");"] {
        w.write("empty.test.hc", source);
        let out = w.run("empty.test.hc", &[]);
        assert!(!out.status.success(), "{}", text(&out));
        assert!(text(&out).contains("No assertions executed"), "{}", text(&out));
    }
}

#[test]
fn failed_assertions_do_not_hide_later_test_files() {
    let w = Workspace::new();
    w.write("a.test.hc", "⊨(⊥);");
    w.write("b.test.hc", "⊨(⊤);");
    let out = w.run(".", &[]);
    let log = text(&out);
    assert!(!out.status.success());
    assert!(log.contains("not ok 1"), "{log}");
    assert!(log.contains("ok 2"), "{log}");
    assert!(log.contains("assertion failed at 1:1"), "{log}");
    assert!(log.contains("1..2"), "{log}");
}

#[test]
fn static_type_failures_are_reported_while_other_files_still_run() {
    let w = Workspace::new();
    w.write("a.test.hc", "⊨(1);");
    w.write("b.test.hc", "⊨(⊤);");
    let out = w.run(".", &[]);
    assert!(!out.status.success());
    let log = text(&out);
    assert!(log.contains("TYPE") && log.contains("ok 2"), "{log}");
}

#[test]
fn filenames_cannot_inject_tap_directives() {
    let w = Workspace::new();
    w.write("false # SKIP.test.hc", "⊨(⊥);");
    let out = w.run(".", &[]);
    assert!(!out.status.success());
    let log = text(&out);
    let result = log.lines().find(|line| line.starts_with("not ok ")).unwrap();
    assert!(!result.contains('#'), "TAP directive must not come from a filename: {result}");
}

#[test]
fn sleeping_tests_are_killed_at_the_requested_timeout() {
    let w = Workspace::new();
    w.write("slow.test.hc", "⌛10000;⊨(⊤);");
    let started = Instant::now();
    let out = w.run("slow.test.hc", &["--timeout-ms", "200"]);
    assert!(!out.status.success());
    assert!(text(&out).contains("timed out"), "{}", text(&out));
    assert!(started.elapsed().as_secs() < 5);
}

#[test]
fn excessive_output_is_bounded_and_reported_as_a_failure() {
    let w = Workspace::new();
    let value = "x".repeat(128);
    w.write("noisy.test.hc", &format!("≔i←0;⟳(i<10000){{⎙(\"{value}\");i←i+1;}}⊨(⊤);"));
    let out = w.run(".", &[]);
    assert!(!out.status.success());
    assert!(text(&out).contains("Test output exceeds"), "{}", text(&out));
    assert!(out.stdout.len() < 150000);
}

#[test]
fn explicit_lockfiles_are_available_to_real_symbol_package_tests() {
    let w = Workspace::new();
    w.write("symbols.test.hc", "use \"demo.math@1.0.0\" as math;⊨(⊕(20,22)≡42);");
    let lock = Path::new(env!("CARGO_MANIFEST_DIR")).parent().unwrap().join("hcode.lock.json");
    let out = w.run("symbols.test.hc", &["--lock", lock.to_str().unwrap()]);
    assert!(out.status.success(), "{}", text(&out));
    assert!(text(&out).contains("# assertions 1"));
}

#[test]
fn timeout_options_and_explicit_non_test_files_are_rejected() {
    let w = Workspace::new();
    w.write("ok.test.hc", "⊨(⊤);");
    for value in ["0", "-1", "NaN", "600001"] {
        let out = w.run("ok.test.hc", &["--timeout-ms", value]);
        assert!(!out.status.success());
        assert!(text(&out).contains("timeout must be 1..600000 milliseconds"), "{}", text(&out));
    }
    w.write("app.hc", "⊨(⊤);");
    let out = w.run("app.hc", &[]);
    assert!(!out.status.success());
    assert!(text(&out).contains(".test.hc"), "{}", text(&out));
}

#[cfg(unix)]
#[test]
fn discovery_skips_symlinks_and_explicit_symlink_targets_are_rejected() {
    let w = Workspace::new();
    let outside = Workspace::new();
    w.write("ok.test.hc", "⊨(⊤);");
    outside.write("bad.test.hc", "⊨(⊥);");
    std::os::unix::fs::symlink(&outside.0, w.0.join("outside")).unwrap();
    std::os::unix::fs::symlink(outside.0.join("bad.test.hc"), w.0.join("linked.test.hc")).unwrap();
    let out = w.run(".", &[]);
    assert!(out.status.success(), "{}", text(&out));
    assert!(text(&out).contains("1..1"));
    assert!(!w.run("linked.test.hc", &[]).status.success());
}
