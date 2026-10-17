# H-Code M4 — module system and starter standard library

## Delivered locally (2026-10-17)
- Rust compiler accepts explicit `import "./path.hc" as alias;` and `export fn name(...) ...`.
- Project-local path resolution; rejects traversal, absolute paths, symlink escape, missing files, over-1 MiB files and recursive import cycles.
- Recursive module import graphs up to depth 32.
- Exports are explicit, checked, and namespaced: `math::square(7)`.
- Non-exported functions remain private.
- Modules typecheck independently without ambient print/IO capabilities.
- JavaScript backend includes transitive module dependencies and keeps old M1 SHA-256-locked pure package imports working.
- Starter standard-library modules: `m4/std/math.hc` (square/max2/shifted) and `m4/std/text.hc` (repeat2/greeting).
- Example `m4/main.hc` uses local math/text modules and verified `demo.math` package in one executable program.

## Proof
- M1 Node test suite: 39/39 PASS.
- M2 Rust frontend: 15/15 PASS.
- M3 JavaScript generation: 8/8 PASS.
- M4 Rust module tests: 6/6 PASS.
- Total 68/68 local tests pass.
- M4 tests cover locked package compatibility, build/run CLI, transitive nested modules, cycle rejection, path restrictions, top-level syntax and privacy of unexported functions.
- Expected M4 CLI output: 49, 12, Hello world, haha, 9 (one per line).

## Execution
From project root:
cargo run --manifest-path compiler/Cargo.toml -- run m4/main.hc --lock hcode.lock.json
cargo run --manifest-path compiler/Cargo.toml -- build m4/main.hc --lock hcode.lock.json --out m4.mjs
node m4.mjs

## Known limitations — not yet production or general package management
- M4 local exports currently support functions only (no exported values/records/classes).
- Local imports must use `./` paths; no parent-directory imports, remote registry or dependency installation.
- Existing lockfile package support is preserved; new local modules are not yet content-hash locked or versioned.
- Modules may declare pure functions and explicit imports only. No module-level state or side effects.
- No standard-library list/map/JSON/IO/HTTP packages or effect permissions.
- The generated JavaScript still executes with Node privileges, without an execution step limit. Never execute untrusted source.
- Local M1 interpreter is unchanged and does not parse the M4 module syntax; the M4 Rust compiler is the authority for that syntax.
- GitHub synchronization / pull request / remote CI were not performed during M4.

## Next expansion
Versioned package manager and lockfile tooling, module exports beyond functions, stable multi-file diagnostics and source maps, capability-oriented standard library, execution sandbox.
