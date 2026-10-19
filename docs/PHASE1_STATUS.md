> Historical record: the licensing and branding assumptions in this document are superseded by the owner-directed JFH-CODE paid-use policy of 2026-10-19. See [current licensing](../LICENSING.md), [commercial terms](../COMMERCIAL.md) and [project principles](../JFH-CODE-PRINCIPLES.md). This document grants no current use permission.

# H-Code phase 1 — symbol-first foundation acceptance (2026-10-17)

**Scope:** the approved hardening plan for H-Code's existing M0–M9 foundation, not delivery of a universal language or the future M10–M59 ecosystem. Official name **H-Code**. Owner **Jonas Fogh Henneberg**, operating as Fastsell.net (CVR 46614887), Denmark. Core and source-shipped Studio: **Apache-2.0**.

## What has been implemented and verified

1. **Real Unicode signs in source:** four matched `phase1/fixtures/*.glyph.hc` and `*.ascii.hc` pairs (functions, Boolean logic, recursion and a version-locked library operation). Both JS reference runtime and Rust compiler verify equivalent meaning/output. This is true compiler syntax, not AI/editor text substitution.
2. **Symbol safety:** new JS and Rust tests reject forbidden/invisible/bidi Unicode, unbound/reserved operations, invalid normalized glyphs, lockfile hash tampering and ambiguous glyphs in different packages. Qualified package references work. Existing core safety behavior was verified rather than advertised as a newly implemented sandbox.
3. **Honest compactness measurements:** reproducible offline `npm run phase1:measure` emits `phase1/results/source-metrics.json`, distinguishing Unicode code points and UTF-8 bytes. Four pairs are comparable and output-checked.
4. **H-Code Studio:** 16/16 implemented core signs exposed in the actual insertion palette with text aliases and accessible labels. UI tests call the real palette handlers and verify inserting a literal sign at the cursor; palette edits also invalidate stale AI-edit approval even when programmatic insertion does not fire a DOM input event.

## Fresh local verification

| Verification | Result |
| --- | --- |
| `npm test` | 48 passed; 0 failed |
| `cargo test --manifest-path compiler/Cargo.toml` | 39 passed; 0 failed |
| `npm run studio:test` | 15 passed; 0 failed |
| `npm run phase1:test` | 4 passed; 0 failed |
| **Total** | **107 passed; 0 failed** |
| `npm run release:check` | PASS |
| `npm run demo` | PASS, outputs `42, 42, 11, hihi, true, 120` |

Tooling: Node.js v24.17.0 on Windows x64 for the compactness report, `hcode-compiler` Cargo crate version 0.2.0. Exact Rust toolchain version was not captured. Browser visual QA and a live optional OpenAI API call were **not** performed.

## Evidence: source compactness (small comparable programs)

| Pair | Unicode code-point reduction | UTF-8 byte reduction |
| --- | ---: | ---: |
| Functions | 11.39% | 0% |
| Boolean logic | 18.92% | 4.05% |
| Recursion | 13.00% | 4.00% |
| Package sign | 14.71% | 5.88% |

`aiTokens: null` and `developerTime: null` are intentional: neither was independently measured. Generated JavaScript byte sizes and cross-language execution speedups were not measured by this report. Thus the aspirational 70% shorter code, 2–5x faster development and 25% fewer tokens **have not been demonstrated**.

## Release scope and outstanding work

- Development is on `feat/phase1-symbol-conformance` for a draft PR against `main`; do **not** merge this branch or publish a tag without explicit review.
- The GitHub repository is **already public** after the prior M9 work; this task makes no visibility change.
- Generated JS still has ordinary Node host privileges, not a secure sandbox. Local Studio must not be exposed publicly.
- Significant general-purpose features (collections, generics, async IO/effects, native/WebAssembly backends, webshops, game frameworks) remain later milestones. Completing **this phase-1 hardening** is not completing the entire H-Code 60-milestone vision.
- Independent security/code review, browser UI QA and real optional AI-provider verification remain future gates.
- Durable guidance: `H-CODE-PRINCIPLES.md`, `docs/SYMBOLS.md`, `docs/superpowers/specs/2026-10-17-hcode-phase1-symbol-first-design.md`, and `docs/PHASE1_EXECUTION_LOG.md`.
