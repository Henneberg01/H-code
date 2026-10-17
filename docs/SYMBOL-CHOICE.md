# CSE: ◇ — a real conditional-choice sign (experimental)

**Branch:** `feat/cse-glyph-conditional`, stacked on `feat/cse-symbolic-composition` (draft PR #8). **Not merged.**

## Language semantics

`a ◇ b : c` means: evaluate `a` once, requiring Bool; if true evaluate `b` (and only `b`), otherwise evaluate `c` (and only `c`). `b` and `c` must have the same statically inferred type. All three parts are proper H-Code expressions. The result can be passed to a function, returned, composed, piped or nested. An accessible alternate spelling is `a ? b : c`, identical AST semantics. Core glyph `◇` is reserved from user packages; mixed/invisible Unicode remains rejected.

`◇` is **not** a built-in Fibonacci/factorial or a secret code generator; it works on *any* properly typed Boolean and pair of matching branch types.

## Frozen-matched tasks (separate alternate-source versions)

| Task | Original M10 H-Code code points | New symbol H-Code code points | Reduction vs **same old H-Code** | New vs unchanged M10 TypeScript |
|---|---:|---:|---:|---:|
| Fibonacci | 96 | 55 | 42.71% | 41.49% |
| Factorial | 90 | 51 | 43.33% | 42.05% |
| Conditional sign | 105 | 63 | 40.00% | 27.59% |

Original H-Code/TypeScript sources under `compact/benchmarks/paired/` are **untouched** and protected by `compact/results/frozen-baseline-m10-eight.json`. New versions live only in `compact/benchmarks/symbol-choice/`. Each pair has identical input, task semantics and stdout. The exact task selection is only THREE tasks — not the 20-case research target. No average across different corpora is asserted. Unicode code points are not UTF-8 bytes.

## Review and testing gate
- JavaScript interpreter execution parity (old/new) has been checked for all three task pairs; 15 initial positive/negative choice probes passed.
- `prototype/test/symbol-choice.test.mjs` and `compiler/tests/symbol_choice.rs` are committed but the complete test command must run in CI.
- The Rust/compiler/static type and generated Node parity **remain unverified** until real `cargo test` evidence.
- Run `npm test`, `npm run studio:test`, `npm run compact:test`, and `cargo test --manifest-path compiler/Cargo.toml`; never merge or promote to release on references alone.
