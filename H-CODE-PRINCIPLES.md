# H-Code — permanent language principles

**This document is normative for the project's direction.** It is a maintained project artifact, not a promise of perfect ChatGPT memory.

## Identity and original idea

- **H-Code is the official name.** It is a new, independent, general-purpose programming language — not a FastSell-specific app builder or a theme system.
- **Actual signs are its primary source syntax.** The project is inspired by the information density of Morse/SOS signaling, **not** by requiring programming to use only dots and dashes.
- A single visible Unicode sign can identify one precisely specified, typed, inspectable operation, potentially a high-level reusable function. It is **not** a hidden instruction or an AI prompt.
- H-Code has its own grammar, tokenizer, AST, type checker, module resolution, library contracts and compiler. Its meaning must be independent of the code editor.
- ASCII text alternatives are mandatory for keyboards, accessibility, reviewers and AI tools, but **they are secondary spellings of the same language**. The meaning and output must remain equivalent.

## Universal programming, not hardcoded app actions

- Developers must be able to write arbitrary algorithms, functions and libraries without relying on a list of prebuilt webshop/game functions.
- H-Code ultimately aims to support backend APIs, sites, complete webshops, games, SaaS, automation, mobile, desktop and system programs through the appropriate language features, target backends and libraries. **Most of this is future work** — do not mark it done because the foundation exists.
- User-defined signs are import-scoped, version-locked and statically contracted. Name collisions and ambiguous signs are errors; package implementation can be audited.
- The initial 15 implemented core signs and their aliases are listed in `docs/SYMBOLS.md`. Reserved `∅`, `∀`, `∈` are not implemented features.

## Measurable compactness

These are **research targets, not achieved results**:

- Target 70% fewer source-code characters for comparable working programs.
- Target 2–5× faster human development through tooling, reusable operations and AI assistance.
- Target 25% fewer AI tokens for matched workloads, with the tokenizer specified and output correctness held constant.

Measure Unicode code points and UTF-8 bytes **separately**; fewer visible characters do not guarantee fewer bytes or faster runtime. Report execution speed, build time, developer effort, readability and tokens independently. Record both gains and regressions. First real results: `phase1/results/source-metrics.json`; methodology in `docs/BENCHMARKS.md`. Larger application benchmarks are still required.

## Reliability, rights and constraints

- The language must compile and run without a paid AI subscription. AI is optional and edits require review.
- A compiler error is better than silent symbol ambiguity or an unversioned dependency.
- Generated JavaScript currently runs with full Node host privileges and is **not sandboxed**. Only run trusted programs. Local Studio is not a public multi-user service.
- Preserve old runnable H-Code programs when hardening the compiler; add conformance tests before semantic changes.
- H-Code Core and the source-shipped Studio use Apache License 2.0; compliant forks and commercial use are permitted under that license. H-Code official brand/trademarks are addressed separately; a registered trademark is not asserted.
- Copyright © 2026 Jonas Fogh Henneberg, operating as Fastsell.net (CVR 46614887), Denmark.

**Do not rename H-Code, reduce it to shortcuts for JavaScript, redefine the signs as visual-only UI, or advertise unmeasured performance.** Any proposed deviation requires an explicit, reviewed change to this document and the language specification.

## Symbol-first invariant reaffirmed (2026-10-18)

**OWNER DIRECTION: HOLD DIG TIL TEGN.** This is a binding product constraint on future milestones, reviews and code changes.

- H-Code syntax must be **sign-first** in source, not a rebranded collection of English keywords. ASCII spellings are accessibility fallbacks, not the design centre.
- Prioritize signs that represent **meaningful typed computation** (e.g. `▷` pipelines, `∘` higher-order composition, proposed `⌕` filter, `⇢` map and `∑` reduction), not superficial abbreviation or syntax translated word-for-word from JavaScript/TypeScript.
- Data types and runtime internals may use conventional names *internally* but developer-facing examples, tutorials and acceptance cases must lead with signs and show that one sign carries an inspectable, general-purpose semantic operation.
- No built-in "webshop" / "paid order" shortcuts used to fake high compression. Typed signs must work with arbitrary user data and user-authored functions; no hidden AI invocation.
- The **70%** goal concerns developer-written source-code Unicode code points versus equivalent working idiomatic code, with UTF-8 bytes/dependencies reported separately. No claims of achievement without matching executable benchmarks.
- Never treat results from **different benchmark corpora** as before/after results for the same code. Fix exact source pairs and revision SHAs, report provenance and version any altered tasks. Keep wins and losses in the same corpus, without retroactively replacing historical results.
- Freeze and preserve M0–M9 milestones and old program behavior; keep additions on development branches with independent parity tests and never imply successful Rust builds before a real run.
