# Canonical 20-task H-Code benchmark — immutable preregistration and independent compiler evidence

**Status: NOT COMPLETE.** This repository contains a **fixed inventory** of the same 20 real programming tasks originally named in `docs/BENCHMARKS.md`; it is not a new handpicked set of short programs. The work is staged early for M19/M58, **without changing M15's planned compact delimiter milestone**.

Source registry: `compact/canonical20/workloads.json`; coverage checker: `npm run benchmark20:status` on Node22+. The registered source is anchored to Git blob SHA `46653ef90ffb3e420fba4ddfbfac3c4cfd57f3b3` from the original M19 preregistration. Rewriting the scope requires an explicit new reviewed registry version, not silent benchmark edits. All twenty IDs, category requirements and acceptance criteria are recorded so that skipped work cannot disappear from the denominator.

**Current state on `main` after PRs #30 and #31: 5/20 functionally compiler-verified, 0/20 partial references, 15/20 unsupported.** The initial manifest JSON retains its original pre-implementation statuses and Git blob SHA; **separate SHA-locked proof harnesses derive full verification only when each task's actual Rust/JS/TypeScript execution passes**. Do not modify the twenty IDs or call a registry field a test.

Task **03 — Unicode token frequency** uses three real typed core signs: `⫶` splits Unicode scalars, `⟟` tokenizes NFC-normalized lowercased Unicode words and `⧉` counts/sorts typed values. The full immutable task includes 10 fixed Unicode examples, 28 unseen input strings, six Rust typecheck failures, five generic primitive programs, and rejection of excessive token counts; all three engines must agree. Full authored source is **437 H-Code vs 1,541 TypeScript codepoints = 71.64% fewer**; UTF-8 **499 vs 1,592 bytes = 68.66% fewer**. Generated JS is **8,970 bytes**. Neither the original task ID/acceptance nor its neighboring workloads were changed. See `compact/canonical20/PROOF-03.md`.

Task **04 — typed CSV validation** introduces true core symbols `⧄` (opt-in local file reading) and `⧇` (typed pure CSV decoding), with Rust parser/checker/emitter, independent JS reference, SHA-locked four valid and six invalid CSV files, forty generated datasets, five bad-type programs and capability/path-traversal tests. The original standalone TS source is a **correctness oracle**, not the fair baseline. A separate **maintained-library TypeScript comparator** (draft PR #32) installs SHA-512-pinned csv-parse/Zod and measures **all 3,362 developer-authored TS codepoints versus 258 H-Code codepoints (92.33% fewer for *this one task*)**, plus each library's installed bytes separately. Neither figure is the global 20-task median. See `compact/canonical20/PROOF-04.md`.

Task **05 — JSON transformation** now runs a complete, typed, nested JSON record transformation: true Rust H-Code compiler→JS, independent JavaScript H-Code interpreter and Node TypeScript runtime. The proof is **3 immutable positive fixtures + 12 generated positive variations + 11 invalid input cases**, with matching outputs and fail-closed malformed input rejection across all engines. `npm run benchmark20:verify05`; source and fixture Git blob SHAs are fixed. Its authored source is 594 H-Code vs 2,005 TS Unicode codepoints (70.37% fewer **on task 05 only**); 651 vs 2,007 UTF-8 bytes (67.56% fewer), generated JS 6,560 bytes tracked separately. See `compact/canonical20/PROOF-05.md`.

Task **02 — Fibonacci recursion** now uses exactly its original M10-pinned source (96 H-Code codepoints versus 94 TypeScript) for a complete independent Rust→JS, H-Code JS reference and Node TypeScript conformance proof. It includes n=7→13, 16 different n values, and 3 static type-error cases. The original H-Code is **2.13% longer** than TS; do not hide this regression. An additional **separate candidate** with compact built-in signs (`↩ ≤ ?`) is 64 codepoints (31.91% fewer than the same TS), and must pass the same 16-case Rust/JS parity. The original source remains byte-for-byte SHA-frozen; the optimized one is never silently substituted. See `compact/canonical20/PROOF-02.md`.

Task **10 — typed sum/map/filter** now executes the original **three unchanged SHA-frozen M14 H-Code programs in the real Rust compiler**, validates them against their historical TypeScript baselines (68.46% median *on those three*), and separately verifies one new complete source-locked program covering 11 concrete typed transformations across Number, String, Bool, records, nested sequences and typed empty lists. The full proof adds 19 generated variable input sets (47 expected outputs) and 6 static type failures, all using the actual language, not a hidden app-specific package. It achieves **505 vs 836 developed codepoints = 39.59% fewer** and **645 vs 836 UTF-8 bytes = 22.85% fewer**, with 7,305 generated JS bytes tracked separately. Source locks and evidence: `compact/canonical20/PROOF-10.md`.


The other **15 tasks are explicitly unsupported/unverified** and remain counted. Thus **5/20 fully verified**, **0/20 partial references**, **15/20 unsupported** in the calculated evidence view. This is not evidence of reaching 70% across actual products or apps. Even though M14's Rust/Node CI is now green for the three narrow collections examples, those are not a substitute for a complete CRUD API, auth session system, file converter or browser app.

The checker **still refuses arbitrary `status: verified` labels**. Workloads 02, 03, 04, 05 and 10 are counted as fully verified only by separately executing their source-SHA-locked, compiler-generated program and a TypeScript baseline with the full positive/negative fixture contract. A JSON label alone cannot manufacture a green benchmark.

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

The next technical work should target real general-purpose I/O and validated CSV parsing, not one-off app macros. Any new glyph must **replace** developer-authored syntax and pass semantic parity; then use the unchanged workload fixtures to determine which larger tasks can be fully implemented. Symbol-first compression is the design criterion, but I/O, auth and UI require real runtimes, not a deceptive single-character stand-in for hidden unsupported effects.

**Historical data separation:** `npm run m14:measure` still verifies its original 3-case median **68.46% fewer Unicode codepoints**, which is *not* the twenty-task score. M16.3 independently reduces the *two-function package microcase* to 159 H-Code vs 230 TS codepoints, including package authoring; it must not replace M14's score either.

### Use

```sh
npm run benchmark20:verify04
# after npm ci --prefix compact/canonical20/baselines/04-idiomatic-typescript:
npm run benchmark20:csv-idiomatic
npm run benchmark20:verify03
npm run benchmark20:verify10
npm run benchmark20:verify02
npm run benchmark20:verify05
npm run benchmark20:status
npm run benchmark20:test
npm run benchmark20:strict # expected exit 2 until all 20 are verified
```

The `verifyNN` commands execute the frozen task suites. `status` prints a machine-readable derived coverage report; `strict` intentionally fails until all 20 are compiler-verified. No hidden AI/opaque prebuilt webshop macros, no invented runtimes and no omitted failing cases.

**Definition of done (M58):** all 20 tasks implemented and proved with identical acceptance tests, appropriate idiomatic TypeScript baselines, pinned Git SHA files, correct Rust backend outputs, Unicode code-point and byte counts plus dependency and generated-size metrics. Only then compute the median and evaluate `≥70%`.
