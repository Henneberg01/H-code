# Canonical 20-task H-Code benchmark — preregistration only

**Status: NOT COMPLETE.** This repository contains a **fixed inventory** of the same 20 real programming tasks originally named in `docs/BENCHMARKS.md`; it is not a new handpicked set of short programs. The work is staged early for M19/M58, **without changing M15's planned compact delimiter milestone**.

Source registry: `compact/canonical20/workloads.json`; coverage checker: `npm run benchmark20:status` on Node22+. The registered source is anchored to Git blob SHA `46653ef90ffb3e420fba4ddfbfac3c4cfd57f3b3` from the original M19 preregistration. Rewriting the scope requires an explicit new reviewed registry version, not silent benchmark edits. All twenty IDs, category requirements and acceptance criteria are recorded so that skipped work cannot disappear from the denominator.

Of the twenty, only two presently have **partial reference evidence**:

- Workload **02**, Fibonacci: a pinned M10 recursion example plus its unchanged TypeScript counterpart. It does not yet constitute full production-language coverage.
- Workload **10**, generic collections: three pinned M14 sum/map/filter examples plus their unchanged idiomatic TypeScript counterparts. A full generics/library/productivity task needs wider tests.

The other **18 tasks are explicitly unsupported/unverified** and remain counted. Thus **0/20 fully verified**, **2/20 partial references**, **18/20 unsupported** in this manifest. This is not evidence of reaching 70% across actual products or apps. Even though M14's Rust/Node CI is now green for the three narrow collections examples, those are not a substitute for a complete CRUD API, auth session system, file converter or browser app.

The checker intentionally refuses `status: verified` until a future implementation adds an exact-SHA compiler-generated execution artifact and idiomatic TypeScript parity for the *full* workload. A JSON label cannot by itself manufacture a green benchmark.

### What we build next: evidence-driven language primitives

The status command also reports **required capabilities across all unverified workloads**. This is the immutable registration's demand tally, **not** a claim about which features the current compiler already has:

| Required capability in unverified tasks | Workloads requiring it |
|---|---:|
| `records` | 5 |
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
npm run benchmark20:status
npm run benchmark20:test
npm run benchmark20:strict # expected exit 2 until all 20 are verified
```

First prints a sourced, machine-readable honest coverage report; the second intentionally fails while the 20-task suite is incomplete. No hidden AI/opaque prebuilt webshop macros, no invented runtimes and no omitted failing cases.

**Definition of done (M58):** all 20 tasks implemented and proved with identical acceptance tests, appropriate idiomatic TypeScript baselines, pinned Git SHA files, correct Rust backend outputs, Unicode code-point and byte counts plus dependency and generated-size metrics. Only then compute the median and evaluate `≥70%`.
