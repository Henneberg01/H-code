# Canonical 20-task H-Code benchmark — immutable preregistration and independent compiler evidence

**Status: NOT COMPLETE.** This repository contains a **fixed inventory** of the same 20 real programming tasks originally named in `docs/BENCHMARKS.md`; it is not a new handpicked set of short programs. The work is staged early for M19/M58, **without changing M15's planned compact delimiter milestone**.

Source registry: `compact/canonical20/workloads.json`; coverage checker: `npm run benchmark20:status` on Node22+. The registered source is anchored to Git blob SHA `46653ef90ffb3e420fba4ddfbfac3c4cfd57f3b3` from the original M19 preregistration. Rewriting the scope requires an explicit new reviewed registry version, not silent benchmark edits. All twenty IDs, category requirements and acceptance criteria are recorded so that skipped work cannot disappear from the denominator.

**Current state on the stacked #27 branch with successful collection proof: 3/20 full compiler-verified, 0/20 partial references, 17/20 unsupported.** The initial manifest JSON retains its original pre-implementation statuses and Git blob SHA; **a separate SHA-locked proof harness derives full verification for task 05**. Do not modify the twenty IDs or call a registry field a test.

Task **05 — JSON transformation** now runs a complete, typed, nested JSON record transformation: true Rust H-Code compiler→JS, independent JavaScript H-Code interpreter and Node TypeScript runtime. The proof is **3 immutable positive fixtures + 12 generated positive variations + 11 invalid input cases**, with matching outputs and fail-closed malformed input rejection across all engines. `npm run benchmark20:verify05`; source and fixture Git blob SHAs are fixed. Its authored source is 594 H-Code vs 2,005 TS Unicode codepoints (70.37% fewer **on task 05 only**); 651 vs 2,007 UTF-8 bytes (67.56% fewer), generated JS 6,560 bytes tracked separately. See `compact/canonical20/PROOF-05.md`.

Task **02 — Fibonacci recursion** now uses exactly its original M10-pinned source (96 H-Code codepoints versus 94 TypeScript) for a complete independent Rust→JS, H-Code JS reference and Node TypeScript conformance proof. It includes n=7→13, 16 different n values, and 3 static type-error cases. The original H-Code is **2.13% longer** than TS; do not hide this regression. An additional **separate candidate** with compact built-in signs (`↩ ≤ ?`) is 64 codepoints (31.91% fewer than the same TS), and must pass the same 16-case Rust/JS parity. The original source remains byte-for-byte SHA-frozen; the optimized one is never silently substituted. See `compact/canonical20/PROOF-02.md`.

Task **10 — typed sum/map/filter** now executes the original **three unchanged SHA-frozen M14 H-Code programs in the real Rust compiler**, validates them against their historical TypeScript baselines (68.46% median *on those three*), and separately verifies one new complete source-locked program covering 11 concrete typed transformations across Number, String, Bool, records, nested sequences and typed empty lists. The full proof adds 19 generated variable input sets (47 expected outputs) and 6 static type failures, all using the actual language, not a hidden app-specific package. It achieves **505 vs 836 developed codepoints = 39.59% fewer** and **645 vs 836 UTF-8 bytes = 22.85% fewer**, with 7,305 generated JS bytes tracked separately. Source locks and evidence: `compact/canonical20/PROOF-10.md`.


The other **17 tasks are explicitly unsupported/unverified** and remain counted. Thus **3/20 fully verified**, **0/20 partial references**, **17/20 unsupported** in the calculated evidence view. This is not evidence of reaching 70% across actual products or apps. Even though M14's Rust/Node CI is now green for the three narrow collections examples, those are not a substitute for a complete CRUD API, auth session system, file converter or browser app.

The checker **still refuses arbitrary `status: verified` labels**. Workloads 02, 05 and 10 are counted as fully verified only by separately executing their source-SHA-locked, compiler-generated program and a TypeScript baseline with the full positive/negative fixture contract. A JSON label alone cannot manufacture a green benchmark.

### What we build next: evidence-driven language primitives

The status command also reports **required capabilities across all unverified workloads**. This is the immutable registration's demand tally, **not** a claim about which features the current compiler already has:

| Required capability in unverified tasks | Workloads requiring it |
|---|---:|
| `records` | 4 |
| `async` | 3 |
| `multi-file-project` | 3 |
| `dom` | 2 |
| `filesystem-read` | 2 |
| `http-client` | 2 |
| `http-server` | 2 |
| `map` | 2 |
| `test-runner` | 2 |
| `ui-events` | 2 |

The next technical work should target reusable constructs, beginning with typed records and compiler-enforced access, not one-off app macros. Any new glyph must **replace** developer-authored syntax and pass semantic parity; then use the unchanged workload fixtures to determine which larger tasks can be fully implemented. Symbol-first compression is the design criterion, but I/O, auth and UI require real runtimes, not a deceptive single-character stand-in for hidden unsupported effects.

**Historical data separation:** `npm run m14:measure` still verifies its original 3-case median **68.46% fewer Unicode codepoints**, which is *not* the twenty-task score. M16.3 independently reduces the *two-function package microcase* to 159 H-Code vs 230 TS codepoints, including package authoring; it must not replace M14's score either.

### Use

```sh
npm run benchmark20:verify10
npm run benchmark20:verify02
npm run benchmark20:verify05
npm run benchmark20:status
npm run benchmark20:test
npm run benchmark20:strict # expected exit 2 until all 20 are verified
```

First prints a sourced, machine-readable honest coverage report; the second intentionally fails while the 20-task suite is incomplete. No hidden AI/opaque prebuilt webshop macros, no invented runtimes and no omitted failing cases.

**Definition of done (M58):** all 20 tasks implemented and proved with identical acceptance tests, appropriate idiomatic TypeScript baselines, pinned Git SHA files, correct Rust backend outputs, Unicode code-point and byte counts plus dependency and generated-size metrics. Only then compute the median and evaluate `≥70%`.
