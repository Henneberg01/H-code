# H-Code milestones

- [x] M0 — initial project foundation (working prototype created in previous session)
- [x] M1 — initial language grammar, glyph registry, reference interpreter, offline packages (reference implementation only)
- [x] M2 — Rust lexer, parser, typed AST and semantic analyzer (15/15 local Rust integration tests; remote CI remains separate)
- [x] M3 — JavaScript code generation and executable hcodec build/run CLI (8/8 M3 tests; 11 examples match M1 reference)
- [x] M4 — local .hc modules, recursive imports, starter math/text stdlib and interoperability with locked symbol packages (6/6 local M4 tests; full package manager remains future work)
- [x] M5 — three executable multi-file calculation workflows (invoice, inventory, savings), tested via Rust/Node CLI (2/2 integration tests; not production apps)
- [x] M6 — local web Studio editor (files/edit/save/check/build/run/glyph palette; 4/4 API tests, visual browser QA pending)
- [x] M7 — AI edits with optional OpenAI API-key startup/test and review/apply (12/12 Studio tests; live key test pending)
- [x] M8 — local runtime budgets, Origin/Host checks and reproducible benchmarks (sandboxing incomplete)
- [x] M9 — beta source/governance merged via PR #2; repository now public, but no official tagged GitHub Release or production certification
- [ ] M10 — optional paid AI Studio
- [ ] M11 — stable 1.0 release
- [ ] M12 — WebAssembly/native/platform expansion
- [ ] M13 — commercial teams/cloud ecosystem

## Immediate actions

M9's source was merged via GitHub PR #2; `Henneberg01/H-code` is publicly visible. This is not the same as a tagged production release or a security guarantee. Phase-1 symbol-first conformance and measurements are tracked separately in `docs/PHASE1_STATUS.md`.

1. M0-M3 local gates passed: Node M1 39/39, Rust M2 15/15, Rust M3 8/8.
2. Fuel and recursion limits added in M8; generated JavaScript still runs with Node privileges and is not safe for untrusted programs.
3. M4 + M5 local gates passed: recursive modules, starter stdlib and 3 multi-file application workflows (6/6 M4 tests, 2/2 M5 tests; 70 tests total including M1 Node suite).
4. M7 includes an OpenAI API-key test and model-backed proposal workflow (12/12 Studio tests). Live API credential verification, sandboxing, visual QA and GitHub sync remain pending.
