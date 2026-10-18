# H-Code milestones

**Fuld roadmap (60 milestones):** [H-Code M0–M59 masterplan, v2](docs/H-CODE-MASTERPLAN-M0-M59.md). **Første konkrete opgave:** [M10/CSE-1 — implementeringsplan](docs/superpowers/plans/2026-10-17-hcode-cse1-compact-syntax.md); [arkitektur og grammatikspecifikation](docs/superpowers/specs/2026-10-17-hcode-compact-syntax-design.md).

**Versionsbemærkning:** Listen nedenfor er den historiske M0–M13-journal. M0–M9 forbliver registreret i prototype-/betaomfang. De endnu **ikke startede** gamle M10–M13-overskrifter foreslås ændret i 60-milepæls-masterplanen: Studio Pro → M57, stabil 1.0 → M59, WASM/native → M30/M31, teams/cloud → M56. De nye M10–M13 skal først levere Compact Syntax Engine, typede lister, records og generiske biblioteker. **Ingen CSE-kode er implementeret som følge af denne plan.**

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
