# H-Code M3 — JavaScript backend

Verified locally via FastSell MCP in the independent H-Code Windows project on 2026-10-17.

Delivered:
- compiler/src/codegen.rs: typed-AST JavaScript emitter with source-level identifier mangling
- compiler/src/main.rs: check, ast, build and run CLI operations
- SHA-256-verified symbol-library linkage into generated JS
- JavaScript output with functions, lexical scopes, recursion, conditionals, loops and short-circuit Booleans
- Runtime division-by-zero checks for / and %

Local evidence:
- M1 Node suite: 39/39 pass
- M2 Rust tests: 15/15 pass
- M3 Rust tests: 8/8 pass
- The 11 original H-Code example programs match M1 reference output
- CLI build writes runnable JavaScript; CLI run invokes Node without a shell

Important limitations:
- Compiled JS has no interpreter step budget; do not execute untrusted H-Code.
- Node globals mean no adversarial security sandbox.
- No full production standard library, source maps, Wasm, native, async or performance benchmarks yet.
- M3 is local-only; do not claim remote GitHub push, merge or successful GitHub CI.

Example:
cargo run --manifest-path compiler/Cargo.toml -- build examples/user_symbols.hc --lock hcode.lock.json --out user_symbols.mjs
node user_symbols.mjs
cargo run --manifest-path compiler/Cargo.toml -- run examples/user_symbols.hc --lock hcode.lock.json
