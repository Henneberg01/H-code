# H-Code Phase 1 — Symbol-first foundation (design specification)

**Date:** 2026-10-17  
**State:** Written design for owner review; implementation has **not** been authorized by review of this file.  
**Project:** H-Code — an independent programming language, not a FastSell webshop feature.  
**Rights:** Copyright © 2026 Jonas Fogh Henneberg, operating as Fastsell.net, CVR 46614887, Denmark.  
**License:** Apache-2.0 for the open-source core. H-Code branding is addressed separately in TRADEMARKS.md.

## 1. Intent and non-negotiable outcome

Build **a new, general-purpose programming language in which Unicode signs are actual source-code syntax**. Its guiding metaphor is **Morse-code-style information density**: one visible sign can designate one explicitly defined operation (including a substantial reusable operation with typed inputs and outputs). It is not a hidden prompt, a graphical shorthand, or a collection of canned webshop/game functions. H-Code programs are ordinary, inspectable and compilable source files with their own grammar, AST, static checks and deterministic meaning.

The owner specified that **signs are primary**. Textual spellings remain a secondary, accessible way to type and review programs; they must never become a separate language with different semantics. Every feature must preserve users' freedom to implement algorithms and libraries rather than using a limited app builder. Compiling/running does not require AI.

The goals of **70% fewer source-code characters, 2–5x faster development and 25% fewer AI tokens** are hypotheses/targets, *not promises or achievements*. Runtime speed, source compactness and model token count are different metrics and must be reported separately, including losses.

## 2. Already implemented and to be preserved

This is **hardening Phase 1 (M0–M9)**, **not** rebuilding it. In the current local H-Code project:

- M1 JavaScript reference interpreter has the initial 15 core glyph-to-keyword/operator equivalences, explicit symbol packages, SHA-256-locked manifests, lexical safety checks and matching canonical linked operation IDs.
- M2 Rust lexer, parser, AST and static type checker understand core glyphs and package-operation calls.
- M3–M5 provide a JavaScript backend, local modules and invoice/inventory/savings demonstrations.
- M6–M7 provide local Studio and optional reviewed AI-assisted edits; M8 adds basic execution bounds and HTTP checks. Runtime-generated JavaScript has Node.js host privileges and is **not sandboxed**.
- M9 release/legal documentation and GitHub synchronization exist. This design changes **neither** Apache licensing nor commercial and trademark decisions.

Existing `.hc` programs, `hcode.lock.json`, package manifests and core aliases must continue to parse and run with the same results. No rename of H-Code.

## 3. Candidate designs and selection

**A. Symbol-first, dual spelling (selected).** Glyphs are first-class lexer tokens. A fixed core table and imported packages map glyphs and accessible ASCII names onto the same typed semantic representation. Pros: original invention is reflected in code; deterministic, readable through tooling, compatible with the working compiler and screen readers. Cost: glyph input tools, Unicode rules and learning materials are required.

**B. Replace source with only dots/dashes.** Pros: looks literally Morse-like. Cons: conflicts with number/string/operator syntax, is less human-readable and can lengthen expressions; not the agreed primary visual language. **Rejected.**

**C. Treat glyphs as editor-only abbreviations for TypeScript/JavaScript.** Pros: fastest to prototype. Cons: H-Code would not be an independent programming language or own semantic contracts. **Rejected.**

## 4. Symbol semantics and source representation

### 4.1 Core signs

Preserve the current language-level signs and aliases:

| Sign | Accessible alias | Canonical role |
| --- | --- | --- |
| `ƒ` | `fn` | Declare a function |
| `≔` | `let` | Declare a variable |
| `↩` | `return` | Return from a function |
| `→` | `->` | Function return type delimiter |
| `←` | `=` | Binding initialization/assignment |
| `⊤`, `⊥` | `true`, `false` | Boolean literals |
| `∧`, `∨`, `¬` | `and`, `or`, `not` | Boolean operators |
| `≡`, `≠`, `≤`, `≥` | `==`, `!=`, `<=`, `>=` | Comparisons |
| `∷` | `::` | Qualified package member |

Existing reserved `∅`, `∀`, `∈` remain **reserved, not implemented features**. Never silently assign them meanings during hardening. Parentheses, braces, commas, semicolons, string/number literals and ordinary user-chosen names remain part of real source syntax.

