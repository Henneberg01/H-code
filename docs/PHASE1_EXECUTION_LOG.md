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

## Task 3 — reproducible symbol measurements

- Added RED-first tests for `measureSource`/`measurePair`; first `npm run phase1:test` failed with `ERR_MODULE_NOT_FOUND` as expected.
- Implemented offline `scripts/phase1-metrics.mjs` with UTF-8 byte and Unicode code-point measurements, explicit negative regressions, allowlisted output file path and output verification against the real interpreter.
- Fresh `npm run phase1:test` GREEN (4/4); `npm test` GREEN (48/48); release checker green.
- Generated `phase1/results/source-metrics.json`: character reductions 11.39%, 18.92%, 13%, 14.71%; byte reductions 0%, 4.05%, 4%, 5.88%.
- `npm run bench`: 5 iterations per sample; compiler CLI startup+static-check medians 9.49–10.32ms, **not** a cross-language runtime comparison.
- Ruling: AI token and developer-time fields are `null` instead of fictitious numbers. No external network/API calls. Cost if wrong: revenue/marketing claims must wait for independent validated studies.

## Task 4 — H-Code Studio and durable documentation

- Added Studio palette integration tests **before** editing the UI: `npm run studio:test` RED (2 failed), witnessing the original 11-entry palette, missing comparison signs and missing accessible button labels.
- Expanded `studio/public/app.js` to the exact 15 language-level signs with accurate aliases, clickable literal insertion, `title` and `aria-label`; rewrote the UI's callout to emphasize signs are **real H-Code source syntax**.
- `npm run studio:test` turned GREEN (15/15). Test invokes the actual palette click listener in a controlled simulated DOM and checks insertion, source focus, cursor, and disabled behavior.
- Added `H-CODE-PRINCIPLES.md` to persist Morse-inspired signs-as-code identity, Apache 2.0 owner/licensing, unproven research targets and general-purpose vision.
- Updated README, symbol registry, historical M9/public-state wording, milestone journal, Phase-1 status, local ignored continuity file, and manual-only GitHub CI to include the new offline metric tests.
- Fresh comprehensive regression after Studio edits: **48/48 Node**, **39/39 Rust**, **15/15 Studio**, **4/4 metrics**, release check PASS and `npm run demo` PASS; **106/106 tests** total. No language/ABI/builtin breaking changes.
- Ruling: `docs/PROJECT_CONTINUITY.md` stays local/ignored due to private Windows host paths. Durable *public* H-Code project principles and progress live in safe tracked documentation; cost if wrong: local-only details will not travel with a Git clone, deliberately limiting sensitive context.
