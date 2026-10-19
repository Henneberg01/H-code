//! Run trusted .test.hc programs with the real compiler and a bounded Node process.
//! Process separation and timeouts are test controls, not an execution sandbox.
use std::{
    fs,
    io::Read,
    path::{Path, PathBuf},
    process::{Command, Stdio},
    thread,
    time::{Duration, Instant, SystemTime, UNIX_EPOCH},
};
use serde::Deserialize;
use crate::{checker::check, codegen::emit, modules::resolve, packages::{load_lockfile, PackageRegistry}, parser::parse};

const OUTPUT_LIMIT: usize = 65536;
const USAGE: &str = "Usage: hcodec test PATH [--lock FILE] [--timeout-ms N]";

struct Options {
    target: PathBuf,
    lock: Option<PathBuf>,
    timeout: Duration,
}

impl Options {
    fn parse(args: &[String]) -> Result<Self, String> {
        let target = args.first().filter(|s| !s.starts_with("--")).ok_or(USAGE)?;
        let mut lock = None;
        let mut timeout = None;
        let mut i = 1;
        while i < args.len() {
            let value = args.get(i + 1).ok_or(USAGE)?;
            match args[i].as_str() {
                "--lock" if lock.is_none() => lock = Some(PathBuf::from(value)),
                "--timeout-ms" if timeout.is_none() => {
                    let millis = value.parse::<u64>().ok().filter(|n| (1..=600000).contains(n))
                        .ok_or("timeout must be 1..600000 milliseconds")?;
                    timeout = Some(Duration::from_millis(millis));
                }
                _ => return Err(USAGE.into()),
            }
            i += 2;
        }
        Ok(Self {target: target.into(), lock, timeout: timeout.unwrap_or(Duration::from_secs(10))})
    }
}

fn is_test(path: &Path) -> bool {
    path.file_name().and_then(|name| name.to_str()).is_some_and(|name| name.ends_with(".test.hc"))
}

fn discover(target: &Path) -> Result<Vec<PathBuf>, String> {
    let metadata = fs::symlink_metadata(target).map_err(|e| format!("Cannot inspect {}: {e}", target.display()))?;
    if metadata.is_symlink() { return Err("Test target must not be a symbolic link".into()); }
    if metadata.is_file() {
        return if is_test(target) {Ok(vec![target.to_path_buf()])}
            else {Err("Explicit test files must end in .test.hc".into())};
    }
    if !metadata.is_dir() { return Err("Test target must be a file or directory".into()); }
    let mut pending = vec![target.to_path_buf()];
    let mut files = Vec::new();
    while let Some(dir) = pending.pop() {
        for entry in fs::read_dir(&dir).map_err(|e| format!("Cannot discover tests in {}: {e}", dir.display()))? {
            let entry = entry.map_err(|e| format!("Cannot read test directory entry: {e}"))?;
            let kind = entry.file_type().map_err(|e| format!("Cannot inspect test directory entry: {e}"))?;
            if kind.is_symlink() { continue; }
            if kind.is_dir() {
                if !matches!(entry.file_name().to_str(), Some(".git"|"node_modules"|"target"|"dist"|"coverage")) {
                    pending.push(entry.path());
                }
            } else if kind.is_file() && is_test(&entry.path()) { files.push(entry.path()); }
        }
    }
    files.sort();
    if files.is_empty() { return Err(format!("No test files found in {}", target.display())); }
    Ok(files)
}

fn compile(path: &Path, lock: Option<&Path>) -> Result<String, String> {
    let source = fs::read_to_string(path).map_err(|e| format!("Cannot read {}: {e}", path.display()))?;
    let mut ast = parse(&source).map_err(|e| e.to_string())?;
    let mut registry = match lock {
        Some(path) => load_lockfile(path).map_err(|e| e.to_string())?,
        None => PackageRegistry::default(),
    };
    resolve(&mut ast, path, &mut registry).map_err(|e| e.to_string())?;
    let typed = check(&ast, &registry, true).map_err(|e| e.to_string())?;
    emit(&typed, &registry)
}

struct Script {
    directory: PathBuf,
    program: PathBuf,
    report: PathBuf,
}

impl Script {
    fn create(application: &str) -> Result<Self, String> {
        let stamp = SystemTime::now().duration_since(UNIX_EPOCH).map_err(|e| e.to_string())?.as_nanos();
        let directory = std::env::temp_dir().join(format!("jfh-code-test-{}-{stamp}", std::process::id()));
        #[cfg(unix)]
        let mut builder = fs::DirBuilder::new();
        #[cfg(not(unix))]
        let builder = fs::DirBuilder::new();
        #[cfg(unix)] {
            use std::os::unix::fs::DirBuilderExt;
            builder.mode(0o700);
        }
        builder.create(&directory).map_err(|e| format!("Cannot create test runtime directory: {e}"))?;
        let result = Self {program: directory.join("test.mjs"), report: directory.join("result.json"), directory};
        // Report through a runner-owned file, never through user-controlled stdout.
        // Neither identifier is addressable from the compiler's encoded user names.
        let report = serde_json::to_string(&result.report).map_err(|e| e.to_string())?;
        let script = format!(
            "import {{writeFileSync as __jfh_test_report}} from 'node:fs';\n\
             let __jfh_test_completed=false;\n\
             process.once('exit',()=>__jfh_test_report({report},JSON.stringify({{\
             completed:__jfh_test_completed,assertions:typeof __hc_assertions==='number'?__hc_assertions:0}})));\n\
             {application}\n\
             if(typeof __hc_assertions==='undefined'||__hc_assertions<1)throw Error('No assertions executed');\n\
             __jfh_test_completed=true;\n"
        );
        fs::write(&result.program, script).map_err(|e| format!("Cannot write compiled test: {e}"))?;
        Ok(result)
    }
}
impl Drop for Script { fn drop(&mut self) { let _ = fs::remove_dir_all(&self.directory); } }

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct Report { completed: bool, assertions: u64 }