### 4.2 User-defined operations

The current `demo.math@1.0.0` manifest defines real imported operations such as `⊕` (add two Numbers), `▦` (repeat a String twice), `⊙` (positive Number predicate), and `⊗` (factorial). These are **not language-global builtins**. A single glyph must resolve through an explicitly imported, versioned package to a unique operation with typed parameters, return type, effect declaration and inspectable H-Code implementation.

Actual supported example (the two calls refer to the same version-locked implementation):

```hcode
use "demo.math@1.0.0" as math;
≔ answer ← ⊕(20, 22);
print(answer);
```

```hcode
use "demo.math@1.0.0" as math;
let answer = math::add(20, 22);
print(answer);
```

The same symbol in two simultaneously imported packages is ambiguous unless written with an explicit namespace (e.g. `math∷⊕`). Unknown signs and core-sign collisions must fail with actionable diagnostics. Do **not** inject hidden implementation logic based on a glyph's visual appearance.

### 4.3 Canonical lowering and Unicode safety

```
UTF-8 .hc source (sign-first or accessible alias)
  -> NFC normalization and forbidden-character validation
  -> token stream (same semantic token kinds for core aliases)
  -> parser / AST
  -> explicit package import + versioned SHA-256 resolution
  -> unique canonical OperationRef + type/effect checks
  -> equivalent checked IR/codegen -> same program behavior
```

Keep existing restrictions: unsafe control/bidi/default-ignorable Unicode is rejected; user glyphs are a single acceptable Unicode symbol scalar value that is NFC/NFKC stable; no redefinition of reserved core symbols; no unpinned dynamic package resolution. If the JavaScript and Rust frontends currently disagree, document/reproduce that mismatch **before** fixing one side.

## 5. Hardening scope (the first implementable slice)

1. **Regression baseline:** run JS reference tests, Rust compiler tests, Studio tests and the release checker on the same revision. Record exact versions, counts, failures and branch SHA. Do not treat historical 86/86 as a fresh run.
2. **Glyph-first conformance fixtures:** add meaningful `.hc` glyph programs alongside equivalent text-alias programs; compare canonical AST/typed results (ignoring source spans), stdout and generated JavaScript behavior. Include recursive functions, Boolean expressions and version-locked library calls. Confirm that glyphs work as language tokens **without editor preprocessing or network access**.
3. **Symbol-linking adversarial cases:** tests for duplicate/ambiguous glyph imports, reserved glyph hijacking, invisible and normalization-confusable glyphs, unknown operations, invalid contract types, and changed manifest/source hashes. Preserve error quality in both frontends.
4. **Reproducible compactness measurements:** add a small offline measurement tool with documented fixtures and machine-readable results; count visible code points, UTF-8 bytes and nonblank logical lines separately for glyph/text variants. Additionally report generated-code sizes, compile+run timings and token counts only when a pinned tokenizer is actually available. Never invent an AI token-savings figure or claim execution speedups from shorter source.
5. **Developer usability/documentation:** put the **symbol spelling first** in tutorials, examples and Studio glyph palette while still showing searchable readable aliases, explicit operation contracts and keyboard input methods. Keep tools accessible and diff-friendly; provide a clear diagnostic if a glyph is missing or ambiguous.
6. **Reviewability:** keep each step isolated in a GitHub feature branch with tests, no automatic merge, release, cloud deployment or repository visibility changes. Update the persistent roadmap and the known limitations when actual results are available.

Not in this slice: a new symbol-declaration DSL; hundreds of unreviewed signs; effects/permissions redesign; unsafe macros; a package registry; generalized collections/generics; WASM/native/game/commerce runtimes; replacing the existing codebase; commercialization UI. These belong to later explicit designs.

## 6. Verification and success criteria

### Functional gates

- Existing `npm test`, `cargo test --manifest-path compiler/Cargo.toml`, `npm run studio:test` and `npm run release:check` remain green; previously reported baseline is 39 + 34 + 13 = **86**, but a fresh run is required.
- At least **four** pairwise equivalent fixtures exercise core glyph declarations/control flow and a version-locked imported operation; output, checked semantic meaning and module resolution agree with the accessible spellings.
- An unknown, ambiguous or forbidden sign is **never** silently reinterpreted. Manifest/source tampering invalidates resolution.
- No regression in the existing `examples/`, `m4/` or `m5/` workflows.
- The generated/compiled path uses ordinary compiler and runtime machinery, not Studio text expansion or an AI round trip.

