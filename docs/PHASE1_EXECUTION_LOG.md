# H-Code phase 1 — execution record

Plan: `docs/superpowers/plans/2026-10-17-hcode-phase1-symbol-first.md`
Spec: `docs/superpowers/specs/2026-10-17-hcode-phase1-symbol-first-design.md`
Feature branch: `feat/phase1-symbol-conformance`

## Rules and provenance

- Ruling: the Windows FastSell source directory is not a Git worktree. Use SHA-guarded FastSell file writes plus GitHub's isolated feature branch for commits; never write or force-update main. Cost if wrong: a mismatch between local uncommitted files and GitHub; mitigate with verified GitHub tree and final tests.
- Ruling: branch from `docs/phase1-symbol-first-design` to include the approved design+plan in the future PR. Do not commit private `PROJECT_STATE.json` or user tokens.

## Baseline — fresh local execution

- JavaScript reference: 39/39, `npm test`.
- Rust compiler: 34/34, `cargo test --manifest-path compiler/Cargo.toml`.
- Studio: 13/13, `npm run studio:test`.
- M9 `npm run release:check` green.
- Main SHA before work: `084da42a5b137ac128d374dc0c41fe2658bc8f8f`.

## Task 1 — glyph/ASCII parity

- Wrote Node fixture test first; `npm test` failed for missing `phase1/fixtures/manifest.json` as expected (RED).
- Created four real paired examples: functions, Boolean operations, recursion, locked `demo.math` symbol invocation.
- Re-ran `npm test`: 44/44 GREEN.
- Added Rust compiler integration suite; `cargo test` passed 35/35 GREEN. The Rust test passed immediately because it verifies existing compiler semantics, so no unproven Rust behavioral fix is claimed.
- Tests compare canonical linked JS AST, direct JS-reference output, emitted Rust-JS equivalence and stdout. Sign execution requires no Studio or AI services.
- No compiler source changed in Task 1.

## Task 2 — Unicode and package-sign validation

- Added JS tests for unbound/reserved symbols, bidi/default-ignorable controls, changed manifest hash, NFKC-unstable glyph and colliding package glyph imports.
- Added matching Rust checks including two temporary locked packages with the same glyph and explicit qualification.
- Tests verified **existing safe behavior** on first run, not a new compiler change. No source code modified.
- Fresh `npm test`: 48/48 GREEN; fresh Rust `cargo test`: 39/39 GREEN.
- Ruling: additional security controls were not introduced where preexisting validators already rejected these cases. This avoids changing semantics; cost if wrong: uncovered cases remain, requiring further audit.
