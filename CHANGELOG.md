# JFH-CODE change log

## Unreleased — frozen refactor workload (2026-10-19)

- Established and committed a concrete baseline for Canonical18 before extracting a reusable statistics module; kept both native and TypeScript assertion files byte-identical.
- Added source-locked proof execution for both versions and languages, twelve fixed inputs, thirty-two generated inputs and six seeded faults. Authored-source measurement includes all modules, support/types and tests.
- Added derived task18 readiness without changing the original twenty-workload registry. The measured 36.51% source reduction on this task does not establish the global 70% goal.

## Unreleased — native program testing (2026-10-19)

- Added the typed assertion sign `⊨` with accessible `assert` alias in the Rust compiler and JavaScript reference.
- Added `hcodec test` with real module/package resolution, sorted `.test.hc` discovery, TAP reporting, per-file timeouts and bounded output. Empty runs and assertion-free files fail.
- Added a numeric module/test example with an independently executable TypeScript comparison; this is groundwork for frozen workloads 18–20, not completion of the twenty-task 70% target.

## Unreleased — identity and paid licensing (2026-10-19)

- Adopted JFH-CODE as the official product name while preserving technical compatibility identifiers and immutable benchmark sources.
- Adopted proprietary commercial licensing requiring a separate paid agreement, with no free use grant. Third-party terms and previously granted legal permissions remain effective.
- Aligned package metadata, contributor-rights requirements and release checks with the current policy.

## M1 offline user-symbol reference (2026-10-17)

- Introduced an explicit version-pinned package import syntax and namespace qualification.
- Added a manifest-validated, SHA-256-locked local package loader.
- Linked bare user glyphs and readable qualified calls to the same canonical operation IDs.
- Added arity, direct-literal argument and runtime argument/return contract checks for exported pure operations.
- Isolated library execution from top-level interpreter builtins and applied a shared execution-step limit.
- Added a demonstration package, example, authoring guide and regression/security-negative tests.
- Kept the reference implementation dependency-free. No compiler or performance claims.

## Initial M1 reference (2026-10-17)

- Initial lexer, parser, reference interpreter, core symbols, examples and CLI.
- Original 17-test baseline and project foundation.

## 0.2.0 - Milestone M2 (Rust frontend)

- Added `compiler/` Rust crate and `hcodec check|ast` frontend CLI.
- Added canonical symbolic/ASCII Unicode lexer, parser, source spans, and structural AST.
- Added scoped static type inference, typed AST, type/arity/return validation and human-readable diagnostics.
- Added verified package interface loading using M1 SHA-256 lockfile and pure library source validation.
- Added Rust conformance suite and CI Rust job alongside the unchanged Node.js M1 suite.
- Execution remains in M1 JavaScript reference interpreter; Rust JavaScript emitter is M3.