### Measurement gates

- Benchmarks distinguish **code points vs UTF-8 bytes**: a Unicode glyph can be one visible character but two or three bytes. Reports must state both; a glyph is not automatically a byte reduction.
- Compare same algorithms and equivalent outputs under a pinned toolchain; include raw data and reproducible commands.
- Benchmark native H-Code execution/build costs independently of source length and of developer task duration. Report median and spread across enough runs, with limitations.
- Compare AI tokens only with a specified tokenizer and equivalent prompt/workload; mark unavailable data explicitly as `not measured`.
- The 70%/2–5x/25% ambitions **do not block a technically correct implementation**; measured regressions must remain visible.

### Documentation and governance

- This signed-off design and subsequent implementation plan/PR are discoverable in GitHub; the project's phase 1 progress journal names completed tests and the remaining work.
- Apache-2.0 remains in force, with © 2026 Jonas Fogh Henneberg / Fastsell.net, CVR 46614887, Denmark. Open source copying under Apache terms is permitted; official brand rights stay separate.
- H-Code is not marketed as fully universal, production secure, significantly faster or 70% smaller until objective test evidence supports the specific claim.

## 7. Integration interfaces and failure handling

| Responsibility | Existing implementation | Required guarantee |
| --- | --- | --- |
| Token + glyph canonicalization | `prototype/src/hcode.mjs`, `compiler/src/lexer.rs` | Signs and aliases denote equal core token kinds; source spans can differ |
| AST and semantic binding | `prototype/src/hcode.mjs`, `compiler/src/parser.rs`, `compiler/src/checker.rs` | Identical language meaning, stable error classes; no unresolved glyph execution |
| Package manifests/lock | `prototype/src/packages.mjs`, `compiler/src/packages.rs` | Explicit imports, typed/versioned definitions, SHA-256 validation |
| JS execution | `compiler/src/codegen.rs`, `prototype/bin/hcode.mjs` | Verified equivalent outputs; **never** claim sandbox security |
| Studio | `studio/public/*`, `studio/server.mjs` | Signs appear as characters in saved .hc source; alias/help available, no online dependency |
| Benchmarks | `docs/BENCHMARKS.md`, future offline harness | Reproducible truthful measurements; no fictitious token/time results |

If validation fails, the compiler must stop with a bounded, source-located error. If a package glyph conflicts, require qualified reference; do not pick a package automatically. If performance data is unavailable, mark it missing rather than publishing estimates. Test suites must reveal rather than conceal backend differences.

## 8. Planned delivery order (after explicit approval of this written design)

- **Slice 1:** regression + glyph parity fixtures (test-first) and provenance; no language redesign.
- **Slice 2:** repair reproducible JS/Rust symbol or error-message discrepancies found by Slice 1, preserving legacy syntax.
- **Slice 3:** offline compactness benchmark harness + fixture report, clearly separated metrics.
- **Slice 4:** glyph-first examples/Studio documentation and continuity update, followed by whole-branch review.

Implementation planning, branch changes and acceptance will follow the documented superpowers plan workflow. A separate review decides whether to merge anything into `main`.

## 9. Risks and open technical choices

- **Unicode usability:** keyboard layouts, font coverage, screen reader names and homoglyph confusables may counteract brevity. Mitigation: pinned code points, accessible names and input shortcuts.
- **Metric gaming:** counting signs instead of bytes or comparing to verbose baselines can falsely imply large wins. Mitigation: report all sizes, matched workloads and honest limitations.
- **Compiler divergence:** M1 JS and M2+ Rust may differ on obscure normalization, package effects or errors. Mitigation: cross-backend conformance tests before changes.
- **Security:** generated JS operates with Node privileges and Studio is localhost only. Mitigation: trusted programs only, no exposure to untrusted input; security redesign is out of scope.
- **Language readability:** excessive overloaded signs can be slower for humans. Mitigation: small stable core, explicit typed operation manifests, discoverable alias/help.

**Owner-review decision requested:** Approve this *written specification*, especially the symbol-first/secondary-alias design, the four-slice scope and the non-retroactive compatibility guarantee, before a detailed executable implementation plan is created.
