# Canonical 20-task H-Code benchmark — immutable preregistration and independent compiler evidence

**Status: NOT COMPLETE.** This repository contains a **fixed inventory** of the same 20 real programming tasks originally named in `docs/BENCHMARKS.md`; it is not a new handpicked set of short programs. The work is staged early for M19/M58, **without changing M15's planned compact delimiter milestone**.

Source registry: `compact/canonical20/workloads.json`; coverage checker: `npm run benchmark20:status` on Node22+. The registered source is anchored to Git blob SHA `46653ef90ffb3e420fba4ddfbfac3c4cfd57f3b3` from the original M19 preregistration. Rewriting the scope requires an explicit new reviewed registry version, not silent benchmark edits. All twenty IDs, category requirements and acceptance criteria are recorded so that skipped work cannot disappear from the denominator.

**Current calculated state with M19.06 source-locked proof: 7/20 compiler-verified, 0/20 partial references, 13/20 unsupported, contingent on the end-to-end Windows/Linux gates.** The initial manifest JSON retains its original pre-implementation statuses and Git blob SHA; **separate SHA-locked proof harnesses derive full verification only when each task's actual Rust/JS/TypeScript execution passes**. Do not modify the twenty IDs or call a registry field a test.

Task **01 — stdin arithmetic CLI** implements real typechecked `⌨` (stdin String effect) and `⩚` (pure String→Number arithmetic parser), with exactly 17 frozen valid and 15 invalid command-line inputs, 64 independently expected generated arithmetic expressions, input byte/UTF-8 limits, negative Rust types, byte-exact stdout/stderr/process status, and real `hcodec run` CLI parity on Windows/Linux. Original authored source is **11 codepoints / 15 bytes**, and the handwritten TypeScript correctness oracle remains at **2,365 codepoints**, but is *not* a competitive source baseline. A separately tested, exact-SHA-pinned maintained library comparator in PR #34 uses `@expr-eval/js@3.7.0`: **11 H-Code versus 2,786 all-authored TS codepoints = 99.61% fewer on *task 01 only***, plus 121,201 installed library bytes, 6,255 Rust-compiled JS bytes and distinct package metadata tracked outside author source. See PROOF-01.md. See `compact/canonical20/PROOF-01.md`.

Task **03 — Unicode token frequency** uses three real typed core signs: `⫶` splits Unicode scalars, `⟟` tokenizes NFC-normalized lowercased Unicode words and `⧉` counts/sorts typed values. The full immutable task includes 10 fixed Unicode examples, 28 unseen input strings, six Rust typecheck failures, five generic primitive programs, and rejection of excessive token counts; all three engines must agree. Full authored source is **437 H-Code vs 1,541 TypeScript codepoints = 71.64% fewer**; UTF-8 **499 vs 1,592 bytes = 68.66% fewer**. Generated JS is **8,970 bytes**. Neither the original task ID/acceptance nor its neighboring workloads were changed. See `compact/canonical20/PROOF-03.md`.

