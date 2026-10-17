# H-Code

**Experimental general-purpose symbolic programming language.** A compact Unicode glyph and an accessible ASCII spelling can identify the **same typed operation**. Users can author their own library functions and associate them with symbols; the symbols are scoped to explicit imports instead of being hidden global shortcuts.

> Status: **M1 in progress**. This repository currently ships a dependency-free JavaScript reference **interpreter and offline symbol linker**, not a production compiler, standalone IDE, native runtime, package registry or a proven performance improvement.

## Working features

- Lexer/parser and interpreter for variables, functions (including recursion), loops, conditionals, Boolean logic, simple numbers and strings.
- 15 canonical core glyphs with corresponding ASCII syntax, including `∷` / `::` for namespace qualification.
- **User-authored typed operations** in `.hc` library source, exported using `manifest.json`.
- Explicit imports by exact package version: `use "demo.math@1.0.0" as math;`.
- Glyph and ASCII calls link to the same version-qualified AST operation (`⊕` / `math::add` / `math∷⊕`).
- Local `hcode.lock.json` with SHA-256 pinning for library source and manifest; **no network downloads**.
- Basic link-time direct-call type checks, runtime argument/return contracts, collision detection and isolated pure library scope.
- CLI for `run`, `check` and `ast`; automated reference and integrity tests.

## Install and run

Requires **Node.js 20+**, no `npm install` required:

```bash
npm test
npm run demo
npm run check
```

Or run the example directly:

```bash
node prototype/bin/hcode.mjs run examples/user_symbols.hc --lock hcode.lock.json
```

`examples/user_symbols.hc`:

```hcode
use "demo.math@1.0.0" as math;
print(⊕(20, 22));       // 42
print(math::add(20, 22)); // 42
print(math∷⊕(5, 6));    // 11
print(⊗(5));             // 120: factorial library implementation
```

You can still run the previous no-library examples without a lockfile:

```bash
node prototype/bin/hcode.mjs run examples/hello_symbols.hc
```

## Source map

| Path | Purpose |
|---|---|
| `prototype/src/hcode.mjs` | Reference lexer/parser, offline semantic linking and interpreter |
| `prototype/src/packages.mjs` | Validated, locked package loader and typed contracts |
| `prototype/bin/hcode.mjs` | Development CLI |
| `packages/demo.math/` | Real H-Code functions exported as user-defined symbols |
| `hcode.lock.json` | Reproducible source and manifest hashes |
| `docs/LIBRARIES.md` | Guide to creating a custom symbol library |
| `docs/LANGUAGE_SPEC.md` | M1 language draft, capabilities and limitations |
| `docs/SYMBOLS.md` | Core/reserved/user glyph registry |
| `grammar/hcode-m1.ebnf` | EBNF for currently parsed statements and calls |
| `MILESTONES.md` | Milestone status and acceptance gates |

## Security and limitations

M1 libraries are pure **H-Code** functions running in an isolated interpreter scope without `print`, host JavaScript, filesystem or network bindings. Hashes detect **unapproved file changes**, not malicious or untrusted authors; they are not signatures or a security sandbox. Interpreter step limits do not guarantee safe execution of hostile programs.

Typed library calls verify obvious literal types during linking and **all argument and result types at runtime**. The complete static typechecker, generalized effects/capabilities, generics, package downloads, native compilation, H-Code Studio and AI workflows belong to later milestones.

## Vision and licensing

H-Code is intended to be platform-independent and useful beyond any one company or application. The source in this repository is provided under **Apache License 2.0**. Future commercial AI and hosting services can be built separately; there is no per-app fee or runtime subscription requirement in the language design.

**No H-Code performance advantage has been measured.** All comparisons must use fair baselines and include correctness, debugging, total development time and AI-token consumption.

## M2: Rust compiler frontend (in progress)

The Rust frontend is independent of the M1 JavaScript reference interpreter. It does **not** execute programs or emit JavaScript yet: it tokenizes, parses, resolves locked imported symbol signatures, performs static type checking/inference and produces an in-memory typed AST. The executable backend is reserved for M3.

```bash
cargo test --manifest-path compiler/Cargo.toml
cargo run --manifest-path compiler/Cargo.toml -- check examples/hello_symbols.hc
cargo run --manifest-path compiler/Cargo.toml -- check examples/user_symbols.hc --lock hcode.lock.json
cargo run --manifest-path compiler/Cargo.toml -- ast examples/fibonacci.hc
```

M2 rejects type errors **before running code**, including invalid assignments, arguments, return types, out-of-scope variables, missing returns and incorrect operators. The new frontend checks M1 symbol operations via the same SHA-256 pinned local package manifests. It rejects unknown packages, ambiguous glyphs and impure library code. The original M1 interpreter and Node tests remain available until M3 code generation replaces the execution path.

See [`docs/M2_STATUS.md`](docs/M2_STATUS.md) for status, accepted subset, limitations and the verified test evidence.
