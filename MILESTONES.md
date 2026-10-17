# H-Code execution milestones - AI-first plan

Milestones are gated by verified deliverables, not dates. Target cadence assumes intensive human-led AI-assisted development. **Dates are targets, not promises.**

| ID | Target | Outcome | Exit gate | Status |
|---|---|---|---|---|
| M0 | Day 1 | Independent GitHub repository, docs, CI, clean build | Repo created, cloneable, CI green | IN PROGRESS - remote Henneberg01/H-code now exists; branch pending verified upload |
| M1 | Days 2-3 | Grammar, symbols, typed offline library prototype, spec | Alias/glyph AST equivalence, locked user-defined operations and tests | IN PROGRESS - symbol linker operational |
| M2 | Days 4-5 | Rust compiler frontend: lexer, parser, typed AST | Syntax conformance tests green | IN PROGRESS - Rust frontend and conformance tests written, pending verified CI |
| M3 | Days 6-7 | JS backend and CLI executable | .hc files compiled to JS and run | NOT STARTED |
| M4 | Days 8-11 | General modules, reusable package tooling and versioned packages | External package import beyond the M1 offline prototype | NOT STARTED - M1 local-package subset available |
| M5 | Days 12-15 | Core libraries: files, HTTP, async, JS interop | CLI and minimal server run | NOT STARTED |
| M6 | Days 16-19 | H-Code Studio MVP (editor integration, diagnostics) | Install, edit, check, debug | NOT STARTED |
| M7 | Days 20-24 | Full-stack web app SDK + sample | Standalone app builds/deploys | NOT STARTED |
| M8 | Days 25-27 | AI structured code edits and tests | Reproducible edit + regression check | NOT STARTED |
| M9 | Days 28-30 | Private alpha release | Third party installs and completes project | NOT STARTED |
| M10 | Days 31-40 | Registry, package signing/locking | Versioned packages resolve reliably | NOT STARTED |
| M11 | Days 41-50 | Desktop target proof of concept | Small desktop app runs | NOT STARTED |
| M12 | Days 51-60 | WebAssembly performance prototype | Benchmark report with caveats | NOT STARTED |
| M13 | Days 61-70 | AI agent advanced workflow | Safe bounded refactor with tests | NOT STARTED |
| M14 | Days 71-80 | Security, correctness, stabilization | External alpha test report | NOT STARTED |
| M15 | Days 81-90 | Public beta and documentation | Docs, CI, reproducible release | NOT STARTED |

## M1 work breakdown

- [x] Create a draft grammar with explicit statement termination and precedence.
- [x] Canonical glyph/ASCII operator mapping for the executable subset.
- [x] Initial language reference prototype, CLI, samples and unit tests.
- [ ] Review and approve all reserved symbol semantics for future versions.
- [x] Build offline reference symbol registration, import grammar, library contracts and version-locking into parser/linker.
- [ ] Define full static type system and conformance suite (M1 decisions, M2 implementation). Current runtime library contracts do not replace static checking.
- [ ] Compare H-Code syntax vs traditional languages on fair benchmark workloads.

## Non-negotiable acceptance

- Correctness first. Never equate compact glyphs with faster runtime by assumption.
- Glyph and alias spellings must have identical AST semantics.
- Invalid programs must fail predictably with useful diagnostics.
- Symbol packages must not be permitted to acquire hidden privileges.
- Stable version locks and reproducibility are required before public launch.
- AI use must be optional for building/running apps.