Task **04 — typed CSV validation** introduces true core symbols `⧄` (opt-in local file reading) and `⧇` (typed pure CSV decoding), with Rust parser/checker/emitter, independent JS reference, SHA-locked four valid and six invalid CSV files, forty generated datasets, five bad-type programs and capability/path-traversal tests. The original standalone TS source is a **correctness oracle**, not the fair baseline. A separate **maintained-library TypeScript comparator** (merged PR #32) installs SHA-512-pinned csv-parse/Zod and measures **all 3,362 developer-authored TS codepoints versus 258 H-Code codepoints (92.33% fewer for *this one task*)**, plus each library's installed bytes separately. Neither figure is the global 20-task median. See `compact/canonical20/PROOF-04.md`.

Task **05 — JSON transformation** now runs a complete, typed, nested JSON record transformation: true Rust H-Code compiler→JS, independent JavaScript H-Code interpreter and Node TypeScript runtime. The proof is **3 immutable positive fixtures + 12 generated positive variations + 11 invalid input cases**, with matching outputs and fail-closed malformed input rejection across all engines. `npm run benchmark20:verify05`; source and fixture Git blob SHAs are fixed. Its authored source is 594 H-Code vs 2,005 TS Unicode codepoints (70.37% fewer **on task 05 only**); 651 vs 2,007 UTF-8 bytes (67.56% fewer), generated JS 6,560 bytes tracked separately. See `compact/canonical20/PROOF-05.md`.

Task **02 — Fibonacci recursion** now uses exactly its original M10-pinned source (96 H-Code codepoints versus 94 TypeScript) for a complete independent Rust→JS, H-Code JS reference and Node TypeScript conformance proof. It includes n=7→13, 16 different n values, and 3 static type-error cases. The original H-Code is **2.13% longer** than TS; do not hide this regression. An additional **separate candidate** with compact built-in signs (`↩ ≤ ?`) is 64 codepoints (31.91% fewer than the same TS), and must pass the same 16-case Rust/JS parity. The original source remains byte-for-byte SHA-frozen; the optimized one is never silently substituted. See `compact/canonical20/PROOF-02.md`.

Task **10 — typed sum/map/filter** now executes the original **three unchanged SHA-frozen M14 H-Code programs in the real Rust compiler**, validates them against their historical TypeScript baselines (68.46% median *on those three*), and separately verifies one new complete source-locked program covering 11 concrete typed transformations across Number, String, Bool, records, nested sequences and typed empty lists. The full proof adds 19 generated variable input sets (47 expected outputs) and 6 static type failures, all using the actual language, not a hidden app-specific package. It achieves **505 vs 836 developed codepoints = 39.59% fewer** and **645 vs 836 UTF-8 bytes = 22.85% fewer**, with 7,305 generated JS bytes tracked separately. Source locks and evidence: `compact/canonical20/PROOF-10.md`.


The other **13 tasks are explicitly unsupported/unverified** and remain counted in the fixed corpus. Thus **7/20 fully verified**, **0/20 partial references**, **13/20 unsupported** in the calculated evidence view. This is not evidence of reaching 70% across actual products or apps. Even though M14's Rust/Node CI is now green for the three narrow collections examples, those are not a substitute for a complete CRUD API, auth session system, file converter or browser app.

The checker **still refuses arbitrary `status: verified` labels**. Workloads 01, 02, 03, 04, 05, 06 and 10 are counted as fully verified only by separately executing their source-SHA-locked, compiler-generated program and a TypeScript baseline with the full positive/negative fixture contract. A JSON label alone cannot manufacture a green benchmark.

**Task 06 — symbol-native HTTP retries:** the Rust compiler implements real effectful `⤋` (typed allowlisted HTTP GET), `⏳` (bounded asynchronous delay) and `⎙` (intrinsic print sign), while source-level `⟳` / `⊢` / `⊣` implement the entire bounded retry algorithm. A separate independent JS H-Code interpreter uses a bounded effect journal and real injected HTTP host. Six original SHA-frozen HTTP sequences and **12 deterministic unseen variants** execute as real HTTP requests in the Rust-generated program, JS reference and idiomatic TypeScript comparator; one full network-failure case verifies four bounded attempts. The source is **707 H-Code vs 3,112 TypeScript codepoints (77.28% fewer for task06 alone)** and 895 vs 3,112 UTF-8 bytes (71.24% fewer); generated JavaScript and dependencies are counted separately. The original registry and cases remain byte-frozen. Run `npm run benchmark20:verify06`. See `compact/canonical20/PROOF-06.md`.

### What we build next: evidence-driven language primitives

The status command also reports **required capabilities across all unverified workloads**. This is the immutable registration's demand tally, **not** a claim about which features the current compiler already has:

| Required capability in unverified tasks | Workloads requiring it |
|---|---:|
| `records` | 3 |
| `async` | 2 |
| `multi-file-project` | 3 |
| `dom` | 2 |
| `filesystem-read` | 1 |
| `http-client` | 1 |
| `http-server` | 2 |
| `map` | 2 |
| `test-runner` | 2 |
| `ui-events` | 2 |

After task 01, the next technical work should target reusable HTTP/async/effect primitives to support original task 06, not one-off app macros. Any new glyph must **replace** developer-authored syntax and pass semantic parity; then use the unchanged workload fixtures to determine which larger tasks can be fully implemented. Symbol-first compression is the design criterion, but I/O, auth and UI require real runtimes, not a deceptive single-character stand-in for hidden unsupported effects.

**Historical data separation:** `npm run m14:measure` still verifies its original 3-case median **68.46% fewer Unicode codepoints**, which is *not* the twenty-task score. M16.3 independently reduces the *two-function package microcase* to 159 H-Code vs 230 TS codepoints, including package authoring; it must not replace M14's score either.

### Use

```sh
npm run benchmark20:verify01
# after npm ci --prefix compact/canonical20/baselines/01-idiomatic-typescript:
npm run benchmark20:calc-idiomatic
npm run benchmark20:verify04
# after npm ci --prefix compact/canonical20/baselines/04-idiomatic-typescript:
npm run benchmark20:csv-idiomatic
npm run benchmark20:verify03
npm run benchmark20:verify10
npm run benchmark20:verify02
npm run benchmark20:verify05
npm run benchmark20:verify06
npm run benchmark20:status
npm run benchmark20:test
npm run benchmark20:strict # expected exit 2 until all 20 are verified
```

The `verifyNN` commands execute the frozen task suites. `status` prints a machine-readable derived coverage report; `strict` intentionally fails until all 20 are compiler-verified. No hidden AI/opaque prebuilt webshop macros, no invented runtimes and no omitted failing cases.

**Definition of done (M58):** all 20 tasks implemented and proved with identical acceptance tests, appropriate idiomatic TypeScript baselines, pinned Git SHA files, correct Rust backend outputs, Unicode code-point and byte counts plus dependency and generated-size metrics. Only then compute the median and evaluate `≥70%`.