impl Script {
    fn read_report(&self) -> Result<Report, String> {
        let metadata = fs::symlink_metadata(&self.report).map_err(|_| "Missing test completion report")?;
        if !metadata.is_file() || metadata.len() > 1024 { return Err("Invalid test completion report".into()); }
        let bytes = fs::read(&self.report).map_err(|e| e.to_string())?;
        let report: Report = serde_json::from_slice(&bytes).map_err(|_| "Invalid test completion report")?;
        if report.assertions > 100000 { return Err("Invalid test assertion count".into()); }
        Ok(report)
    }
}

fn capture(mut stream: impl Read) -> Result<(String, bool), String> {
    let mut bytes = Vec::new();
    let mut buffer = [0u8; 4096];
    let mut overflow = false;
    loop {
        let count = stream.read(&mut buffer).map_err(|e| format!("Cannot capture test output: {e}"))?;
        if count == 0 { break; }
        let retained = (OUTPUT_LIMIT - bytes.len()).min(count);
        bytes.extend_from_slice(&buffer[..retained]);
        overflow |= retained != count;
        // Continue draining after the limit so a noisy child cannot deadlock its pipe.
    }
    Ok((String::from_utf8_lossy(&bytes).into_owned(), overflow))
}

struct Outcome { stdout: String, stderr: String, assertions: u64, failure: Option<String> }

fn execute(script: &Script, timeout: Duration) -> Result<Outcome, String> {
    let mut child = Command::new("node").arg(&script.program).stdin(Stdio::null())
        .stdout(Stdio::piped()).stderr(Stdio::piped()).spawn()
        .map_err(|e| format!("Cannot execute Node.js: {e}"))?;
    let stdout = child.stdout.take().ok_or("Cannot capture test stdout")?;
    let stderr = child.stderr.take().ok_or("Cannot capture test stderr")?;
    let stdout = thread::spawn(move || capture(stdout));
    let stderr = thread::spawn(move || capture(stderr));
    let started = Instant::now();
    let status = loop {
        match child.try_wait() {
            Ok(Some(status)) => break Ok(status),
            Ok(None) if started.elapsed() < timeout => thread::sleep(Duration::from_millis(5)),
            other => {
                let _ = child.kill();
                let _ = child.wait();
                break Err(match other {
                    Err(error) => format!("Cannot wait for test process: {error}"),
                    _ => format!("Test timed out after {} milliseconds", timeout.as_millis()),
                });
            }
        }
    };
    let (stdout, stdout_overflow) = stdout.join().map_err(|_| "Test stdout reader failed")??;
    let (stderr, stderr_overflow) = stderr.join().map_err(|_| "Test stderr reader failed")??;
    let report = script.read_report();
    let assertions = report.as_ref().map(|r| r.assertions).unwrap_or(0);
    let failure = match status {
        Err(error) => Some(error),
        Ok(_) if stdout_overflow || stderr_overflow => Some("Test output exceeds 65536 bytes per stream".into()),
        Ok(status) if !status.success() => Some(format!("Test process failed with {status}")),
        Ok(_) => match report {
            Err(error) => Some(error),
            Ok(report) if !report.completed || report.assertions == 0 => Some("No assertions executed".into()),
            _ => None,
        },
    };
    Ok(Outcome {stdout, stderr, assertions, failure})
}

/// Execute every discovered file, return nonzero on any failure, and never accept zero tests.
pub fn run(args: &[String]) -> Result<(), String> {
    let options = Options::parse(args)?;
    let files = discover(&options.target)?;
    let mut failed = 0;
    let mut assertions = 0;
    println!("TAP version 13");
    for (index, path) in files.iter().enumerate() {
        let result = compile(path, options.lock.as_deref())
            .and_then(|application| Script::create(&application))
            .and_then(|script| execute(&script, options.timeout));
        let label = path.display().to_string().replace('\n', "\\n").replace('\r', "\\r").replace('#', "\\u0023");
        match result {
            Ok(outcome) => {
                assertions += outcome.assertions;
                println!("{} {} - {label}", if outcome.failure.is_some() {"not ok"} else {"ok"}, index + 1);
                for line in outcome.stdout.lines().chain(outcome.stderr.lines()) { println!("# {line}"); }
                if let Some(reason) = outcome.failure { failed += 1; println!("# {reason}"); }
            }
            Err(error) => {
                failed += 1;
                println!("not ok {} - {label}", index + 1);
                for line in error.lines() { println!("# {line}"); }
            }
        }
    }
    println!("1..{}\n# tests {}\n# pass {}\n# fail {failed}\n# assertions {assertions}", files.len(), files.len(), files.len() - failed);
    if failed != 0 { return Err(format!("{failed} test file(s) failed")); }
    Ok(())
}
