# Testing JFH-CODE programs

The development compiler runs real `.test.hc` programs through its lexer,
module resolver, static type checker and JavaScript emitter, then executes
each file in a separate Node.js process. Node 20+ and stable Rust are required.
The example comparison with TypeScript requires Node 22+.

```sh
cargo run --manifest-path compiler/Cargo.toml -- test examples/testing
cargo run --manifest-path compiler/Cargo.toml -- test examples/testing/number.test.hc --timeout-ms 2000
# Installed compiler, with an explicitly selected package lock:
hcodec test path/to/tests --lock hcode.lock.json
```

## Assertions are actual language operations

`⊨(condition)` has the secondary ASCII spelling `assert(condition)`.
Its type is `Bool → Unit`: exactly one Boolean argument is required. The Rust
checker rejects wrong types and arity before execution; the JavaScript reference
checks them at runtime. A true condition returns Unit (`none` when printed).
A false condition throws an error and stops that file; the compiled diagnostic
includes its source line and column. Arguments are evaluated once.

```hcode
import "./number.hc" as n
⊨(n∷magnitude(-7)≡7)
⊨(n∷total(⟦1,-2,3⟧)≡2)
```

The operation can be stored in a binding or passed as a function. An indirect
compiled call reports the location where the builtin was referenced. Ordinary
nested lexical shadowing remains possible. The core sign is reserved against
package replacement. Assertions are effects: pure package/module functions
cannot access the builtin, and runtime-enforced pure callbacks deny it.
The reference evaluator returns an `assertions` count alongside `steps` on
successful evaluation. The CLI runner uses compiled execution, not that counter.

## Discovery and reporting

A file target must end in `.test.hc`. A directory target is searched recursively;
files run in sorted path order. Discovery skips symbolic links and directories
named `.git`, `node_modules`, `target`, `dist` or `coverage`. An explicitly selected
symbolic link is an error. Local imports and optional SHA-locked packages use
the same module/package resolution as `hcodec run`.

An empty discovery is an error. Every file must execute at least one actual
assertion to pass; an unreachable assertion or a printed result marker does
not count. Results use TAP 13, with one result per file, diagnostics as comments
and an assertion total. Counts include a false assertion that was executed.
Other files still run after a compile error, failed assertion or timeout.
Any file failure makes the command exit nonzero.

Each Node process has a default 10-second wall-clock timeout. `--timeout-ms`
accepts integers from 1 through 600000. Expiration kills and reaps that process.
Captured stdout and stderr each retain at most 65536 bytes; exceeding either
limit fails the file. These controls do not isolate host access or roll back
filesystem/network effects. Only run trusted programs, as with `hcodec run`.

## Reproduce the example measurement

```sh
npm run test:example
```

This runs the real compiler and an independent TypeScript implementation of the
same numeric functions and four assertions. The JSON report counts both module
and test files, including imports and whitespace, in Unicode codepoints and
UTF-8 bytes separately. Generated JavaScript bytes are reported separately.
The files live under `examples/testing`; this small illustration does not
replace any frozen workload or prove the global 70% reduction target.

Native testing is a prerequisite for the frozen refactor, bug-repair and
incremental-feature workloads (18–20). Those tasks still require their own
unchanged acceptance cases, source locks and independent TypeScript comparisons.
