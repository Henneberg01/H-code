# H-Code M13: `∑` `⌕` `⇢` — implemented core semantics (experimental)

**Branch:** `feat/m13-core-collection-signs` (stacked on M11 draft and all earlier unmerged phases).  
**Status:** Source committed, direct JS-reference tests passed, Rust source authored, full Cargo/CI and release approval **pending**.

## Invariant — signs are the language

A Unicode sign represents actual, generic, inspectable programming logic; it does not merely abbreviate TypeScript, call a large language model, or hide a domain-specific helper. ASCII spelling is only an accessibility fallback.

| H-Code sign | ASCII fallback | Static contract | Execution |
|---|---|---|---|
| `∑xs` | `@+xs` | `⟦Number⟧ → Number` | Checked left-to-right numeric sum; empty → `0` |
| `xs ⌕ pred` | `xs @? pred` | `⟦T⟧ × (T → Bool) → ⟦T⟧` | Calls predicate once per item and keeps items returning true, preserving original order |
| `xs ⇢ transform` | `xs @> transform` | `⟦T⟧ × (T → U) → ⟦U⟧` | Applies function once per item, returns a *new* sequence with inferred element type U |

The Rust compiler maintains proper `TokenKind`, `ExprKind`, `TypedExprKind`, generic unification, and JS emitter cases for all three. The JS reference also has parser and evaluator cases for each. Both have explicit allocation and step accounting. The generated JS uses dedicated checked loops and typed call sites, **not** `Array.map` / `Array.filter` name substitution.

The previous M11 `⟦ ` / `⟧`, `⌗` and `⧺` remain supported; package core glyphs are reserved so a locked package cannot redefine `∑` `⌕` `⇢`. All original programs and package locks must continue to pass full CI.

## Precedence and edge semantics

- `⌕` and `⇢` are left-associative binary operators at precedence 5, with `⧺`; numeric arithmetic and `∘` bind more tightly.
- `∑` is a tight-binding unary operator, so `∑(xs⌕pred⇢f)` explicitly sums the final mapped values.
- Index the result as `(xs⇢f)⟦i⟧`; the unparenthesized `xs⇢f⟦i⟧` instead indexes `f` and is invalid by design.
- The input sequence and callback are evaluated once, left-to-right. The callback runs once for each element in input order. `⌕` checks that each callback result is Boolean.
- `∑` rejects non-number elements; empty numeric sequences sum to zero. `⇢` can change types. An empty sequence may infer its type context from a numeric sum or typed callable.
- Max sequence length is currently 16,384; step/fuel counters apply. Generated JS is **not a sandbox**; running untrusted programs is prohibited.

## Fair comparison — same source pair, same output

Our M11 set contained three fully user-authored sum/map/filter algorithms and their idiomatic TypeScript implementations, all with frozen SHA hashes. M13 has **new, separately named H-Code sign variants** for exactly these three tasks. The original H-Code and TypeScript source bytes are unchanged. The automated `npm run m13:measure` runner verifies all three Git blob IDs and exact expected stdout in both the original and new H-Code reference, then executes the original TypeScript in Node22 and reports separate code-point and UTF-8 byte metrics.

| Task | M11 H-Code | New sign H-Code | Original TypeScript | Source code-point reduction vs TypeScript | UTF-8 byte reduction vs TypeScript |
|---|---:|---:|---:|---:|---:|
| Sum | 113 | 17 | 100 | 83.00% | 77.00% |
| Map | 159 | 57 | 130 | 56.15% | 40.00% |
| Filter | 185 | 77 | 167 | 53.89% | 40.12% |

Median: **56.15% fewer Unicode code points** and **40.12% fewer UTF-8 bytes** in these **three predefined tasks**. These numbers were measured in a reference-level same-task comparison. They are NOT a universal gain, a user-dev-time metric, a generated-binary-size metric, or the 20-program final benchmark.

Immutable source corpus: `compact/benchmarks/m13/manifest.json`, source programs, and `results-reference.json`.

## Test gates, openly not complete

- [x] Rust AST/checker/emitter source code authored
- [x] JavaScript reference actually executed for positive/negative generic operator cases
- [x] Generated JS helper source decoded from Rust emitter and run as JavaScript with outputs 10, [20,22], [2,3], 10 and 0
- [x] Node/Rust authored test files and automated exact-source measurement runner committed
- [ ] Run `cargo test --manifest-path compiler/Cargo.toml`
- [ ] Run complete `npm test`, `npm run studio:test`, `npm run compact:test`, `npm run m13:measure`, `npm run release:check` on exact PR SHA
- [ ] Review secure package manifest v2, arbitrary package-defined operator bindings and previous stacked PRs
- [ ] Independent, full 20-task corpus, reporting losing programs too, before advertising the 70% source goal as achieved

**Decision:** Implement core general-purpose signs now, without waiting for the entire generic package manifest. M13's larger user-defined library/manifest-v2 milestone is still open. This work stays as a draft feature branch, not a release.
