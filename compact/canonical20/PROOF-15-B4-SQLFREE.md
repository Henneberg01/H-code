# M19.15 B4 — SQL-free, complete H-Code dashboard candidate

**Status:** candidate awaiting exact-head Rust/JS/SQLite/Chromium/CodeQL and Windows/Ubuntu CI. Not yet accepted or merged; do not promote Canonical15 or claim all twenty H-Code tasks meet 70%.

## Same functionality, symbolic developer source

The user-authored backend `compact/canonical20/candidates/15-db-dashboard-sqlfree-b4.hc` (Git blob `250bfa1c78da2f6e4affb23f478fd421ba3ef6cc`) reads a **real existing SQLite file** with permission, applies date/status filters, totals, per-region grouping and deterministic ranking. It uses only general H-Code glyphs: `⧈`, `⌕`, `⇢`, `⧉`, `∑`, `↥`, `↧`, `⤓`, `⤒`, `⎙`. No SQL is authored in this candidate and no domain-specific macro is added. The original B3 program is **not modified**. The browser source stays the SHA-locked `15-db-dashboard-ui.hc` and continues to render semantic, escaped HTML against the independently authored TS browser comparator.

The **↥** primitive is native Rust AST/typechecked `⟦T⟧ × (T→String) → ⟦T⟧` and independently interpreted by the JS reference. It performs a stable ascending Unicode scalar String key sort with one key evaluation per element. Paired with native **↧** numeric descending sort it delivers descending revenue, ascending region on revenue ties without falling back to a 20-line manual selection sort. Side-effect-denying callbacks are mandatory in both runtimes.

## Frozen source comparison (before correctness sign-off)

| Developer-authored component | Unicode codepoints | UTF-8 bytes |
|---|---:|---:|
| New H-Code backend | 592 | 712 |
| Original unchanged H-Code browser | 674 | 732 |
| **Total H-Code candidate** | **1,266** | **1,444** |
| Original independent TypeScript backend | 2,059 | 2,059 |
| Original independent TypeScript browser | 3,429 | 3,429 |
| **Total TypeScript** | **5,488** | **5,488** |

Reduction: **76.93% fewer Unicode codepoints**, **73.69% fewer UTF-8 bytes** *for Canonical15 only*, not the median of all twenty tasks. Compiler, generated ESM, host dependencies and test infrastructure are separately reported/excluded consistently. The stricter TypeScript invalid-ISO-date rejection is not yet matched by this H-Code application; positive data equivalence is the acceptance scope, and that difference must not be concealed.

## Proof required

Run `cargo test --manifest-path compiler/Cargo.toml --test m19_sort_text` and `node --test scripts/m19-sort-text.test.mjs` for native glyph/alias, typing and Unicode scalar parity. Run `node --experimental-sqlite --experimental-strip-types --test scripts/m19-sqlfree-dashboard.test.mjs` to compare all five frozen cases with independent TypeScript, old source-locked Rust/JS implementation and new SQL-free Rust/JS implementation, plus Unicode tie-breaking adversaries and denial of host DB access. Preserve original Git blob locks, CodeQL and full conformance, including the existing true Chromium proof. No acceptance without all checks on the same head SHA.
