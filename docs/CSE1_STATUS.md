# H-Code M10 / Compact Syntax Engine 1 — implementation status

**Branch:** `feat/m10-cse1-compact-syntax` (based on the unmerged Phase-1 lineage, through `feat/cse-m0-benchmarks`)

**Status:** Source implementation and tests committed; **end-to-end test execution still required**. Not merged, not released, not verified safe for untrusted inputs.

## Implemented source changes (pending validation)
- Canonical real lexer token `▷` (Unicode U+25B7) or `|>` (ASCII); both frontends map them identically.
- Locked package manifests cannot export reserved `▷`, preventing glyph collisions.
- Expression-return functions `ƒ f(x) ↩ expression;` or `fn f(x) return expression;` lower to existing `Function` with a `Return` statement.
- Parser-level pipeline semantics: `x ▷ f` becomes `f(x)`, `x ▷ f(a)` becomes `f(x,a)`; pipelines chain left to right with exactly one evaluation of each left operand.
- Precedence: weakly bound below arithmetic and Boolean; unparenthesized arithmetic after a pipeline is rejected.
- Rust checker and JS backend reuse existing typed call semantics; no runtime JavaScript substitution or new ambient host privileges.
- Editor's sign palette includes `▷` and its ASCII alias `|>`.

## Authored automated checks
- `prototype/test/compact-lexer.test.mjs`, `compact-functions.test.mjs`, `compact-pipeline.test.mjs`, `compact-conformance.test.mjs`.
- Rust: `compiler/tests/compact_lexer.rs`, `compact_functions.rs`, `compact_pipeline.rs`, `compact_conformance.rs`.
- Seven positive ASCII/Unicode source pairs under `compact/fixtures/`; negative parser/type cases and side-effect single-evaluation tests.
- Developer-sourced code-point and UTF-8 report script `npm run compact:measure`, with `npm run compact:test` for numeric semantics.
- Updated existing Studio palette test to expect 16 actual core glyphs on this branch.

## Mandatory validation gate (NOT completed as of document creation)
Run from repository root on Node 20+/Rust stable:

```sh
npm test
npm run studio:test
npm run phase1:test
npm run compact:test
npm run compact:measure
cargo test --manifest-path compiler/Cargo.toml
npm run demo
npm run release:check
```

If any test fails: fix code on the feature branch; do **not** claim M10 complete, and do not merge into main. Verify locked-package collision tests, symbol normalization, source spans, legacy apps and seven paired compiled outputs. A manual-only Actions workflow already exists; do not enable paid automatic runs without approval.

## Measurement integrity
Current fixture measurement compares glyph H-Code **to ASCII H-Code**. This is not a TypeScript comparison, not a 20-task benchmark, and not a verified ≥70% gain. Rust-compiled Node JS still inherits host privileges; M37 sandboxing remains future work.

**Next:** verify CI/test evidence; add matched, runnable idiomatic TypeScript programs and dependency accounting; review M10 draft PR; only then schedule CSE-2 typed lists.

## Limited TypeScript-to-H-Code functional comparisons (NOT VERIFIED)

Eight handwritten, varied TypeScript/H-Code pairs are included under `compact/benchmarks/paired/`. The manual CI job now runs `npm run compact:ts-parity` **after Cargo builds/tests**; this only emits metric results if both programs execute and output matches. The report is explicitly marked **PRELIMINARY** and excludes dependency/runtime footprint. No parity execution result has been obtained in this authoring session.

## Eight-task interim benchmark protocol (expanded without hiding losses)

The preliminary `compact/benchmarks/paired` set now covers a typed function, composed functions, recursive Fibonacci, a counter loop, a string operation, a Boolean operation, recursive factorial and a conditional branch. Some implementations are *expected to be longer in H-Code*; negative results must remain visible. This set is **not** the 20-task final suite and is not independently verified by Rust yet. Run `npm run compact:ts-parity` before reporting executable TypeScript parity. The compiler-feature priorities are determined by actual regressions; adding arbitrary one-symbol task-specific shortcuts is prohibited.

## Expanded eight-case preliminary source metrics — 2026-10-18

The repository's paired source programs currently have a **median 2.27% shorter H-Code Unicode code-point count** and a **median 5.85% larger H-Code UTF-8 byte count**. Four of eight cases are LONGER in H-Code: `recursive-fibonacci`, `counter-loop`, `recursive-factorial` and `conditional-branch`. These are intentionally not hidden.

All eight H-Code examples ran in the JavaScript reference interpreter and equivalent TypeScript programs produced matching output in isolated evaluations. **Rust compiler and full GitHub CI parity remain unverified**. Source-count details, caveats and base SHA are in `compact/results/m10-interim-reference.json`. The 70% research target is NOT achieved; M11 onward should prioritize general-purpose typed collection operations and compact control flow, not task-specific macro tricks.
