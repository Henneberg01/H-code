# M19.13 B2 — independent browser correctness and competitive source comparison

Canonical13 original immutable registry entry: `13-form-validation-ui` with acceptance **interactive required/email validation with accessible error feedback**. The preregistered twenty-task JSON is untouched. This is a candidate, **not** a status promotion or 70% global proof.

## Programs compared

Both programs operate on exactly the same real HTML5 form from `compact/canonical20/programs/13-form-validation-ui.html`:

- H-Code developer-written source: `compact/canonical20/programs/13-form-validation-ui.hc`, Git blob `67d5766dd1624fb9780639d574a13d15f8a55e6f`.
- Independent idiomatic TypeScript: `compact/canonical20/idiomatic/13-form-validation-ui.ts`, Git blob `716aeede97a7cda7a0e45b0ea638e842f0684ef9`.
- Shared HTML fixture: Git blob `376e62dbc511d8feb137d4c8d05a8e8461b8703a`.
- Generic test probe: `scripts/m19-browser-ui-probe.js`, Git blob `58bfe367b7f26926e360b9045ae28624fd2fb0b8`.
- Original Canonical20 registry: Git blob `46653ef90ffb3e420fba4ddfbfac3c4cfd57f3b3`.

The independent TypeScript source uses normal typed DOM `querySelector`, `addEventListener`, `textContent`, `checkValidity` and `setAttribute` APIs. It contains no H-Code symbols, macros, runtime imports, or padding for benchmarks. Stock Node22's type-stripping API provides browser-executable JS. **The Rust compiler generates browser-executable H-Code ESM from the user-written .hc source.**

## Real browser acceptance and regression

`npm run m19:browser-compare` requires a headless Chromium executable, starts a local-only HTTP fixture server, and runs both programs in **separate fresh real browser sessions** with the same HTML source and exact input/submit DOM events. It checks byte-equivalent stage-by-stage browser traces of:

1. Invalid email and `required` native validity; `aria-invalid=true`, accessible live error text, escaped preview, submit cancellation.
2. An HTML payload in the form value: preview remains plain text, not executable `innerHTML` or an actual image.
3. Six further generated email variants test empty required values, missing hosts, plus-addressing, hyphenated domains and spaces.
4. Valid email: `aria-invalid=false`, cleared live error message, accepted submit and exact preview text.

The H-Code JS reference interpreter has its own DOM host implementation, independently verified in B1. A `git blob` hash mismatch, changed original task criterion, missing stage, unequal actual DOM trace or browser error causes test failure.

## Authored source size, including comments

| Measure | H-Code developer source | Idiomatic TS developer source |
|---|---:|---:|
| Unicode code points | 418 | 705 |
| UTF-8 source bytes | 441 | 705 |
| Reduction against this TS source | **40.71%** | — |
| UTF-8 byte reduction | **37.45%** | — |

The comparison is fairer than the prior correctness-oracle-only task metrics because both programs actually run against the same Chromium fixture. This task **does not reach 70% fewer developer-authored code points**. It is one workload only. The measured Rust-generated browser ESM size is printed separately by the Chrome test; browser/runtime/dependency sizes and execution metrics must never be conflated with developer-written source.

## Gates

- `npm run m19:browser-dom`: Rust-compiled ESM vs independent H-Code JS reference with deterministic DOM event mock on Windows and Ubuntu.
- `npm run m19:browser-real`: actual Chromium acceptance for native H-Code HTML5 form.
- `npm run m19:browser-compare`: real Chromium H-Code-versus-idiomatic-TypeScript event and DOM parity plus codepoint/UTF-8 measurements.
- `cargo test --manifest-path compiler/Cargo.toml --test m19_browser_dom`: native type checker, UTF-8 glyph/ASCII aliases, purity constraints and intrinsic shadowing guards.

This branch depends on PR #52. It must pass exact-head CI, Chrome and CodeQL before it can merge, and complete Canonical13 status promotion requires a strict derived source-locked proof integrated into the Canonical20 evaluator. This document does not change the 12/20 `main` result.
